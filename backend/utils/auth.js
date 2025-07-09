// utils/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Function to generate a JWT token
// Payload should contain user/company ID, role, and potentially isCompany flag
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' }); // Token expires in 1 hour
};

// Middleware to verify JWT token
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  // Expecting "Bearer TOKEN"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token missing from Authorization header' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach decoded user/company info to the request
    // This allows subsequent middleware/routes to know who is making the request
    req.user = decoded; // { id: '...', role: 'jobseeker', isCompany: false }
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' }); // Forbidden
  }
};

// Middleware for role-based authorization
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Access denied. No role information.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Requires one of: ${roles.join(', ')} roles.` });
    }
    next();
  };
};

// Middleware to authorize ownership of a resource
// Requires verifyToken to run first to populate req.user
// 'resourceIdField' is the name of the field in the resource document that holds the owner's ID (e.g., 'jobSeeker' for an Application, 'company' for a Job)
export const authorizeOwner = (Model, resourceIdField, userIdFieldInToken = 'id') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required for ownership check.' });
    }

    try {
      const resource = await Model.findById(req.params.id);
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found.' });
      }

      // Check if the authenticated user/company ID matches the owner ID in the resource
      if (resource[resourceIdField].toString() !== req.user[userIdFieldInToken].toString()) {
        // If not the owner, check if they are an admin
        if (req.user.role === 'admin') {
          next(); // Admins can bypass ownership check
        } else {
          return res.status(403).json({ message: 'Access denied. You do not own this resource.' });
        }
      } else {
        next(); // User/Company owns the resource
      }
    } catch (error) {
      console.error("Authorization owner error:", error);
      return res.status(500).json({ message: 'Server error during authorization.' });
    }
  };
};
