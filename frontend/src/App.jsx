import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './components/Navbar';
import SPC from './components/SPC';
import Home from './components/Home';
import ActiveBuild from './components/ActiveBuild';
import Login from './components/Login';
import Reports from './components/Reports';
import { SampleProvider } from './components/SampleContext';
import API_BASE_URL from './components/api';
import MsRegister from './components/MsRegister';
import AdminPage from './components/Admin/AdminPage';
import ProtectedRoute from './components/ProtectedRoute';
import AIChatBot from './components/AIChatBot';
import { useQuery } from 'react-query';
import CameraInspection from './components/CameraInspection';


const useChatbotStatus = () => {
    return useQuery('chatbotStatus', async () => {
        const { data } = await axios.get(`${API_BASE_URL}/settings/chatbot-status`, { withCredentials: true });
        return data.isEnabled;
    }, {
        staleTime: 5 * 60 * 1000,
    });
};


function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { data: isChatBotVisible } = useChatbotStatus();


    const refreshUser = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/auth/current_user`, { withCredentials: true });
            setUser(response.data);
        } catch (error) {
            console.error('No active user session:', error.message);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen">Loading application...</div>;
    }

    return (
        <SampleProvider>
            <Router>
                <div>
                    <Navbar user={user} refreshUser={refreshUser} />
                    <Routes>
                        <Route path="/" element={<Navigate to="/spc-tracking-app/Home" />} />
                        <Route path="/spc-tracking-app" element={<Navigate to="/spc-tracking-app/Home" />} />

                        <Route
                            path="/spc-tracking-app/Home"
                            element={<Home user={user} />}
                        />
                        <Route
                            path="/spc-tracking-app/active-build"
                            element={
                                <ProtectedRoute user={user} allowedRoles={['operator', 'engineer']}>
                                    <ActiveBuild user={user} />
                                </ProtectedRoute>
                            }
                        />
                        {/* CORRECTED: Reverted to a single route for the Admin Page */}
                        <Route 
                            path="/spc-tracking-app/admin"
                            element={
                                <ProtectedRoute user={user} allowedRoles={['engineer']}>
                                    <AdminPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/spc-tracking-app/spc"
                            element={
                                <ProtectedRoute user={user} allowedRoles={['engineer']}>
                                    <SPC user={user} />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/spc-tracking-app/reports"
                            element={
                                <ProtectedRoute user={user} allowedRoles={['engineer']}>
                                    <Reports user={user} />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/spc-tracking-app/login"
                            element={<Login refreshUser={refreshUser} />}
                        />
                        <Route path="/spc-tracking-app/ms-register" element={<MsRegister refreshUser={refreshUser} />} />
                        <Route
                            path="/spc-tracking-app/camera-inspection"
                            element={
                                <ProtectedRoute user={user} allowedRoles={['engineer']}>
                                    <CameraInspection />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                    {/* {user && isChatBotVisible && <AIChatBot />} */}
                </div>
            </Router>
        </SampleProvider>
    );
}

export default App;
