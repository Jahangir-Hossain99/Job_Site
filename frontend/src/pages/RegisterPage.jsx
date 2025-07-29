import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/apiClient'; // Import your API client

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [role, setRole] = useState('jobseeker'); // Default role
  const [companyName, setCompanyName] = useState(''); // For company registration
  const [industry, setIndustry] = useState(''); // For company registration
  const [website, setWebsite] = useState(''); // For company registration
  const [description, setDescription] = useState(''); // For company registration
  const [headquarters, setHeadquarters] = useState(''); // For company registration
  const [contactPerson, setContactPerson] = useState(''); // For company registration
  const [contactPhone, setContactPhone] = useState(''); // For company registration

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let response;
      if (role === 'jobseeker') {
        response = await api.registerUser({ email, password, fullName, phoneNumber, location });
      } else { // 'company' role
        response = await api.registerCompany({ 
          email, password, companyName, industry, website, description, 
          headquarters, contactPerson, contactPhone 
        });
      }
      
      setSuccess(response.data.message || 'Registration successful!');
      // Optionally, automatically log in the user after registration
      // localStorage.setItem('token', response.data.token);
      // localStorage.setItem('user', JSON.stringify(response.data.entity));
      // navigate(role === 'jobseeker' ? '/profile' : '/company-dashboard');

      // For now, just show success and let them navigate to login
      setEmail('');
      setPassword('');
      setFullName('');
      setPhoneNumber('');
      setLocation('');
      setCompanyName('');
      setIndustry('');
      setWebsite('');
      setDescription('');
      setHeadquarters('');
      setContactPerson('');
      setContactPhone('');
      setRole('jobseeker'); // Reset to default
      
    } catch (err) {
      console.error('Registration error:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.response && err.response.data && err.response.data.errors) {
        // Handle validation errors from backend
        const validationErrors = Object.values(err.response.data.errors).join(', ');
        setError(`Validation failed: ${validationErrors}`);
      }
      else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-blue-700 mb-6">Register Your Account</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Success!</strong>
            <span className="block sm:inline"> {success} You can now <Link to="/login" className="font-medium underline">login</Link>.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-gray-700 text-sm font-medium mb-2">Register As</label>
            <select
              id="role"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="jobseeker">Job Seeker</option>
              <option value="company">Company</option>
            </select>
          </div>

          {/* Common Fields */}
          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">Email Address</label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Job Seeker Specific Fields */}
          {role === 'jobseeker' && (
            <>
              <div>
                <label htmlFor="fullName" className="block text-gray-700 text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="phoneNumber" className="block text-gray-700 text-sm font-medium mb-2">Phone Number (Optional)</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="+8801XXXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="location" className="block text-gray-700 text-sm font-medium mb-2">Location (Optional)</label>
                <input
                  type="text"
                  id="location"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Dhaka, Bangladesh"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Company Specific Fields */}
          {role === 'company' && (
            <>
              <div>
                <label htmlFor="companyName" className="block text-gray-700 text-sm font-medium mb-2">Company Name</label>
                <input
                  type="text"
                  id="companyName"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Innovate Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="industry" className="block text-gray-700 text-sm font-medium mb-2">Industry</label>
                <input
                  type="text"
                  id="industry"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Software Development"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="website" className="block text-gray-700 text-sm font-medium mb-2">Website (Optional)</label>
                <input
                  type="url"
                  id="website"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="https://www.yourcompany.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-gray-700 text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  id="description"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Brief description of your company..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                ></textarea>
              </div>
              <div>
                <label htmlFor="headquarters" className="block text-gray-700 text-sm font-medium mb-2">Headquarters (Optional)</label>
                <input
                  type="text"
                  id="headquarters"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="New York, USA"
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contactPerson" className="block text-gray-700 text-sm font-medium mb-2">Contact Person (Optional)</label>
                <input
                  type="text"
                  id="contactPerson"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Jane Doe"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contactPhone" className="block text-gray-700 text-sm font-medium mb-2">Contact Phone (Optional)</label>
                <input
                  type="tel"
                  id="contactPhone"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="+8801XXXXXXXXX"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account? <Link to="/login" className="text-blue-600 hover:underline font-medium">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
