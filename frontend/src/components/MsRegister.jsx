import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from './api';

export default function MsRegister({ refreshUser }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { email, idToken } = state || {};

  const [role, setRole] = useState('engineer');
  const [secretKey, setSecretKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (secretKey !== 'TN35') {
      setError('Invalid secret key.');
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/auth/register-ms`, {
        email,
        idToken,
        role,
        secretKey,
      }, { withCredentials: true });

      await refreshUser();
      navigate('/spc-tracking-app/Home');
    } catch (err) {
      console.error('❌ Microsoft Registration Error:', err);
      setError(err.response?.data?.error || 'Registration failed.');
    }
  };

  if (!email || !idToken) {
    return <p className="text-red-600 p-6">Invalid registration state. Please retry Microsoft login.</p>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md max-w-sm w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">Complete Microsoft Registration</h2>
        <p className="text-center mb-4 text-gray-700">Email: <strong>{email}</strong></p>

        <label className="block mb-2 font-medium">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
        >
          <option value="engineer">Engineer</option>
          <option value="inspector">Inspector</option>
        </select>

        <label className="block mb-2 font-medium">Secret Key</label>
        <input
          type="password"
          placeholder="Enter secret key"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />

        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700">
          Complete Registration
        </button>

        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
      </form>
    </div>
  );
}
