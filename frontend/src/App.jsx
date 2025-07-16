import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import JobRecommendations from './components/JobRecommendations';
import LoginPage from './pages/LoginPage'; // Import LoginPage from its new path

// Placeholder components (no changes to their content)
const HomePage = () => (
  <div className="p-8 text-center">
    <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to the AI-Enhanced Job Portal!</h2>
    <p className="text-lg text-gray-600 mb-8">Find your dream job or the perfect candidate with smart recommendations.</p>
    {/* Integrate JobRecommendations component here */}
    <JobRecommendations />
  </div>
);
const RegisterPage = () => <div className="p-8 text-center text-xl">Register Page</div>;
const JobListingsPage = () => <div className="p-8 text-center text-xl">Job Listings</div>;
const ProfilePage = () => <div className="p-8 text-center text-xl">User Profile</div>;
const CompanyDashboardPage = () => <div className="p-8 text-center text-xl">Company Dashboard</div>;
const ChatPage = () => <div className="p-8 text-center text-xl">Chat Interface</div>;


function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-gray-100 font-sans text-gray-900 w-full overflow-x-hidden">
        {/* Navbar */}
        <nav className="bg-blue-600 p-4 shadow-md w-full">
          <div className="container mx-auto flex justify-between items-center">
            <Link to="/" className="text-white text-2xl font-bold rounded-md px-3 py-2 hover:bg-blue-700 transition-colors">
              Job Portal AI
            </Link>
            <div className="space-x-4">
              <Link to="/jobs" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Jobs</Link>
              <Link to="/login" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Login</Link>
              <Link to="/register" className="text-white hover:text-blue-200 rounded-md px-3 py-2 transition-colors">Register</Link>
              {/* Add more links as needed for authenticated users */}
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-grow container mx-auto p-4 w-full">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} /> {/* Use the imported LoginPage */}
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/jobs" element={<JobListingsPage />} />
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
  );
}

export default App;
