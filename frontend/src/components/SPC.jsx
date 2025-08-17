import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import API_BASE_URL from "./api";
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Line, Bar } from 'react-chartjs-2';
import Plotly from 'plotly.js-dist';
import PChart from './PChart';
import ParetoChart from './ParetoChart';
import { FiSearch, FiChevronDown, FiChevronRight, FiX, FiBarChart2, FiCpu, FiStar, FiZap, FiPercent, FiTrendingUp, FiAlertOctagon, FiCheckCircle, FiHeart, FiEyeOff } from 'react-icons/fi';
import {
  Chart as ChartJS,
  LineElement, CategoryScale, LinearScale, PointElement, BarElement, Tooltip, Legend
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, BarElement, Tooltip, Legend);

// --- Reusable Custom Hooks for Data Fetching ---

// Generic hook for fetching data that doesn't change often
const useStaticData = (endpoint, options = {}) => {
    return useQuery(endpoint, async () => {
        if (!endpoint) return options.default || [];
        const { data } = await axios.get(`${API_BASE_URL}/${endpoint}`, { withCredentials: true });
        return data;
    }, {
        staleTime: Infinity, // This data is considered static for the session
        ...options
    });
};

// Hook for fetching user's favorite inspections
const useFavorites = (user) => {
    return useQuery('favorites', async () => {
        const { data } = await axios.get(`${API_BASE_URL}/favorites`, { withCredentials: true });
        return data;
    }, {
        enabled: !!user, // Only fetch if the user is logged in
    });
};


