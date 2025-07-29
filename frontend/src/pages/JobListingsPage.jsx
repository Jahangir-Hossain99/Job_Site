<<<<<<< HEAD
// frontend/src/pages/JobListingsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import api from '../api/apiClient'; // Correct relative path to apiClient

// Import icons from Lucide React
import { MapPin, Briefcase, DollarSign, Building, Clock, Calendar } from 'lucide-react';

const JobListingsPage = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate(); // Initialize useNavigate hook

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

    // Function to handle viewing job details and incrementing view count
    const handleViewDetails = async (jobId) => {
        try {
            // Attempt to increment job view count on the backend
            await api.incrementJobView(jobId);
            // Navigate to the job details page
            navigate(`/jobs/${jobId}`);
        } catch (err) {
            console.error("Error incrementing job view or navigating:", err);
            // Even if incrementing view fails, still navigate to the job details page
            navigate(`/jobs/${jobId}`);
        }
    };

    if (loading) {
        return <div className="text-center p-8 text-xl text-blue-600">Loading job listings...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-xl text-red-600 border border-red-300 bg-red-50 rounded-lg mx-auto max-w-md">{error}</div>;
    }

    if (jobs.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
                <p className="text-gray-600 text-lg mb-4">No job listings available at the moment.</p>
                <p className="text-gray-500">Please check back later or post a new job if you are a company!</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6"> {/* Increased padding and centered container */}
            <h2 className="text-4xl font-extrabold text-gray-900 mb-10 text-center tracking-tight">All Job Listings</h2> {/* Enhanced title styling */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"> {/* Increased gap for better spacing */}
                {jobs.map((job) => (
                    <div
                        key={job._id}
                        className="bg-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 overflow-hidden border border-gray-200"
                    >
                        <div className="p-6"> {/* Increased padding inside the card */}
                            <div className="flex items-center mb-3">
                                {/* Company Logo or Placeholder */}
                                {job.company?.logoUrl ? (
                                    <img
                                        src={job.company.logoUrl}
                                        alt={`${job.company.companyName} Logo`}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-blue-400 mr-4 flex-shrink-0"
                                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/48x48/cccccc/ffffff?text=Logo`; }}
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border-2 border-blue-300 mr-4 flex-shrink-0">
                                        <Building size={24} /> {/* Lucide icon as placeholder */}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 leading-tight">{job.title}</h3> {/* Larger, bolder title */}
                                    {job.company && (
                                        <p className="text-blue-700 text-md font-semibold mt-1">
                                            {job.company.companyName}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="text-gray-700 text-sm space-y-1 mb-4"> {/* Consistent text styling and spacing */}
                                <p className="flex items-center"><MapPin size={16} className="mr-2 text-gray-500" /> {job.location}</p>
                                <p className="flex items-center"><Briefcase size={16} className="mr-2 text-gray-500" /> {job.jobType}</p>
                                {job.salaryRange && job.salaryRange.min && job.salaryRange.max && (
                                    <p className="flex items-center"><DollarSign size={16} className="mr-2 text-gray-500" /> ${job.salaryRange.min} - ${job.salaryRange.max}</p>
                                )}
                                {job.applicationDeadline && (
                                    <p className="flex items-center"><Calendar size={16} className="mr-2 text-gray-500" /> Apply by: {new Date(job.applicationDeadline).toLocaleDateString()}</p>
                                )}
                            </div>

                            <p className="text-gray-600 text-base line-clamp-3 mb-4"> {/* Description with line clamping */}
                                {job.description}
                            </p>

                            <div className="flex justify-between items-center text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
                                <p className="flex items-center"><Clock size={14} className="mr-1" /> Posted: {new Date(job.createdAt).toLocaleDateString()}</p>
                                {/* Corrected from job.viewsCount to job.views based on backend schema */}
                                <p>Views: {job.views || 0}</p>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-4"> {/* Button area with light background */}
                            <button
                                onClick={() => handleViewDetails(job._id)} // Added onClick handler
                                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-lg font-semibold shadow-md hover:shadow-lg"
                            >
                                View Details
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
=======
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
>>>>>>> 3c9da4536584b4d73bdecbbe8574c3f4802a9e53
};

export default JobListingsPage;
