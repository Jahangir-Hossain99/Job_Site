// frontend/src/App.jsx
import React, { useContext } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
// REMOVED: import { ErrorBoundary } from 'react-error-boundary';
// REMOVED: import ErrorFallback from './components/ErrorFallback';

import { AuthContext } from './context/AuthContext';

// Import your page components
import LoginPage from './pages/UserPages/LoginPage';
import RegisterPage from './pages/UserPages/RegisterPage';
import UserProfile from './pages/UserPages/UserProfile';

import CompanyJobDashboard from './pages/CompanyPages/CompanyJobDashboard';
import CreateJobPage from './pages/CompanyPages/CreateJobPage';
import JobApplicantsPage from './pages/CompanyPages/JobApplicantsPage';
import JobDetailsPage from './pages/CompanyPages/JobDetailsPage';

import JobListingsPage from './pages/JobListingsPage';
import JobRecommendations from './components/JobRecommendations'; // KEEP THIS IMPORT!

// Placeholder components
const HomePage = () => {
    const { currentUser } = useContext(AuthContext);
    const isJobSeekerLoggedIn = currentUser && currentUser.role === 'jobseeker';

    return (
        <div className="p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to the AI-Enhanced Job Portal!</h2>
            <p className="text-lg text-gray-600 mb-8">Find your dream job or the perfect candidate with smart recommendations.</p>
            {isJobSeekerLoggedIn ? <JobRecommendations /> : <JobListingsPage />}
        </div>
    );
};

const AdminDashboard = () => (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-100">
        <h1 className="text-4xl font-bold text-gray-800">Admin Dashboard (Placeholder)</h1>
    </div>
);

const ChatPage = () => <div className="p-8 text-center text-xl">Chat Interface (Placeholder)</div>;


// PrivateRoute component to protect routes
const PrivateRoute = ({ children, allowedRoles }) => {
    const { currentUser, loadingAuth } = useContext(AuthContext);

    if (loadingAuth) {
        return <div className="text-center p-6 text-blue-600">Loading authentication...</div>;
    }

    if (!currentUser) { // Not authenticated
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
};


function App() {
    const { currentUser, handleLogout, loadingAuth } = useContext(AuthContext);

    if (loadingAuth) {
        return <div className="text-center p-6 text-blue-600 min-h-screen flex items-center justify-center">Loading application...</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-100 font-sans text-gray-900 w-full overflow-x-hidden">
            <nav className="bg-blue-600 p-4 shadow-md w-full">
                <div className="container mx-auto flex justify-between items-center">
                    <Link to="/" className="text-white text-2xl font-bold rounded-md px-3 py-2 hover:bg-blue-700 transition-colors">
                        Job Portal AI
                    </Link>
                    <div className="space-x-4 flex items-center">
                        <Link to="/jobs" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Jobs</Link>

                        {currentUser ? (
                            <>
                                {(currentUser.role === 'company' || currentUser.role === 'admin') && (
                                    <Link to="/create-job" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Post a Job</Link>
                                )}

                                {currentUser.role === 'jobseeker' && (
                                    <Link to="/profile" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Profile</Link>
                                )}

                                {currentUser.role === 'company' && (
                                    <Link to="/company-dashboard" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Dashboard</Link>
                                )}

                                {currentUser.role === 'admin' && (
                                    <Link to="/admin-dashboard" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Admin</Link>
                                )}
                                <Link to="/chat" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Chat</Link>

                                <LogoutButton />
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Login</Link>
                                <Link to="/register" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Register</Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            <main className="flex-grow container mx-auto p-4 w-full">
                {/* REMOVED: ErrorBoundary wrapper */}
                {/* <ErrorBoundary
                    FallbackComponent={ErrorFallback}
                    onReset={() => {
                        window.location.reload();
                    }}
                > */}
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/jobs/:id" element={<JobDetailsPage />} />

                        <Route path="/jobs" element={
                            <PrivateRoute allowedRoles={['jobseeker', 'company', 'admin']}>
                                <JobListingsPage />
                            </PrivateRoute>
                        } />
                        <Route path="/create-job" element={
                            <PrivateRoute allowedRoles={['company']}>
                                <CreateJobPage />
                            </PrivateRoute>
                        } />
                        <Route path="/profile" element={
                            <PrivateRoute allowedRoles={['jobseeker', 'company', 'admin']}>
                                <UserProfile />
                            </PrivateRoute>
                        } />
                        <Route path="/company-dashboard" element={
                            <PrivateRoute allowedRoles={['company', 'admin']}>
                                <CompanyJobDashboard />
                            </PrivateRoute>
                        } />
                        <Route path="/admin-dashboard" element={
                            <PrivateRoute allowedRoles={['admin']}>
                                <AdminDashboard />
                            </PrivateRoute>
                        } />
                        <Route path="/chat" element={
                            <PrivateRoute allowedRoles={['jobseeker', 'company', 'admin']}>
                                <ChatPage />
                            </PrivateRoute>
                        } />

                        <Route path="/applications/for-job/:jobId" element={
                            <PrivateRoute allowedRoles={['company', 'admin']}>
                                <JobApplicantsPage />
                            </PrivateRoute>
                        } />

                        <Route path="*" element={
                            <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-100">
                                <h1 className="text-4xl font-bold text-gray-800">404 - Page Not Found</h1>
                            </div>
                        } />
                    </Routes>
                {/* </ErrorBoundary> */}
            </main>

            <footer className="bg-gray-800 text-white p-4 text-center mt-auto w-full">
                <div className="container mx-auto">
                    <p>&copy; {new Date().getFullYear()} AI-Enhanced Job Portal. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

const LogoutButton = () => {
    const { handleLogout } = useContext(AuthContext);
    const navigate = useNavigate();

    const onLogoutClick = () => {
        handleLogout();
    };

    return (
        <button onClick={onLogoutClick} className="bg-red-500 text-white py-1.5 px-4 rounded-md hover:bg-red-600 transition-colors">
            Logout
        </button>
    );
};

export default App;
