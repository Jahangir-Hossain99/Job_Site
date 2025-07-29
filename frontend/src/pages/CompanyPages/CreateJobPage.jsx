// frontend/src/pages/CompanyPages/CreateJobPage.jsx
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/apiClient';
import { AuthContext } from '../../context/AuthContext';

// Import icons for consistency
import { PlusCircle, Save, XCircle, ChevronLeft } from 'lucide-react';

const CreateJobPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useContext(AuthContext);

    const [jobData, setJobData] = useState({
        title: '',
        description: '',
        location: '',
        jobType: '',
        salaryRange: { min: '', max: '' },
        requiredSkills: '',
        preferredSkills: '',
        technologiesUsed: '',
        seniorityLevel: '',
        industry: '',
        companySize: '',
        workEnvironment: '',
        applicationDeadline: '',
        status: 'pending_review' // Default status
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'salaryRangeMin') {
            setJobData(prev => ({
                ...prev,
                salaryRange: { ...prev.salaryRange, min: value }
            }));
        } else if (name === 'salaryRangeMax') {
            setJobData(prev => ({
                ...prev,
                salaryRange: { ...prev.salaryRange, max: value }
            }));
        } else {
            setJobData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        // Client-side validation for required fields
        if (!jobData.title || !jobData.description || !jobData.location || !jobData.jobType || !jobData.seniorityLevel) {
            setError("Please fill in all required fields (Job Title, Description, Location, Job Type, Seniority Level).");
            setLoading(false);
            return;
        }

        const newJob = {
            ...jobData,
            requiredSkills: jobData.requiredSkills.split(',').map(s => s.trim()).filter(s => s),
            preferredSkills: jobData.preferredSkills.split(',').map(s => s.trim()).filter(s => s),
            technologiesUsed: jobData.technologiesUsed.split(',').map(s => s.trim()).filter(s => s),
            // Convert to ISO string if date is provided
            applicationDeadline: jobData.applicationDeadline ? new Date(jobData.applicationDeadline).toISOString() : undefined,
            // Only include salaryRange if both min and max are provided
            salaryRange: (jobData.salaryRange.min && jobData.salaryRange.max) ? jobData.salaryRange : undefined
        };

        try {
            const response = await api.createJob(newJob);
            setSuccessMessage(response.data.message || "Job posted successfully!");
            // Optionally clear form or redirect after success
            setJobData({ // Clear form after successful submission
                title: '',
                description: '',
                location: '',
                jobType: '',
                salaryRange: { min: '', max: '' },
                requiredSkills: '',
                preferredSkills: '',
                technologiesUsed: '',
                seniorityLevel: '',
                industry: '',
                companySize: '',
                workEnvironment: '',
                applicationDeadline: '',
                status: 'pending_review'
            });

            // Redirect to dashboard after a short delay to show success message
            setTimeout(() => {
                navigate('/company-dashboard', { state: { successMessage: 'Job posted successfully!' } });
            }, 2000); // Redirect after 2 seconds
        } catch (err) {
            console.error("Error creating job:", err);
            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to post job: ${err.response.data.message}`);
            } else {
                setError("Failed to post job. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!currentUser || (currentUser.role !== 'company' && currentUser.role !== 'admin')) {
        return <div className="text-center p-6 text-red-600">Access Denied: Only companies can post jobs.</div>;
    }

    return (
        <div className="container mx-auto p-10 max-w-6xl bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl my-10 border border-blue-100 overflow-hidden"> {/* Changed max-w-4xl to max-w-6xl */}
            <div className="flex justify-between items-center mb-12">
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center px-7 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-all duration-200 shadow-md transform hover:scale-105 group"
                >
                    <ChevronLeft size={22} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back
                </button>
                <h2 className="text-4xl font-extrabold text-gray-900 text-center tracking-tight">Post a New Job</h2>
                <div></div> {/* Placeholder to balance flexbox */}
            </div>

            {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg relative mb-10 shadow-lg animate-fade-in-down" role="alert">
                    {successMessage}
                </div>
            )}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg relative mb-10 shadow-lg animate-fade-in-down" role="alert">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Job Title */}
                <div>
                    <label htmlFor="title" className="block text-lg font-semibold text-gray-700 mb-2">Job Title <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={jobData.title}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                        required
                        placeholder="e.g., Senior Software Engineer"
                    />
                </div>

                {/* Job Description */}
                <div>
                    <label htmlFor="description" className="block text-lg font-semibold text-gray-700 mb-2">Job Description <span className="text-red-500">*</span></label>
                    <textarea
                        id="description"
                        name="description"
                        rows="8"
                        value={jobData.description}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 resize-y text-lg"
                        required
                        placeholder="Provide a detailed description of the role, responsibilities, and expectations."
                    ></textarea>
                </div>

                {/* Location */}
                <div>
                    <label htmlFor="location" className="block text-lg font-semibold text-gray-700 mb-2">Location <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="location"
                        name="location"
                        value={jobData.location}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                        required
                        placeholder="e.g., Remote, New York, NY, USA"
                    />
                </div>

                {/* Salary Range */}
                <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-2">Salary Range (Optional)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <input
                                type="number"
                                id="salaryRangeMin"
                                name="salaryRangeMin"
                                value={jobData.salaryRange.min}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                                placeholder="Min Salary"
                            />
                        </div>
                        <div>
                            <input
                                type="number"
                                id="salaryRangeMax"
                                name="salaryRangeMax"
                                value={jobData.salaryRange.max}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                                placeholder="Max Salary"
                            />
                        </div>
                        <div className="flex items-center text-gray-600 text-lg">
                            <span className="ml-2">USD</span>
                        </div>
                    </div>
                </div>

                {/* Job Type & Seniority Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="jobType" className="block text-lg font-semibold text-gray-700 mb-2">Job Type <span className="text-red-500">*</span></label>
                        <select
                            id="jobType"
                            name="jobType"
                            value={jobData.jobType}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                            required
                        >
                            <option value="">Select Job Type</option>
                            <option value="Full-time">Full-time</option>
                            <option value="Part-time">Part-time</option>
                            <option value="Contract">Contract</option>
                            <option value="Temporary">Temporary</option>
                            <option value="Internship">Internship</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="seniorityLevel" className="block text-lg font-semibold text-gray-700 mb-2">Seniority Level <span className="text-red-500">*</span></label>
                        <select
                            id="seniorityLevel"
                            name="seniorityLevel"
                            value={jobData.seniorityLevel}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                            required
                        >
                            <option value="">Select Seniority Level</option>
                            <option value="Entry-Level">Entry-Level</option>
                            <option value="Junior">Junior</option>
                            <option value="Mid-Level">Mid-Level</option>
                            <option value="Senior">Senior</option>
                            <option value="Lead">Lead</option>
                            <option value="Manager">Manager</option>
                            <option value="Director">Director</option>
                            <option value="Executive">Executive</option>
                        </select>
                    </div>
                </div>

                {/* Skills & Technologies */}
                <div>
                    <label htmlFor="requiredSkills" className="block text-lg font-semibold text-gray-700 mb-2">Required Skills (comma-separated)</label>
                    <input
                        type="text"
                        id="requiredSkills"
                        name="requiredSkills"
                        value={jobData.requiredSkills}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                        placeholder="e.g., JavaScript, React, Node.js"
                    />
                </div>
                <div>
                    <label htmlFor="preferredSkills" className="block text-lg font-semibold text-gray-700 mb-2">Preferred Skills (comma-separated)</label>
                    <input
                        type="text"
                        id="preferredSkills"
                        name="preferredSkills"
                        value={jobData.preferredSkills}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                        placeholder="e.g., Redux, GraphQL, AWS"
                    />
                </div>
                <div>
                    <label htmlFor="technologiesUsed" className="block text-lg font-semibold text-gray-700 mb-2">Technologies Used (comma-separated)</label>
                    <input
                        type="text"
                        id="technologiesUsed"
                        name="technologiesUsed"
                        value={jobData.technologiesUsed}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                        placeholder="e.g., Docker, Kubernetes, Azure"
                    />
                </div>

                {/* Other Job Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="industry" className="block text-lg font-semibold text-gray-700 mb-2">Industry</label>
                        <input
                            type="text"
                            id="industry"
                            name="industry"
                            value={jobData.industry}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                            placeholder="e.g., Software Development"
                        />
                    </div>
                    <div>
                        <label htmlFor="companySize" className="block text-lg font-semibold text-gray-700 mb-2">Company Size</label>
                        <input
                            type="text"
                            id="companySize"
                            name="companySize"
                            value={jobData.companySize}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                            placeholder="e.g., 50-200 employees"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="workEnvironment" className="block text-lg font-semibold text-gray-700 mb-2">Work Environment</label>
                        <select
                            id="workEnvironment"
                            name="workEnvironment"
                            value={jobData.workEnvironment}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                        >
                            <option value="">Select Work Environment</option>
                            <option value="Remote">Remote</option>
                            <option value="On-site">On-site</option>
                            <option value="Hybrid">Hybrid</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="applicationDeadline" className="block text-lg font-semibold text-gray-700 mb-2">Application Deadline</label>
                        <input
                            type="date"
                            id="applicationDeadline"
                            name="applicationDeadline"
                            value={jobData.applicationDeadline}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-blue-300 rounded-lg shadow-sm p-4 focus:ring-blue-600 focus:border-blue-600 text-gray-900 bg-blue-50 transition-all duration-200 text-lg"
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-center pt-8">
                    <button
                        type="submit"
                        className="inline-flex items-center px-14 py-5 bg-blue-600 text-white font-semibold rounded-lg text-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 group"
                        disabled={loading}
                    >
                        {loading ? 'Posting Job...' : <><PlusCircle size={32} className="mr-4 group-hover:rotate-6 transition-transform" /> Post Job</>} {/* Larger icon */}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateJobPage;
