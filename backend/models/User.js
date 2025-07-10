// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Job from './Job.js'; // Import Job model for pre-deleteOne hook
import Application from './Application.js'; // Import Application model for pre-deleteOne hook

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false // Do not return password by default
    },
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    phoneNumber: {
        type: String,
        trim: true,
        match: [/^\+?\d{10,15}$/, 'Please fill a valid phone number']
    },
    location: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['jobseeker', 'admin'], // 'company' role handled by Company model
        default: 'jobseeker'
    },
    // Job Seeker Profile Fields
    headline: {
        type: String,
        trim: true,
        maxlength: [100, 'Headline cannot be more than 100 characters']
    },
    resumeUrl: {
        type: String,
        trim: true
    },
    portfolioUrl: {
        type: String,
        trim: true
    },
    skills: {
        type: [String],
        default: [],
        trim: true
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
        institution: String,
        startDate: Date,
        endDate: Date,
        description: String // Added: field to describe projects or achievements for education entry
    }],
    // New Field: Certifications
    certifications: [{
        name: { type: String, trim: true },
        issuingOrganization: { type: String, trim: true },
        issueDate: Date,
        expirationDate: Date,
        credentialUrl: { type: String, trim: true }
    }],
    // New Field: Projects
    projects: [{
        title: { type: String, trim: true },
        description: { type: String, trim: true }, // Detailed project description (AI input)
        technologiesUsed: { type: [String], default: [] }, // Specific tech stack (AI input)
        projectUrl: { type: String, trim: true }
    }],
    // New Field: Languages
    languages: [{
        name: { type: String, trim: true },
        proficiency: { type: String, enum: ['Basic', 'Conversational', 'Fluent', 'Native'], default: 'Basic' }
    }],
    // AI Integration Fields
    lastRecommendedJobs: [{ // Store last few recommended jobs for tracking/caching
        job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
        score: Number,
        date: { type: Date, default: Date.now }
    }],
    aiProfileVector: { // Optional: if AI needs to store a vector representation of user profile
        type: [Number], // Array of numbers
        select: false // Do not return by default
    },
    // Refined jobPreferences for AI matching
    jobPreferences: {
        jobTypes: { // e.g., 'Full-time', 'Part-time'
            type: [String],
            default: []
        },
        locations: {
            type: [String],
            default: []
        },
        industries: {
            type: [String],
            default: []
        },
        salaryExpectation: {
            min: Number,
            max: Number
        },
        seniorityLevelPreference: { // Added: Seniority level preference
            type: [String],
            enum: ['Entry-level', 'Mid-level', 'Senior', 'Manager', 'Executive'],
            default: []
        },
        companySizePreference: { // Added: Company size preference
            type: [String],
            enum: ['Small (1-50)', 'Medium (51-500)', 'Large (501+)'],
            default: []
        },
        workEnvironmentPreference: { // Added: Work environment preference
            type: [String],
            default: [] // e.g., 'Collaborative', 'Independent', 'Fast-paced', 'Remote', 'Hybrid'
        }
    }
}, { timestamps: true });

// Password hashing middleware
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Pre-deleteOne hook to delete associated applications when a user is deleted
userSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {
        // Find and delete all applications by this job seeker
        await Application.deleteMany({ jobSeeker: this._id });
        console.log(`Deleted applications for user: ${this._id}`);
        next();
    } catch (error) {
        console.error('Error deleting applications for user:', error);
        next(error);
    }
});


const User = mongoose.model('User', userSchema);
export default User;