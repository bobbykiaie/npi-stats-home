import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authconfig";
import axios from "axios";
import API_BASE_URL from "./api";

export default function Login({ refreshUser }) {
  const { instance } = useMsal();
  const navigate = useNavigate();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await axios.post(
        `${API_BASE_URL}/auth/login`,
        { username, password },
        { withCredentials: true }
      );
      refreshUser();
      navigate("/spc-tracking-app/Home");
    } catch (err) {
      console.error("❌ Login Error:", err);
      setError("Invalid username or password");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (secretKey !== "TN35") {
      setError("Invalid secret key. Please enter the correct key to create an account.");
      return;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/auth/register`,
        { username, password, role, secretKey },
        { withCredentials: true }
      );

      alert("✅ Account created successfully! Please log in.");
      setIsLoginMode(true);
      setUsername("");
      setPassword("");
      setRole("");
      setSecretKey("");
    } catch (err) {
      console.error("❌ Registration Error:", err);
      setError(err.response?.data?.error || "Failed to create account");
    }
  };

  const handleMicrosoftLogin = async () => {
    setError("");
    try {
      const loginResponse = await instance.loginPopup(loginRequest);
      const idToken = loginResponse.idToken;

      const response = await axios.post(
        `${API_BASE_URL}/auth/microsoft`,
        { token: idToken },
        { withCredentials: true }
      );

      if (response.data.newUser) {
        navigate("/spc-tracking-app/ms-register", {
          state: { email: response.data.email, idToken },
        });
      } else {
        refreshUser();
        navigate("/spc-tracking-app/Home");
      }
    } catch (error) {
      console.error("❌ Microsoft Login Error:", error);
      setError("Microsoft login failed. Please try again.");
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError("");
    setUsername("");
    setPassword("");
    setRole("");
    setSecretKey("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center tracking-tight">NPI Stats</h1>
        <h2 className="text-2xl font-semibold text-blue-700 mb-6 text-center">
          {isLoginMode ? "Login" : "Create Account"}
        </h2>

        <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-gray-700 font-medium mb-2">Username</label>
            <input
              type="text"
              id="username"
              placeholder="Enter Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-xl shadow-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium mb-2">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-xl shadow-sm"
              required
            />
          </div>

          {!isLoginMode && (
            <>
              <div>
                <label htmlFor="role" className="block text-gray-700 font-medium mb-2">Role</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-xl"
                  required
                >
                  <option value="" disabled>Select Role</option>
                  <option value="engineer">Engineer</option>
                  <option value="inspector">Inspector</option>
                </select>
              </div>

              <div>
                <label htmlFor="secretKey" className="block text-gray-700 font-medium mb-2">Secret Key</label>
                <input
                  type="text"
                  id="secretKey"
                  placeholder="Enter Secret Key"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-xl"
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className={`w-full ${isLoginMode ? 'bg-blue-600' : 'bg-green-600'} text-white px-6 py-3 rounded-xl shadow-md hover:opacity-90 transition duration-300`}
          >
            {isLoginMode ? "Login" : "Create Account"}
          </button>

          {isLoginMode && (
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-xl shadow-md font-semibold text-lg hover:bg-gray-300 transition duration-300"
            >
              Sign in with Microsoft
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={toggleMode}
            className="text-blue-600 hover:underline font-medium"
          >
            {isLoginMode ? "Don't have an account? Create one" : "Already have an account? Login"}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-center bg-red-100 p-4 mt-4 rounded-lg shadow-md">{error}</p>
        )}
      </div>
    </div>
  );
}
