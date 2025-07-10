// app.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Import dedicated route files
import usersRouter from './routes/users.js';
import companiesRouter from './routes/companies.js';
import jobsRouter from './routes/jobs.js';
import applicationsRouter from './routes/applications.js';
import authRouter from './routes/auth.js'; // <-- NEW: Import auth router


// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL) // Removed deprecated options
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));


// Middleware
app.use(express.json()); // Parses JSON bodies from incoming requests


// Root path for testing
app.get('/', (req, res) => {
  res.send('Welcome to the Job Portal API! Please use /auth/register or /auth/login for authentication.');
});

// Mount the authentication routes
app.use('/auth', authRouter); // <-- NEW: Mount auth router


// Mount the dedicated resource route files under specific paths
// These routes will now be protected by authentication/authorization middleware in their respective files
app.use('/users', usersRouter);
app.use('/companies', companiesRouter);
app.use('/jobs', jobsRouter);
app.use('/applications', applicationsRouter);


// Simple error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});