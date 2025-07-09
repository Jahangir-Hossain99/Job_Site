// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
// No need to import Application here, we'll use this.model('Application')

const userSchema = new mongoose.Schema({
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
        enum: ['jobseeker', 'admin'],
        default: 'jobseeker'
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, 'Full name must be at least 2 characters long']
    },
    phoneNumber: {
        type: String,
        trim: true,
    },
    location: {
        type: String,
        trim: true,
    },
    headline: {
        type: String,
        trim: true,
        maxlength: [100, 'Headline cannot exceed 100 characters']
    },
    resumeUrl: {
        type: String,
        trim: true,
    },
    portfolioUrl: {
        type: String,
        trim: true,
    },
    skills: {
        type: [String],
        default: []
    },
    experience: [{
        title: String,
        company: String,
        startDate: Date,
        endDate: Date,
        description: String
    }],
    education: [{
        degree: String,
        university: String,
        startDate: Date,
        endDate: Date
    }],
    lastLogin: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Pre-save hook for password hashing (already present)
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password (for login) (already present)
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// --- NEW: Pre-delete hook for cascading deletes ---
userSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    console.log(`Deleting all applications for job seeker: ${this._id}`);
    // Delete all applications submitted by this user
    // We use this.model('Application') to avoid circular dependencies if Application also imported User
    await this.model('Application').deleteMany({ jobSeeker: this._id });
    next();
});

export default mongoose.model('User', userSchema);