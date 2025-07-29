// backend/routes/jobs.js
import express from 'express';
import Job from '../models/Job.js';
import User from '../models/User.js'; // Assuming User model is needed for role checks/populating
import { verifyToken, authorizeRoles } from '../utils/auth.js'; // Your authentication middleware
import axios from 'axios';
import mongoose from 'mongoose';

const router = express.Router();

// AI Service API Client setup
const aiApiClient = axios.create({
    baseURL: process.env.AI_SERVICE_URL, // e.g., http://localhost:5000/api/v1/ai
    timeout: 10000, // 10 seconds timeout
});

// @route   POST /api/jobs
// @desc    Create a new job posting
// @access  Private (Company only)
router.post('/', verifyToken, authorizeRoles('company'), async (req, res) => { // Changed to 'company'
    try {
        const {
            title,
            description,
            location,
            jobType,
            salaryRange,
            requiredSkills,
            preferredSkills,
            technologiesUsed,
            seniorityLevel,
            industry,
            companySize,
            workEnvironment,
            applicationDeadline
        } = req.body;

        const companyId = req.user.id; // This is the ID of the company user who is posting the job.

        if (!title || !description || !location || !jobType || !companyId) {
            return res.status(400).json({ message: 'Please enter all required fields: title, description, location, jobType, companyId.' });
        }

        const newJob = new Job({
            title,
            description,
            location,
            jobType,
            company: companyId, // Link job to the authenticated company user
            salaryRange,
            requiredSkills,
            preferredSkills,
            technologiesUsed,
            seniorityLevel,
            industry,
            companySize,
            workEnvironment,
            applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
            status: 'pending_review', // Default status
        });

        const job = await newJob.save();

        // Optional: Notify AI service about new job
        try {
            const companyUser = await User.findById(companyId).select('companyName'); // Assuming companyName is on the User model
            const companyNameForAI = companyUser ? companyUser.companyName : 'N/A';

            await aiApiClient.post('/notify-new-job', {
                jobId: job._id.toString(),
                title: job.title,
                description: job.description,
                companyName: companyNameForAI
            });
            console.log(`[Backend] Notified AI service about new job: ${job._id}`);
        } catch (aiError) {
            console.warn(`[Backend] Failed to notify AI service about new job ${job._id}:`, aiError.message);
        }

        res.status(201).json({ message: 'Job posted successfully!', job });
    } catch (error) {
        console.error('[Backend] Error posting job:', error.message);
        res.status(500).json({ message: 'Server error: Failed to post job.' });
    }
});

// @route   GET /api/jobs
// @desc    Get all job postings (publicly accessible)
// @access  Public
router.get('/', async (req, res) => {
    try {
        // Only fetch active jobs for public view
        const jobs = await Job.find({ status: 'active' }).populate('company', 'companyName logoUrl');
        res.status(200).json(jobs);
    } catch (error) {
        console.error('[Backend] Error fetching all jobs:', error.message);
        res.status(500).json({ message: 'Server error: Failed to fetch jobs.' });
    }
});

// --- START OF NEW ROUTE FOR COMPANY-SPECIFIC JOBS ---
// @route   GET /api/jobs/company/:companyId
// @desc    Get all jobs posted by a specific company (company/admin only)
// @access  Private (Company who owns the jobs or Admin)
router.get('/company/:companyId', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => { // Changed to 'company'
    try {
        const { companyId } = req.params;

        // Authorization check: Ensure the authenticated user is either
        // the company whose jobs are being requested, or an admin.
        if (req.user.role === 'company' && req.user.id !== companyId) {
            return res.status(403).json({ message: 'Forbidden: Not authorized to view jobs of another company.' });
        }
        // If role is not 'company' and not 'admin', deny access
        if (req.user.role !== 'company' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access Denied: Only companies or administrators can view this resource.' });
        }

        // Find jobs where the 'company' field matches the companyId from the URL parameter
        const jobs = await Job.find({ company: companyId })
                                .populate('company', 'companyName website logoUrl') // Populate relevant company info
                                .sort({ createdAt: -1 }); // Sort by most recent

        res.status(200).json(jobs);
    } catch (error) {
        console.error('[Backend] Error fetching company-specific jobs:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid company ID format.' });
        }
        res.status(500).json({ message: 'Server error: Failed to fetch company jobs.' });
    }
});
// --- END OF NEW ROUTE ---

// @route   GET /api/jobs/recommended
// @desc    Get job recommendations for a job seeker from AI service
// @access  Private (Jobseeker only)
router.get('/recommended', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log(`[Backend] Fetching recommendations for userId: ${user._id}`);
        console.log(`[Backend] AI Service URL: ${process.env.AI_SERVICE_URL}`);

        const aiResponse = await aiApiClient.post('/recommend-jobs', {
            userId: user._id.toString(),
        });

        console.log('[Backend] Received response from AI service for recommendations.');
        // console.log('[Backend] AI service response data:', aiResponse.data);

        res.status(aiResponse.status).json(aiResponse.data);

    } catch (error) {
        console.error('[Backend] Error fetching recommended jobs from AI service:', error.message);
        if (error.response) {
            console.error('[Backend] AI Service Error Response Status:', error.response.status);
            console.error('[Backend] AI Service Error Response Data:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ message: 'Failed to load recommendations: An unexpected error occurred.' });
    }
});

