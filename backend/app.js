// app.js
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors'; // Import cors middleware
import http from 'http'; // Import Node.js http module
import { Server } from 'socket.io'; // Import the Server class from socket.io

// Helper for __dirname in ES Modules (not strictly used in this file, but can be kept)
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

const app = express();
// Enable CORS for all Express routes (separate from Socket.IO CORS)
app.use(cors());
const PORT = process.env.PORT || 3000;

// Create an HTTP server and pass the Express app as its request handler
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
// Configure CORS for Socket.IO specifically
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173", // IMPORTANT: Set your frontend URL here for production
        methods: ["GET", "POST"]
    }
});

// Import dedicated route files
import usersRouter from './routes/users.js';
import companiesRouter from './routes/companies.js';
import jobsRouter from './routes/jobs.js';
import applicationsRouter from './routes/applications.js';
import messagesRouter from './routes/messages.js';
import authRouter from './routes/auth.js';

// Import the chat service
import initializeChat from './services/chatService.js'; // Adjust path as needed

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));


// Middleware for Express routes
app.use(express.json());


// Root path for testing
app.get('/', (req, res) => {
    res.send('Welcome to the Job Portal API! Please use /auth/register or /auth/login for authentication.');
});

// Mount the authentication routes
app.use('/auth', authRouter);

// Mount the dedicated resource route files under specific paths
app.use('/users', usersRouter);
app.use('/companies', companiesRouter);
app.use('/jobs', jobsRouter);
app.use('/applications', applicationsRouter);
app.use('/messages', messagesRouter);


// Initialize Socket.IO chat handling
initializeChat(io); // Pass the io instance to your chat service


// Global error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging
    res.status(500).send('Something broke!'); // Send a generic error response
});


// Start the HTTP server (which Express and Socket.IO are attached to)
server.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
    console.log('Socket.IO is listening for WebSocket connections.');
});