export default function SPC({ user }) {
  if (!user || user.role !== 'engineer') {
    return <div className="p-4 text-red-500">You do not have permission to view this page.</div>;
  }

  // --- Core State ---
  const [searchMode, setSearchMode] = useState('product');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpec, setSelectedSpec] = useState(null);
  
  // --- Favorites State & Logic ---
  const queryClient = useQueryClient();
  const { data: favorites } = useFavorites(user);
  const [expandedMpForFavorite, setExpandedMpForFavorite] = useState(null);

  const toggleFavoriteMutation = useMutation(
    (spec) => axios.post(`${API_BASE_URL}/favorites/toggle`, { 
        config_number: spec.config_number,
        mp_number: spec.mp_number,
        spec_name: spec.spec_name
     }, { withCredentials: true }),
    {
        onSuccess: () => {
            queryClient.invalidateQueries('favorites');
        },
    }
  );

  const toggleFavorite = (spec) => {
    toggleFavoriteMutation.mutate(spec);
  };

  // --- Filter State ---
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedLot, setSelectedLot] = useState("");
  const [dataPointsFilter, setDataPointsFilter] = useState(50);
  const [excludeOutliers, setExcludeOutliers] = useState(true);

  // --- Modal State ---
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);
  const [isOutliersModalOpen, setIsOutliersModalOpen] = useState(false);
  const [isExcludedLotsModalOpen, setIsExcludedLotsModalOpen] = useState(false); // New modal state
  
  // --- Chart & Data State ---
  const [inspectionLogs, setInspectionLogs] = useState([]);
  const [chartStats, setChartStats] = useState({});
  const [cpkLeaderboard, setCpkLeaderboard] = useState([]);
  const [pChartData, setPChartData] = useState([]);
  const [paretoData, setParetoData] = useState([]);
  const [outlierList, setOutlierList] = useState([]);

  // --- Data Fetching Hooks ---
  const { data: products } = useStaticData('products');
  const { data: mps } = useStaticData('manufacturing-procedures');
  const { data: usernames } = useStaticData('inspections/users');
  // This query now implicitly fetches only non-excluded lots because the backend route for it will be updated
  const { data: lotsForSpec } = useQuery(['lotsForSpec', selectedSpec], async () => {
    if (!selectedSpec) return [];
    const { config_number, mp_number, spec_name } = selectedSpec;
    const { data } = await axios.get(`${API_BASE_URL}/inspections/lots-for-spec/${config_number}/${mp_number}/${spec_name}`, { withCredentials: true });
    return data;
  }, { enabled: !!selectedSpec });


  // --- Data Fetching Logic ---
  const fetchAllChartData = useCallback(async () => {
    if (!selectedSpec) return;

    const { config_number, mp_number, spec_name, type } = selectedSpec;
    // The backend now handles filtering by excluded lots, so no change is needed here.
    const commonParams = { 
        ...(selectedLot ? { lot_number: selectedLot } : { limit: dataPointsFilter }),
        excludeOutliers,
        username: selectedUser || undefined
    };
    
    setInspectionLogs([]);
    setPChartData([]);
    setParetoData([]);
    setCpkLeaderboard([]);
    setChartStats({});

    try {
      if (type === 'Variable') {
        const logsPromise = axios.get(`${API_BASE_URL}/inspections/logs/${config_number}/${mp_number}/${spec_name}`, { params: commonParams, withCredentials: true });
        const cpkPromise = axios.get(`${API_BASE_URL}/inspections/inspection_logs/cpk-by-user/${config_number}/${mp_number}/${spec_name}`, { params: commonParams, withCredentials: true });

        const [logsRes, cpkRes] = await Promise.all([logsPromise, cpkPromise]);
        
        const logs = logsRes.data;
        setInspectionLogs(logs);
        setCpkLeaderboard(cpkRes.data);

        const inspectionValues = logs.map(log => log.inspection_value).filter(v => v !== null);
        if (inspectionValues.length > 1) {
            const mean = inspectionValues.reduce((s, v) => s + v, 0) / inspectionValues.length;
            const stdDev = Math.sqrt(inspectionValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (inspectionValues.length - 1));
            const { upper_spec: usl, lower_spec: lsl } = selectedSpec;
            const cpk = (usl != null && lsl != null && stdDev > 0) ? Math.min((usl - mean) / (3 * stdDev), (mean - lsl) / (3 * stdDev)).toFixed(2) : null;
            setChartStats({ mean, stdDev, usl, lsl, cpk });
        } else {
            setChartStats({ usl: selectedSpec.upper_spec, lsl: selectedSpec.lower_spec });
        }

      } else if (type === 'Attribute') {
        const pChartPromise = axios.get(`${API_BASE_URL}/inspections/p-chart-data/${config_number}/${mp_number}/${spec_name}`, { withCredentials: true });
        const paretoPromise = axios.get(`${API_BASE_URL}/inspections/reject-summary/${config_number}/${mp_number}/${spec_name}`, { params: { lot_number: selectedLot || undefined }, withCredentials: true });
        
        const [pChartRes, paretoRes] = await Promise.all([pChartPromise, paretoPromise]);
        setPChartData(pChartRes.data);
        setParetoData(paretoRes.data);
      }
    } catch (error) {
        console.error("Failed to fetch chart data:", error);
    }
  }, [selectedSpec, dataPointsFilter, selectedUser, selectedLot, excludeOutliers]);

  useEffect(() => {
    fetchAllChartData();
  }, [fetchAllChartData]);

  // Fetch outlier list when modal opens
  useEffect(() => {
    if (isOutliersModalOpen && selectedSpec) {
        axios.get(`${API_BASE_URL}/inspections/outliers/${selectedSpec.config_number}/${selectedSpec.mp_number}/${selectedSpec.spec_name}`, { withCredentials: true })
             .then(res => setOutlierList(res.data))
             .catch(err => console.error("Could not fetch outliers", err));
    }
  }, [isOutliersModalOpen, selectedSpec]);
  
  // --- Handlers ---
  const handleSpecSelect = (spec, isFromFavorite = false) => {
    setSelectedLot(""); 
    setSelectedSpec(spec);
    if (isFromFavorite) {
      setExpandedMpForFavorite(spec.mp_number);
    } else {
      setExpandedMpForFavorite(null);
    }
  };
  
  const toggleOutlierStatus = async (logId) => {
    try {
        await axios.put(`${API_BASE_URL}/inspections/log/${logId}/toggle-outlier`, {}, { withCredentials: true });
        fetchAllChartData(); 
        if (isOutliersModalOpen && selectedSpec) {
           const res = await axios.get(`${API_BASE_URL}/inspections/outliers/${selectedSpec.config_number}/${selectedSpec.mp_number}/${selectedSpec.spec_name}`, { withCredentials: true });
           setOutlierList(res.data);
        }
    } catch (error) {
        console.error("Failed to toggle outlier status", error);
        alert("Error: Could not update the outlier status.");
    }
  };

  // --- Memoized Values ---
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    if (!searchTerm) return products;
    return products.filter(p => p?.product_name?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

  const filteredMps = useMemo(() => {
    if (!mps || !Array.isArray(mps)) return [];
    if (!searchTerm) return mps;
    return mps.filter(mp => 
        mp?.procedure_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        mp?.mp_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [mps, searchTerm]);
  
  const chartData = useMemo(() => ({
    labels: inspectionLogs.map((log) => `Unit ${log.unit_number}`),
    datasets: [
      { 
        label: 'Values', 
        data: inspectionLogs.map(log => log.inspection_value), 
        borderColor: 'rgb(59, 130, 246)', 
        backgroundColor: 'rgba(59, 130, 246, 0.1)', 
        fill: true, 
        tension: 0.1, 
        pointRadius: 4, 
        pointHoverRadius: 6,
        pointBackgroundColor: inspectionLogs.map(log => log.is_outlier ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'),
      },
      chartStats.mean != null && { label: 'Mean', data: Array(inspectionLogs.length).fill(chartStats.mean), borderColor: 'rgb(16, 185, 129)', borderDash: [5, 5], borderWidth: 2, pointRadius: 0 },
      chartStats.usl != null && { label: 'USL', data: Array(inspectionLogs.length).fill(chartStats.usl), borderColor: 'rgb(239, 68, 68)', borderWidth: 2, pointRadius: 0 },
      chartStats.lsl != null && { label: 'LSL', data: Array(inspectionLogs.length).fill(chartStats.lsl), borderColor: 'rgb(239, 68, 68)', borderWidth: 2, pointRadius: 0 },
    ].filter(Boolean),
  }), [inspectionLogs, chartStats]);
  
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, chartElement) => {
      event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
    },
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const dataIndex = elements[0].index;
        setSelectedDataPoint(inspectionLogs[dataIndex]);
      }
    },
    plugins: { 
        legend: { position: 'top' },
        tooltip: {
            callbacks: {
                footer: (tooltipItems) => {
                    const log = inspectionLogs[tooltipItems[0].dataIndex];
                    return log?.is_outlier ? 'Status: Marked as Outlier' : '';
                }
            }
        }
    },
  }), [inspectionLogs]);

  // --- JSX ---
  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50">
        {selectedDataPoint && <DataPointSummaryModal 
            data={selectedDataPoint} 
            onClose={() => setSelectedDataPoint(null)}
            onToggleOutlier={toggleOutlierStatus}
        />}
        {isOutliersModalOpen && <OutliersListModal 
            outliers={outlierList}
            onClose={() => setIsOutliersModalOpen(false)}
            onToggleOutlier={toggleOutlierStatus}
        />}
        {isExcludedLotsModalOpen && <ExcludedLotsModal onClose={() => setIsExcludedLotsModalOpen(false)} />}
      
        <aside className="w-96 flex-shrink-0 bg-white shadow-md flex flex-col p-4">
            <h2 className="text-2xl font-bold mb-4 text-slate-800">Find a Spec</h2>
            <div className="flex-1 overflow-y-auto pr-1">
                <FavoriteInspections favorites={favorites} onSelectFavorite={(spec) => handleSpecSelect(spec, true)} />

                <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg">
                    <button onClick={() => setSearchMode('product')} className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${searchMode === 'product' ? 'bg-white text-indigo-600 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>By Product</button>
                    <button onClick={() => setSearchMode('mp')} className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${searchMode === 'mp' ? 'bg-white text-indigo-600 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>By Procedure</button>
                </div>
                <div className="relative mb-4">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder={`Search ${searchMode}s...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    {searchTerm && <FiX onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"/>}
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
                    {searchMode === 'product' ? (
                        <ProductAccordionList products={filteredProducts} onSpecSelect={handleSpecSelect} selectedSpec={selectedSpec} expandedMp={expandedMpForFavorite} setExpandedMp={setExpandedMpForFavorite} />
                    ) : (
                        <MpAccordionList mps={filteredMps} onSpecSelect={handleSpecSelect} selectedSpec={selectedSpec} expandedMp={expandedMpForFavorite} setExpandedMp={setExpandedMpForFavorite}/>
                    )}
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
                <button 
                    onClick={() => setIsExcludedLotsModalOpen(true)} 
                    className="w-full text-left p-2 rounded-lg hover:bg-red-50 text-red-700 font-semibold flex items-center"
                >
                    <FiEyeOff className="mr-3"/> View Excluded Lots
                </button>
            </div>
        </aside>
      
        <main className="flex-1 p-6 overflow-y-auto">
            {selectedSpec ? (
                <>
                    <div className="mb-6">
                        <div className="flex items-center gap-2">
                            <h1 className="text-4xl font-bold text-slate-800">{selectedSpec.spec_name}</h1>
                            <button 
                                onClick={() => toggleFavorite(selectedSpec)} 
                                className="p-2 text-slate-400 hover:text-amber-500 transition-colors"
                                title={favorites?.some(f => f.spec_name === selectedSpec.spec_name && f.config_number === selectedSpec.config_number && f.mp_number === selectedSpec.mp_number) ? 'Unfavorite' : 'Favorite'}
                            >
                                <FiStar className={`w-6 h-6 ${favorites?.some(f => f.spec_name === selectedSpec.spec_name && f.config_number === selectedSpec.config_number && f.mp_number === selectedSpec.mp_number) ? 'fill-current text-amber-400' : 'stroke-current'}`} />
                            </button>
                        </div>
                        <p className="text-slate-500 mt-1">{selectedSpec.product_name || selectedSpec.config_number} / {selectedSpec.mp_number}</p>
                        
                        <div className="mt-6 flex items-center gap-4 flex-wrap bg-slate-100 p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                                <label htmlFor="userFilter" className="text-sm font-medium text-gray-700">User:</label>
                                <select id="userFilter" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="p-2 border border-slate-300 rounded-lg">
                                    <option value="">All Users</option>
                                    {(usernames || []).map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="lotFilter" className="text-sm font-medium text-gray-700">Lot:</label>
                                <SearchableDropdown options={lotsForSpec || []} value={selectedLot} onChange={setSelectedLot} placeholder="All (use quantity filter)"/>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="dps" className={`text-sm font-medium transition-colors ${selectedLot ? 'text-gray-400' : 'text-gray-700'}`}>Show last:</label>
                                <input id="dps" type="number" min="1" value={dataPointsFilter} onChange={(e) => setDataPointsFilter(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 p-2 border border-slate-300 rounded-lg" disabled={!!selectedLot} />
                            </div>
                            
                            <div className="flex items-center gap-4 border-l pl-4 ml-2">
                                <div className="flex items-center">
                                    <label htmlFor="outlierToggle" className="text-sm font-medium text-gray-700 mr-3">Exclude Outliers</label>
                                    <label htmlFor="outlierToggle" className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            id="outlierToggle" 
                                            className="sr-only peer"
                                            checked={excludeOutliers} 
                                            onChange={() => setExcludeOutliers(!excludeOutliers)} 
                                        />
                                        <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                <button onClick={() => setIsOutliersModalOpen(true)} className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-2">
                                    <FiAlertOctagon /> Manage Outliers
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {selectedSpec.type === 'Variable' ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><FiCpu className="mr-2 text-indigo-500"/>Statistics</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span>CPK:</span><span className="font-bold text-indigo-600">{chartStats.cpk ?? 'N/A'}</span></div>
                                        <div className="flex justify-between"><span>Mean:</span><span className="font-mono">{chartStats.mean?.toFixed(4) ?? 'N/A'}</span></div>
                                        <div className="flex justify-between"><span>Std Dev:</span><span className="font-mono">{chartStats.stdDev?.toFixed(4) ?? 'N/A'}</span></div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><FiStar className="mr-2 text-indigo-500"/>CPK Leaderboard</h3>
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {cpkLeaderboard.length > 0 ? cpkLeaderboard.map((item, index) => (
                                            <li key={item.username} className="flex justify-between text-sm p-2 rounded-md hover:bg-slate-50">
                                                <span>{index+1}. {item.username.split('@')[0]}</span>
                                                <span className="font-semibold">{item.cpk}</span>
                                            </li>
                                        )) : <li className="text-sm text-slate-400">No data for leaderboard.</li>}
                                    </ul>
                                </div>
                                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm min-h-[400px] flex flex-col">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><FiBarChart2 className="mr-2 text-indigo-500"/>Control Chart</h3>
                                    <div className="flex-grow">
                                        {inspectionLogs.length > 0 ? <Line data={chartData} options={chartOptions} /> : <div className="flex h-full items-center justify-center text-slate-400">No data for selected filters.</div>}
                                    </div>
                                </div>
                                <div className="lg:col-span-2">
                                    <NormalityTestSection selectedSpec={selectedSpec} selectedLot={selectedLot} dataPointsFilter={dataPointsFilter} excludeOutliers={excludeOutliers} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm min-h-[400px] flex flex-col">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><FiPercent className="mr-2 text-indigo-500"/>P-Chart</h3>
                                    <div className="flex-grow"><PChart data={pChartData} /></div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm min-h-[400px] flex flex-col">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><FiTrendingUp className="mr-2 text-indigo-500"/>Pareto Analysis</h3>
                                    <div className="flex-grow"><ParetoChart data={paretoData} /></div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex h-full items-center justify-center text-slate-500"><p>Select an inspection from the left panel to view its SPC chart.</p></div>
            )}
        </main>
    </div>
  );
}

// --- Helper Components ---

function ExcludedLotsModal({ onClose }) {
    const { data: excludedLots, isLoading } = useQuery('excludedLots', async () => {
        const { data } = await axios.get(`${API_BASE_URL}/lots/excluded`, { withCredentials: true });
        return data;
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl relative flex flex-col h-[70vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><FiX size={24}/></button>
                <h3 className="text-2xl font-bold mb-4 text-slate-800 flex items-center"><FiEyeOff className="mr-3"/>Lots Excluded From Analysis</h3>
                <div className="flex-grow overflow-y-auto border-t pt-4">
                    {isLoading ? (
                        <p>Loading excluded lots...</p>
                    ) : excludedLots && excludedLots.length > 0 ? (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                <tr>
                                    <th className="p-2">Lot Number</th>
                                    <th className="p-2">Product</th>
                                    <th className="p-2">Configuration</th>
                                    <th className="p-2">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {excludedLots.map(lot => (
                                    <tr key={lot.lot_number} className="border-b hover:bg-slate-50">
                                        <td className="p-2 font-mono font-semibold">{lot.lot_number}</td>
                                        <td className="p-2">{lot.configuration?.product?.product_name}</td>
                                        <td className="p-2">{lot.configuration?.config_name}</td>
                                        <td className="p-2">{new Date(lot.creation_date).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            <p>No lots are currently excluded from analysis.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


function FavoriteInspections({ favorites, onSelectFavorite }) {
  if (!favorites || favorites.length === 0) return null;
  return (
    <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-3 px-2 flex items-center gap-2"><FiHeart className="text-red-500"/>Favorites</h3>
        <div className="flex gap-3 pb-3 -mx-4 px-4 overflow-x-auto">
            {favorites.map(spec => (
                <div key={`${spec.config_number}-${spec.mp_number}-${spec.spec_name}`} onClick={() => onSelectFavorite(spec)} className="flex-shrink-0 w-48 h-32 bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div>
                        <p className="font-bold text-slate-800 truncate">{spec.spec_name}</p>
                        <p className="text-xs text-slate-500">{spec.mp_number}</p>
                    </div>
                    <p className="text-xs text-indigo-600 font-medium truncate">{spec.product_name}</p>
                </div>
            ))}
        </div>
    </div>
  );
}

function DataPointSummaryModal({ data, onClose, onToggleOutlier }) {
    if (!data) return null;
    const isSnapshotObject = typeof data.process_parameters_snapshot === 'object' && data.process_parameters_snapshot !== null && !Array.isArray(data.process_parameters_snapshot);

    const handleToggle = () => {
        if(window.confirm(`Are you sure you want to mark this point as ${data.is_outlier ? 'VALID' : 'an OUTLIER'}?`)) {
            onToggleOutlier(data.log_id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><FiX size={24}/></button>
                <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-bold mb-4 text-slate-800">Inspection Details</h3>
                    {data.is_outlier && <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full flex items-center gap-1"><FiAlertOctagon size={12}/> Marked as Outlier</span>}
                </div>
                <div className="space-y-4 text-slate-700">
                    <div className="grid grid-cols-2 gap-4 border-b pb-4">
                        <div><p className="text-sm text-slate-500">Unit Number</p><p className="font-semibold text-lg">{data.unit_number}</p></div>
                        <div><p className="text-sm text-slate-500">Inspection Value</p><p className="font-semibold text-lg">{data.inspection_value}</p></div>
                        <div><p className="text-sm text-slate-500">Operator</p><p className="font-semibold">{data.username}</p></div>
                        <div><p className="text-sm text-slate-500">Lot Number</p><p className="font-semibold">{data.lot_number}</p></div>
                        <div className="col-span-2"><p className="text-sm text-slate-500">Timestamp</p><p className="font-semibold">{new Date(data.timestamp).toLocaleString()}</p></div>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-800 mb-2">Process Inputs at time of inspection:</p>
                        <div className="bg-slate-50 p-4 rounded-lg text-sm space-y-4 max-h-48 overflow-y-auto">
                            {isSnapshotObject && Object.keys(data.process_parameters_snapshot).length > 0 ? (
                                Object.entries(data.process_parameters_snapshot).map(([recipeName, parameters]) => (
                                    <div key={recipeName}>
                                        <h4 className="font-semibold text-slate-600">{recipeName}</h4>
                                        <ul className="pl-4 list-disc list-inside">
                                            {Object.entries(parameters).map(([key, value]) => (
                                                <li key={key}><strong className="font-medium">{key}:</strong> <span className="font-mono">{String(value)}</span></li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 italic">No process parameters were recorded.</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t flex justify-end">
                    <button onClick={handleToggle} className={`px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2 ${data.is_outlier ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        {data.is_outlier ? <FiCheckCircle/> : <FiAlertOctagon/>}
                        {data.is_outlier ? 'Mark as Valid' : 'Mark as Outlier'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function OutliersListModal({ outliers, onClose, onToggleOutlier }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col h-[70vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><FiX size={24}/></button>
                <h3 className="text-2xl font-bold mb-4 text-slate-800">Manage Outliers</h3>
                <div className="flex-grow overflow-y-auto border-t pt-4">
                    {outliers && outliers.length > 0 ? (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                <tr>
                                    <th className="p-2">Unit #</th>
                                    <th className="p-2">Value</th>
                                    <th className="p-2">Operator</th>
                                    <th className="p-2">Timestamp</th>
                                    <th className="p-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outliers.map(log => (
                                    <tr key={log.log_id} className="border-b hover:bg-slate-50">
                                        <td className="p-2 font-mono">{log.unit_number}</td>
                                        <td className="p-2 font-mono font-semibold">{log.inspection_value}</td>
                                        <td className="p-2">{log.username}</td>
                                        <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="p-2 text-right">
                                            <button onClick={() => onToggleOutlier(log.log_id)} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-semibold">
                                                Re-introduce
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            <p>No outliers have been marked for this specification.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SearchableDropdown({ options, value, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => { setInputValue(value || ""); }, [value]);
  useEffect(() => {
    const handleClickOutside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const filteredOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    if (!inputValue) return options;
    return options.filter(option => option.toLowerCase().includes(inputValue.toLowerCase()));
  }, [options, inputValue]);
  const handleSelect = (option) => { onChange(option); setInputValue(option); setIsOpen(false); };
  const handleClear = () => { onChange(""); setInputValue(""); };
  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input type="text" className="p-2 border border-slate-300 rounded-lg w-48" value={inputValue} onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder={placeholder} />
        {inputValue && <FiX onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600"/>}
      </div>
      {isOpen && (<ul className="absolute z-10 w-full bg-white border mt-1 rounded-lg max-h-60 overflow-y-auto shadow-lg">{filteredOptions.length > 0 ? (filteredOptions.map(option => (<li key={option} className="p-2 hover:bg-indigo-100 cursor-pointer text-sm" onClick={() => handleSelect(option)}>{option}</li>))) : ( <li className="p-2 text-sm text-gray-500">No lots found</li> )}</ul>)}
    </div>
  );
}

function ProductAccordionList({ products, onSpecSelect, selectedSpec, expandedMp, setExpandedMp }) {
    return <div className="space-y-1">{products.map(product => <ProductAccordion key={product?.mvd_number || Math.random()} product={product} onSpecSelect={onSpecSelect} selectedSpec={selectedSpec} expandedMp={expandedMp} setExpandedMp={setExpandedMp}/>)}</div>
}

function MpAccordionList({ mps, onSpecSelect, selectedSpec, expandedMp, setExpandedMp }) {
    return <div className="space-y-1">{mps.map(mp => <MpAccordion key={mp?.mp_number || Math.random()} mp={mp} onSpecSelect={onSpecSelect} selectedSpec={selectedSpec} isToplevel={true} expandedMp={expandedMp} setExpandedMp={setExpandedMp}/>)}</div>
}

function ProductAccordion({ product, onSpecSelect, selectedSpec, expandedMp, setExpandedMp }) {
    const [isOpen, setIsOpen] = useState(false);
    const containsExpandedMp = useMemo(() => {
        return product.configurations?.some(c => c.manufacturing_procedures?.some(m => m.mp_number === expandedMp));
    }, [product, expandedMp]);

    useEffect(() => {
        if (containsExpandedMp) setIsOpen(true);
    }, [containsExpandedMp]);

    if (!product) return null;
    return(
        <div className="py-1">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left flex items-center justify-between p-2 rounded hover:bg-slate-100 font-semibold">
                <span>{product.product_name}</span>
                {isOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            {isOpen && (
                <div className="pl-4 border-l-2 ml-2">
                    {(product.configurations || []).map(config => <ConfigAccordion key={config.config_number} product_name={product.product_name} config={config} onSpecSelect={onSpecSelect} selectedSpec={selectedSpec} expandedMp={expandedMp} setExpandedMp={setExpandedMp} />)}
                </div>
            )}
        </div>
    )
}

function ConfigAccordion({ product_name, config, onSpecSelect, selectedSpec, expandedMp, setExpandedMp }) {
    const [isOpen, setIsOpen] = useState(false);
    const { data: mps } = useQuery(['configMps', config.config_number], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/configurations/${config.config_number}/mps`, { withCredentials: true });
        return data;
    }, { enabled: isOpen });

    const containsExpandedMp = useMemo(() => {
        if (!mps) return false;
        return mps.some(m => m.mp_number === expandedMp);
    }, [mps, expandedMp]);

    useEffect(() => {
        if (containsExpandedMp) setIsOpen(true);
    }, [containsExpandedMp]);

    return (
        <div className="py-1">
             <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left flex items-center justify-between p-2 rounded hover:bg-slate-100 text-sm font-medium">
                <span>{config.config_name}</span>
                {isOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            {isOpen && (
                <div className="pl-4 border-l-2 ml-2">
                    {(mps || []).map(mp => (
                       <MpAccordion key={mp.mp_number} mp={mp} configNumber={config.config_number} onSpecSelect={onSpecSelect} selectedSpec={selectedSpec} product_name={product_name} config_name={config.config_name} expandedMp={expandedMp} setExpandedMp={setExpandedMp}/>
                    ))}
                </div>
            )}
        </div>
    )
};

function MpAccordion({ mp, configNumber, onSpecSelect, selectedSpec, product_name, config_name, isToplevel = false, expandedMp, setExpandedMp }) {
    const [isOpen, setIsOpen] = useState(false);
    const endpoint = isToplevel
        ? `${API_BASE_URL}/manufacturing-procedures/${mp.mp_number}/specs`
        : `${API_BASE_URL}/specifications/${configNumber}/${mp.mp_number}`;

    const { data: specs } = useQuery(['specs', mp.mp_number, configNumber], () => axios.get(endpoint, { withCredentials: true }).then(res => res.data), { enabled: isOpen });
    
    useEffect(() => {
        if (mp.mp_number === expandedMp) {
            setIsOpen(true);
        }
    }, [mp.mp_number, expandedMp]);

    const handleToggleOpen = () => {
        setIsOpen(!isOpen);
        if (expandedMp) setExpandedMp(null);
    };
    
    const handleSelect = (spec) => { 
        onSpecSelect({ 
            ...spec, 
            product_name: product_name || spec.product_name, 
            config_name: config_name || spec.config_name 
        }); 
    }
    return(
        <div className="py-1">
             <button onClick={handleToggleOpen} className="w-full text-left flex items-center justify-between p-2 rounded hover:bg-slate-100 text-sm">
                <span>{mp.procedure_name}</span>
                {isOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            {isOpen && (
                <div className="pl-4 border-l-2 ml-2">
                     {(specs || []).map(spec => (
                         <button key={`${spec.config_number}-${spec.mp_number}-${spec.spec_name}`} onClick={() => handleSelect(spec)} className={`w-full text-left p-2 rounded text-xs ${selectedSpec?.spec_name === spec.spec_name && selectedSpec?.config_number === spec.config_number && selectedSpec?.mp_number === spec.mp_number ? 'bg-indigo-100 font-semibold' : 'hover:bg-slate-50'}`}>
                             {spec.spec_name}
                             {isToplevel && <span className="text-slate-400 block">{spec.product_name} / {spec.config_name}</span>}
                         </button>
                     ))}
                </div>
            )}
        </div>
    )
}

function NormalityTestSection({selectedSpec, selectedLot, dataPointsFilter, excludeOutliers}) {
    const [showNormality, setShowNormality] = useState(false);
    const [testType, setTestType] = useState('shapiro_wilk');
    const [normalityData, setNormalityData] = useState(null);
    const [normalityLoading, setNormalityLoading] = useState(false);
    const [normalityError, setNormalityError] = useState(null);
    const qqPlotRef = useRef(null);

    const fetchNormalityTest = async () => {
        setNormalityLoading(true);
        setNormalityError(null);
        setNormalityData(null);
        try {
            const { config_number, mp_number, spec_name } = selectedSpec;
            const params = {
                ...(selectedLot ? { lot_number: selectedLot } : { limit: dataPointsFilter }),
                excludeOutliers
            };
            const response = await axios.get(`${API_BASE_URL}/inspections/test/normality/${config_number}/${mp_number}/${spec_name}`, { params, withCredentials: true });
            setNormalityData(response.data);
        } catch (err) {
            setNormalityError(err.response?.data?.error || 'Failed to fetch normality results.');
        } finally {
            setNormalityLoading(false);
        }
    };

    const renderQQPlot = useCallback((data, container) => {
        if (!container || !data?.qq_plot_data?.[testType]?.sample_quantiles?.length) { 
            if (container) Plotly.purge(container);
            return; 
        };
        const testData = data.qq_plot_data[testType];
        const plotData = [
            { x: testData.theoretical_quantiles, y: testData.sample_quantiles, mode: 'markers', name: 'Data Points' }, 
            { x: testData.fit_line_x, y: testData.fit_line_y, mode: 'lines', name: 'Fit Line', line: { color: 'red', dash: 'dash' }}
        ].filter(p => p.x && p.y);
        const layout = { title: `${testType.replace(/_/g, ' ')} Q-Q Plot`, xaxis: { title: 'Theoretical Quantiles' }, yaxis: { title: 'Sample Quantiles' }, showlegend: false, margin: { t: 40, l: 40, r: 20, b: 40 } };
        Plotly.newPlot(container, plotData, layout, { responsive: true });
    }, [testType]);

    useEffect(() => {
        if (showNormality && normalityData && qqPlotRef.current) {
            renderQQPlot(normalityData, qqPlotRef.current);
        }
    }, [normalityData, showNormality, renderQQPlot]);
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <button onClick={() => setShowNormality(!showNormality)} className="w-full text-left font-semibold text-slate-800 flex justify-between items-center">
                <h3 className="text-lg flex items-center"><FiZap className="mr-2 text-indigo-500"/>Normality Testing</h3>
                {showNormality ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            {showNormality && (
                <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-4 mb-4">
                       <select value={testType} onChange={e => setTestType(e.target.value)} className="p-2 border rounded-lg">
                           <option value="shapiro_wilk">Shapiro-Wilk</option>
                           <option value="anderson_darling">Anderson-Darling</option>
                           <option value="johnson">Johnson</option>
                       </select>
                       <button onClick={fetchNormalityTest} disabled={normalityLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:bg-indigo-300 hover:bg-indigo-700 transition-colors">
                           {normalityLoading ? 'Testing...' : 'Check Normality'}
                       </button>
                    </div>
                    {normalityError && <p className="text-red-500 bg-red-50 p-3 rounded-lg">{normalityError}</p>}
                    {normalityData && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div ref={qqPlotRef} className="w-full min-h-[320px]"></div>
                           <div className="text-sm">
                                <h4 className="font-semibold text-lg mb-2">Test Results</h4>
                                {normalityData.tests?.[testType] ? (
                                    <div className="space-y-2">
                                        <p><strong>Test:</strong> {testType.replace(/_/g, ' ')}</p>
                                        <p><strong>Statistic:</strong> {normalityData.tests[testType].statistic?.toFixed(4)}</p>
                                        <p><strong>P-Value:</strong> {normalityData.tests[testType].p_value?.toFixed(4)}</p>
                                        <p><strong>Conclusion:</strong> <span className={normalityData.tests[testType].normality === 'Likely Normal' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{normalityData.tests[testType].normality}</span></p>
                                    </div>
                                ) : <p>No results for this test.</p>}
                           </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
