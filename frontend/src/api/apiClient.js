// frontend/src/api/apiClient.js
import axios from 'axios';

// Get backend base URL from environment variables (e.g., .env.development, .env.production)
// In Vite, environment variables are exposed via import.meta.env
// Make sure to prefix your environment variables with VITE_ (e.g., VITE_BACKEND_URL)
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Assuming you store token in localStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const api = {
  // --- Auth Endpoints ---
  registerUser: (userData) => apiClient.post('/auth/register/user', userData),
  registerCompany: (companyData) => apiClient.post('/auth/register/company', companyData),
  login: (credentials) => apiClient.post('/auth/login', credentials),

  // --- User Endpoints ---
  getUserProfile: (userId) => apiClient.get(`/users/${userId}`),
  updateUserProfile: (userId, userData) => apiClient.patch(`/users/${userId}`, userData),
  getProfileTailoringSuggestions: (userId, jobId) => apiClient.get(`/users/${userId}/profile-tailoring-suggestions-for-job/${jobId}`),

  // --- Company Endpoints ---
  getAllCompanies: () => apiClient.get('/companies'),
  getCompanyById: (companyId) => apiClient.get(`/companies/${companyId}`),
  updateCompanyProfile: (companyId, companyData) => apiClient.patch(`/companies/${companyId}`, companyData),

  // --- Job Endpoints ---
  getAllJobs: () => apiClient.get('/jobs'), // Public jobs
  getJobById: (jobId) => apiClient.get(`/jobs/${jobId}`),
  createJob: (jobData) => apiClient.post('/jobs', jobData),
  updateJob: (jobId, jobData) => apiClient.patch(`/jobs/${jobId}`, jobData),
  deleteJob: (jobId) => apiClient.delete(`/jobs/${jobId}`),
  incrementJobView: (jobId) => apiClient.patch(`/jobs/${jobId}/view`),
  getRecommendedJobs: async () => {
    try {
      const response = await apiClient.get('/jobs/recommended');
      // --- CRITICAL FIX: Ensure response.data is an array or extract the 'jobs' array ---
      if (Array.isArray(response.data)) {
        return response; // If it's already an array, return as is
      } else if (response.data && Array.isArray(response.data.jobs)) {
        // If the backend returns { message: '...', jobs: [...] }
        return { ...response, data: response.data.jobs }; // Return a modified response with just the jobs array
      } else {
        // If the response is not an array and doesn't contain a 'jobs' array, return an empty array
        console.warn("Backend /jobs/recommended returned unexpected data format:", response.data);
        return { ...response, data: [] }; // Return an empty array to prevent map errors
      }
      // --- END CRITICAL FIX ---
    } catch (error) {
      console.error("Error in getRecommendedJobs API call:", error);
      // Re-throw the error so the component can handle it
      throw error;
    }
  },
  // --- Application Endpoints ---
  applyForJob: (applicationData) => apiClient.post('/applications', applicationData),
  getMyApplications: () => apiClient.get('/applications/my-applications'),
  getApplicationsForJob: (jobId) => apiClient.get(`/applications/for-job/${jobId}`),
  getSingleApplication: (applicationId) => apiClient.get(`/applications/${applicationId}`),
  updateApplication: (applicationId, updateData) => apiClient.patch(`/applications/${applicationId}`, updateData),
  deleteApplication: (applicationId) => apiClient.delete(`/applications/${applicationId}`),

  // --- Message Endpoints (for chat history/conversations) ---
  getConversations: () => apiClient.get('/messages/conversations'),
  getChatHistory: (otherPartyId) => apiClient.get(`/messages/history/${otherPartyId}`),
};

export default api;
