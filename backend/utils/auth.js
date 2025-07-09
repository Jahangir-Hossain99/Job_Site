// utils/auth.js (NO CHANGE TO THIS FILE, it's already structured for this)
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token missing from Authorization header' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};

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

// authorizeOwner middleware: Checks if the authenticated user/company is the owner of the resource
// Model: The Mongoose model of the resource (e.g., User, Company, Job, Application)
// resourceIdField: The field in the resource document that stores the owner's ID (e.g., '_id' for User/Company, 'company' for Job, 'jobSeeker' for Application)
// userIdFieldInToken: The field in the JWT payload that stores the user/company ID (default is 'id')
export const authorizeOwner = (Model, resourceIdField, userIdFieldInToken = 'id') => {
  return async (req, res, next) => {
    // This middleware assumes verifyToken has already run and populated req.user
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required for ownership check.' });
    }

    // Admins can bypass ownership checks
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      // Find the resource using the ID from the request parameters
      const resource = await Model.findById(req.params.id);
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found.' });
      }

      // Special handling for Company: The Company's _id is its own owner ID
      if (Model.modelName === 'Company') {
        if (resource._id.toString() === req.user[userIdFieldInToken].toString()) {
          res.company = resource; // Attach for subsequent middleware/route handlers
          return next();
        }
      }
      // Special handling for User: The User's _id is its own owner ID
      else if (Model.modelName === 'User') {
        if (resource._id.toString() === req.user[userIdFieldInToken].toString()) {
            res.user = resource; // Attach for subsequent middleware/route handlers
            return next();
        }
      }
      // For other models (Job, Application), check if the resourceIdField matches the user ID in token
      else if (resource[resourceIdField] && resource[resourceIdField].toString() === req.user[userIdFieldInToken].toString()) {
        if (Model.modelName === 'Job') res.job = resource;
        else if (Model.modelName === 'Application') res.application = resource;
        return next();
      }

      return res.status(403).json({ message: 'Access denied. You do not own this resource or are not authorized.' });

    } catch (error) {
      console.error("Authorization owner error:", error);
      // Check for CastError (invalid ID format)
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        return res.status(400).json({ message: `Invalid ID format for ${Model.modelName}` });
      }
      return res.status(500).json({ message: 'Server error during authorization.' });
    }
  };
};