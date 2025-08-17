import React, { useState, useEffect } from 'react';
import { FiCamera } from 'react-icons/fi';

// This component displays the live feed from the Keyence camera.
export default function CameraView() {
    // The camera's IP is hardcoded for this embedded view.
    const cameraIp = '192.168.1.10';
    const iframeSrc = `http://${cameraIp}`;

    return (
        <div className="mt-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center">
                <FiCamera className="mr-2 text-indigo-500" />
                Live Camera Feed
            </h3>
            <div className="bg-white p-2 rounded-xl shadow-sm border">
                <iframe
                    src={iframeSrc}
                    title="Keyence Camera Interface"
                    className="w-full h-80 border-0 rounded-lg" // Adjust height as needed
                ></iframe>
            </div>
        </div>
    );
}