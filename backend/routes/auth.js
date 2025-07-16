// routes/auth.js
import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { generateToken } from '../utils/auth.js';

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
            return res.status(409).json({ message: 'Email already exists' });
        }
        if (err.keyValue.companyName) {
            return res.status(409).json({ message: 'Company name already exists' });
        }
    }
    res.status(500).json({ message: err.message });
};

// --- Register a new Job Seeker (User) ---
router.post('/register/user', async (req, res) => {
    const { email, password, fullName, phoneNumber, location } = req.body;

    // Basic input validation before hitting Mongoose
    if (!email || !password || !fullName) {
        return res.status(400).json({ message: 'Email, password, and full name are required.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }
    if (!/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const user = new User({
        email,
        password,
        fullName,
        phoneNumber,
        location,
        role: 'jobseeker'
    });

    try {
        const newUser = await user.save();
        const token = generateToken({ id: newUser._id, role: newUser.role, isCompany: false });

        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json({ message: 'User registered successfully', user: userResponse, token });
    } catch (err) {
        handleAuthError(res, err);
    }
});

// --- Register a new Company ---
router.post('/register/company', async (req, res) => {
    const { email, password, companyName, industry, website, description, headquarters, logoUrl, contactPerson, contactPhone } = req.body;

    // Basic input validation before hitting Mongoose
    if (!email || !password || !companyName) {
        return res.status(400).json({ message: 'Email, password, and company name are required.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }
    if (!/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
    }


    const company = new Company({
        email,
        password,
        companyName,
        industry,
        website,
        description,
        headquarters,
        logoUrl,
        contactPerson,
        contactPhone,
        role: 'company'
    });

    try {
        const newCompany = await company.save();
        const token = generateToken({ id: newCompany._id, role: newCompany.role, isCompany: true });

        const companyResponse = newCompany.toObject();
        delete companyResponse.password;

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
    entity = await User.findOne({ email }).select('+password');
    if (entity) {
        isCompany = false;
    } else {
        // If not found in User, try to find in Company model
        entity = await Company.findOne({ email }).select('+password');;
        if (entity) {
            isCompany = true;
        }
    }

    if (!entity) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await entity.comparePassword(password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({ id: entity._id, role: entity.role, isCompany: isCompany });

    const entityResponse = entity.toObject();
    delete entityResponse.password;

    res.status(200).json({ message: 'Login successful', entity: entityResponse, token });
});

export default router;