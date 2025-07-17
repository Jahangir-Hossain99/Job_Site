// backend/routes/jobs.js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken'; // Import jwt for getJobById's AI notification

import Job from '../models/Job.js';
import User from '../models/User.js'; // For AI recommendations
import Company from '../models/Company.js'; // For populating company data in jobs and AI logic
import { verifyToken, authorizeRoles } from '../utils/auth.js';
import aiApiClient from '../utils/aiApiClient.js'; // AI service client

// Helper for consistent Mongoose validation errors
const handleMongooseError = (res, err) => {
    console.error("Mongoose Error:", err); // Log the full error for debugging
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    if (err.code === 11000) { // Duplicate key error
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ message: `Duplicate field value: ${field} already exists.` });
    }
    res.status(500).json({ message: err.message || 'Server error' });
};

// --- ROUTES ---

// @route   POST /jobs
// @desc    Create a new job posting
// @access  Private (Company, Admin)
router.post('/', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => {
    try {
        const { user } = req; // Authenticated user from JWT payload
        
        let companyIdToAssociate;

        if (user.role === 'company') {
            // If the authenticated user is a company, the job is for *their* company.
            companyIdToAssociate = user.id;
        } else { // user.role === 'admin'
            // If the authenticated user is an admin, they must explicitly provide the company ID in the request body.
            if (!req.body.company) {
                 return res.status(400).json({ message: 'Admin must specify a company ID in the request body to post a job.' });
            }
            companyIdToAssociate = req.body.company;
            // Validate if the provided companyIdToAssociate is a valid Company
            const companyExists = await Company.findById(companyIdToAssociate);
            if (!companyExists) {
                return res.status(400).json({ message: 'Invalid company ID provided by admin for job posting.' });
            }
        }

        // Create new job instance
        const newJob = new Job({
            ...req.body, // Take all other fields from the request body
            company: companyIdToAssociate, // Assign the determined company ID
            postedBy: user.id, // Record who actually posted it (the user's ID)
            status: req.body.status || 'pending_review' // Default status if not provided
        });

        // AI Scam Detection (before saving)
        try {
            const companyDetailsForAI = await Company.findById(companyIdToAssociate);
            const companyNameForAI = companyDetailsForAI ? companyDetailsForAI.companyName : 'Unknown Company';

            const scamDetectionResult = await aiApiClient.detectScam({
                jobTitle: newJob.title,
                jobDescription: newJob.description,
                companyName: companyNameForAI
            });

            if (scamDetectionResult.isSuspicious) {
                newJob.status = 'flagged'; // Set status to flagged if suspicious
                newJob.aiScamFlags = scamDetectionResult.flags; // Store flags
                console.warn(`Job flagged as suspicious: ${newJob.title}. Flags: ${scamDetectionResult.flags.join(', ')}`);
            } else {
                newJob.status = req.body.status || 'active'; // Use provided status or default to active
            }
        } catch (aiError) {
            console.error("AI Scam Detection failed:", aiError.message);
            // Don't block job creation if AI service is down, but log it
            newJob.status = req.body.status || 'active'; // Default to active if AI fails
        }

        await newJob.save();

        res.status(201).json({ message: 'Job posting created successfully!', job: newJob });

    } catch (err) {
        handleMongooseError(res, err);
    }
});

// @route   GET /jobs
// @desc    Get all active job postings (public)
// @access  Public
router.get('/', async (req, res) => {
    try {
        const jobs = await Job.find({ status: 'active' }).populate('company', 'companyName logoUrl industry').sort({ createdAt: -1 });
        res.status(200).json(jobs);
    } catch (err) {
        handleMongooseError(res, err);
    }
});

// @route   GET /jobs/admin
// @desc    Get all job postings (for admin dashboard, with optional status filter)
// @access  Private (Admin)
router.get('/admin', verifyToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status) {
            query.status = status;
        }
        const jobs = await Job.find(query).populate('company', 'companyName logoUrl industry').sort({ createdAt: -1 });
        res.status(200).json(jobs);
    } catch (err) {
        handleMongooseError(res, err);
    }
});

