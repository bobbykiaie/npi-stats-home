import React from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate
import axios from 'axios';
import API_BASE_URL from "./api";

export default function Navbar({ user, refreshUser }) {
  const navigate = useNavigate(); // Hook for programmatic navigation

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true });
      refreshUser(); // Refresh user state immediately
      navigate('/spc-tracking-app/login'); // Redirect to login page
    } catch (error) {
      console.error("❌ Logout error:", error);
    }
  };

  return (
    <nav className="bg-emerald-600 text-white px-6 py-4 flex justify-between items-center shadow-md">
      <div className="text-2xl font-bold">NPI Stats</div>
      <div className="flex space-x-8">
        {/* Home link (visible to all logged-in users) */}
        <Link
          to="/spc-tracking-app/Home"
          className="hover:text-gray-300 transition-colors"
        >
          Home
        </Link>
        {/* Active Build link (visible to all logged-in users, adjust as needed) */}
        {user && (
          <Link
            to="/spc-tracking-app/active-build"
            className="hover:text-gray-300 transition-colors"
          >
            Active Build
          </Link>
        )}
                {/* SPC link (visible only to engineers) */}
        {user && user.role === 'engineer' && (
          <Link
            to="/spc-tracking-app/spc"
            className="hover:text-gray-300 transition-colors"
          >
            SPC
          </Link>
        )}
        {/* MODIFIED: Replaced individual engineer links with a single Admin link */}
        {user && user.role === 'engineer' && (
          <Link
            to="/spc-tracking-app/admin"
            className="hover:text-gray-300 transition-colors"
          >
            Admin
          </Link>
        )}

        {/* Active Builds link (visible only to engineers)
        {user && user.role === 'engineer' && (
          <Link
            to="/spc-tracking-app/active-builds"
            className="hover:text-gray-300 transition-colors"
          >
            Build History
          </Link>
        )} */}



        {/* Reports link (visible only to engineers) */}
        {user && user.role === 'engineer' && (
          <Link
            to="/spc-tracking-app/reports"
            className="hover:text-gray-300 transition-colors"
          >
            Reports
          </Link>
        )}

        {/* Add more links as needed */}
        {user && user.role === 'engineer' && (
          <Link
            to="/spc-tracking-app/camera-inspection"
            className="hover:text-gray-300 transition-colors"
          >
            Camera Inspection
          </Link>
  )} 

        {/* Login/Logout logic */}
        {user ? (
          <button
            onClick={handleLogout}
            className="hover:text-gray-300 transition-colors"
          >
            Logout ({user.username})
          </button>
        ) : (
          <Link
            to="/spc-tracking-app/login"
            className="hover:text-gray-300 transition-colors"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}