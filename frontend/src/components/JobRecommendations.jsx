import React, { useState, useEffect } from 'react';
import api from '../api/apiClient'; // Import your API client

const JobRecommendations = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null); // To check if the user is a jobseeker

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError("Please log in as a job seeker to see personalized recommendations.");
          setLoading(false);
          return;
        }

        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (!storedUser || storedUser.role !== 'jobseeker') {
            setError("Only job seekers can view personalized recommendations. Please log in with a job seeker account.");
            setLoading(false);
            return;
        }
        setUserRole(storedUser.role);

        const response = await api.getRecommendedJobs();
        // --- CRITICAL FIX: Ensure response.data is an array before setting state ---
        if (Array.isArray(response.data)) {
            setJobs(response.data);
        } else if (response.data && response.data.jobs && Array.isArray(response.data.jobs)) {
            // If the backend returns { message: '...', jobs: [...] }
            setJobs(response.data.jobs);
        }
        else {
            // If the response is not an array, or is empty/malformed, treat as no jobs
            console.warn("Received non-array data for job recommendations:", response.data);
            setJobs([]); // Set to empty array to prevent map error
        }
        // --- END CRITICAL FIX ---
      } catch (err) {
        console.error("Error fetching recommended jobs:", err);
        if (err.response && err.response.status === 401) {
          setError("Your session has expired or you are not authorized. Please log in again.");
        } else if (err.response && err.response.data && err.response.data.message) {
          setError(`Failed to load recommendations: ${err.response.data.message}`);
        } else {
          setError("Failed to load personalized job recommendations. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  if (loading) {
    return <div className="text-center p-6 text-blue-600">Loading personalized job recommendations...</div>;
  }

  if (error) {
    return <div className="text-center p-6 text-red-600 border border-red-300 bg-red-50 rounded-lg">{error}</div>;
  }

  if (userRole !== 'jobseeker') {
    return <div className="text-center p-6 text-gray-600">Log in as a job seeker to get personalized job recommendations!</div>;
  }

  // --- CRITICAL FIX: Add a check for jobs.length before mapping ---
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return <div className="text-center p-6 text-gray-600">No personalized recommendations found at this time. Explore general job listings!</div>;
  }
  // --- END CRITICAL FIX ---

  return (
    <div className="mt-8">
      <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Personalized Job Recommendations For You</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => ( // This line will now be safe
          <div key={job._id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-300">
            <h4 className="text-xl font-bold text-blue-700 mb-2">{job.title}</h4>
            <p className="text-gray-600 mb-1">
              <span className="font-semibold">{job.company?.companyName || 'N/A'}</span> - {job.location}
            </p>
            <p className="text-gray-500 text-sm mb-3">{job.jobType}</p>
            <p className="text-gray-700 text-sm line-clamp-3 mb-4">{job.description}</p>
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>Posted: {new Date(job.createdAt).toLocaleDateString()}</span>
              <span>Views: {job.viewsCount || 0}</span>
            </div>
            <button className="mt-4 w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
              View Details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobRecommendations;