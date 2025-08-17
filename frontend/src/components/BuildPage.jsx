import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

export default function BuildPage() {
    const { config_number, mp_number } = useParams();  // ✅ Extract params from URL
    const location = useLocation();
    const navigate = useNavigate();

    const [configs, setConfigs] = useState(location.state?.configs || []);
    const [selectedConfig, setSelectedConfig] = useState(config_number || null);
    const [mpList, setMpList] = useState([]);
    const [error, setError] = useState("");
    const [mpDetails, setMpDetails] = useState(null);

    // ✅ Fetch configs if missing (fallback if user directly navigates to /build/:config_number/:mp_number)
    useEffect(() => {
        if (!configs.length && config_number) {
            axios.get(`${API_BASE_URL}/configurations/by-ys/${config_number}`)
                .then(response => setConfigs(response.data))
                .catch(error => console.error("Error fetching configurations:", error));
        }
    }, [configs, config_number]);

    // ✅ Fetch MP list when a configuration is selected
    useEffect(() => {
        if (selectedConfig) {
            fetchMPs(selectedConfig);
        }
    }, [selectedConfig]);

    // ✅ Fetch MP details if navigating to an individual MP page
    useEffect(() => {
        if (config_number && mp_number) {
            fetchMPDetails(config_number, mp_number);
        }
    }, [config_number, mp_number]);

    const fetchMPs = async (configNumber) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/manufacturing_procedures/by-config/${configNumber}`);
            setMpList(response.data);
        } catch (error) {
            setError("Error fetching MPs.");
        }
    };

    const fetchMPDetails = async (configNumber, mpNumber) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/manufacturing_procedures/by-config/${configNumber}`);
            const mpData = response.data.find(mp => mp.mp_number === mpNumber);
            if (mpData) {
                setMpDetails(mpData);
            } else {
                setError("MP not found for this configuration.");
            }
        } catch (error) {
            setError("Error fetching MP details.");
        }
    };

    const handleSelectMP = async (config, mp) => {
        try {
            // ✅ Send request to start build
            await axios.post("${API_BASE_URL}/start_build", {
                user_id: 1,  // Replace with the logged-in user ID
                lot_number: config,
                mp_number: mp
            }, { withCredentials: true });
    
            console.log("✅ Build started. Redirecting...");
            navigate(`/spc-tracking-app/build/${config}/${mp}`);
        } catch (error) {
            console.error("❌ Error starting build:", error.response?.data || error.message);
        }
    };
    

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Manufacturing Procedure</h1>

            {error ? (
                <p className="text-red-500">{error}</p>
            ) : (
                <>
                    {/* ✅ Show available configurations */}
                    {!config_number && (
                        <>
                            <h2 className="text-lg font-bold">Select Configuration:</h2>
                            <div className="space-y-2">
                                {configs.map((config) => (
                                    <button
                                        key={config.config_number}
                                        onClick={() => setSelectedConfig(config.config_number)}
                                        className={`p-2 border rounded-lg w-full text-left ${
                                            selectedConfig === config.config_number ? "bg-blue-200" : "bg-white"
                                        }`}
                                    >
                                        {config.config_number} (BR#: {config.br_number})
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ✅ Show MPs when a config is selected */}
                    {selectedConfig && !mp_number && (
                        <>
                            <h2 className="text-lg font-bold mt-4">Select Manufacturing Procedure:</h2>
                            <div className="space-y-2">
                                {mpList.map((mp) => (
                                    <button
                                        key={mp.mp_number}
                                        onClick={() => handleSelectMP(selectedConfig, mp.mp_number)}
                                        className="p-2 border rounded-lg w-full text-left bg-gray-100"
                                    >
                                        {mp.procedure_name} (MP#: {mp.mp_number})
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ✅ Show MP Details when navigating to an MP */}
                    {config_number && mp_number && (
                        <div className="mt-4">
                            <p>✅ Configuration: <strong>{config_number}</strong></p>
                            <p>✅ MP: <strong>{mp_number}</strong></p>
                            {mpDetails ? (
                                <div>
                                    <h2 className="text-xl font-bold mt-4">Procedure Name:</h2>
                                    <p>{mpDetails.procedure_name}</p>
                                </div>
                            ) : (
                                <p className="text-red-500">MP details not available.</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
