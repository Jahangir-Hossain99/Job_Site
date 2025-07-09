// models/Job.js
import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company', // Reference to the Company document that posted this job
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
    timestamps: true // createdAt and updatedAt fields
});

export default mongoose.model('Job', jobSchema);