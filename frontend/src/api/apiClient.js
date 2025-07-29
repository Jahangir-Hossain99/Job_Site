// frontend/src/api/apiClient.js
import axios from 'axios';

// IMPORTANT: Set this to the exact base URL of your backend API.
// Based on your console output, your backend is running on port 3000
// and the routes like '/jobs' are directly under that root, not '/api/jobs'.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'; // Corrected to 3000, removed /api

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add the token to headers
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// API Endpoints - these paths are now relative to 'http://localhost:3000'
const api = {
    // Auth
    registerUser: (userData) => apiClient.post('/auth/register/jobseeker', userData),
    registerCompany: (companyData) => apiClient.post('/auth/register/company', companyData),
    login: (credentials) => apiClient.post('/auth/login', credentials),
    logout: () => apiClient.post('/auth/logout'),

    // Users (Job Seekers)
    getUserProfile: (userId) => apiClient.get(`/users/${userId}`),
    updateUserProfile: (userId, userData) => apiClient.put(`/users/${userId}`, userData),
    deleteUserProfile: (userId) => apiClient.delete(`/users/${userId}`),

    // Companies
    getCompanyById: (companyId) => apiClient.get(`/companies/${companyId}`),
    updateCompanyProfile: (companyId, companyData) => apiClient.put(`/companies/${companyId}`, companyData),

    // Jobs
    createJob: (jobData) => apiClient.post('/jobs', jobData),
    getAllJobs: () => apiClient.get('/jobs'),
    getJobById: (jobId) => apiClient.get(`/jobs/${jobId}`),
    getJobsByCompanyId: (companyId) => apiClient.get(`/jobs/company/${companyId}`),
    updateJob: (jobId, jobData) => apiClient.put(`/jobs/${jobId}`, jobData), // This is the one for EditJobPage
    deleteJob: (jobId) => apiClient.delete(`/jobs/${jobId}`),
    incrementJobView: (jobId) => apiClient.patch(`/jobs/${jobId}/view`),
    getRecommendedJobs: () => apiClient.get('/jobs/recommended'),
    detectScam: (jobData) => apiClient.post('/jobs/detect-scam', jobData),

    // Applications
    applyForJob: (applicationData) => apiClient.post('/applications', applicationData),
    getMyApplications: () => apiClient.get('/applications/my-applications'),
    getApplicationsForJob: (jobId) => apiClient.get(`/applications/for-job/${jobId}`),
    getSingleApplication: (applicationId) => apiClient.get(`/applications/${applicationId}`),
    updateApplicationStatus: (applicationId, statusData) => apiClient.patch(`/applications/${applicationId}`, statusData),
    deleteApplication: (applicationId) => apiClient.delete(`/applications/${applicationId}`),

    // Chat
    getChatMessages: (chatId) => apiClient.get(`/chat/${chatId}/messages`),
    sendMessage: (chatId, messageData) => apiClient.post(`/chat/${chatId}/messages`, messageData),
};

export default api;

