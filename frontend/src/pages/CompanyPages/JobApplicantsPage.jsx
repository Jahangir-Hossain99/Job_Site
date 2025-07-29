// frontend/src/pages/CompanyPages/JobApplicantsPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/apiClient'; // Path to apiClient remains the same relative to src
import { AuthContext } from '../../context/AuthContext'; // Path to AuthContext remains the same relative to src
import { Mail, Phone, ExternalLink, FileText, User, Award, Info } from 'lucide-react';

const JobApplicantsPage = () => {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const { currentUser, loadingAuth } = useContext(AuthContext);
    const [applicants, setApplicants] = useState([]);
    const [jobTitle, setJobTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchApplicants = async () => {
            setLoading(true);
            setError(null);

            if (loadingAuth) return;

            if (!currentUser || (currentUser.role !== 'company' && currentUser.role !== 'admin')) {
                setError("Access Denied: You are not authorized to view this page.");
                setLoading(false);
                return;
            }

            try {
                const jobResponse = await api.getJobById(jobId);
                setJobTitle(jobResponse.data.title);

                const applicantsResponse = await api.getApplicationsForJob(jobId);
                setApplicants(applicantsResponse.data);
            } catch (err) {
                console.error("Error fetching job applicants:", err);
                if (err.response && err.response.data && err.response.data.message) {
                    setError(`Failed to load applicants: ${err.response.data.message}`);
                } else {
                    setError("Failed to load applicants. Please try again later.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchApplicants();
    }, [jobId, currentUser, loadingAuth, navigate]);

    if (loading || loadingAuth) {
        return <div className="text-center p-6 text-blue-600">Loading applicants...</div>;
    }

    if (error) {
        return <div className="text-center p-6 text-red-600 border border-red-300 bg-red-50 rounded-lg">{error}</div>;
    }

    if (applicants.length === 0) {
        return (
            <div className="container mx-auto p-6 max-w-4xl bg-white rounded-lg shadow-lg my-8 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Applicants for "{jobTitle}"</h2>
                <p className="text-gray-600 text-lg">No applicants found for this job yet.</p>
                <div className="mt-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 hover:underline py-2 px-4 rounded-md transition-colors"
                    >
                        &larr; Back to Job Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl bg-white rounded-lg shadow-lg my-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Applicants for "{jobTitle}"</h2>

            <div className="grid grid-cols-1 gap-6">
                {applicants.map((application) => (
                    <div key={application._id} className="bg-gray-50 p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
                        {application.jobSeeker?.profilePictureUrl ? (
                            <img
                                src={application.jobSeeker.profilePictureUrl}
                                alt={`${application.jobSeeker.fullName}'s Profile`}
                                className="w-16 h-16 rounded-full object-cover border-2 border-blue-300 flex-shrink-0"
                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/64x64/cccccc/ffffff?text=User`; }}
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border-2 border-blue-300 flex-shrink-0">
                                <User size={32} />
                            </div>
                        )}

                        <div className="flex-grow">
                            <h3 className="text-xl font-semibold text-gray-900">{application.jobSeeker?.fullName || 'N/A'}</h3>
                            <p className="text-gray-600 text-sm">{application.jobSeeker?.headline || 'No Headline'}</p>
                            <p className="text-gray-600 text-sm mt-1">Applied on: {new Date(application.createdAt).toLocaleDateString()}</p>
                            <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${
                                application.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                application.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
                                application.status === 'interview' ? 'bg-purple-100 text-purple-800' :
                                application.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                application.status === 'hired' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                                Status: {application.status.replace(/_/g, ' ').toUpperCase()}
                            </span>

                            {application.aiScreeningScore != null && (
                                <div className="mt-3 p-2 bg-blue-50 rounded-md border border-blue-200">
                                    <div className="flex items-center text-blue-800 font-medium text-sm">
                                        <Award size={16} className="mr-1" /> AI Score: {application.aiScreeningScore.toFixed(2)}%
                                    </div>
                                    {application.aiScreeningReasons && application.aiScreeningReasons.length > 0 && (
                                        <div className="text-xs text-blue-700 mt-1">
                                            <span className="font-semibold">Reasons:</span> {application.aiScreeningReasons.join(', ')}
                                        </div>
                                    )}
                                </div>
                            )}
                            {application.aiScreeningScore == null && (
                                <div className="mt-3 p-2 bg-gray-100 rounded-md border border-gray-200">
                                    <div className="flex items-center text-gray-600 font-medium text-sm">
                                        <Info size={16} className="mr-1" /> AI screening not available.
                                    </div>
                                </div>
                            )}

                            {application.jobSeeker?.skills && application.jobSeeker.skills.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-sm font-medium text-gray-700 mb-1">Skills:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {application.jobSeeker.skills.slice(0, 5).map((skill, idx) => (
                                            <span key={idx} className="bg-gray-200 text-gray-800 px-2 py-0.5 text-xs rounded-full">
                                                {skill}
                                            </span>
                                        ))}
                                        {application.jobSeeker.skills.length > 5 && (
                                            <span className="bg-gray-200 text-gray-800 px-2 py-0.5 text-xs rounded-full">...</span>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        <div className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2 mt-4 md:mt-0 flex-shrink-0">
                            {application.jobSeeker?.email && (
                                <a href={`mailto:${application.jobSeeker.email}`} className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors" title="Email Applicant">
                                    <Mail size={20} />
                                </a>
                            )}
                            {application.jobSeeker?.phoneNumber && (
                                <a href={`tel:${application.jobSeeker.phoneNumber}`} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors" title="Call Applicant">
                                    <Phone size={20} />
                                </a>
                            )}
                            {application.jobSeeker?.resumeUrl && (
                                <a href={application.jobSeeker.resumeUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors" title="View Resume">
                                    <FileText size={20} />
                                </a>
                            )}
                            {application.jobSeeker?.portfolioUrl && (
                                <a href={application.jobSeeker.portfolioUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200 transition-colors" title="View Portfolio">
                                    <ExternalLink size={20} />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 text-center">
                <button
                    onClick={() => navigate(-1)}
                    className="text-blue-600 hover:underline py-2 px-4 rounded-md transition-colors"
                >
                    &larr; Back to Job Dashboard
                </button>
            </div>
        </div>
    );
};

export default JobApplicantsPage;
