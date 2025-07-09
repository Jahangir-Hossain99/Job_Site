// dumpUsers.js
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './models/User.js';     // Import User model
import Company from './models/Company.js'; // Import Company model

async function dumpDataToConsole() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.DATABASE_URL); // Removed deprecated options
        console.log("MongoDB connected successfully!");

        console.log("\n--- Dumping User Data ---");
        const users = await User.find({});
        console.log(`Found ${users.length} users.`);
        if (users.length === 0) {
            console.log("No users found in the database.");
        } else {
            users.forEach((user, index) => {
                const userObj = user.toObject();
                delete userObj.password; // Exclude password
                console.log(`\n--- User ${index + 1} ---`);
                console.log(JSON.stringify(userObj, null, 2));
            });
        }

        console.log("\n--- Dumping Company Data ---");
        const companies = await Company.find({});
        console.log(`Found ${companies.length} companies.`);
        if (companies.length === 0) {
            console.log("No companies found in the database.");
        } else {
            companies.forEach((company, index) => {
                const companyObj = company.toObject();
                delete companyObj.password; // Exclude password
                console.log(`\n--- Company ${index + 1} ---`);
                console.log(JSON.stringify(companyObj, null, 2));
            });
        }

        console.log("\n--- Dumping Job Data (recent 5) ---");
        // Limit to 5 most recent jobs to avoid overly long output
        const jobs = await Job.find({}).sort({ createdAt: -1 }).limit(5).populate('company', 'companyName');
        console.log(`Found ${jobs.length} recent jobs.`);
        if (jobs.length === 0) {
            console.log("No jobs found in the database.");
        } else {
            jobs.forEach((job, index) => {
                const jobObj = job.toObject();
                console.log(`\n--- Job ${index + 1} ---`);
                console.log(JSON.stringify(jobObj, null, 2));
            });
        }

        console.log("\n--- Dumping Application Data (recent 5) ---");
        // Limit to 5 most recent applications
        const applications = await Application.find({})
            .sort({ createdAt: -1 }).limit(5)
            .populate('job', 'title')
            .populate('jobSeeker', 'fullName');
        console.log(`Found ${applications.length} recent applications.`);
        if (applications.length === 0) {
            console.log("No applications found in the database.");
        } else {
            applications.forEach((app, index) => {
                const appObj = app.toObject();
                console.log(`\n--- Application ${index + 1} ---`);
                console.log(JSON.stringify(appObj, null, 2));
            });
        }

    } catch (error) {
        console.error("\n--- Error dumping data ---");
        console.error(error);
    } finally {
        console.log("\nDisconnecting from MongoDB...");
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
    }
}

// Execute the function
dumpDataToConsole();