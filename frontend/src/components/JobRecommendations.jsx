// frontend/src/components/JobRecommendations.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/apiClient'; // Import your API client
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import { jwtDecode } from 'jwt-decode'; // Import jwtDecode to get user role from token

// Import icons from Lucide React
import { MapPin, Briefcase, DollarSign, Building, Clock, Calendar } from 'lucide-react';

const JobRecommendations = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null); // To check if the user is a jobseeker
    const navigate = useNavigate(); // Initialize useNavigate

    useEffect(() => {
        const fetchJobs = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem('token');
                let isJobSeeker = false;
                let currentUserRole = null;

                if (token) {
                    try {
                        const decodedToken = jwtDecode(token);
                        currentUserRole = decodedToken.role;
                        if (currentUserRole === 'jobseeker') {
                            isJobSeeker = true;
                        }
                    } catch (decodeError) {
                        console.error("Error decoding token:", decodeError);
                    }
                }
                
                setUserRole(currentUserRole);

                let response;
                if (isJobSeeker) {
                    response = await api.getRecommendedJobs();
                } else {
                    response = await api.getAllJobs();
                }

                if (response.data) {
                    if (Array.isArray(response.data)) {
                        setJobs(response.data);
                        console.log("JobRecommendations: Fetched jobs (array):", response.data);
                    } else if (response.data.jobs && Array.isArray(response.data.jobs)) {
                        setJobs(response.data.jobs);
                        console.log("JobRecommendations: Fetched jobs (from .jobs property):", response.data.jobs);
                    } else {
                        console.warn("JobRecommendations: Received non-array or malformed data for jobs:", response.data);
                        setJobs([]);
                        setError("Failed to load jobs due to an unexpected data format from the server.");
                    }
                } else {
                    console.warn("JobRecommendations: Response data is null or undefined:", response);
                    setJobs([]);
                    setError("No job data received from the server.");
                }

            } catch (err) {
                console.error("JobRecommendations: Error fetching jobs:", err);
                setError("Failed to load jobs. Please try again later.");
                setJobs([]);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, []);

    const handleViewDetails = async (jobId) => {
        console.log("JobRecommendations: Attempting to view details for jobId:", jobId);
        if (!jobId) {
            console.error("JobRecommendations: Job ID is undefined, cannot navigate to details page.");
            setError("Cannot view job details: Job ID is missing.");
            return;
        }

        try {
            await api.incrementJobView(jobId);
            navigate(`/jobs/${jobId}`);
        } catch (err) {
            console.error("JobRecommendations: Error incrementing job view or navigating:", err);
            navigate(`/jobs/${jobId}`);
        }
    };

    if (loading) {
        return <div className="text-center p-8 text-xl text-blue-600">Loading personalized job recommendations...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-xl text-red-600 border border-red-300 bg-red-50 rounded-lg mx-auto max-w-md">{error}</div>;
    }

    if (!Array.isArray(jobs) || jobs.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
                <p className="text-gray-600 text-lg mb-4">
                    {userRole === 'jobseeker'
                        ? "No personalized recommendations found at this time. Explore general job listings!"
                        : "No job listings available at the moment."}
                </p>
                {userRole !== 'jobseeker' && (
                    <p className="text-gray-500">Please check back later or post a new job if you are a company!</p>
                )}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <h3 className="text-4xl font-extrabold text-gray-900 mb-10 text-center tracking-tight">
                {userRole === 'jobseeker' ? "Personalized Job Recommendations For You" : "Available Job Listings"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {jobs.map((job) => {
                    // --- THE CRITICAL FIX IS HERE ---
                    const jobIdToUse = job.jobId; // Use jobId as confirmed by console output

                    if (!jobIdToUse) {
                        console.warn("JobRecommendations: Job object missing 'jobId' property:", job);
                        return null; // Skip rendering this specific card if 'jobId' is missing
                    }

                    return (
                        <div
                            key={jobIdToUse} // Use jobIdToUse as key
                            className="bg-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 overflow-hidden border border-gray-200"
                        >
                            <div className="p-6">
                                <div className="flex items-center mb-3">
                                    {job.company?.logoUrl ? (
                                        <img
                                            src={job.company.logoUrl}
                                            alt={`${job.company.companyName} Logo`}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-blue-400 mr-4 flex-shrink-0"
                                            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/48x48/cccccc/ffffff?text=Logo`; }}
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border-2 border-blue-300 mr-4 flex-shrink-0">
                                            <Building size={24} />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-2xl font-bold text-gray-900 leading-tight">{job.title}</h4>
                                        {job.company && (
                                            <p className="text-blue-700 text-md font-semibold mt-1">
                                                {job.company.companyName}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="text-gray-700 text-sm space-y-1 mb-4">
                                    <p className="flex items-center"><MapPin size={16} className="mr-2 text-gray-500" /> {job.location}</p>
                                    <p className="flex items-center"><Briefcase size={16} className="mr-2 text-gray-500" /> {job.jobType}</p>
                                    {job.salaryRange && job.salaryRange.min && job.salaryRange.max && (
                                        <p className="flex items-center"><DollarSign size={16} className="mr-2 text-gray-500" /> ${job.salaryRange.min} - ${job.salaryRange.max}</p>
                                    )}
                                    {job.applicationDeadline && (
                                        <p className="flex items-center"><Calendar size={16} className="mr-2 text-gray-500" /> Apply by: {new Date(job.applicationDeadline).toLocaleDateString()}</p>
                                    )}
                                </div>

                                <p className="text-gray-600 text-base line-clamp-3 mb-4">
                                    {job.description}
                                </p>

                                <div className="flex justify-between items-center text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
                                    <p className="flex items-center"><Clock size={14} className="mr-1" /> Posted: {new Date(job.createdAt).toLocaleDateString()}</p>
                                    <p>Views: {job.views || 0}</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-4">
                                <button
                                    onClick={() => handleViewDetails(jobIdToUse)} 
                                    className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-lg font-semibold shadow-md hover:shadow-lg"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default JobRecommendations;
