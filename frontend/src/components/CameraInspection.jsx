import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from './api'; // Assuming you have this config file
import { FiCamera, FiRefreshCw, FiDatabase } from 'react-icons/fi';

export default function CameraInspection() {
    const [cameraIp, setCameraIp] = useState('192.168.1.10'); // Default or load from settings
    const [iframeSrc, setIframeSrc] = useState('');
    const [lastResult, setLastResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // You would typically load the last saved IP from user settings/database
        // For now, we'll just use a default.
        if (cameraIp) {
            setIframeSrc(`http://${cameraIp}`);
        }
    }, []);

    const handleIpChange = (e) => {
        setCameraIp(e.target.value);
    };

    const handleConnect = () => {
        if (cameraIp) {
            setIframeSrc(`http://${cameraIp}`);
        } else {
            alert("Please enter a valid IP address.");
        }
    };

    const handleFetchResult = async () => {
        setIsLoading(true);
        setError('');
        setLastResult(null);
        try {
            // This new backend route will act as the bridge to the camera
            const response = await axios.post(`${API_BASE_URL}/camera/fetch-result`, 
                { ip: cameraIp },
                { withCredentials: true }
            );
            setLastResult(response.data);
            alert("Successfully fetched and saved the latest inspection result!");
        } catch (err) {
            console.error("Error fetching camera result:", err);
            const errorMessage = err.response?.data?.error || "Failed to fetch result. Check backend logs and camera connection.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Camera Inspection</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Controls and Results */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-800 mb-4">Camera Settings</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="camera-ip" className="block text-sm font-medium text-slate-700 mb-1">Camera IP Address</label>
                                <input
                                    type="text"
                                    id="camera-ip"
                                    value={cameraIp}
                                    onChange={handleIpChange}
                                    className="w-full p-2 border border-slate-300 rounded-md"
                                    placeholder="e.g., 192.168.1.10"
                                />
                            </div>
                            <button onClick={handleConnect} className="w-full p-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition">
                                Connect to Camera
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-800 mb-4">Data Logging</h2>
                        <button 
                            onClick={handleFetchResult} 
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2 p-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            {isLoading ? <FiRefreshCw className="animate-spin" /> : <FiDatabase />}
                            {isLoading ? 'Fetching...' : 'Fetch Last Result & Save'}
                        </button>
                        {error && <p className="text-red-500 mt-4">{error}</p>}
                        {lastResult && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-2">
                                <h3 className="font-bold text-slate-700">Last Saved Result:</h3>
                                <p><span className="font-semibold">Status:</span> <span className={`font-bold ${lastResult.status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>{lastResult.status}</span></p>
                                <p><span className="font-semibold">Program:</span> {lastResult.programName}</p>
                                {lastResult.measurements && Object.entries(lastResult.measurements).map(([key, value]) => (
                                    <p key={key}><span className="font-semibold">{key}:</span> {value}</p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Embedded Camera UI */}
                <div className="lg:col-span-2 bg-white p-2 rounded-xl shadow-sm">
                    {iframeSrc ? (
                        <iframe
                            src={iframeSrc}
                            title="Keyence Camera Interface"
                            className="w-full h-[600px] border-0 rounded-lg"
                            // sandbox="allow-scripts allow-same-origin allow-forms" // Security attribute, might need adjustment
                        ></iframe>
                    ) : (
                        <div className="w-full h-[600px] flex items-center justify-center bg-slate-100 rounded-lg">
                            <div className="text-center text-slate-500">
                                <FiCamera size={48} className="mx-auto mb-4" />
                                <p>Enter the camera's IP address and click "Connect"</p>
                                <p>to view the live interface.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
