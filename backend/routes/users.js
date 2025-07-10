// routes/users.js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';

import User from '../models/User.js';
import Job from '../models/Job.js'; // Needed to fetch job details for tailoring suggestions
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
        return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: err.message });
};

// --- ROUTES ---

// GET all users (Admin only)
router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Admin can view all user data, including potentially sensitive AI vectors if needed, but not password
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one user by ID (Admin or User's own profile)
router.get('/:id', verifyToken, authorizeRoles('jobseeker', 'admin'), authorizeOwner(User, '_id'), async (req, res) => {
  try {
    // authorizeOwner middleware already attaches the user to res.user and ensures authorization
    // Populate lastRecommendedJobs to show job titles
    const user = await res.user.populate('lastRecommendedJobs.job', 'title company location');

    // Refinement: Simpler password exclusion
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE one user (Handled by /auth/register/jobseeker) - route remains commented out
/*
router.post('/', async (req, res) => {
  const { email, password, fullName, phoneNumber, location, role } = req.body;

  const user = new User({
    email, password, fullName, phoneNumber, location, role: role || 'jobseeker'
  });

  try {
    const newUser = await user.save();
    const userResponse = newUser.toObject();
    delete userResponse.password; // Remove password from response
    res.status(201).json(userResponse);
  } catch (err) {
    handleMongooseError(res, err);
  }
});
*/

// UPDATE one user (Admin or User's own profile)
router.patch('/:id', verifyToken, authorizeRoles('jobseeker', 'admin'), authorizeOwner(User, '_id'), async (req, res) => {
  const {
    email, password, fullName, phoneNumber, location, role,
    headline, resumeUrl, portfolioUrl, skills, experience, education,
    certifications, projects, languages, jobPreferences
  } = req.body;

  // Destructure res.user for easier access
  const user = res.user;

  // Update user fields
  if (email != null) user.email = email;
  if (password != null) {
      user.password = password; // Hashing handled by pre-save hook
  }
  if (fullName != null) user.fullName = fullName;
  if (phoneNumber != null) user.phoneNumber = phoneNumber;
  if (location != null) user.location = location;
  if (headline != null) user.headline = headline;
  if (resumeUrl != null) user.resumeUrl = resumeUrl;
  if (portfolioUrl != null) user.portfolioUrl = portfolioUrl;
  if (skills != null) user.skills = skills;
  if (experience != null) user.experience = experience;
  if (education != null) user.education = education;
  if (certifications != null) user.certifications = certifications; // New field
  if (projects != null) user.projects = projects; // New field
  if (languages != null) user.languages = languages; // New field
  if (jobPreferences != null) {
    // Merging preferences:
    // This approach is fine; if jobPreferences in req.body contains empty arrays
    // for fields like jobTypes, it will overwrite the existing array.
    user.jobPreferences = { ...user.jobPreferences, ...jobPreferences };
  }

  // Only admin can change role
  if (role != null && req.user.role === 'admin') {
      user.role = role;
  } else if (role != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You cannot change roles.' });
  }

  try {
    const updatedUser = await user.save();

    // --- AI INTEGRATION: Notify AI service about profile update ---
    // Extract comprehensive data for the AI. Use updatedUser for latest data.
    const userProfileForAI = {
        userId: updatedUser._id.toString(),
        skills: updatedUser.skills,
        experience: updatedUser.experience,
        education: updatedUser.education,
        certifications: updatedUser.certifications,
        projects: updatedUser.projects,
        languages: updatedUser.languages,
        jobPreferences: updatedUser.jobPreferences,
        location: updatedUser.location,
        headline: updatedUser.headline,
        // Include any other relevant fields the AI model needs for real-time updates
    };
    aiApiClient.updateUserProfile(userProfileForAI)
        .then(response => console.log('AI User profile update notification sent successfully.'))
        .catch(error => console.error('Failed to notify AI of user profile update:', error.message));
    // -----------------------------------------------------------

    const userResponse = updatedUser.toObject();
    delete userResponse.password; // Remove password from response
    res.json(userResponse);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// DELETE one user (Admin or User's own profile)
router.delete('/:id', verifyToken, authorizeRoles('jobseeker', 'admin'), authorizeOwner(User, '_id'), async (req, res) => {
  try {
    // authorizeOwner middleware already attaches the user to res.user
    await res.user.deleteOne(); // This will trigger the pre('deleteOne') hook in User model
    res.json({ message: 'Deleted user successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- NEW AI-POWERED ROUTE ---
// GET AI-powered profile tailoring suggestions for a specific job (Job Seeker only)
router.get('/:id/profile-tailoring-suggestions-for-job/:jobId', verifyToken, authorizeRoles('jobseeker'), authorizeOwner(User, '_id'), async (req, res) => {
    try {
        const userId = req.params.id;
        const jobId = req.params.jobId;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ message: 'Invalid Job ID format' });
        }

        // Fetch the user's detailed profile (excluding sensitive/unnecessary fields for AI input)
        const userProfile = await User.findById(userId)
            .select('-password -aiProfileVector -lastRecommendedJobs') // Exclude AI-specific internal fields
            .lean(); // Use .lean() for plain JS object for AI input, avoids Mongoose overhead
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        // Fetch the job details needed by the AI for tailoring suggestions
        const jobDetails = await Job.findById(jobId)
            .select('title description requiredSkills preferredSkills technologiesUsed seniorityLevel industry')
            .lean();
        if (!jobDetails) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Call the AI service for suggestions
        const aiSuggestions = await aiApiClient.profileTailoringSuggestions({
            userId: userId, // Pass ID for AI to potentially log/track
            jobId: jobId,   // Pass ID for AI to potentially log/track
            userProfile: userProfile,
            jobDetails: jobDetails
        });

        res.json(aiSuggestions); // AI service expected to return { suggestions: [], tailoredResumePreview: "" }

    } catch (err) {
        console.error('Error fetching profile tailoring suggestions:', err);
        // Provide a user-friendly error message, especially if AI service is down
        res.status(500).json({ message: 'Failed to get profile tailoring suggestions. Please try again later.', error: err.message });
    }
});

export default router;