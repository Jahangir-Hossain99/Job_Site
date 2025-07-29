// frontend/src/pages/CompanyPages/JobDetailsPage.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/apiClient';
import { AuthContext } from '../../context/AuthContext';

// Import icons from Lucide React
import { MapPin, Briefcase, DollarSign, Building, Clock, Calendar, Eye, Save, XCircle, ChevronLeft, UserPlus, Info } from 'lucide-react';

const JobDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, loadingAuth } = useContext(AuthContext);

    const [job, setJob] = useState(null);
    const [editableJobData, setEditableJobData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingField, setEditingField] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const activeInputRef = useRef(null);

    // Effect to handle incoming navigation state (success messages from other pages, e.g., dashboard)
    useEffect(() => {
        if (location.state && location.state.successMessage) {
            setSuccessMessage(location.state.successMessage);
            navigate(location.pathname, { replace: true, state: {} }); // Clear state
        }
        let timer;
        if (successMessage) {
            timer = setTimeout(() => {
                setSuccessMessage(null);
            }, 5000);
        }
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [location, navigate, successMessage]);

    // Effect to fetch job details
    useEffect(() => {
        const fetchJobDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.getJobById(id);
                setJob(response.data);
                setEditableJobData({
                    ...response.data,
                    requiredSkills: response.data.requiredSkills?.join(', ') || '',
                    preferredSkills: response.data.preferredSkills?.join(', ') || '',
                    technologiesUsed: response.data.technologiesUsed?.join(', ') || '',
                    applicationDeadline: response.data.applicationDeadline ? new Date(response.data.applicationDeadline).toISOString().split('T')[0] : '',
                    salaryRange: {
                        min: response.data.salaryRange?.min || '',
                        max: response.data.salaryRange?.max || ''
                    }
                });
            } catch (err) {
                console.error("Error fetching job details:", err);
                if (err.response && err.response.data && err.response.data.message) {
                    setError(`Failed to load job details: ${err.response.data.message}`);
                } else {
                    setError("Failed to load job details. Please try again later.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchJobDetails();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'salaryRangeMin' || name === 'salaryRangeMax') {
            setEditableJobData(prev => ({
                ...prev,
                salaryRange: {
                    ...prev.salaryRange,
                    [name === 'salaryRangeMin' ? 'min' : 'max']: value
                }
            }));
        } else {
            setEditableJobData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFieldClick = (fieldName) => {
        if (canEdit && !isSubmitting) {
            setEditingField(fieldName);
            setError(null);
            setSuccessMessage(null);
        }
    };

    useEffect(() => {
        if (editingField && activeInputRef.current) {
            activeInputRef.current.focus();
        }
    }, [editingField]);


    const handleInputBlur = () => {
        setEditingField(null);
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);
        setEditingField(null);

        const isCompanyOwner = currentUser && currentUser.role === 'company' && job.company?._id === currentUser._id;
        const isAdmin = currentUser && currentUser.role === 'admin';

        if (!isCompanyOwner && !isAdmin) {
            setError("Access Denied: You are not authorized to save changes to this job.");
            setIsSubmitting(false);
            return;
        }

        const updatedData = {
            ...editableJobData,
            requiredSkills: editableJobData.requiredSkills.split(',').map(s => s.trim()).filter(s => s),
            preferredSkills: editableJobData.preferredSkills.split(',').map(s => s.trim()).filter(s => s),
            technologiesUsed: editableJobData.technologiesUsed.split(',').map(s => s.trim()).filter(s => s),
            applicationDeadline: editableJobData.applicationDeadline ? new Date(editableJobData.applicationDeadline).toISOString() : undefined,
            salaryRange: (editableJobData.salaryRange.min === '' && editableJobData.salaryRange.max === '') ? undefined : editableJobData.salaryRange
        };

        try {
            const response = await api.updateJob(id, updatedData);
            setJob(response.data.job);
            setEditableJobData({
                ...response.data.job,
                requiredSkills: response.data.job.requiredSkills?.join(', ') || '',
                preferredSkills: response.data.job.preferredSkills?.join(', ') || '',
                technologiesUsed: response.data.job.technologiesUsed?.join(', ') || '',
                applicationDeadline: response.data.job.applicationDeadline ? new Date(response.data.job.applicationDeadline).toISOString().split('T')[0] : '',
                salaryRange: {
                    min: response.data.job.salaryRange?.min || '',
                    max: response.data.job.salaryRange?.max || ''
                }
            });
            setSuccessMessage(response.data.message || "Job updated successfully!");
        } catch (err) {
            console.error("Error updating job:", err);
            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to update job: ${err.response.data.message}`);
            } else {
                setError("Failed to update job. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="text-center p-6 text-blue-600">Loading job details...</div>;
    }

    if (error) {
        return <div className="text-center p-6 text-red-600 border border-red-300 bg-red-50 rounded-lg">{error}</div>;
    }

    if (!job || !editableJobData) {
        return <div className="text-center p-6 text-gray-600">Job not found.</div>;
    }

    const canEdit = currentUser && (
        (currentUser.role === 'company' && job.company?._id === currentUser._id) ||
        currentUser.role === 'admin'
    );

    const renderField = (label, name, value, type = 'text', options = [], icon = null) => (
        <div className="mb-4">
            <strong className="block text-gray-700 text-base font-semibold flex items-center mb-1"> {/* Slightly larger label font */}
                {icon && <span className="mr-2 text-gray-500">{React.createElement(icon, { size: 20 })}</span>} {/* Larger icons */}
                {label}:
            </strong>
            {editingField === name && canEdit ? (
                type === 'textarea' ? (
                    <textarea
                        name={name}
                        value={value}
                        onChange={handleChange}
                        onBlur={handleInputBlur}
                        ref={activeInputRef}
                        rows="4"
                        className="mt-1 block w-full border border-blue-400 rounded-lg shadow-sm p-3.5 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 resize-y text-lg" // Larger padding, larger text
                    />
                ) : type === 'select' ? (
                    <select
                        name={name}
                        value={value}
                        onChange={handleChange}
                        onBlur={handleInputBlur}
                        ref={activeInputRef}
                        className="mt-1 block w-full border border-blue-400 rounded-lg shadow-sm p-3.5 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg" // Larger padding, larger text
                    >
                        <option value="">Select {label}</option>
                        {options.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={type}
                        name={name}
                        value={value}
                        onChange={handleChange}
                        onBlur={handleInputBlur}
                        ref={activeInputRef}
                        className="mt-1 block w-full border border-blue-400 rounded-lg shadow-sm p-3.5 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg" // Larger padding, larger text
                    />
                )
            ) : (
                <span
                    className={`text-gray-900 text-xl font-medium block leading-relaxed ${canEdit ? 'cursor-pointer hover:bg-blue-100 rounded-lg px-4 py-2 transition-all duration-200 border border-transparent hover:border-blue-300 shadow-sm' : ''}`} // Larger text, larger padding on hover
                    onClick={() => handleFieldClick(name)}
                >
                    {value || <span className="text-gray-500 italic">Not specified</span>}
                </span>
            )}
        </div>
    );

    return (
        <div className="container mx-auto p-10 max-w-7xl bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl my-10 border border-blue-100 overflow-hidden"> {/* Increased max-w and padding */}
            <div className="flex justify-between items-center mb-12"> {/* Increased margin */}
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center px-7 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-all duration-200 shadow-md transform hover:scale-105 group"
                >
                    <ChevronLeft size={22} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back
                </button>
                {canEdit && (
                    <button
                        onClick={handleSave}
                        className="inline-flex items-center px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-lg disabled:opacity-50 transform hover:scale-105 group"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : <><Save size={22} className="mr-2 group-hover:rotate-6 transition-transform" /> Save Changes</>}
                    </button>
                )}
            </div>

            <h1
                className={`text-7xl font-extrabold text-gray-900 mb-12 text-center tracking-tight leading-tight ${canEdit ? 'cursor-pointer hover:bg-blue-100 rounded-xl px-6 py-4 transition-all duration-200 border border-transparent hover:border-blue-300 shadow-md' : ''}`} 
                onClick={() => handleFieldClick('title')}
            >
                {editingField === 'title' && canEdit ? (
                    <input
                        type="text"
                        name="title"
                        value={editableJobData.title}
                        onChange={handleChange}
                        onBlur={handleInputBlur}
                        ref={activeInputRef}
                        className="w-full text-7xl font-extrabold text-gray-900 text-center border-b-2 border-blue-500 focus:border-blue-700 outline-none bg-blue-50 rounded-lg pb-3 px-6 transition-all duration-200" // Larger padding
                    />
                ) : (
                    editableJobData.title
                )}
            </h1>

            {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg relative mb-10 shadow-lg animate-fade-in-down" role="alert"> {/* Larger padding, margin */}
                    {successMessage}
                </div>
            )}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg relative mb-10 shadow-lg animate-fade-in-down" role="alert"> {/* Larger padding, margin */}
                    {error}
                </div>
            )}

            {job.company && (
                <div className="flex flex-col md:flex-row items-center justify-center mb-14 bg-blue-100 p-8 rounded-xl shadow-inner border border-blue-200"> {/* More padding, margin */}
                    {job.company.logoUrl ? (
                        <img
                            src={job.company.logoUrl}
                            alt={`${job.company.companyName} Logo`}
                            className="w-32 h-32 rounded-full mr-0 md:mr-10 mb-6 md:mb-0 object-cover border-4 border-blue-400 shadow-xl" // Larger logo, more margin
                            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/128x128/cccccc/ffffff?text=Logo`; }}
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-blue-300 flex items-center justify-center text-blue-800 border-4 border-blue-400 mr-0 md:mr-10 mb-6 md:mb-0 shadow-xl">
                            <Building size={64} /> {/* Larger icon */}
                        </div>
                    )}
                    <div className="text-center md:text-left">
                        <h2 className="text-4xl font-extrabold text-blue-900 mb-2">{job.company.companyName}</h2> {/* Larger, bolder */}
                        {job.company.website && (
                            <a href={job.company.website} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline text-xl font-medium block mb-3"> {/* Larger, more margin */}
                                {job.company.website}
                            </a>
                        )}
                        {job.company.description && (
                            <p className="text-gray-700 text-lg mt-2 max-w-prose leading-relaxed"> {/* Larger text */}
                                {job.company.description}
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-gray-100 p-8 rounded-2xl shadow-lg mb-10 border border-gray-200">
                <h3 className="text-3xl font-bold text-gray-800 mb-6 flex items-center pb-3 border-b-2 border-gray-300">
                    <Info size={28} className="mr-3 text-gray-600" /> Job Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8 text-gray-700"> {/* Increased columns and gaps */}
                    {renderField('Location', 'location', editableJobData.location, 'text', [], MapPin)}
                    {renderField('Job Type', 'jobType', editableJobData.jobType, 'select', ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'], Briefcase)}
                    {renderField('Seniority Level', 'seniorityLevel', editableJobData.seniorityLevel, 'select', ['Entry-Level', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director', 'Executive'])}
                    {renderField('Industry', 'industry', editableJobData.industry)}
                    {renderField('Company Size', 'companySize', editableJobData.companySize)}
                    {renderField('Work Environment', 'workEnvironment', editableJobData.workEnvironment, 'select', ['Remote', 'On-site', 'Hybrid'])}
                    {renderField('Application Deadline', 'applicationDeadline', editableJobData.applicationDeadline, 'date', [], Calendar)}
                    {renderField('Job Status', 'status', editableJobData.status, 'select', ['pending_review', 'active', 'closed', 'archived'])}

                    {/* Salary Range - Special handling for two inputs */}
                    <div className="mb-4">
                        <strong className="block text-gray-700 text-base font-semibold flex items-center mb-1">
                            <DollarSign size={20} className="mr-2 text-gray-500" /> Salary Range:
                        </strong>
                        {editingField === 'salaryRange' && canEdit ? (
                            <div className="flex space-x-4"> {/* Increased space */}
                                <input
                                    type="number"
                                    name="salaryRangeMin"
                                    value={editableJobData.salaryRange.min}
                                    onChange={handleChange}
                                    onBlur={handleInputBlur}
                                    ref={activeInputRef}
                                    placeholder="Min"
                                    className="mt-1 block w-1/2 border border-blue-400 rounded-lg shadow-sm p-3.5 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                                />
                                <input
                                    type="number"
                                    name="salaryRangeMax"
                                    value={editableJobData.salaryRange.max}
                                    onChange={handleChange}
                                    onBlur={handleInputBlur}
                                    placeholder="Max"
                                    className="mt-1 block w-1/2 border border-blue-400 rounded-lg shadow-sm p-3.5 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                                />
                            </div>
                        ) : (
                            <span
                                className={`text-gray-900 text-xl font-medium block leading-relaxed ${canEdit ? 'cursor-pointer hover:bg-blue-100 rounded-lg px-4 py-2 transition-all duration-200 border border-transparent hover:border-blue-300 shadow-sm' : ''}`}
                                onClick={() => handleFieldClick('salaryRange')}
                            >
                                {editableJobData.salaryRange.min && editableJobData.salaryRange.max
                                    ? `$${editableJobData.salaryRange.min} - $${editableJobData.salaryRange.max}`
                                    : <span className="text-gray-500 italic">Not specified</span>}
                            </span>
                        )}
                    </div>
                    <p className="flex items-center text-gray-700">
                        <Clock size={20} className="mr-2 text-gray-500" />
                        <strong>Posted On:</strong> <span className="ml-2 text-lg font-medium">{new Date(job.createdAt).toLocaleDateString()}</span>
                    </p>
                    <p className="flex items-center text-gray-700">
                        <Eye size={20} className="mr-2 text-gray-500" />
                        <strong>Views:</strong> <span className="ml-2 text-lg font-medium">{job.views || 0}</span>
                    </p>
                </div>
            </div>

            <div className="bg-gray-100 p-8 rounded-2xl shadow-lg mb-10 border border-gray-200">
                <h3 className="text-3xl font-bold text-gray-800 mb-6 flex items-center pb-3 border-b-2 border-gray-300">
                    <Briefcase size={28} className="mr-3 text-gray-600" /> Job Description
                </h3>
                {renderField('Description', 'description', editableJobData.description, 'textarea')}
            </div>

            <div className="bg-gray-100 p-8 rounded-2xl shadow-lg mb-10 border border-gray-200">
                <h3 className="text-3xl font-bold text-gray-800 mb-6 flex items-center pb-3 border-b-2 border-gray-300">
                    <Info size={28} className="mr-3 text-gray-600" /> Skills & Technologies
                </h3>
                {renderField('Required Skills', 'requiredSkills', editableJobData.requiredSkills)}
                {renderField('Preferred Skills', 'preferredSkills', editableJobData.preferredSkills)}
                {renderField('Technologies Used', 'technologiesUsed', editableJobData.technologiesUsed)}
            </div>


            {/* Apply button for job seekers */}
            {currentUser && currentUser.role === 'jobseeker' && (
                <div className="mt-12 text-center">
                    <button
                        onClick={() => navigate(`/apply/${job._id}`)}
                        className="inline-flex items-center px-14 py-5 bg-purple-600 text-white font-semibold rounded-lg text-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 group"
                    >
                        <UserPlus size={32} className="mr-4 group-hover:rotate-6 transition-transform" /> Apply for this Job
                    </button>
                </div>
            )}
        </div>
    );
};

export default JobDetailsPage;
