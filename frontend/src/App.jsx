import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom'; // Keep useNavigate import here

import JobRecommendations from './components/JobRecommendations';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import JobListingsPage from './pages/JobListingsPage';
import CreateJobPage from './pages/CreateJobPage';

// Create AuthContext
export const AuthContext = createContext(null);

// Placeholder components (no changes)
const HomePage = () => (
  <div className="p-8 text-center">
    <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to the AI-Enhanced Job Portal!</h2>
    <p className="text-lg text-gray-600 mb-8">Find your dream job or the perfect candidate with smart recommendations.</p>
    <JobRecommendations />
  </div>
);
const ProfilePage = () => <div className="p-8 text-center text-xl">User Profile</div>;
const CompanyDashboardPage = () => <div className="p-8 text-center text-xl">Company Dashboard</div>;
const ChatPage = () => <div className="p-8 text-center text-xl">Chat Interface</div>;


function App() {
  const [currentUser, setCurrentUser] = useState(null);
  // --- FIX: useNavigate must be inside Router context, so it needs to be called within a component
  //    that is a child of Router. We will define a component that uses it.
  //    For now, we'll pass it down or handle logout within the component
  //    that consumes AuthContext.
  //    The issue is that App itself is the parent of Router, so useNavigate cannot be here.
  //    We will move the logout logic to a separate handler or directly into the button's onClick.
  //    Let's refine the handleLogout to be a function that can be called from the context.
  //    The navigate will be called inside the button's onClick.
  // --- END FIX ---

  // Function to handle logout, will be called from a component inside Router
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    // The actual navigation will happen in the component that calls this function
  };

  return (
    // AuthContext.Provider must wrap BrowserRouter
    <AuthContext.Provider value={{ currentUser, setCurrentUser, handleLogout }}>
      <Router> {/* Router is now the direct child of AuthContext.Provider */}
        <div className="flex flex-col min-h-screen bg-gray-100 font-sans text-gray-900 w-full overflow-x-hidden">
          {/* Navbar */}
          <nav className="bg-blue-600 p-4 shadow-md w-full">
            <div className="container mx-auto flex justify-between items-center">
              <Link to="/" className="text-white text-2xl font-bold rounded-md px-3 py-2 hover:bg-blue-700 transition-colors">
                Job Portal AI
              </Link>
              <div className="space-x-4 flex items-center">
                <Link to="/jobs" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Jobs</Link>
                
                {currentUser && (currentUser.role === 'company' || currentUser.role === 'admin') && (
                  <Link to="/create-job" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Post a Job</Link>
                )}

                {currentUser ? (
                  <>
                    {currentUser.role === 'jobseeker' && (
                      <Link to="/profile" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Profile</Link>
                    )}
                    {currentUser.role === 'company' && (
                      <Link to="/company-dashboard" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Dashboard</Link>
                    )}
                    {currentUser.role === 'admin' && (
                      <Link to="/admin-dashboard" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Admin</Link>
                    )}
                    {/* --- FIX: Call useNavigate inside the onClick handler --- */}
                    <LogoutButton /> {/* Use a dedicated LogoutButton component */}
                    {/* --- END FIX --- */}
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

          {/* Main Content Area */}
          <main className="flex-grow container mx-auto p-4 w-full">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/jobs" element={<JobListingsPage />} />
              <Route path="/create-job" element={<CreateJobPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/company-dashboard" element={<CompanyDashboardPage />} />
              <Route path="/chat" element={<ChatPage />} />
              {/* Add more routes here */}
            </Routes>
          </main>

          {/* Footer */}
          <footer className="bg-gray-800 text-white p-4 text-center mt-auto w-full">
            <div className="container mx-auto">
              <p>&copy; {new Date().getFullYear()} AI-Enhanced Job Portal. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

// --- NEW: Dedicated LogoutButton component to use useNavigate ---
const LogoutButton = () => {
  const { handleLogout } = useContext(AuthContext);
  const navigate = useNavigate(); // useNavigate hook is used here, inside a component that is a child of Router

  const onLogoutClick = () => {
    handleLogout();
    navigate('/'); // Redirect to home after logout
  };

  return (
    <button onClick={onLogoutClick} className="bg-red-500 text-white py-1.5 px-4 rounded-md hover:bg-red-600 transition-colors">
      Logout
    </button>
  );
};
// --- END NEW ---

export default App;
