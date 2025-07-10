// routes/applications.js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';

import Application from '../models/Application.js';
import Job from '../models/Job.js';
import User from '../models/User.js'; // Needed to populate jobSeeker data
import { verifyToken, authorizeRoles, authorizeOwner } from '../utils/auth.js';
import aiApiClient from '../utils/aiApiClient.js'; // Import the AI API client

const handleMongooseError = (res, err) => {
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    if (err.code === 11000) {
        return res.status(409).json({ message: 'You have already applied for this job.' });
    }
    res.status(500).json({ message: err.message });
};

// --- ROUTES ---

// GET all applications (Admin only)
router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const applications = await Application.find()
            .populate('job', 'title')
            .populate('jobSeeker', 'fullName email')
            .populate('company', 'companyName');
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET applications by Job Seeker (Job Seeker's own applications)
router.get('/my-applications', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
    try {
        const applications = await Application.find({ jobSeeker: req.user.id })
            .populate('job', 'title location jobType company applicationDeadline')
            .populate('company', 'companyName logoUrl'); // Populate company details for display
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET applications for a specific Job ID (Company or Admin only)
// This is where AI candidate screening will be integrated
router.get('/for-job/:jobId', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => {
    try {
        const jobId = req.params.jobId;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ message: 'Invalid Job ID format' });
        }

        const job = await Job.findById(jobId).lean(); // Fetch job details for AI input
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Company role check: Ensure the company owns this job
        if (req.user.role === 'company' && job.company.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You do not own this job.' });
        }

        // Fetch applications for the job
        // Populate jobSeeker with relevant fields for AI, and application with AI fields
        let applications = await Application.find({ job: jobId })
            .populate('jobSeeker', 'fullName email phoneNumber headline skills experience education certifications projects languages')
            .lean(); // Use .lean() to make it a plain JS object for easier modification

        // If there are applications, call the AI service for screening
        if (applications.length > 0) {
            const applicantIds = applications.map(app => app.jobSeeker._id.toString());

            // Prepare jobDetails for AI
            const jobDetailsForAI = {
                jobId: job._id.toString(),
                title: job.title,
                description: job.description,
                requiredSkills: job.requiredSkills,
                preferredSkills: job.preferredSkills,
                technologiesUsed: job.technologiesUsed,
                seniorityLevel: job.seniorityLevel,
                industry: job.industry,
                // Add any other job fields the AI needs for screening
            };

            try {
                // --- AI INTEGRATION: Candidate Screening ---
                const aiScreeningResults = await aiApiClient.screenCandidates({
                    jobId: jobId,
                    jobDetails: jobDetailsForAI,
                    applicantIds: applicantIds, // Only send IDs, AI fetches full profiles if needed
                    // Alternatively, you could send a subset of applicant profiles here if AI expects it
                    // applicants: applications.map(app => ({ id: app.jobSeeker._id.toString(), profile: app.jobSeeker }))
                });
                // ------------------------------------------

                // Update applications with AI screening results
                const bulkOps = [];
                const screenedApplicantsMap = new Map(aiScreeningResults.map(r => [r.applicantId, r]));

                applications.forEach(app => {
                    const screening = screenedApplicantsMap.get(app.jobSeeker._id.toString());
                    if (screening) {
                        app.aiScreeningScore = screening.score;
                        app.aiScreeningReasons = screening.reasons;
                        // Prepare for bulk update
                        bulkOps.push({
                            updateOne: {
                                filter: { _id: app._id },
                                update: {
                                    $set: {
                                        aiScreeningScore: screening.score,
                                        aiScreeningReasons: screening.reasons,
                                        // Update status to 'reviewed' if it's still 'pending' and AI has screened it
                                        // This is a business logic decision.
                                        status: app.status === 'pending' ? 'reviewed' : app.status
                                    }
                                }
                            }
                        });
                    }
                });

                // Execute bulk updates if there are any
                if (bulkOps.length > 0) {
                    await Application.bulkWrite(bulkOps);
                    console.log(`Updated AI screening scores for ${bulkOps.length} applications for job ${jobId}`);
                    // Re-fetch applications with updated AI fields for the response, or use the modified 'applications' array
                    // For simplicity, we'll return the 'applications' array that was modified in memory.
                    // If you need the fully updated documents from DB, you'd re-query.
                }

            } catch (aiError) {
                console.error('Error from AI screening service:', aiError.message);
                // Continue without AI data if AI service fails, or provide specific error to client
                // For now, applications will be returned without AI scores if the AI call fails.
                applications.forEach(app => {
                    app.aiScreeningScore = null; // Ensure null if AI failed
                    app.aiScreeningReasons = ['AI screening failed.'];
                });
            }
        }

        res.json(applications);

    } catch (err) {
        console.error('Error fetching applications for job:', err);
        res.status(500).json({ message: err.message });
    }
});


