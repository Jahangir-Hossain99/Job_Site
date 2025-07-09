// models/Application.js
import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job', // Reference to the Job document being applied for
        required: true,
        index: true
    },
    jobSeeker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the Job Seeker (User) who applied
        required: true,
        index: true
    },
    company: { // Denormalized, derived from the Job's company field
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'interview_scheduled', 'offered', 'rejected', 'withdrawn'],
        default: 'pending',
        index: true
    },
    appliedAt: {
        type: Date,
        default: Date.now
    },
    resumeSnapshotUrl: {
        type: String, // URL to the resume version submitted for this job
    },
    coverLetterSnapshotUrl: {
        type: String, // URL to the cover letter version submitted for this job
    },
    interviewScheduledAt: { type: Date },
    interviewLink: { type: String },
}, {
    timestamps: true
});

// Ensure a job seeker can only apply to a specific job once
applicationSchema.index({ job: 1, jobSeeker: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema);