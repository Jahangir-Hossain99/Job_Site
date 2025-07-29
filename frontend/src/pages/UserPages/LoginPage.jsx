// frontend/src/pages/LoginPage.jsx
import React, { useState, useContext } from 'react'; // Import useContext
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/apiClient' // Your API client
import { AuthContext } from '../../context/AuthContext'; // Import AuthContext from its new location

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { handleLogin } = useContext(AuthContext); // Use handleLogin from context

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await api.login({ email, password });

            const { token, entity } = response.data;

            // Call handleLogin from AuthContext to update global state and localStorage
            handleLogin(token, entity);

            console.log('Login successful:', entity);

            // Redirect based on role
            if (entity.role === 'jobseeker') {
                navigate('/jobs'); // Redirect jobseekers to jobs page
            } else if (entity.role === 'company') {
                navigate('/company-dashboard');
            } else if (entity.role === 'admin') {
                navigate('/admin-dashboard');
            } else {
                navigate('/');
            }

        } catch (err) {
            console.error('Login error:', err);
            if (err.response && err.response.data && err.response.data.message) {
                setError(err.response.data.message);
            } else {
                setError('Login failed. Please check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-200">
                <h2 className="text-3xl font-bold text-center text-blue-700 mb-6">Login to Your Account</h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
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
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <p className="text-center text-gray-600 text-sm mt-6">
                    Don't have an account? <Link to="/register" className="text-blue-600 hover:underline font-medium">Register here</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
