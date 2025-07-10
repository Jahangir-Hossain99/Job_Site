// routes/jobs.js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import User from '../models/User.js'; // Needed to fetch user profile for recommendations
import Company from '../models/Company.js';
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
      return res.status(409).json({ message: 'Duplicate key error' });
    }
    res.status(500).json({ message: err.message });
};


// --- ROUTES ---

// GET all jobs (PUBLICLY ACCESSIBLE) - For general Browse
router.get('/', async (req, res) => {
  try {
    let query = { status: 'active' }; // Default to 'active' jobs for public view

    // Implement more sophisticated filtering here if needed (e.g., from query params)
    // const { location, jobType, keywords, seniorityLevel, industry, companySize } = req.query;
    // if (location) query.location = new RegExp(location, 'i');
    // if (jobType) query.jobType = jobType;
    // if (keywords) query.requiredSkills = { $in: keywords.split(',').map(k => new RegExp(k.trim(), 'i')) };
    // if (seniorityLevel) query.seniorityLevel = seniorityLevel;
    // if (industry) query.industry = new RegExp(industry, 'i');
    // if (companySize) query.companySize = companySize;

    const jobs = await Job.find(query)
        .populate('company', 'companyName headquarters logoUrl')
        .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all jobs (Admin only) - For full administrative control over all jobs/statuses
router.get('/admin', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Admin can view all jobs regardless of status
    let query = {};
    // Admin can also filter by status if a query param is provided
    if (req.query.status) {
        query.status = req.query.status;
    }
    // Admin can apply other filters as well
    // const { location, jobType, keywords, isFlagged, seniorityLevel, industry } = req.query;
    // if (location) query.location = new RegExp(location, 'i');
    // if (jobType) query.jobType = jobType;
    // if (keywords) query.requiredSkills = { $in: keywords.split(',').map(k => new RegExp(k.trim(), 'i')) };
    // if (isFlagged != null) query.isFlagged = isFlagged;
    // if (seniorityLevel) query.seniorityLevel = seniorityLevel;
    // if (industry) query.industry = new RegExp(industry, 'i');

    const jobs = await Job.find(query)
        .populate('company', 'companyName headquarters logoUrl email contactPerson contactPhone') // Admin gets more company details
        .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- NEW AI-POWERED ROUTE ---
// GET AI-powered job recommendations for a job seeker
router.get('/recommended', verifyToken, authorizeRoles('jobseeker'), async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch the user's detailed profile for AI input
        const userProfile = await User.findById(userId)
            .select('-password -aiProfileVector -lastRecommendedJobs') // Exclude AI internal fields
            .lean(); // Use .lean() for plain JS object
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found. Cannot generate recommendations.' });
        }

        // Fetch user's recent activity for AI (e.g., jobs viewed, applied to)
        // This is a placeholder. You might fetch from a separate activity log if implemented.
        const recentActivity = []; // For now, an empty array. Populate with real activity later if desired.

        // Call the AI service for job recommendations
        const aiRecommendations = await aiApiClient.recommendJobs({
            userId: userId,
            userProfile: userProfile,
            recentActivity: recentActivity // Pass recent interaction data
        });

        if (!aiRecommendations || aiRecommendations.length === 0) {
            return res.json({ message: 'No personalized recommendations available at this time. Showing general jobs.', jobs: [] });
        }

        // Extract job IDs from AI response and sort them by score
        const recommendedJobIds = aiRecommendations
            .sort((a, b) => b.score - a.score) // Sort by score descending
            .map(rec => rec.jobId);

        // Fetch full job details for recommended jobs from your DB, maintaining order
        const recommendedJobs = await Job.find({ _id: { $in: recommendedJobIds }, status: 'active' })
            .populate('company', 'companyName headquarters logoUrl');

        // Reorder jobs based on AI's scores
        const orderedJobs = recommendedJobIds.map(id =>
            recommendedJobs.find(job => job._id.toString() === id)
        ).filter(job => job != null); // Filter out nulls if some jobs were not found/active

        // Update user's lastRecommendedJobs in the background
        // Limit to N most recent recommendations to avoid unbounded growth
        const updateUserData = aiRecommendations.map(rec => ({
            job: rec.jobId,
            score: rec.score,
            date: new Date()
        })).slice(0, 10); // Store last 10 recommendations

        await User.findByIdAndUpdate(userId, {
            $set: { lastRecommendedJobs: updateUserData }
        }, { new: true }).catch(err => console.error('Error updating user lastRecommendedJobs:', err.message));


        res.json(orderedJobs);

    } catch (err) {
        console.error('Error fetching AI recommended jobs:', err);
        // Fallback or provide a user-friendly message
        res.status(500).json({ message: 'Failed to retrieve personalized job recommendations. Please try again later.', error: err.message });
    }
});


// GET one job by ID (Public)
// This public route still needs to fetch the job. authorizeOwner is for *protected* routes.
// The fetching logic is intentionally replicated here for clarity, as it's a public endpoint
// and authorizeOwner also includes authorization checks which are not desired for public access.
router.get('/:id', async (req, res, next) => {
  let job;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid Job ID format' });
    }
    job = await Job.findById(req.params.id); // Fetch full job to increment views
    if (job == null) {
      return res.status(404).json({ message: 'Cannot find job' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.job = job; // Attach for next middleware/handler
  next();
}, async (req, res) => {
  try {
    res.job.viewsCount = (res.job.viewsCount || 0) + 1;
    await res.job.save();

    // --- AI INTEGRATION: Notify AI service about job view interaction ---
    if (req.user && req.user.role === 'jobseeker') { // Only track if it's a logged-in job seeker
        aiApiClient.notifyJobInteraction({
            userId: req.user.id,
            jobId: res.job._id.toString(),
            type: 'view' // Type of interaction
        })
        .then(response => console.log('AI Job view interaction notified successfully.'))
        .catch(error => console.error('Failed to notify AI of job view interaction:', error.message));
    }
    // ------------------------------------------------------------------

    const job = await res.job.populate('company', 'companyName headquarters logoUrl description website contactPerson contactPhone');
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE one job (Company role required)
router.post('/', verifyToken, authorizeRoles('company', 'admin'), async (req, res) => {
  const {
    company, title, description, location, jobType, salaryRange,
    requirements, responsibilities, benefits, applicationDeadline,
    status, isFlagged, flagReason,
    requiredSkills, preferredSkills, technologiesUsed, seniorityLevel, industry,
    companySize, workEnvironment
  } = req.body;

  // If a company is posting, ensure the 'company' field matches their own ID
  if (req.user.role === 'company' && company !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only post jobs for your own company.' });
  }
  // For admin, the 'company' field must be provided and valid
  if (req.user.role === 'admin' && !company) {
    return res.status(400).json({ message: 'Admin must specify a company ID for the job.' });
  }

  // Basic validation for company ObjectId existence
  if (!mongoose.Types.ObjectId.isValid(company)) {
    return res.status(400).json({ message: 'Invalid Company ID format.' });
  }
  const existingCompany = await Company.findById(company);
  if (!existingCompany) {
    return res.status(400).json({ message: 'Company not found.' });
  }

  if (applicationDeadline) {
    const deadlineDate = new Date(applicationDeadline);
    if (isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ message: 'Invalid application deadline date format.' });
    }
    if (deadlineDate < new Date()) {
      return res.status(400).json({ message: 'Application deadline must be in the future.' });
    }
  }

  const job = new Job({
    company, title, description, location, jobType, salaryRange,
    requirements, responsibilities, benefits, applicationDeadline,
    status: status || 'pending_review', // Default to pending review for new jobs
    isFlagged: isFlagged || false,
    flagReason: flagReason || '',
    requiredSkills, preferredSkills, technologiesUsed, seniorityLevel, industry,
    companySize, workEnvironment
  });

  try {
    // --- AI INTEGRATION: Scam Detection before saving ---
    const scamDetectionResult = await aiApiClient.detectScam({
        jobTitle: title,
        jobDescription: description,
        companyName: existingCompany.companyName // Use the fetched company name
    });

    if (scamDetectionResult.isSuspicious) {
        job.isFlagged = true;
        job.flagReason = `AI Flagged: ${scamDetectionResult.flags.join(', ')} (Score: ${scamDetectionResult.score.toFixed(2)})`;
        job.status = 'pending_review'; // Force pending review if AI flags it
        console.warn(`Job ${job.title} from ${existingCompany.companyName} flagged by AI for: ${job.flagReason}`);
    }
    // ---------------------------------------------------

    const newJob = await job.save();
    const populatedJob = await newJob.populate('company', 'companyName headquarters logoUrl');
    res.status(201).json(populatedJob);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// UPDATE one job (Admin or owner company required)
// authorizeOwner(Job, 'company') will fetch the job and attach it to res.job,
// then check if the authenticated company owns this job, or if they are admin.
router.patch('/:id', verifyToken, authorizeRoles('company', 'admin'), authorizeOwner(Job, 'company'), async (req, res) => {
  const {
    company, title, description, location, jobType, salaryRange,
    requirements, responsibilities, benefits, applicationDeadline,
    status, viewsCount, isFlagged, flagReason,
    requiredSkills, preferredSkills, technologiesUsed, seniorityLevel, industry,
    companySize, workEnvironment
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

  // New Job Fields
  if (requiredSkills != null) res.job.requiredSkills = requiredSkills;
  if (preferredSkills != null) res.job.preferredSkills = preferredSkills;
  if (technologiesUsed != null) res.job.technologiesUsed = technologiesUsed;
  if (seniorityLevel != null) res.job.seniorityLevel = seniorityLevel;
  if (industry != null) res.job.industry = industry;
  if (companySize != null) res.job.companySize = companySize;
  if (workEnvironment != null) res.job.workEnvironment = workEnvironment;


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

  // Admin and Company can change status
  if (status != null && (req.user.role === 'admin' || req.user.role === 'company')) {
    res.job.status = status;
  } else if (status != null && req.user.role !== 'admin' && req.user.role !== 'company') {
      return res.status(403).json({ message: 'Access denied. You cannot change job status.' });
  }

  // isFlagged and flagReason are usually admin-only, or set by AI
  if (isFlagged != null && req.user.role === 'admin') {
      res.job.isFlagged = isFlagged;
  } else if (isFlagged != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only admin can flag jobs.' });
  }
  if (flagReason != null && req.user.role === 'admin') {
      res.job.flagReason = flagReason;
  } else if (flagReason != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only admin can set flag reasons.' });
  }
  // viewsCount should not be directly updatable via PATCH by client

  try {
    const updatedJob = await res.job.save();
    const populatedJob = await updatedJob.populate('company', 'companyName headquarters logoUrl');
    res.json(populatedJob);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// DELETE one job (Admin or owner company required)
// authorizeOwner(Job, 'company') will fetch the job and attach it to res.job
router.delete('/:id', verifyToken, authorizeRoles('company', 'admin'), authorizeOwner(Job, 'company'), async (req, res) => {
  try {
    await res.job.deleteOne(); // This will trigger the pre('deleteOne') hook in Job model
    res.json({ message: 'Deleted job successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH to increment viewsCount (Public - can be used from client side)
// OBSERVED: Replicated getJob logic from GET /:id. This is acceptable for clarity
// on public routes where authorizeOwner (with its auth checks) is not suitable.
// OBSERVED: No verifyToken or authorizeRoles. This allows anonymous users to increment
// view counts. This is common for public job boards but means bots could inflate numbers.
// If unique or authenticated views are required, a more sophisticated mechanism would be needed.
router.patch('/:id/view', async (req, res, next) => {
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
  res.job = job; // Attach for next middleware/handler
  next();
}, async (req, res) => {
  try {
    res.job.viewsCount = (res.job.viewsCount || 0) + 1;
    await res.job.save();

    // --- AI INTEGRATION: Notify AI service about job view interaction (even for public views) ---
    // If you want to track anonymous views, you might need to send IP or a session ID.
    // For now, only send if a job seeker is logged in for personalized tracking.
    if (req.user && req.user.role === 'jobseeker') {
        aiApiClient.notifyJobInteraction({
            userId: req.user.id,
            jobId: res.job._id.toString(),
            type: 'view' // Type of interaction
        })
        .then(response => console.log('AI Job view interaction notified successfully via PATCH /:id/view.'))
        .catch(error => console.error('Failed to notify AI of job view interaction via PATCH /:id/view:', error.message));
    }
    // ------------------------------------------------------------------------------------------

    res.json({ message: 'Views count updated', viewsCount: res.job.viewsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;