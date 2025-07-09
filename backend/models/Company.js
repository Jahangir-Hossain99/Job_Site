// models/Company.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const companySchema = new mongoose.Schema({
    email: { // Main contact email for the company account
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: [8, 'Password must be at least 8 characters long']
    },
    role: {
        type: String,
        required: true,
        enum: ['company', 'admin'], // Roles for Company model (though admin would usually be in User model)
        default: 'company'
    },
    companyName: {
        type: String,
        required: true,
        unique: true, // Ensures unique company names
        trim: true,
        minlength: [2, 'Company name must be at least 2 characters long']
    },
    industry: {
        type: String,
        trim: true,
    },
    website: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    location: {
        type: String,
        trim: true,
    },
    logoUrl: {
        type: String, // URL to the company logo
        trim: true,
    },
    contactPhone: {
        type: String,
        trim: true,
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    isVerified: { // For company verification (e.g., by admin)
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Pre-save hook for password hashing
companySchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password (for login)
companySchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('Company', companySchema);