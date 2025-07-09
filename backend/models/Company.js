// models/Company.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
// No need to import Job here, we'll use this.model('Job')

const companySchema = new mongoose.Schema({
    // ... (existing schema properties) ...
    email: {
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
        enum: ['company', 'admin'],
        default: 'company'
    },
    companyName: {
        type: String,
        required: true,
        unique: true,
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
    headquarters: {
        type: String,
        trim: true,
    },
    logoUrl: {
        type: String,
        trim: true,
    },
    contactPerson: {
        type: String,
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
    isVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Pre-save hook for password hashing (already present)
companySchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password (for login) (already present)
companySchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// --- NEW: Pre-delete hook for cascading deletes ---
companySchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    console.log(`Deleting all jobs for company: ${this._id}`);
    // Delete all jobs posted by this company
    await this.model('Job').deleteMany({ company: this._id });
    next();
});

export default mongoose.model('Company', companySchema);