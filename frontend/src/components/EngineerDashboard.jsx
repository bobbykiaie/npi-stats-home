import React, { useState, useEffect } from "react";
import axios from "axios";

export default function EngineerDashboard() {
    const [activeBuilds, setActiveBuilds] = useState([]);

    useEffect(() => {
        fetchActiveBuilds();
    }, []);

    const fetchActiveBuilds = async () => {
        try {
            const response = await axios.get("${API_BASE_URL}/active_builds");
            setActiveBuilds(response.data);
        } catch (error) {
            console.error("Error fetching active builds:", error);
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Active Builds Dashboard</h1>

            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border p-2">Operator</th>
                        <th className="border p-2">Lot Number</th>
                        <th className="border p-2">Manufacturing Procedure</th>
                        <th className="border p-2">Start Time</th>
                    </tr>
                </thead>
                <tbody>
                    {activeBuilds.length > 0 ? (
                        activeBuilds.map((build) => (
                            <tr key={build.build_id} className="border">
                                <td className="border p-2">{build.username}</td>
                                <td className="border p-2">{build.lot_number}</td>
                                <td className="border p-2">{build.mp_number}</td>
                                <td className="border p-2">{build.start_time}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="4" className="border p-2 text-center">No active builds</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
