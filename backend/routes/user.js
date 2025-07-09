// routes/users.js
import express from 'express';
const router = express.Router();
import User from '../models/User.js'; // Ensure the correct path and .js extension
import { verifyToken, authorizeRoles, authorizeOwner } from '../utils/auth.js'; // Import auth middleware
import bcrypt from 'bcrypt'; // Needed for password updates

// Middleware to get a single user by ID
async function getUser(req, res, next) {
  let user;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }
    user = await User.findById(req.params.id);
    if (user == null) {
      return res.status(404).json({ message: 'Cannot find user' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.user = user; // Attach the found user to the response object
  next(); // Move to the next middleware or route handler
}

// Helper for consistent Mongoose validation errors
const handleMongooseError = (res, err) => {
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    if (err.code === 11000) { // Duplicate key error
        if (err.keyValue.email) {
            return res.status(409).json({ message: 'Email already exists' });
        }
    }
    res.status(500).json({ message: err.message });
};

// --- ROUTES ---

// GET all users (Admin only)
router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await User.find();
    // Filter out passwords before sending the response
    res.json(users.map(user => {
      const userObj = user.toObject();
      delete userObj.password;
      return userObj;
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one user by ID (Admin or User's own profile)
router.get('/:id', verifyToken, getUser, (req, res) => {
  // Allow admin to view any profile, or user to view their own
  if (req.user.role === 'admin' || req.user.id === res.user._id.toString()) {
    const userResponse = res.user.toObject();
    delete userResponse.password; // Exclude password for security
    res.json(userResponse);
  } else {
    res.status(403).json({ message: 'Access denied. You can only view your own profile.' });
  }
});

// CREATE one user (typically handled by /auth/register/user)
// This route is generally not exposed if you have a dedicated auth registration endpoint.
// If you intend to have an admin create users, you would protect it:
/*
router.post('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { email, password, fullName, phoneNumber, location, role } = req.body;

  const user = new User({
    email, password, fullName, phoneNumber, location, role
  });

  try {
    const newUser = await user.save();
    const userResponse = newUser.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (err) {
    handleMongooseError(res, err);
  }
});
*/


// UPDATE one user (Admin or User's own profile)
// Allows partial updates using PATCH
router.patch('/:id', verifyToken, getUser, async (req, res) => {
  // Only admin can update any profile, or user can update their own
  if (req.user.role !== 'admin' && req.user.id !== res.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied. You can only update your own profile.' });
  }

  const {
    email, password, fullName, phoneNumber, location, headline,
    resumeUrl, portfolioUrl, skills, experience, education, role
  } = req.body;

  // Update fields only if they are provided in the request body
  if (email != null) res.user.email = email;
  if (password != null) {
      // Hashing is handled by the pre-save hook in the User model
      res.user.password = password;
  }
  if (fullName != null) res.user.fullName = fullName;
  if (phoneNumber != null) res.user.phoneNumber = phoneNumber;
  if (location != null) res.user.location = location;
  if (headline != null) res.user.headline = headline;
  if (resumeUrl != null) res.user.resumeUrl = resumeUrl;
  if (portfolioUrl != null) res.user.portfolioUrl = portfolioUrl;
  if (skills != null) res.user.skills = skills;
  if (experience != null) res.user.experience = experience;
  if (education != null) res.user.education = education;

  // Only admin can change roles
  if (role != null && req.user.role === 'admin') {
      res.user.role = role;
  } else if (role != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You cannot change your role.' });
  }

  try {
    const updatedUser = await res.user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password; // Exclude password from the response
    res.json(userResponse);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// DELETE one user (Admin or User's own profile)
router.delete('/:id', verifyToken, getUser, async (req, res) => {
  // Only admin can delete any profile, or user can delete their own
  if (req.user.role !== 'admin' && req.user.id !== res.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied. You can only delete your own profile.' });
  }

  try {
    await res.user.deleteOne();
    res.json({ message: 'Deleted user successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

// Admin should create users via a dedicated auth route, not this one.