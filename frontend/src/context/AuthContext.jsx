// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode'; // Make sure you have jwt-decode installed
import { useNavigate } from 'react-router-dom'; // Import useNavigate for redirects

// Create AuthContext
export const AuthContext = createContext(null);

// AuthProvider component
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true); // To indicate if initial auth check is done
    const navigate = useNavigate(); // Hook for navigation

    // Effect to check auth status on initial load and on localStorage changes
    useEffect(() => {
        const checkAuthStatus = () => {
            const token = localStorage.getItem('token');
            const userString = localStorage.getItem('user');

            if (token && userString) {
                try {
                    const decodedToken = jwtDecode(token);
                    const userObject = JSON.parse(userString);

                    // Check if token is expired
                    if (decodedToken.exp * 1000 > Date.now()) {
                        setCurrentUser(userObject);
                    } else {
                        // Token expired, clear it
                        handleLogout();
                    }
                } catch (error) {
                    console.error("AuthContext useEffect: Error decoding token or parsing user data:", error);
                    handleLogout(); // Clear everything if token/user data is invalid
                }
            } else {
                setCurrentUser(null);
            }
            setLoadingAuth(false);
        };

        checkAuthStatus(); // Run once on mount

        // Listen for changes in localStorage (e.g., from apiClient logout)
        window.addEventListener('storage', checkAuthStatus);
        return () => {
            window.removeEventListener('storage', checkAuthStatus);
        };
    }, []);

    // Function to handle login success
    const handleLogin = (token, userEntity) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userEntity));
        setCurrentUser(userEntity);
        // console.log("AuthContext handleLogin: User set in state and localStorage.");
    };

    // Function to handle logout
    const handleLogout = () => {
        // console.log("AuthContext handleLogout: Clearing localStorage and state.");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        // Redirect to login page after logout (ensure this doesn't conflict with apiClient's redirect)
        // If apiClient already redirects, this might be redundant or cause a double redirect.
        // For now, let's keep it here for explicit context-driven logout.
        navigate('/login');
    };

    // Provide the auth state and functions to children components
    return (
        <AuthContext.Provider value={{ currentUser, setCurrentUser, handleLogin, handleLogout, loadingAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to easily consume the AuthContext
export const useAuth = () => {
    return useContext(AuthContext);
};
