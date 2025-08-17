// src/pages/NotAuthorized.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function NotAuthorized() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center text-center p-6 bg-gray-50">
      <h1 className="text-6xl font-bold text-red-500">403</h1>
      <h2 className="text-3xl font-semibold text-gray-800 mt-4">Access Denied</h2>
      <p className="text-gray-600 mt-2">
        Sorry, you do not have the necessary permissions to access this page.
      </p>
      <Link
        to="/spc-tracking-app/Home"
        className="mt-8 bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
}