// @route   GET /jobs/:id
// @desc    Get a single job posting by ID, and increment view count
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }

        const job = await Job.findByIdAndUpdate(
            id,
            { $inc: { viewsCount: 1 } }, // Increment viewsCount
            { new: true } // Return the updated document
        ).populate('company', 'companyName logoUrl description headquarters website industry contactPerson contactPhone');

        if (!job) {
            return res.status(404).json({ message: 'Job posting not found.' });
        }

        // Notify AI service about job view
        const token = req.headers.authorization?.split(' ')[1];
        if (token) { // Only notify if a user is logged in
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.role === 'jobseeker') { // Only track jobseeker views for recommendations
                    aiApiClient.notifyJobInteraction({
                        userId: decoded.id,
                        jobId: job._id.toString(),
                        type: 'view'
                    });
                }
            } catch (jwtError) {
                console.warn("JWT verification failed for AI interaction notification:", jwtError.message);
            }
        }

        res.status(200).json(job);
    } catch (err) {
        handleMongooseError(res, err);
    }
});

// @route   PATCH /jobs/:id/view
// @desc    Explicitly increment job view count (for frontend tracking)
// @access  Public (can be called by frontend without auth)
router.patch('/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }

        const job = await Job.findByIdAndUpdate(
            id,
            { $inc: { viewsCount: 1 } },
            { new: true, select: 'viewsCount' } // Return only viewsCount
        );

        if (!job) {
            return res.status(404).json({ message: 'Job posting not found.' });
        }

        res.status(200).json({ message: 'View count incremented.', viewsCount: job.viewsCount });
    } catch (err) {
        handleMongooseError(res, err);
    }
});


// @route   PATCH /jobs/:id
// @desc    Update a job posting
// @access  Private (Company owner, Admin)
router.patch('/:id', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { user } = req; // Authenticated user from JWT payload

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job posting not found.' });
        }

        // Authorization check: Only owner company or admin can update
        if (user.role === 'company' && job.company.toString() !== user.id) {
            return res.status(403).json({ message: 'Access denied. You can only update jobs for your own company.' });
        }
        if (user.role !== 'company' && user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only companies or admins can update job postings.' });
        }

        // Prevent direct modification of 'company' field by non-admin users
        if (user.role !== 'admin' && req.body.company && req.body.company !== job.company.toString()) {
            return res.status(403).json({ message: 'Forbidden: Companies cannot change the associated company of a job.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).populate('company', 'companyName');

        res.status(200).json({ message: 'Job posting updated successfully!', job: updatedJob });

    } catch (err) {
        handleMongooseError(res, err);
    }
});

// @route   DELETE /jobs/:id
// @desc    Delete a job posting
// @access  Private (Company owner, Admin)
router.delete('/:id', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { user } = req; // Authenticated user from JWT payload

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job posting not found.' });
        }

        // Authorization check: Only owner company or admin can delete
        if (user.role === 'company' && job.company.toString() !== user.id) {
            return res.status(403).json({ message: 'Access denied. You can only delete jobs for your own company.' });
        }
        if (user.role !== 'company' && user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only companies or admins can delete job postings.' });
        }

        await Job.findByIdAndDelete(id);

        res.status(200).json({ message: 'Job posting deleted successfully!' });

    } catch (err) {
        handleMongooseError(res, err);
    }
});

// @route   GET /jobs/recommended
// @desc    Get AI-powered personalized job recommendations for a job seeker
// @access  Private (Job Seeker)
router.get('/recommended', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
    try {
        const { user } = req; // Authenticated user from JWT payload

        if (user.role !== 'jobseeker') {
            return res.status(403).json({ message: 'Forbidden: Only job seekers can get personalized job recommendations.' });
        }

        const userProfile = await User.findById(user.id).lean(); // Fetch full user profile
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found for recommendations.' });
        }

        // Call AI microservice for recommendations
        const aiRecommendations = await aiApiClient.recommendJobs({
            userId: user.id,
            userProfile: userProfile // Pass the full user profile
        });

        // The AI service returns an array of job objects (or dummy ones)
        // We just pass them through to the frontend.
        res.status(200).json(aiRecommendations);

    } catch (err) {
        console.error("Error fetching AI recommended jobs:", err);
        // If AI service fails, return an empty array or a fallback message
        res.status(500).json({ message: 'Failed to get job recommendations from AI service. Please try again later.', jobs: [] });
    }
});

export default router;
