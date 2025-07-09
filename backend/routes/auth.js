// routes/auth.js
import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import User from '../models/User.js'; // Assuming User model path
import Company from '../models/Company.js'; // Assuming Company model path
import { generateToken } from '../utils/auth.js'; // Import the token generation utility

// Helper for consistent Mongoose validation/duplicate error handling
const handleAuthError = (res, err) => {
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    if (err.code === 11000) {
        if (err.keyValue.email) {
            return res.status(409).json({ message: 'Email already exists' }); // 409 Conflict
        }
        if (err.keyValue.companyName) { // For company registration
            return res.status(409).json({ message: 'Company name already exists' }); // 409 Conflict
        }
    }
    res.status(500).json({ message: err.message });
};

// --- Register a new Job Seeker (User) ---
router.post('/register/user', async (req, res) => {
    const { email, password, fullName, phoneNumber, location } = req.body; // Role will default to 'jobseeker'

    const user = new User({
        email,
        password, // Password will be hashed by the pre-save hook in User model
        fullName,
        phoneNumber,
        location,
        role: 'jobseeker' // Explicitly set role for job seeker registration
    });

    try {
        const newUser = await user.save();
        // Generate token upon successful registration
        const token = generateToken({ id: newUser._id, role: newUser.role, isCompany: false });

        const userResponse = newUser.toObject();
        delete userResponse.password; // Exclude password from response

        res.status(201).json({ message: 'User registered successfully', user: userResponse, token });
    } catch (err) {
        handleAuthError(res, err);
    }
});

// --- Register a new Company ---
router.post('/register/company', async (req, res) => {
    const { email, password, companyName, industry, website, description, headquarters, logoUrl, contactPerson, contactPhone } = req.body;

    const company = new Company({
        email,
        password, // Password will be hashed by the pre-save hook in Company model
        companyName,
        industry,
        website,
        description,
        headquarters,
        logoUrl,
        contactPerson,
        contactPhone,
        role: 'company' // Explicitly set role for company registration
    });

    try {
        const newCompany = await company.save();
        // Generate token upon successful registration
        const token = generateToken({ id: newCompany._id, role: newCompany.role, isCompany: true });

        const companyResponse = newCompany.toObject();
        delete companyResponse.password; // Exclude password from response

        res.status(201).json({ message: 'Company registered successfully', company: companyResponse, token });
    } catch (err) {
        handleAuthError(res, err);
    }
});


// --- User/Company Login ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    let entity;
    let isCompany = false;

    // Try to find in User model
    entity = await User.findOne({ email });
    if (entity) {
        isCompany = false;
    } else {
        // If not found in User, try to find in Company model
        entity = await Company.findOne({ email });
        if (entity) {
            isCompany = true;
        }
    }

    if (!entity) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare password using the model's method
    const isMatch = await entity.comparePassword(password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken({ id: entity._id, role: entity.role, isCompany: isCompany });

    const entityResponse = entity.toObject();
    delete entityResponse.password; // Exclude password

    res.status(200).json({ message: 'Login successful', entity: entityResponse, token });
});

export default router;


