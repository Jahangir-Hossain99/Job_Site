// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
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
        enum: ['jobseeker', 'admin'], // Roles for User model
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
        // Consider adding phone number validation regex if needed
    },
    location: {
        type: String,
        trim: true,
    },
    headline: { // A short professional headline for job seekers
        type: String,
        trim: true,
        maxlength: [100, 'Headline cannot exceed 100 characters']
    },
    resumeUrl: { // URL to the job seeker's latest resume
        type: String,
        trim: true,
    },
    skills: {
        type: [String], // Array of skills
        default: []
    },
    experience: [{ // Array of work experience objects
        title: String,
        company: String,
        startDate: Date,
        endDate: Date,
        description: String
    }],
    education: [{ // Array of education objects
        degree: String,
        Institution: String,
        startDate: Date,
        endDate: Date
    }],
    lastLogin: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // createdAt and updatedAt fields
});

// Pre-save hook for password hashing
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password (for login)
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);