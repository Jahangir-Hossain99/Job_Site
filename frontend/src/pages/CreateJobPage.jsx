import React, { useState, useEffect, useContext } from 'react'; // Import useContext
import { useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import { AuthContext } from '../App'; // Import AuthContext

const CreateJobPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext); // Use currentUser from context
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  // Removed userRole state as it's now from context

  // Form states (no changes here)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('BDT');
  const [jobType, setJobType] = useState('Full-time');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [preferredSkills, setPreferredSkills] = useState('');
  const [seniorityLevel, setSeniorityLevel] = useState('Entry-level');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('1-10');
  const [workEnvironment, setWorkEnvironment] = useState('');
  const [technologiesUsed, setTechnologiesUsed] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');

 useEffect(() => {
    if (currentUser) { // Check currentUser from context
      if (currentUser.role !== 'company' && currentUser.role !== 'admin') {
        setError("You must be logged in as a company or admin to post jobs.");
        setTimeout(() => navigate('/'), 3000);
      }
    } else {
      setError("Please log in to post jobs.");
      setTimeout(() => navigate('/login'), 3000);
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!title || !description || !location || !jobType || !requiredSkills || !seniorityLevel || !industry) {
      setError("Please fill in all required fields (Title, Description, Location, Job Type, Required Skills, Seniority Level, Industry).");
      setLoading(false);
      return;
    }

    try {
      const jobData = {
        title,
        description,
        location,
        salaryRange: {
          min: salaryMin ? parseFloat(salaryMin) : undefined,
          max: salaryMax ? parseFloat(salaryMax) : undefined,
          currency: salaryCurrency,
        },
        jobType,
        requiredSkills: requiredSkills.split(',').map(s => s.trim()).filter(s => s),
        preferredSkills: preferredSkills.split(',').map(s => s.trim()).filter(s => s),
        seniorityLevel,
        industry,
        companySize,
        workEnvironment: workEnvironment.split(',').map(s => s.trim()).filter(s => s),
        technologiesUsed: technologiesUsed.split(',').map(s => s.trim()).filter(s => s),
        applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : undefined,
        status: 'active',
      };

      const response = await api.createJob(jobData);
      setSuccess(response.data.message || 'Job posted successfully!');
      // Clear form
      setTitle(''); setDescription(''); setLocation('');
      setSalaryMin(''); setSalaryMax(''); setSalaryCurrency('BDT');
      setJobType('Full-time'); setRequiredSkills(''); setPreferredSkills('');
      setSeniorityLevel('Entry-level'); setIndustry(''); setCompanySize('1-10');
      setWorkEnvironment(''); setTechnologiesUsed(''); setApplicationDeadline('');

      setTimeout(() => navigate('/jobs'), 2000);

    } catch (err) {
      console.error('Job posting error:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.response && err.response.data && err.response.data.errors) {
        const validationErrors = Object.values(err.response.data.errors).map(e => e.message).join(', ');
        setError(`Validation failed: ${validationErrors}`);
      } else {
        setError('Failed to post job. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Only render the form if the user is a company or admin
  // Use currentUser from context
  if (!currentUser || (currentUser.role !== 'company' && currentUser.role !== 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-md w-full text-center">
          <strong className="font-bold">Access Denied!</strong>
          <span className="block sm:inline"> {error || "You must be logged in as a company or admin to post jobs."}</span>
        </div>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-blue-700 mb-8">Post a New Job</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Success!</strong>
            <span className="block sm:inline"> {success} Redirecting to job listings...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Job Details */}
          <div>
            <label htmlFor="title" className="block text-gray-700 text-sm font-medium mb-2">Job Title <span className="text-red-500">*</span></label>
            <input type="text" id="title" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="description" className="block text-gray-700 text-sm font-medium mb-2">Job Description <span className="text-red-500">*</span></label>
            <textarea id="description" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" rows="6" value={description} onChange={(e) => setDescription(e.target.value)} required></textarea>
          </div>
          <div>
            <label htmlFor="location" className="block text-gray-700 text-sm font-medium mb-2">Location <span className="text-red-500">*</span></label>
            <input type="text" id="location" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={location} onChange={(e) => setLocation(e.target.value)} required />
          </div>

          {/* Salary Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="salaryMin" className="block text-gray-700 text-sm font-medium mb-2">Min Salary (Optional)</label>
              <input type="number" id="salaryMin" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
            </div>
            <div>
              <label htmlFor="salaryMax" className="block text-gray-700 text-sm font-medium mb-2">Max Salary (Optional)</label>
              <input type="number" id="salaryMax" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
            </div>
            <div>
              <label htmlFor="salaryCurrency" className="block text-gray-700 text-sm font-medium mb-2">Currency</label>
              <select id="salaryCurrency" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)}>
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                {/* Add more currencies as needed */}
              </select>
            </div>
          </div>

          {/* Job Type & Seniority Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="jobType" className="block text-gray-700 text-sm font-medium mb-2">Job Type <span className="text-red-500">*</span></label>
              <select id="jobType" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={jobType} onChange={(e) => setJobType(e.target.value)} required>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div>
              <label htmlFor="seniorityLevel" className="block text-gray-700 text-sm font-medium mb-2">Seniority Level <span className="text-red-500">*</span></label>
              <select id="seniorityLevel" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={seniorityLevel} onChange={(e) => setSeniorityLevel(e.target.value)} required>
                <option value="Entry-level">Entry-level</option>
                <option value="Junior">Junior</option>
                <option value="Mid-level">Mid-level</option>
                <option value="Senior">Senior</option>
                <option value="Lead">Lead</option>
                <option value="Director">Director</option>
                <option value="Executive">Executive</option>
              </select>
            </div>
          </div>

          {/* Skills & Technologies */}
          <div>
            <label htmlFor="requiredSkills" className="block text-gray-700 text-sm font-medium mb-2">Required Skills (comma-separated) <span className="text-red-500">*</span></label>
            <input type="text" id="requiredSkills" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., React, Node.js, MongoDB" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="preferredSkills" className="block text-gray-700 text-sm font-medium mb-2">Preferred Skills (comma-separated)</label>
            <input type="text" id="preferredSkills" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., TypeScript, AWS, Docker" value={preferredSkills} onChange={(e) => setPreferredSkills(e.target.value)} />
          </div>
          <div>
            <label htmlFor="technologiesUsed" className="block text-gray-700 text-sm font-medium mb-2">Technologies Used (comma-separated)</label>
            <input type="text" id="technologiesUsed" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Git, Jira, Slack" value={technologiesUsed} onChange={(e) => setTechnologiesUsed(e.target.value)} />
          </div>

          {/* Industry & Company Size */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="industry" className="block text-gray-700 text-sm font-medium mb-2">Industry <span className="text-red-500">*</span></label>
              <input type="text" id="industry" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Software Development" value={industry} onChange={(e) => setIndustry(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="companySize" className="block text-gray-700 text-sm font-medium mb-2">Company Size</label>
              <select id="companySize" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="501-1000">501-1000 employees</option>
                <option value="1000+">1000+ employees</option>
              </select>
            </div>
          </div>

          {/* Work Environment & Deadline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="workEnvironment" className="block text-gray-700 text-sm font-medium mb-2">Work Environment (comma-separated)</label>
              <input type="text" id="workEnvironment" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Remote, On-site, Hybrid" value={workEnvironment} onChange={(e) => setWorkEnvironment(e.target.value)} />
            </div>
            <div>
              <label htmlFor="applicationDeadline" className="block text-gray-700 text-sm font-medium mb-2">Application Deadline (Optional)</label>
              <input type="date" id="applicationDeadline" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Posting Job...' : 'Post Job'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateJobPage;
