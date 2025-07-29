// frontend/src/pages/CompanyPages/CompanyJobDashboard.jsx
import React, { useState, useEffect, useContext } from 'react';
import api from '../../api/apiClient';
import { jwtDecode } from 'jwt-decode';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

// Import icons from Lucide React
// Removed 'Edit' icon as the button is being removed
import { Eye, Trash2, Users, MapPin, Briefcase, DollarSign, Building, Clock, Calendar, PlusCircle } from 'lucide-react';

const CompanyJobDashboard = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [companyUserId, setCompanyUserId] = useState(null);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, loadingAuth } = useContext(AuthContext);

    // No changes needed here for the success alert, as it's handled by JobDetailsPage now.

    useEffect(() => {
        const fetchCompanyJobs = async () => {
            setLoading(true);
            setError(null);

            if (loadingAuth) return;

            const token = localStorage.getItem('token');
            if (!token) {
                setError("You are not logged in. Please log in to view your dashboard.");
                setLoading(false);
                return;
            }

            try {
                const decodedToken = jwtDecode(token);
                const currentUserId = decodedToken.id;
                const userRole = decodedToken.role;

                if (userRole !== 'company' && userRole !== 'admin') {
                    setError("Access Denied: Only companies or administrators can view this dashboard.");
                    setLoading(false);
                    return;
                }

                setCompanyUserId(currentUserId);

                const response = await api.getJobsByCompanyId(currentUserId);
                setJobs(response.data);
            } catch (err) {
                console.error("Error fetching company's jobs:", err);
                if (err.response && err.response.data && err.response.data.message) {
                    setError(`Failed to load jobs: ${err.response.data.message}`);
                } else {
                    setError("Failed to load jobs. Please try again later.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchCompanyJobs();
    }, [currentUser, loadingAuth, navigate]);

    const handleDeleteJob = async (jobId) => {
        if (window.confirm("Are you sure you want to delete this job posting? This action cannot be undone.")) {
            try {
                setLoading(true);
                setDeleteMessage(null);
                await api.deleteJob(jobId);
                setJobs(jobs.filter(job => job._id !== jobId));
                setDeleteMessage("Job posting deleted successfully!");
                const timer = setTimeout(() => {
                    setDeleteMessage(null);
                }, 5000);
                return () => clearTimeout(timer);
            } catch (err) {
                console.error("Error deleting job:", err);
                if (err.response && err.response.data && err.response.data.message) {
                    setDeleteMessage(`Failed to delete job: ${err.response.data.message}`);
                } else {
                    setDeleteMessage("Failed to delete job. Please try again.");
                }
            } finally {
                setLoading(false);
            }
        }
    };

    const handleViewDetails = (jobId) => {
        // This button now serves as the entry point for both viewing and editing
        navigate(`/jobs/${jobId}`);
    };

    // REMOVED: handleEditJob function is no longer needed

    const handleViewApplicants = (jobId) => {
        navigate(`/applications/for-job/${jobId}`);
    };

    if (loading || loadingAuth) {
        return <div className="text-center p-6 text-blue-600">Loading company dashboard...</div>;
    }

    if (error) {
        return <div className="text-center p-6 text-red-600 border border-red-300 bg-red-50 rounded-lg">{error}</div>;
    }

    if (!companyUserId) {
        return <div className="text-center p-6 text-gray-600">Please log in as a company to view this dashboard.</div>;
    }

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center tracking-tight">Your Posted Jobs</h2>

            {/* dashboardSuccessMessage display is removed from here */}
            {/* {dashboardSuccessMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                    {dashboardSuccessMessage}
                </div>
            )} */}

            {deleteMessage && (
                <div className={`p-3 mb-4 rounded-md text-center ${deleteMessage.includes("successfully") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {deleteMessage}
                </div>
            )}

            {jobs.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
                    <p className="text-gray-600 text-lg mb-6">You haven't posted any jobs yet.</p>
                    <button
                        onClick={() => navigate('/create-job')}
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                    >
                        <PlusCircle size={20} className="mr-2" /> Post Your First Job
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {jobs.map((job) => (
                        <div
                            key={job._id}
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
                                        <h3 className="text-2xl font-bold text-gray-900 leading-tight">{job.title}</h3>
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
                                    <p className="flex items-center text-gray-600">
                                        <Clock size={16} className="mr-2 text-gray-500" /> Status: <span className={`ml-1 font-semibold ${
                                            job.status === 'active' ? 'text-green-600' :
                                            job.status === 'pending_review' ? 'text-yellow-600' :
                                            'text-red-600'
                                        }`}>{job.status.replace('_', ' ')}</span>
                                    </p>
                                </div>

                                <p className="text-gray-600 text-base line-clamp-3 mb-4">
                                    {job.description}
                                </p>

                                <div className="flex justify-between items-center text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
                                    <p className="flex items-center"><Clock size={14} className="mr-1" /> Posted: {new Date(job.createdAt).toLocaleDateString()}</p>
                                    <p>Views: {job.views || 0}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 flex justify-around items-center space-x-2 border-t border-gray-100">
                                <button
                                    onClick={() => handleViewApplicants(job._id)}
                                    className="p-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors shadow-sm hover:shadow-md"
                                    title="View Applicants"
                                >
                                    <Users size={20} />
                                </button>
                                <button
                                    onClick={() => handleViewDetails(job._id)}
                                    className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors shadow-sm hover:shadow-md"
                                    title="View Details / Edit Job"
                                >
                                    <Eye size={20} />
                                </button>
                                {/* REMOVED: The dedicated Edit button */}
                                {/* <button
                                    onClick={() => handleEditJob(job._id)}
                                    className="p-2 bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200 transition-colors shadow-sm hover:shadow-md"
                                    title="Edit Job"
                                >
                                    <Edit size={20} />
                                </button> */}
                                <button
                                    onClick={() => handleDeleteJob(job._id)}
                                    className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors shadow-sm hover:shadow-md"
                                    title="Delete Job"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CompanyJobDashboard;
