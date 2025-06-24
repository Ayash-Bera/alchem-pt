import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Research from './pages/Research';
import Dashboard from './pages/Dashboard';
import Navbar from './components/Layout/Navbar';

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/research" replace />} />
          <Route path="/research" element={<Research />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/result/:jobId" element={<JobResult />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;