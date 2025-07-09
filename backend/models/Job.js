// models/Job.js
import mongoose from 'mongoose';
// No need to import Application here, we'll use this.model('Application')

const jobSchema = new mongoose.Schema({
    // ... (existing schema properties) ...
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: [5, 'Job title must be at least 5 characters long']
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: [50, 'Job description must be at least 50 characters long']
    },
    location: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    jobType: {
        type: String,
        required: true,
        enum: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Remote'],
        index: true
    },
    salaryRange: {
        min: Number,
        max: Number,
        currency: { type: String, default: 'BDT' },
    },
    requirements: {
        type: [String],
        default: [],
        index: true
    },
    responsibilities: {
        type: [String],
        default: []
    },
    benefits: {
        type: [String],
        default: []
    },
    applicationDeadline: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['active', 'closed', 'filled', 'pending_review', 'rejected'],
        default: 'pending_review',
        index: true
    },
    applicants: [{ // Array of ObjectIds referencing Application documents (optional, could be done via Application.find({ job: jobId }))
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Application'
    }],
    viewsCount: {
        type: Number,
        default: 0
    },
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String },
}, {
    timestamps: true
});

// --- NEW: Pre-delete hook for cascading deletes ---
jobSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    console.log(`Deleting all applications for job: ${this._id}`);
    // Delete all applications submitted for this job
    await this.model('Application').deleteMany({ job: this._id });
    next();
});

export default mongoose.model('Job', jobSchema);