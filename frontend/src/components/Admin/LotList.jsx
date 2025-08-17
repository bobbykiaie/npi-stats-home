import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import API_BASE_URL from '../api';
import { FiEyeOff, FiEye, FiList, FiChevronsLeft, FiSliders, FiCamera, FiCheck, FiX, FiDatabase, FiSearch, FiTrash2, FiCpu, FiPercent } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';

// --- Reusable Hooks ---
const useLots = () => {
    return useQuery('allLots', async () => {
        const { data } = await axios.get(`${API_BASE_URL}/lots/overview`, { withCredentials: true });
        return data;
    });
};

// --- Main Component ---
export default function LotList() {
    const { data: lots, isLoading } = useLots();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLot, setSelectedLot] = useState(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const queryClient = useQueryClient();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLotClick = (lot) => {
        setSelectedLot(lot);
    };
    
    useEffect(() => {
        const lotNumberFromState = location.state?.selectedLotNumber;
        if (lotNumberFromState && lots) {
            const lotExists = lots.find(l => l.lot_number === lotNumberFromState);
            if (lotExists) {
                setSelectedLot(lotExists);
                navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [location.state, lots, navigate]);


    const toggleExclusionMutation = useMutation(
        (lotNumber) => axios.post(`${API_BASE_URL}/lots/${lotNumber}/toggle-exclusion`, {}, { withCredentials: true }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('allLots');
            },
            onError: (error) => {
                alert(`Error: ${error.response?.data?.error || 'Could not update lot status.'}`);
            }
        }
    );

    const deleteLotMutation = useMutation(
        (lotNumber) => axios.delete(`${API_BASE_URL}/lots/${lotNumber}`, { withCredentials: true }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('allLots');
                alert('Lot deleted successfully.');
            },
            onError: (error) => {
                alert(`Error: ${error.response?.data?.error || 'Could not delete lot.'}`);
            }
        }
    );

    const handleDeleteLot = (lotNumber) => {
        if (window.confirm(`Are you sure you want to permanently delete Lot ${lotNumber}? This action cannot be undone.`)) {
            deleteLotMutation.mutate(lotNumber);
        }
    };

    const { activeLots, excludedLots } = useMemo(() => {
        const active = [];
        const excluded = [];
        if (!lots) return { activeLots: [], excludedLots: [] };
        
        const filtered = lots.filter(lot => lot.lot_number.toLowerCase().includes(searchTerm.toLowerCase()));

        filtered.forEach(lot => {
            if (lot.is_excluded) {
                excluded.push(lot);
            } else {
                active.push(lot);
            }
        });
        return { activeLots: active, excludedLots: excluded };
    }, [lots, searchTerm]);

    const LotTable = ({ lotData, title, isExcludedList = false }) => (
        <div className="mb-12">
            <h3 className="text-2xl font-semibold text-slate-800 mb-4 flex items-center gap-3">
                {isExcludedList ? <FiEyeOff className="text-red-500" /> : <FiList className="text-indigo-500" />}
                {title}
            </h3>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <ul className="divide-y divide-slate-200">
                    {lotData.map(lot => (
                        <li key={lot.lot_number} className={`p-4 transition-colors duration-200 flex justify-between items-center ${isExcludedList ? 'bg-red-50' : ''}`}>
                            <div onClick={() => handleLotClick(lot)} className="cursor-pointer flex-grow">
                                <p className="font-semibold text-indigo-600">{lot.lot_number}</p>
                                <p className="text-sm text-slate-500">{lot.product_name} - {lot.config_number}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleExclusionMutation.mutate(lot.lot_number)}
                                    disabled={toggleExclusionMutation.isLoading && toggleExclusionMutation.variables === lot.lot_number}
                                    className={`flex items-center px-3 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${
                                        isExcludedList
                                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                                    }`}
                                >
                                    {isExcludedList ? <FiEye className="mr-2" /> : <FiEyeOff className="mr-2" />}
                                    {isExcludedList ? 'Re-include' : 'Exclude'}
                                </button>
                                <button
                                    onClick={() => handleDeleteLot(lot.lot_number)}
                                    disabled={deleteLotMutation.isLoading && deleteLotMutation.variables === lot.lot_number}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                    title="Delete Lot Permanently"
                                >
                                    <FiTrash2 size={16} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    if (isLoadingDetails) {
        return <div className="p-8 text-center">Loading Lot Details...</div>;
    }

    if (selectedLot) {
        return <LotDataView lot={selectedLot} onBack={() => setSelectedLot(null)} />;
    }

    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8 flex items-center gap-3"><FiDatabase /> Lot History</h1>
            
            <div className="relative mb-6">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Search by lot number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-lg p-3 pl-12 border border-slate-300 rounded-lg shadow-sm"
                />
            </div>
            
            {isLoading ? <p>Loading lots...</p> : (
                <>
                    <LotTable lotData={activeLots} title="Active Lots" />
                    {excludedLots.length > 0 && <LotTable lotData={excludedLots} title="Excluded Lots" isExcludedList={true} />}
                </>
            )}
        </div>
    );
}


// --- NEW Sub-component to display the detailed lot data with MP selection ---
function LotDataView({ lot, onBack }) {
    const [selectedMp, setSelectedMp] = useState(null);
    
    const { data: activeMps, isLoading: isLoadingMps } = useQuery(
        ['activeMpsForLot', lot.lot_number],
        () => axios.get(`${API_BASE_URL}/lots/${lot.lot_number}/active-mps`, { withCredentials: true }).then(res => res.data),
        {
            onSuccess: (data) => {
                if (data && data.length > 0 && !selectedMp) {
                    setSelectedMp(data[0]);
                }
            }
        }
    );

    const { data: lotDetails, isLoading: isLoadingLotDetails } = useQuery(
        ['lotDetails', lot.lot_number, selectedMp?.mp_number],
        () => axios.get(`${API_BASE_URL}/lots/details/${lot.lot_number}/${selectedMp.mp_number}`, { withCredentials: true }).then(res => res.data),
        {
            enabled: !!selectedMp
        }
    );
    
    const [selectedSample, setSelectedSample] = useState(null);
    const [viewImage, setViewImage] = useState(null);

    const inspections = lotDetails?.inspections || [];
    const specs = lotDetails?.specs || [];

    const selectedInspection = useMemo(() => {
        if (!selectedSample) return null;
        return inspections.find(ins => ins.unit_number === selectedSample);
    }, [selectedSample, inspections]);

    const snapshot = useMemo(() => {
        if (!selectedInspection || !selectedInspection.process_parameters_snapshot) return null;
        try {
            return JSON.parse(selectedInspection.process_parameters_snapshot);
        } catch (e) {
            console.error("Failed to parse snapshot JSON:", e);
            return null;
        }
    }, [selectedInspection]);
    
    const getYieldColor = (yieldValue) => {
        if (yieldValue >= 95) return 'text-green-600';
        if (yieldValue >= 85) return 'text-amber-600';
        return 'text-red-600';
    };

    return (
        <>
            {viewImage && <ImageViewModal imageUrl={viewImage} onClose={() => setViewImage(null)} />}
            <div className="p-8 flex gap-8 h-full">
                {/* MP Selection Sidebar */}
                <aside className="w-64 bg-white p-4 rounded-xl shadow-sm flex-col flex">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><FiCpu/> Procedures</h3>
                    <div className="flex-grow overflow-y-auto">
                        {isLoadingMps ? <p>Loading...</p> : (
                            <ul className="space-y-2">
                                {activeMps?.map(mp => (
                                    <li key={mp.mp_number}>
                                        <button 
                                            onClick={() => setSelectedMp(mp)}
                                            className={`w-full text-left p-3 rounded-lg transition-colors ${selectedMp?.mp_number === mp.mp_number ? 'bg-indigo-600 text-white font-semibold' : 'hover:bg-slate-100'}`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">{mp.procedure_name}</span>
                                                <span className={`text-sm font-bold ${getYieldColor(mp.yield)}`}>{mp.yield}%</span>
                                            </div>
                                            <p className="text-xs opacity-70">{mp.mp_number}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1">
                    <button onClick={onBack} className="flex items-center gap-2 mb-6 text-indigo-600 font-semibold hover:underline">
                        <FiChevronsLeft /> Back to Lot List
                    </button>
                    <h1 className="text-3xl font-bold text-slate-800">Lot: {lot.lot_number}</h1>
                    <p className="text-slate-500 mb-6">{lot.product_name} / {lot.config_number}</p>

                    {isLoadingLotDetails && <p>Loading data for {selectedMp?.procedure_name}...</p>}

                    {lotDetails && (
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-xl font-semibold text-slate-800 mb-4">Inspection Data</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100">
                                            <tr>
                                                <th className="p-3 text-left font-semibold text-slate-600">Sample</th>
                                                {specs.map((spec) => (<th key={spec.spec_name} className="p-3 text-left font-semibold text-slate-600">{spec.spec_name}</th>))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...Array(lotDetails.lot.quantity)].map((_, i) => {
                                                const unitNumber = i + 1;
                                                return (
                                                    <tr key={unitNumber} className={`border-b border-slate-100 transition-colors cursor-pointer ${selectedSample === unitNumber ? 'bg-indigo-100' : 'hover:bg-slate-50'}`} onClick={() => setSelectedSample(unitNumber)}>
                                                        <td className="p-3 font-medium text-slate-800">{unitNumber}</td>
                                                        {specs.map((spec) => {
                                                            const inspection = inspections.find((ins) => ins.unit_number === unitNumber && ins.spec_name === spec.spec_name);
                                                            return (
                                                                <td key={spec.spec_name} className="p-3 text-center">
                                                                    {inspection ? (
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <span className={inspection.pass_fail === "Pass" ? "text-green-600" : "text-red-600"}>{inspection.pass_fail === "Pass" ? <FiCheck/> : <FiX/>}</span>
                                                                            {inspection.inspection_value !== null && (<span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full font-mono">{inspection.inspection_value}</span>)}
                                                                            {inspection.reject_code && (<span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded-full font-semibold">{inspection.reject_code}</span>)}
                                                                            {inspection.image_url && <button onClick={(e) => { e.stopPropagation(); setViewImage(inspection.image_url); }} className="text-blue-500 hover:text-blue-700"><FiCamera /></button>}
                                                                        </div>
                                                                    ) : <span className="text-slate-300">-</span>}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm sticky top-6">
                                     <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                        <FiSliders /> Process Inputs
                                    </h2>
                                    {selectedSample && snapshot ? (
                                        <div className="space-y-4">
                                            {Object.entries(snapshot).map(([recipeName, parameters]) => (
                                                <div key={recipeName}>
                                                    <h4 className="font-bold text-slate-600">{recipeName}</h4>
                                                    <ul className="pl-4 mt-1 space-y-1 text-sm">
                                                        {Object.entries(parameters).map(([key, value]) => (
                                                            <li key={key} className="flex justify-between">
                                                                <span className="text-slate-500">{key}:</span>
                                                                <span className="font-mono text-slate-800">{String(value)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-center py-8">Select a sample to view its process inputs.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function ImageViewModal({ imageUrl, onClose }) {
    const finalImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${API_BASE_URL.replace('/api', '')}${imageUrl}`;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <img src={finalImageUrl} alt="Inspection" className="max-w-full max-h-[90vh] rounded-lg" />
                <button onClick={onClose} className="absolute -top-4 -right-4 bg-white text-slate-800 rounded-full p-2 shadow-lg"><FiX/></button>
            </div>
        </div>
    );
}
