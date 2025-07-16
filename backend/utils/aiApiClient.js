// backend/utils/aiApiClient.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Adjust path if your .env is not in the project root

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

if (!AI_SERVICE_URL) {
    console.error("AI_SERVICE_URL is not defined in backend/.env. Please set it (e.g., AI_SERVICE_URL=http://localhost:5000/api/v1/ai)");
}

const aiApiClient = {
    /**
     * Calls the AI microservice to get job recommendations for a user.
     * @param {object} data - Contains userId and userProfile.
     * @returns {Promise<Array>} - Array of recommended jobs.
     */
    recommendJobs: async (data) => {
        try {
            console.log(`[AI API Client] Requesting job recommendations from: ${AI_SERVICE_URL}/recommend-jobs`);
            const response = await axios.post(`${AI_SERVICE_URL}/recommend-jobs`, data);
            return response.data;
        } catch (error) {
            console.error('[AI API Client] Error fetching job recommendations:', error.response ? error.response.data : error.message);
            throw new Error('Failed to get job recommendations from AI service');
        }
    },

    /**
     * Calls the AI microservice to screen candidates for a job.
     * @param {object} data - Contains jobId, jobDetails, and applicantIds.
     * @returns {Promise<Array>} - Array of screening results.
     */
    screenCandidates: async (data) => {
        try {
            console.log(`[AI API Client] Requesting candidate screening from: ${AI_SERVICE_URL}/screen-candidates`);
            const response = await axios.post(`${AI_SERVICE_URL}/screen-candidates`, data);
            return response.data;
        } catch (error) {
            console.error('[AI API Client] Error screening candidates:', error.response ? error.response.data : error.message);
            throw new Error('Failed to screen candidates with AI service');
        }
    },

    /**
     * Calls the AI microservice to detect if a job posting is a scam.
     * @param {object} data - Contains jobTitle, jobDescription, companyName.
     * @returns {Promise<object>} - Scam detection result (isSuspicious, score, flags).
     */
    detectScam: async (data) => {
        try {
            console.log(`[AI API Client] Requesting scam detection from: ${AI_SERVICE_URL}/detect-scam`);
            const response = await axios.post(`${AI_SERVICE_URL}/detect-scam`, data);
            return response.data;
        } catch (error) {
            console.error('[AI API Client] Error detecting scam:', error.response ? error.response.data : error.message);
            throw new Error('Failed to perform scam detection with AI service');
        }
    },

    /**
     * Calls the AI microservice to get profile tailoring suggestions for a job application.
     * @param {object} data - Contains userId, jobId, userProfile, jobDetails.
     * @returns {Promise<object>} - Profile tailoring suggestions.
     */
    profileTailoringSuggestions: async (data) => {
        try {
            console.log(`[AI API Client] Requesting profile tailoring suggestions from: ${AI_SERVICE_URL}/profile-tailoring-suggestions`);
            const response = await axios.post(`${AI_SERVICE_URL}/profile-tailoring-suggestions`, data);
            return response.data;
        } catch (error) {
            console.error('[AI API Client] Error getting tailoring suggestions:', error.response ? error.response.data : error.message);
            throw new Error('Failed to get profile tailoring suggestions from AI service');
        }
    },

    /**
     * Notifies the AI microservice about a user profile update.
     * @param {object} data - Contains userId and updated userProfile.
     * @returns {Promise<object>} - Confirmation message.
     */
    updateUserProfile: async (data) => {
        try {
            console.log(`[AI API Client] Notifying user profile update to: ${AI_SERVICE_URL}/update-user-profile`);
            const response = await axios.post(`${AI_SERVICE_URL}/update-user-profile`, data);
            return response.data;
        } catch (error) {
            console.error('[AI API Client] Error notifying user profile update:', error.response ? error.response.data : error.message);
            // Don't throw for notifications if the main operation doesn't depend on it
            return { message: "Failed to notify AI service about profile update." };
        }
    },

    /**
     * Notifies the AI microservice about a new job application.
     * @param {object} data - Contains applicationId, userId, jobId.
     * @returns {Promise<object>} - Confirmation message.
     */
    notifyNewApplication: async (data) => {
        try {
            console.log(`[AI API Client] Notifying new application to: ${AI_SERVICE_URL}/notify-new-application`);
            const response = await axios.post(`${AI_SERVICE_URL}/notify-new-application`, data);
            return response.data;
        } catch (error) {
            console.error('[AI API Client] Error notifying new application:', error.response ? error.response.data : error.message);
            return { message: "Failed to notify AI service about new application." };
        }
    },

    /**
     * Notifies the AI microservice about a job interaction (view, click).
     * @param {object} data - Contains userId, jobId, type (e.g., 'view', 'click').
     * @returns {Promise<object>} - Confirmation message.
     */
    notifyJobInteraction: async (data) => {
        try {
            console.log(`[AI API Client] Notifying job interaction to: ${AI_SERVICE_URL}/notify-job-interaction`);
            const response = await axios.post(`${AI_SERVICE_URL}/notify-job-interaction`, data);
            return response.data;
        } catch (error) {
            console.error('[AI API Client] Error notifying job interaction:', error.response ? error.response.data : error.message);
            return { message: "Failed to notify AI service about job interaction." };
        }
    },
};

export default aiApiClient;