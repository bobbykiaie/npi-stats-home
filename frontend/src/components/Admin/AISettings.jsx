import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import API_BASE_URL from '../api';
import { FiCpu, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Modal from './Modal';

// Hook to fetch the chatbot status
const useChatbotStatus = () => {
    return useQuery('chatbotStatus', async () => {
        const { data } = await axios.get(`${API_BASE_URL}/settings/chatbot-status`, { withCredentials: true });
        return data.isEnabled;
    });
};

export default function AISettings() {
    const queryClient = useQueryClient();
    const { data: isChatbotEnabled, isLoading } = useChatbotStatus();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const toggleMutation = useMutation(
        (password) => axios.post(`${API_BASE_URL}/settings/toggle-chatbot`, { password }, { withCredentials: true }),
        {
            onSuccess: () => {
                // CORRECTED: Instead of manually setting the data, we invalidate the query.
                // This tells React Query that the 'chatbotStatus' data is stale and needs
                // to be refetched from the server, ensuring the UI is always in sync.
                queryClient.invalidateQueries('chatbotStatus');
                
                // Close the modal and clear the form
                setIsModalOpen(false);
                setPassword('');
                setError('');
            },
            onError: (err) => {
                setError(err.response?.data?.error || 'An error occurred.');
            }
        }
    );

    const handlePasswordConfirm = () => {
        setError('');
        if (!password) {
            setError('Password is required.');
            return;
        }
        toggleMutation.mutate(password);
    };

    if (isLoading) {
        return <div className="p-8">Loading AI settings...</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8 flex items-center gap-3">
                <FiCpu /> AI Chatbot Settings
            </h1>
            <div className="max-w-2xl bg-white p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Enable AI Assistant</h3>
                        <p className="text-sm text-slate-500">Show or hide the AI chatbot for all users.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`font-bold ${isChatbotEnabled ? 'text-green-600' : 'text-red-600'}`}>
                            {isChatbotEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                        >
                            Change
                        </button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FiLock /> Enter AI Feature Password</h3>
                    <p className="text-sm text-slate-600 mb-4">A unique password is required to change this system-wide setting.</p>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter AI Feature Password"
                        className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    <div className="flex justify-end gap-4 mt-6">
                        <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 font-semibold text-slate-700">
                            Cancel
                        </button>
                        <button 
                            onClick={handlePasswordConfirm}
                            disabled={toggleMutation.isLoading}
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-blue-400"
                        >
                            {toggleMutation.isLoading ? 'Changing...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
