// routes/applications.js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose'; // Needed for ObjectId validation

import Application from '../models/Application.js';
import Job from '../models/Job.js';
import User from '../models/User.js'; // User is jobSeeker here
import Company from '../models/Company.js';
import { verifyToken, authorizeRoles, authorizeOwner } from '../utils/auth.js'; // Import auth middleware

// Middleware to get a single application by ID
async function getApplication(req, res, next) {
  let application;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid Application ID format' });
    }
    application = await Application.findById(req.params.id);
    if (application == null) {
      return res.status(404).json({ message: 'Cannot find application' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.application = application;
  next();
}

// Helper for consistent Mongoose error handling
const handleMongooseError = (res, err) => {
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    // Handle unique index error (job + jobSeeker)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate application: You have already applied to this job.' });
    }
    res.status(500).json({ message: err.message });
};


// --- ROUTES ---

// GET all applications (Admin only)
router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const applications = await Application.find()
      .populate('job', 'title company location') // Populate job basics
      .populate('jobSeeker', 'fullName email')   // Populate job seeker basics
      .populate('company', 'companyName email'); // Populate company basics

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET applications for the authenticated job seeker (Job Seeker only)
router.get('/my', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
  try {
    const applications = await Application.find({ jobSeeker: req.user.id })
      .populate('job', 'title company location jobType applicationDeadline')
      .populate('company', 'companyName headquarters logoUrl')
      .sort({ appliedAt: -1 }); // Most recent applications first

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET applications for jobs posted by the authenticated company (Company only)
router.get('/for-my-jobs', verifyToken, authorizeRoles('company'), async (req, res) => {
  try {
    // Find jobs posted by this company
    const companyJobs = await Job.find({ company: req.user.id }).select('_id');
    const jobIds = companyJobs.map(job => job._id);

    if (jobIds.length === 0) {
        return res.status(200).json({ message: 'No jobs found for this company, thus no applications.', applications: [] });
    }

    const applications = await Application.find({ job: { $in: jobIds } })
      .populate('job', 'title company location jobType')
      .populate('jobSeeker', 'fullName email phoneNumber resumeUrl') // Companies need job seeker contact info
      .populate('company', 'companyName') // Populate their own company name
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// GET one application by ID (Admin, owning job seeker, or company owning the job)
router.get('/:id', verifyToken, getApplication, async (req, res) => {
  // Authorization logic:
  // 1. Admin can view any application
  // 2. Job seeker can view their own application
  // 3. Company can view applications to their jobs

  const application = res.application;

  if (req.user.role === 'admin') {
    // Admin bypass
  } else if (req.user.role === 'jobseeker' && application.jobSeeker.toString() === req.user.id) {
    // Job seeker owns it
  } else if (req.user.role === 'company' && application.company.toString() === req.user.id) {
    // Company owns the job this application is for
  } else {
    return res.status(403).json({ message: 'Access denied. You do not have permission to view this application.' });
  }

  try {
    const populatedApplication = await application
      .populate('job', 'title description company location jobType')
      .populate('jobSeeker', 'fullName email phoneNumber resumeUrl portfolioUrl skills experience education')
      .populate('company', 'companyName email headquarters logoUrl');

    res.json(populatedApplication);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// CREATE one application (Job Seeker only)
router.post('/', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
  const {
    job, status, resumeSnapshotUrl, coverLetterSnapshotUrl,
    interviewScheduledAt, interviewLink
  } = req.body;

  // The jobSeeker ID comes from the authenticated user's token
  const jobSeeker = req.user.id;

  // --- Input Validation ---
  if (!job) {
    return res.status(400).json({ message: 'Job ID is required.' });
  }

  // Validate Job ID format and existence
  if (!mongoose.Types.ObjectId.isValid(job)) {
    return res.status(400).json({ message: 'Invalid Job ID format.' });
  }
  const existingJob = await Job.findById(job);
  if (!existingJob) {
    return res.status(400).json({ message: 'Job not found.' });
  }

  // Automatically derive company ID from the job
  const companyId = existingJob.company;
  if (!companyId) {
      return res.status(500).json({ message: 'Job document is missing company ID.' });
  }

  // Validate interviewScheduledAt if provided (only if status is for interview)
  if (interviewScheduledAt && status === 'interview_scheduled') {
    const interviewDate = new Date(interviewScheduledAt);
    if (isNaN(interviewDate.getTime())) {
      return res.status(400).json({ message: 'Invalid interview scheduled date.' });
    }
    if (interviewDate < new Date()) {
      return res.status(400).json({ message: 'Interview scheduled date must be in the future.' });
    }
  }

  const application = new Application({
    job,
    jobSeeker, // Set from authenticated user
    company: companyId, // Set from job
    status: status || 'pending', // Default status for new applications
    resumeSnapshotUrl,
    coverLetterSnapshotUrl,
    interviewScheduledAt,
    interviewLink
  });

  try {
    const newApplication = await application.save();

    // Optionally update the Job's applicants array (if you track this directly on the job)
    // await Job.findByIdAndUpdate(job, { $push: { applicants: newApplication._id } });

    // Populate relevant details before sending response
    const populatedApplication = await newApplication
      .populate('job', 'title company location jobType')
      .populate('jobSeeker', 'fullName email')
      .populate('company', 'companyName email');

    res.status(201).json(populatedApplication); // 201 Created
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// UPDATE one application (Admin or Company owning the job, Job seeker can withdraw)
router.patch('/:id', verifyToken, getApplication, async (req, res) => {
  const application = res.application;
  const {
    status, resumeSnapshotUrl, coverLetterSnapshotUrl,
    interviewScheduledAt, interviewLink
  } = req.body;

  // Authorization Check:
  // Admin can update anything.
  // Company (owning the job) can update status, interview fields.
  // Job seeker (owning the application) can only change status to 'withdrawn'.

  if (req.user.role === 'admin') {
      // Admin has full control
  } else if (req.user.role === 'company' && application.company.toString() === req.user.id) {
      // Company can update status and interview details
      if (resumeSnapshotUrl != null || coverLetterSnapshotUrl != null) {
          return res.status(403).json({ message: 'Companies cannot update resume or cover letter URLs.' });
      }
      if (status != null) application.status = status;
      if (interviewScheduledAt != null) {
        const interviewDate = new Date(interviewScheduledAt);
        if (isNaN(interviewDate.getTime())) {
          return res.status(400).json({ message: 'Invalid interview scheduled date.' });
        }
        application.interviewScheduledAt = interviewDate;
      }
      if (interviewLink != null) application.interviewLink = interviewLink;

  } else if (req.user.role === 'jobseeker' && application.jobSeeker.toString() === req.user.id) {
      // Job seeker can only withdraw their application
      if (Object.keys(req.body).length !== 1 || status !== 'withdrawn') {
          return res.status(403).json({ message: 'Access denied. Job seekers can only withdraw their application.' });
      }
      application.status = 'withdrawn';
  } else {
      return res.status(403).json({ message: 'Access denied. You do not have permission to update this application.' });
  }

  try {
    const updatedApplication = await application.save();
    const populatedApplication = await updatedApplication
      .populate('job', 'title company location jobType')
      .populate('jobSeeker', 'fullName email')
      .populate('company', 'companyName email');

    res.json(populatedApplication);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// DELETE one application (Admin or owning job seeker - for withdrawal/cancellation)
router.delete('/:id', verifyToken, getApplication, async (req, res) => {
  const application = res.application;

  // Authorization: Admin or job seeker (owner)
  if (req.user.role === 'admin' || (req.user.role === 'jobseeker' && application.jobSeeker.toString() === req.user.id)) {
    try {
      await application.deleteOne();
      res.json({ message: 'Deleted application successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  } else {
    res.status(403).json({ message: 'Access denied. You do not have permission to delete this application.' });
  }
});


export default router;

// Shouldn't we write codes whether admin,companies, jobseekes can view  applications  or not and codes for the status should be also write the code right? so are you going to write the codes here in this file ?