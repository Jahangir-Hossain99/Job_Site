// routes/companies.js
import express from 'express';
const router = express.Router();
import Company from '../models/Company.js';
import { verifyToken, authorizeRoles, authorizeOwner } from '../utils/auth.js';
import mongoose from 'mongoose';

const handleMongooseError = (res, err) => {
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    if (err.code === 11000) {
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
router.get('/', async (req, res) => {
  try {
    // Select specific fields for public view
    const companies = await Company.find().select('-password -email -contactPhone -contactPerson');
    res.json(companies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one company by ID (PUBLICLY ACCESSIBLE, but sensitive data protected)
router.get('/:id', async (req, res, next) => {
  let company;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid Company ID format' });
    }
    // Explicitly select fields to exclude sensitive data for public view
    company = await Company.findById(req.params.id).select('-password -email -contactPhone -contactPerson');
    if (company == null) {
      return res.status(404).json({ message: 'Cannot find company' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.company = company; // Attach for next middleware/handler
  next();
}, (req, res) => {
  // companyResponse already cleansed by the .select() in findById
  res.json(res.company);
});


// CREATE one company (Handled by /auth/register/company) - route remains commented out
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
router.patch('/:id', verifyToken, authorizeRoles('company', 'admin'), authorizeOwner(Company, '_id'), async (req, res) => {
  const {
    email, password, companyName, industry, website,
    description, headquarters, logoUrl, contactPerson, contactPhone,
    isVerified, role
  } = req.body;

  if (email != null) res.company.email = email;
  if (password != null) {
      res.company.password = password; // Hashing is handled by the pre-save hook
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
    delete companyResponse.password;
    // For internal/authorized view, sensitive fields can remain or be selectively exposed
    res.json(companyResponse);
  } catch (err) {
    handleMongooseError(res, err);
  }
});

// DELETE one company (Admin or Company's own profile - PROTECTED)
router.delete('/:id', verifyToken, authorizeRoles('company', 'admin'), authorizeOwner(Company, '_id'), async (req, res) => {
  try {
    await res.company.deleteOne(); // This will trigger the pre('deleteOne') hook in Company model
    res.json({ message: 'Deleted company successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;