// CREATE a new application (Job Seeker only)
router.post('/', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
    const { jobId, resumeSnapshotUrl, coverLetterSnapshotUrl } = req.body;
    const jobSeekerId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return res.status(400).json({ message: 'Invalid Job ID format' });
    }

    try {
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }
        if (job.status !== 'active') {
            return res.status(400).json({ message: 'Job is not active and cannot accept applications.' });
        }
        if (job.applicationDeadline && new Date() > job.applicationDeadline) {
            return res.status(400).json({ message: 'Application deadline has passed.' });
        }

        // Check if job seeker has already applied (handled by unique index on schema)
        const existingApplication = await Application.findOne({ job: jobId, jobSeeker: jobSeekerId });
        if (existingApplication) {
            return res.status(409).json({ message: 'You have already applied for this job.' });
        }

        const application = new Application({
            job: jobId,
            jobSeeker: jobSeekerId,
            company: job.company, // Store company ID for easy retrieval
            resumeSnapshotUrl,
            coverLetterSnapshotUrl
        });

        const newApplication = await application.save();

        // Update the Job model to include this application's ID in its 'applicants' array
        job.applicants.push(newApplication._id);
        await job.save();

        // --- AI INTEGRATION: Notify AI service of new application ---
        aiApiClient.notifyNewApplication({
            applicationId: newApplication._id.toString(),
            userId: jobSeekerId,
            jobId: jobId
        })
        .then(response => console.log('AI New application notification sent successfully.'))
        .catch(error => console.error('Failed to notify AI of new application:', error.message));
        // ---------------------------------------------------------

        const populatedApplication = await newApplication
            .populate('job', 'title location jobType')
            .populate('jobSeeker', 'fullName email')
            .populate('company', 'companyName');

        res.status(201).json(populatedApplication);

    } catch (err) {
        handleMongooseError(res, err);
    }
});

// GET one application by ID (Job Seeker owner, Company owner of job, or Admin)
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const applicationId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(applicationId)) {
            return res.status(400).json({ message: 'Invalid Application ID format' });
        }

        const application = await Application.findById(applicationId)
            .populate('job', 'title company') // Populate job to check company ownership
            .populate('jobSeeker', 'fullName email');

        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        // Authorization check
        const isJobSeekerOwner = application.jobSeeker._id.toString() === req.user.id;
        const isCompanyOwner = application.job.company.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isJobSeekerOwner && !isCompanyOwner && !isAdmin) {
            return res.status(403).json({ message: 'Access denied. You do not have permission to view this application.' });
        }

        res.json(application);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// UPDATE application status or details (Company owner of job, or Admin)
router.patch('/:id', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => {
    const { status, interviewScheduledAt, interviewLink, aiInterviewAssessment } = req.body;
    const applicationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        return res.status(400).json({ message: 'Invalid Application ID format' });
    }

    try {
        const application = await Application.findById(applicationId).populate('job', 'company'); // Populate job to check company ownership
        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        // Company role check: Ensure the company owns the job this application is for
        if (req.user.role === 'company' && application.job.company.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You do not own the job for this application.' });
        }

        // Update fields if provided
        if (status != null) application.status = status;
        if (interviewScheduledAt != null) application.interviewScheduledAt = interviewScheduledAt;
        if (interviewLink != null) application.interviewLink = interviewLink;

        // --- AI INTEGRATION: AI Interview Assessment (manual update for now) ---
        // This field is primarily for AI to fill, but an admin/company could manually add/edit
        if (aiInterviewAssessment != null) {
            if (req.user.role === 'admin' || req.user.role === 'company') { // Only allowed by privileged roles
                application.aiInterviewAssessment = aiInterviewAssessment;
            } else {
                return res.status(403).json({ message: 'Access denied. Only admin or company can update AI interview assessment.' });
            }
        }
        // If AI were to provide this in real-time, it would be another AI API call here or in a separate hook.
        // ----------------------------------------------------------------------


        const updatedApplication = await application.save();
        res.json(updatedApplication);

    } catch (err) {
        handleMongooseError(res, err);
    }
});

// DELETE an application (Job Seeker owner, Company owner of job, or Admin)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const applicationId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(applicationId)) {
            return res.status(400).json({ message: 'Invalid Application ID format' });
        }

        const application = await Application.findById(applicationId);
        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        // Authorization check: only owner, company owner of job, or admin can delete
        const job = await Job.findById(application.job);
        const isJobSeekerOwner = application.jobSeeker.toString() === req.user.id;
        const isCompanyOwner = job && job.company.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isJobSeekerOwner && !isCompanyOwner && !isAdmin) {
            return res.status(403).json({ message: 'Access denied. You do not have permission to delete this application.' });
        }

        // Remove application ID from the Job's applicants array (data consistency NFR)
        if (job) {
            job.applicants = job.applicants.filter(appId => appId.toString() !== application._id.toString());
            await job.save();
        }

        await application.deleteOne();
        res.json({ message: 'Application deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;