// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Your global CSS
import { BrowserRouter as Router } from 'react-router-dom'; // Import BrowserRouter
import { AuthProvider } from './context/AuthContext.jsx'; // Import AuthProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router> {/* Router should wrap AuthProvider */}
      <AuthProvider> {/* AuthProvider wraps your entire App */}
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);
