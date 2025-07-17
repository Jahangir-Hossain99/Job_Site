import React, { useState, useEffect } from 'react';
import api from '../api/apiClient'; // Import your API client

const JobListingsPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getAllJobs(); // Call the API to get all public jobs
        setJobs(response.data); // Assuming response.data is the array of jobs
      } catch (err) {
        console.error("Error fetching job listings:", err);
        if (err.response && err.response.data && err.response.data.message) {
          setError(`Failed to load jobs: ${err.response.data.message}`);
        } else {
          setError("Failed to load job listings. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []); // Empty dependency array means this runs once on mount

  if (loading) {
    return <div className="text-center p-6 text-blue-600">Loading job listings...</div>;
  }

  if (error) {
    return <div className="text-center p-6 text-red-600 border border-red-300 bg-red-50 rounded-lg">{error}</div>;
  }

  if (jobs.length === 0) {
    return <div className="text-center p-6 text-gray-600">No job listings found at this time. Check back later!</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">All Job Listings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <div key={job._id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-300">
            <h3 className="text-xl font-bold text-blue-700 mb-2">{job.title}</h3>
            <p className="text-gray-600 mb-1">
              <span className="font-semibold">{job.company?.companyName || 'N/A'}</span> - {job.location}
            </p>
            <p className="text-gray-500 text-sm mb-3">{job.jobType}</p>
            <p className="text-gray-700 text-sm line-clamp-3 mb-4">{job.description}</p>
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>Posted: {new Date(job.createdAt).toLocaleDateString()}</span>
              <span>Views: {job.viewsCount || 0}</span>
            </div>
            {/* You can add a "View Details" button here */}
            <button className="mt-4 w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
              View Details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobListingsPage;
