// routes/jobs.js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose'; // Needed for ObjectId validation
import Job from '../models/Job.js';
import Company from '../models/Company.js'; // Needed for validating company reference
import { verifyToken, authorizeRoles, authorizeOwner } from '../utils/auth.js'; // Import auth middleware

// Middleware to get a single job by ID
async function getJob(req, res, next) {
  let job;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid Job ID format' });
    }
    job = await Job.findById(req.params.id);
    if (job == null) {
      return res.status(404).json({ message: 'Cannot find job' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.job = job; // Attach the found job to the response object
  next();
}

// Helper function for consistent error handling
const handleMongooseError = (res, err) => {
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate key error' }); // Though less likely for jobs without specific unique fields
    }
    res.status(500).json({ message: err.message });
};


// --- ROUTES ---

// GET all jobs (Public)
router.get('/', async (req, res) => {
  try {
    // Populate the 'company' field to get company details
    // Only show 'active' jobs by default, unless query parameter 'status' is provided by admin
    let query = { status: 'active' };
    if (req.query.status && req.query.status !== 'active') { // Allow admin to view other statuses
        // This check would ideally be part of a `verifyToken, authorizeRoles('admin')` middleware chain
        // but for a public endpoint, we just filter. For full control, this GET / endpoint
        // should be split into public and admin versions. For now, public is just 'active'.
    }
    // Implement filters here: e.g., location, jobType, keywords etc.
    // const { location, jobType, keywords } = req.query;
    // if (location) query.location = new RegExp(location, 'i'); // Case-insensitive regex search
    // if (jobType) query.jobType = jobType;
    // if (keywords) query.requirements = { $in: keywords.split(',').map(k => new RegExp(k.trim(), 'i')) };


    const jobs = await Job.find(query)
        .populate('company', 'companyName headquarters logoUrl') // Select specific company fields
        .sort({ createdAt: -1 }); // Latest jobs first

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one job by ID (Public)
router.get('/:id', getJob, async (req, res) => {
  try {
    // Increment viewsCount only if the request is not from an authenticated company/admin (to avoid self-inflating views)
    // For simplicity, we'll increment on every public GET, but a more robust solution might track unique IPs or user sessions.
    res.job.viewsCount = (res.job.viewsCount || 0) + 1;
    await res.job.save(); // Save the incremented view count

    const job = await res.job.populate('company', 'companyName headquarters logoUrl description website contactPerson contactPhone');
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE one job (Company role required)
router.post('/', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => {
  // If a company is posting, ensure the 'company' field matches their own ID
  if (req.user.role === 'company' && req.body.company !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only post jobs for your own company.' });
  }

  const {
    company, title, description, location, jobType, salaryRange,
    requirements, responsibilities, benefits, applicationDeadline,
    status, isFlagged, flagReason
  } = req.body;

  // Basic validation for company ObjectId existence
  if (!mongoose.Types.ObjectId.isValid(company)) {
    return res.status(400).json({ message: 'Invalid Company ID format' });
  }
  const existingCompany = await Company.findById(company);
  if (!existingCompany) {
    return res.status(400).json({ message: 'Company not found.' });
  }

  // Validate applicationDeadline
  if (applicationDeadline && new Date(applicationDeadline) < new Date()) {
    return res.status(400).json({ message: 'Application deadline must be in the future.' });
  }

  const job = new Job({
    company, title, description, location, jobType, salaryRange,
    requirements, responsibilities, benefits, applicationDeadline,
    status: status || 'pending_review', // Default to pending_review for new jobs
    // viewsCount, isFlagged, flagReason usually default or set by admin/system
    isFlagged: isFlagged || false,
    flagReason: flagReason || ''
  });

  try {
    const newJob = await job.save();
    // Populate company details before sending response
    const populatedJob = await newJob.populate('company', 'companyName headquarters logoUrl');
    res.status(201).json(populatedJob); // 201 Created
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// UPDATE one job (Admin or owner company required)
router.patch('/:id', verifyToken, authorizeRoles('company', 'admin'), getJob, async (req, res) => {
  // Use authorizeOwner middleware helper to check ownership, or admin bypass
  // req.user.id (from token) must match res.job.company (job poster)
  if (req.user.role !== 'admin' && res.job.company.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Access denied. You can only update jobs posted by your company.' });
  }

  const {
    company, title, description, location, jobType, salaryRange,
    requirements, responsibilities, benefits, applicationDeadline,
    status,  isFlagged, flagReason
  } = req.body;

  // Prevent changing the associated company of a job after creation
  if (company != null && company.toString() !== res.job.company.toString()) {
      return res.status(403).json({ message: 'Changing the company for a job is not allowed.' });
  }

  if (title != null) res.job.title = title;
  if (description != null) res.job.description = description;
  if (location != null) res.job.location = location;
  if (jobType != null) res.job.jobType = jobType;
  if (salaryRange != null) res.job.salaryRange = salaryRange;
  if (requirements != null) res.job.requirements = requirements;
  if (responsibilities != null) res.job.responsibilities = responsibilities;
  if (benefits != null) res.job.benefits = benefits;

  if (applicationDeadline != null) {
    const newDeadline = new Date(applicationDeadline);
    if (isNaN(newDeadline.getTime())) {
      return res.status(400).json({ message: 'Invalid application deadline date' });
    }
    if (newDeadline < new Date()) {
      return res.status(400).json({ message: 'Application deadline must be in the future' });
    }
    res.job.applicationDeadline = newDeadline;
  }

  // Only admin can change status from 'pending_review' or directly manage 'isFlagged'
  if (status != null && (req.user.role === 'admin' || req.user.role === 'company')) {
    res.job.status = status;
  } else if (status != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You are not authorized to change job status.' });
  }

  if (isFlagged != null && req.user.role === 'admin') {
      res.job.isFlagged = isFlagged;
  } else if (isFlagged != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You are not authorized to flag jobs.' });
  }
  if (flagReason != null && req.user.role === 'admin') {
      res.job.flagReason = flagReason;
  } else if (flagReason != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You are not authorized to set flag reasons.' });
  }
  // viewsCount should not be directly updatable via PATCH by client
  // if (viewsCount != null) res.job.viewsCount = viewsCount;


  try {
    const updatedJob = await res.job.save();
    const populatedJob = await updatedJob.populate('company', 'companyName headquarters logoUrl');
    res.json(populatedJob);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// DELETE one job (Admin or owner company required)
router.delete('/:id', verifyToken, authorizeRoles('company', 'admin'), getJob, async (req, res) => {
  // Use authorizeOwner middleware helper to check ownership, or admin bypass
  // req.user.id (from token) must match res.job.company (job poster)
  if (req.user.role !== 'admin' && res.job.company.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Access denied. You can only delete jobs posted by your company.' });
  }

  try {
    await res.job.deleteOne();
    res.json({ message: 'Deleted job successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Optional: Route to increment viewsCount (Public - can be used from client side)
router.patch('/:id/view', getJob, async (req, res) => {
  try {
    res.job.viewsCount = (res.job.viewsCount || 0) + 1;
    await res.job.save();
    res.json({ message: 'Views count updated', viewsCount: res.job.viewsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
