// routes/companies.js
import express from 'express';
const router = express.Router();
import Company from '../models/Company.js';
import { verifyToken, authorizeRoles } from '../utils/auth.js'; // Import auth middleware
import mongoose from 'mongoose'; // For ObjectId validation

// Middleware to get a single company by ID
async function getCompany(req, res, next) {
  let company;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid Company ID format' });
    }
    company = await Company.findById(req.params.id);
    if (company == null) {
      return res.status(404).json({ message: 'Cannot find company' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.company = company;
  next();
}

// Helper for consistent Mongoose validation/duplicate error handling
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
        if (err.keyValue.companyName) {
            return res.status(409).json({ message: 'Company name already exists' });
        }
    }
    res.status(500).json({ message: err.message });
};


// --- ROUTES ---

// GET all companies (PUBLICLY ACCESSIBLE)
router.get('/', async (req, res) => { // Removed verifyToken and authorizeRoles
  try {
    const companies = await Company.find().select('-password -email -contactPhone'); // Exclude sensitive fields for public view
    res.json(companies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one company by ID (PUBLICLY ACCESSIBLE, but sensitive data protected)
router.get('/:id', getCompany, (req, res) => { // Removed verifyToken
  const companyResponse = res.company.toObject();
  delete companyResponse.password; // Always exclude password
  // For public view, you might want to exclude contact email/phone unless logged in/authorized
  // For now, we'll send it, but a more granular approach might be needed.
  res.json(companyResponse);
});

// CREATE one company (Handled by /auth/register/company)
// This route is generally not exposed if you have a dedicated auth registration endpoint.
// If you intend to have an admin create companies, you would protect it:
/*
router.post('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { email, password, companyName, industry, website, description, headquarters, logoUrl, contactPerson, contactPhone, isVerified, role } = req.body;

  const company = new Company({
    email, password, companyName, industry, website, description, headquarters, logoUrl, contactPerson, contactPhone, isVerified, role: role || 'company'
  });

  try {
    const newCompany = await company.save();
    const companyResponse = newCompany.toObject();
    delete companyResponse.password;
    res.status(201).json(companyResponse);
  } catch (err) {
    handleMongooseError(res, err);
  }
});
*/

// UPDATE one company (Admin or Company's own profile - PROTECTED)
router.patch('/:id', verifyToken, getCompany, async (req, res) => {
  // Only admin can update any profile, or company can update their own
  if (req.user.role !== 'admin' && (!req.user.isCompany || req.user.id !== res.company._id.toString())) {
    return res.status(403).json({ message: 'Access denied. You can only update your own company profile.' });
  }

  const {
    email, password, companyName, industry, website,
    description, headquarters, logoUrl, contactPerson, contactPhone,
    isVerified, role // Role and isVerified usually updated by admin
  } = req.body;

  // Update fields only if they are provided in the request body
  if (email != null) res.company.email = email;
  if (password != null) {
      res.company.password = password; // Hashing is handled by pre-save hook
  }
  if (companyName != null) res.company.companyName = companyName;
  if (industry != null) res.company.industry = industry;
  if (website != null) res.company.website = website;
  if (description != null) res.company.description = description;
  if (headquarters != null) res.company.headquarters = headquarters;
  if (logoUrl != null) res.company.logoUrl = logoUrl;
  if (contactPerson != null) res.company.contactPerson = contactPerson;
  if (contactPhone != null) res.company.contactPhone = contactPhone;

  // Only admin can change verification status or role
  if (isVerified != null && req.user.role === 'admin') {
      res.company.isVerified = isVerified;
  } else if (isVerified != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You cannot change verification status.' });
  }
  if (role != null && req.user.role === 'admin') {
      res.company.role = role;
  } else if (role != null && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You cannot change roles.' });
  }

  try {
    const updatedCompany = await res.company.save();
    const companyResponse = updatedCompany.toObject();
    delete companyResponse.password; // Exclude password from the response
    res.json(companyResponse);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// DELETE one company (Admin or Company's own profile - PROTECTED)
router.delete('/:id', verifyToken, getCompany, async (req, res) => {
  // Only admin can delete any company, or company can delete their own
  if (req.user.role !== 'admin' && (!req.user.isCompany || req.user.id !== res.company._id.toString())) {
    return res.status(403).json({ message: 'Access denied. You can only delete your own company profile.' });
  }

  try {
    await res.company.deleteOne();
    res.json({ message: 'Deleted company successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;