import React from 'react';
import { FiBox, FiTool, FiXCircle, FiList, FiClipboard, FiCpu } from 'react-icons/fi';
// The Link component is no longer needed here for tab switching
// import { Link } from 'react-router-dom';

export default function AdminSidebar({ activeTab, setActiveTab }) {
    const menuItems = [
        { name: 'Products', view: 'products', icon: <FiBox /> },
        { name: 'Equipment', view: 'equipment', icon: <FiTool /> },
        { name: 'Rejects', view: 'rejects', icon: <FiXCircle /> },
        { name: 'Lot History', view: 'lots', icon: <FiList /> },
        { name: 'Process Recipes', view: 'recipes', icon: <FiClipboard /> },
        { name: 'AI Settings', view: 'ai-settings', icon: <FiCpu /> },
    ];

    return (
        <aside className="w-64 bg-white shadow-md p-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Admin Panel</h2>
            <nav>
                <ul>
                    {menuItems.map(item => (
                        <li key={item.view}>
                            {/* CORRECTED: Using a button with onClick to set the active tab state */}
                            <button
                                onClick={() => setActiveTab(item.view)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors text-left ${
                                    activeTab === item.view
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {item.icon}
                                {item.name}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
}
