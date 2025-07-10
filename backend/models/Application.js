// models/Application.js
import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    jobSeeker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    company: { // Storing company ID directly for easy access/filtering
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'interview_scheduled', 'offered', 'rejected', 'withdrawn', 'hired'],
        default: 'pending'
    },
    appliedAt: {
        type: Date,
        default: Date.now
    },
    resumeSnapshotUrl: { // URL to the resume submitted for this specific application
        type: String,
        trim: true
    },
    coverLetterSnapshotUrl: { // URL to the cover letter submitted for this specific application
        type: String,
        trim: true
    },
    interviewScheduledAt: {
        type: Date
    },
    interviewLink: {
        type: String,
        trim: true
    },
    // AI Integration Fields
    aiScreeningScore: { // AI's confidence score for this candidate's fit for the job
        type: Number,
        min: 0,
        max: 1,
        default: null
    },
    aiScreeningReasons: { // Reasons/keywords from AI for the score
        type: [String],
        default: []
    },
    aiInterviewAssessment: { // AI's summary/assessment of interview performance (if applicable)
        type: String,
        trim: true
    }
}, { timestamps: true });

// Compound unique index to prevent a job seeker from applying to the same job twice
applicationSchema.index({ jobSeeker: 1, job: 1 }, { unique: true });

const Application = mongoose.model('Application', applicationSchema);
export default Application;