// @route   GET /api/jobs/:id
// @desc    Get a single job posting by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('company', 'companyName logoUrl website description'); // Populate more company fields
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }
        res.status(200).json(job);
    } catch (error) {
        console.error('[Backend] Error fetching single job:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }
        res.status(500).json({ message: 'Server error: Failed to fetch job.' });
    }
});

// @route   PUT /api/jobs/:id
// @desc    Update a job posting by ID
// @access  Private (Company who owns the job)
router.put('/:id', verifyToken, authorizeRoles('company'), async (req, res) => { // Changed to 'company'
    try {
        const { id } = req.params;
        const updatedJobData = req.body;

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        // Ensure the authenticated company owns this job
        if (job.company.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You can only update jobs posted by your company.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(id, updatedJobData, { new: true, runValidators: true });

        // Optional: Notify AI service about job update
        try {
            const companyUser = await User.findById(job.company).select('companyName');
            const companyNameForAI = companyUser ? companyUser.companyName : 'N/A';

            await aiApiClient.post('/notify-job-update', {
                jobId: updatedJob._id.toString(),
                title: updatedJob.title,
                description: updatedJob.description,
                companyName: companyNameForAI
            });
            console.log(`[Backend] Notified AI service about job update: ${updatedJob._id}`);
        } catch (aiError) {
            console.warn(`[Backend] Failed to notify AI service about job update ${updatedJob._id}:`, aiError.message);
        }

        res.status(200).json({ message: 'Job updated successfully!', job: updatedJob });
    } catch (error) {
        console.error('[Backend] Error updating job:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }
        res.status(500).json({ message: 'Server error: Failed to update job.' });
    }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete a job posting by ID
// @access  Private (Company who owns the job)
router.delete('/:id', verifyToken, authorizeRoles('company'), async (req, res) => { // Changed to 'company'
    try {
        const { id } = req.params;

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        // Ensure the authenticated company owns this job
        if (job.company.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You can only delete jobs posted by your company.' });
        }

        await Job.findByIdAndDelete(id);

        // Optional: Notify AI service about job deletion
        try {
            await aiApiClient.post('/notify-job-delete', {
                jobId: id,
            });
            console.log(`[Backend] Notified AI service about job deletion: ${id}`);
        } catch (aiError) {
            console.warn(`[Backend] Failed to notify AI service about job deletion ${id}:`, aiError.message);
        }

        res.status(200).json({ message: 'Job deleted successfully!' });
    } catch (error) {
        console.error('[Backend] Error deleting job:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }
        res.status(500).json({ message: 'Server error: Failed to delete job.' });
    }
});

// @route   POST /api/jobs/:id/apply
// @desc    Apply for a job
// @access  Private (Jobseeker only)
router.post('/:id/apply', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
    try {
        const jobId = req.params.id;
        const jobseekerId = req.user.id;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        if (job.applicants.includes(jobseekerId)) {
            return res.status(400).json({ message: 'You have already applied for this job.' });
        }

        job.applicants.push(jobseekerId);
        await job.save();

        try {
            await aiApiClient.post('/notify-new-application', {
                applicationId: new mongoose.Types.ObjectId().toString(),
                userId: jobseekerId.toString(),
                jobId: jobId.toString()
            });
            console.log(`[Backend] Notified AI service about new application for job ${jobId} by user ${jobseekerId}`);
        } catch (aiError) {
            console.warn(`[Backend] Failed to notify AI service about new application:`, aiError.message);
        }

        res.status(200).json({ message: 'Application submitted successfully!' });
    } catch (error) {
        console.error('[Backend] Error applying for job:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }
        res.status(500).json({ message: 'Server error: Failed to submit application.' });
    }
});

// @route   PATCH /api/jobs/:id/view
// @desc    Increment job view count
// @access  Public
router.patch('/:id/view', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        job.views = (job.views || 0) + 1;
        await job.save();
        res.status(200).json({ message: 'View count incremented', views: job.views });
    } catch (error) {
        console.error('[Backend] Error incrementing job view:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid job ID format.' });
        }
        res.status(500).json({ message: 'Server error: Failed to increment view count.' });
    }
});

// @route   POST /api/jobs/detect-scam
// @desc    Detect if a job posting is a scam using AI service
// @access  Private (Company only)
router.post('/detect-scam', verifyToken, authorizeRoles('company'), async (req, res) => { // Changed to 'company'
    try {
        const { jobTitle, jobDescription, companyName } = req.body;

        if (!jobTitle || !jobDescription) {
            return res.status(400).json({ message: 'Job title and description are required for scam detection.' });
        }

        console.log(`[Backend] Sending job data to AI service for scam detection: ${jobTitle}`);
        const aiResponse = await aiApiClient.post('/detect-scam', {
            jobTitle,
            jobDescription,
            companyName: companyName || 'N/A'
        });

        console.log('[Backend] Received response from AI service for scam detection.');
        res.status(aiResponse.status).json(aiResponse.data);

    } catch (error) {
        console.error('[Backend] Error detecting scam from AI service:', error.message);
        if (error.response) {
            console.error('[Backend] AI Service Error Response Status:', error.response.status);
            console.error('[Backend] AI Service Error Response Data:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ message: 'Failed to detect scam: An unexpected error occurred.' });
    }
});

export default router;
