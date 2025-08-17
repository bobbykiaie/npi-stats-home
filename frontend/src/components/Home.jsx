import React, { useState, useMemo } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import API_BASE_URL from "./api";
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FiPlus, FiPlay, FiBarChart2, FiSettings, FiLogIn, FiLogOut, FiList, FiCheckCircle, FiX, FiClock, FiZap, FiBox, FiTrendingUp, FiActivity, FiSearch, FiPackage, FiEyeOff, FiChevronRight, FiPercent } from 'react-icons/fi';

// --- Data Fetching Hooks ---
const useUserActiveBuilds = (user) => {
    return useQuery(['userActiveBuilds', user?.username], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/builds/active_builds`, { withCredentials: true });
        return data || [];
    }, {
        enabled: !!user,
        refetchInterval: 10000,
    });
};

const useDashboardStats = (user) => {
    return useQuery('dashboardStats', async () => {
        const { data } = await axios.get(`${API_BASE_URL}/dashboard/stats`, { withCredentials: true });
        return data;
    }, {
        enabled: !!user && user.role === 'engineer',
    });
};

const useAllActiveBuildsYield = (productId) => {
    return useQuery(['allActiveBuildsYield', productId], async () => {
        const params = productId && productId !== 'All' ? { productId } : {};
        const { data } = await axios.get(`${API_BASE_URL}/dashboard/all-active-builds-yield`, { params, withCredentials: true });
        return data;
    }, {
        enabled: true, 
    });
};


// --- Main Home Component ---
export default function Home({ user }) {
  const [isStartBuildModalOpen, setStartBuildModalOpen] = useState(false);
  const [isCreateLotModalOpen, setCreateLotModalOpen] = useState(false);
  const { data: userActiveBuilds } = useUserActiveBuilds(user);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(user);
  const navigate = useNavigate();

  if (!user) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
            <h1 className="text-4xl font-bold text-slate-800">Welcome to NPI Stats</h1>
            <p className="text-slate-500 mt-2 mb-8">Please log in to continue.</p>
            <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                <FiLogIn />
                Login
            </button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
        {isStartBuildModalOpen && <StartBuildModal user={user} onClose={() => setStartBuildModalOpen(false)} />}
        {isCreateLotModalOpen && <CreateLotModal onClose={() => setCreateLotModalOpen(false)} />}
      
        <div className="max-w-7xl mx-auto">
            <header className="mb-12">
                <h1 className="text-4xl font-bold text-slate-900">Welcome back, {user.name || user.username}!</h1>
                <p className="text-lg text-slate-600">Here's what's happening today.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-8">
                    <ActiveBuildsList activeBuilds={userActiveBuilds} />
                    <QuickActions user={user} onStartBuild={() => setStartBuildModalOpen(true)} onCreateLot={() => setCreateLotModalOpen(true)} />
                    {user.role === 'engineer' && <StatsCards stats={stats} isLoading={statsLoading} />}
                </div>

                {/* Right Column (Active Build Yields) */}
                <div className="lg:col-span-1">
                    {user.role === 'engineer' && <AllActiveBuildsYieldFeed />}
                </div>
            </div>
        </div>
    </div>
  );
}


// --- Dashboard Widget Components ---

function ActiveBuildsList({ activeBuilds }) {
    const navigate = useNavigate();
    if (!activeBuilds || activeBuilds.length === 0) {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
                <FiPlay size={40} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-800">No Active Builds</h3>
                <p className="text-slate-500 mt-2">Start a build from the Quick Actions panel to begin.</p>
            </div>
        );
    }

    return (
         <div className="bg-white p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><FiZap className="text-indigo-500"/> Your Active Builds ({activeBuilds.length})</h3>
            <ul className="space-y-3">
                {activeBuilds.map(build => (
                    <li key={build.build_id} className="p-4 bg-indigo-50 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-indigo-800">{build.lot_number}</p>
                            <p className="text-sm text-indigo-600">MP: {build.mp_number}</p>
                        </div>
                        <button 
                            onClick={() => navigate('/spc-tracking-app/active-build', { state: { selectedBuildId: build.build_id } })} 
                            className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            Go to Build <FiChevronRight />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function QuickActions({ user, onStartBuild, onCreateLot }) {
    const actions = [
        { name: 'Start a Build', icon: <FiPlay />, onClick: onStartBuild, roles: ['operator', 'engineer'] },
        { name: 'Create a Lot', icon: <FiPlus />, onClick: onCreateLot, roles: ['engineer'] },
        { name: 'SPC Analysis', icon: <FiBarChart2 />, link: '/spc-tracking-app/spc', roles: ['engineer'] },
        { name: 'Admin Panel', icon: <FiSettings />, link: '/spc-tracking-app/admin', roles: ['engineer'] },
    ];

    const userActions = actions.filter(action => action.roles.includes(user.role));

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {userActions.map(action => {
                    const content = (
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-xl hover:bg-indigo-100 transition-colors h-full">
                            <div className="text-3xl text-indigo-600 mb-2">{action.icon}</div>
                            <span className="text-sm font-semibold text-slate-700 text-center">{action.name}</span>
                        </div>
                    );
                    return action.link ? <Link to={action.link} key={action.name}>{content}</Link> : <button onClick={action.onClick} key={action.name} className="w-full h-full">{content}</button>;
                })}
            </div>
        </div>
    );
}

function StatsCards({ stats, isLoading }) {
    const statCards = [
        { name: 'Active Lots', value: stats?.activeLots, icon: <FiBox />, unit: '' },
        { name: 'Builds (Last 7 Days)', value: stats?.recentBuilds, icon: <FiActivity />, unit: '' },
        { name: 'Overall Yield (7 Days)', value: stats?.yield, icon: <FiTrendingUp />, unit: '%' },
    ];

    if (isLoading) {
        return <div className="bg-white p-6 rounded-2xl shadow-lg text-center">Loading stats...</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statCards.map(stat => (
                <div key={stat.name} className="bg-white p-6 rounded-2xl shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">{stat.icon}</div>
                    <div>
                        <p className="text-sm text-slate-500">{stat.name}</p>
                        <p className="text-2xl font-bold text-slate-800">{stat.value ?? 'N/A'}{stat.unit}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function AllActiveBuildsYieldFeed() {
    const [selectedProduct, setSelectedProduct] = useState('All');
    const { data: products } = useQuery('products', () => axios.get(`${API_BASE_URL}/products`, { withCredentials: true }).then(res => res.data));
    const { data: buildsWithYield, isLoading } = useAllActiveBuildsYield(selectedProduct);
    const navigate = useNavigate();

    const getYieldColor = (yieldValue) => {
        if (yieldValue >= 95) return 'text-green-600';
        if (yieldValue >= 85) return 'text-amber-600';
        return 'text-red-600';
    };

    const handleLotClick = (lotNumber) => {
        navigate('/spc-tracking-app/admin/lots', { state: { selectedLotNumber: lotNumber } });
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FiPercent /> Active Build Yields</h3>
                <select 
                    value={selectedProduct} 
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="p-2 border border-slate-300 rounded-lg text-sm"
                >
                    <option value="All">All Products</option>
                    {products?.map(p => <option key={p.mvd_number} value={p.mvd_number}>{p.product_name}</option>)}
                </select>
            </div>
            <div className="flex-grow overflow-y-auto">
                {isLoading ? <p>Loading yields...</p> : buildsWithYield && buildsWithYield.length > 0 ? (
                    <ul className="space-y-4">
                        {buildsWithYield.map((build) => (
                            <li key={build.build_id} onClick={() => handleLotClick(build.lot_number)} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                <div className="flex-grow">
                                    <p className="font-semibold text-slate-800">{build.lot_number}</p>
                                    <p className="text-sm text-slate-500">{build.product_name}</p>
                                    <p className="text-xs text-indigo-600">MP: {build.mp_number} ({build.username})</p>
                                </div>
                                {build.yield !== undefined ? (
                                    <div className="text-right">
                                        <p className={`text-2xl font-bold ${getYieldColor(build.yield)}`}>{build.yield}%</p>
                                        <p className="text-xs text-slate-500">{build.passed} / {build.failed}</p>
                                    </div>
                                ) : <p className="text-sm text-slate-400">Loading...</p>}
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-slate-500 text-center pt-8">No active builds found for the selected product.</p>}
            </div>
        </div>
    );
}


// --- Modal Components ---
function StartBuildModal({ user, onClose }) {
    const [lotNumber, setLotNumber] = useState("");
    const [mpList, setMpList] = useState([]);
    const [selectedMP, setSelectedMP] = useState(null);
    const [error, setError] = useState("");
    const queryClient = useQueryClient();

    const handleSearchLot = async () => {
        if (!lotNumber.trim()) return setError("Please enter a lot number.");
        try {
            const { data } = await axios.get(`${API_BASE_URL}/lots/manufacturing_procedures/by-lot/${lotNumber}`, { withCredentials: true });
            if (data.length > 0) {
                setMpList(data);
                setError("");
            } else {
                setMpList([]);
                setError("No manufacturing procedures found for this lot.");
            }
        } catch (err) {
            setError("Lot number not found or an error occurred.");
        }
    };
    
    const startBuildMutation = useMutation(
        () => axios.post(`${API_BASE_URL}/builds/start_build`, {
            username: user.username,
            lot_number: lotNumber,
            mp_number: selectedMP.mp_number,
        }, { withCredentials: true }),
        {
            onSuccess: () => {
                // BUG FIX: Use the correct query key to invalidate the cache.
                // This ensures the "Your Active Builds" list updates immediately.
                queryClient.invalidateQueries(['userActiveBuilds', user.username]);
                onClose();
            },
            onError: (err) => {
                setError(err.response?.data?.error || "Failed to start build.");
            }
        }
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><FiX /></button>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Start a New Build</h2>
                <div className="relative mb-4">
                    <input type="text" placeholder='Enter Lot Number...' value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" />
                    <button onClick={handleSearchLot} className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700"><FiSearch /></button>
                </div>
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                {mpList.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        <h3 className="font-semibold text-slate-600">Select a procedure for Lot {lotNumber}:</h3>
                        {mpList.map(mp => (
                            <button key={mp.mp_number} onClick={() => setSelectedMP(mp)} className={`w-full text-left p-3 rounded-lg border-2 ${selectedMP?.mp_number === mp.mp_number ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-slate-100 hover:bg-slate-200'}`}>
                                {mp.procedure_name}
                            </button>
                        ))}
                    </div>
                )}
                <button onClick={() => startBuildMutation.mutate()} disabled={!selectedMP || startBuildMutation.isLoading} className="w-full mt-6 bg-green-600 text-white font-semibold py-3 rounded-lg disabled:bg-green-300">
                    {startBuildMutation.isLoading ? 'Starting...' : 'Start Build'}
                </button>
            </div>
        </div>
    );
}

function CreateLotModal({ onClose }) {
    const [newLot, setNewLot] = useState({ product: "", config_number: "", quantity: "", lot_number: "" });
    const [isExcluded, setIsExcluded] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const queryClient = useQueryClient();

    const { data: products } = useQuery('products', () => axios.get(`${API_BASE_URL}/products`, { withCredentials: true }).then(res => res.data));
    
    const { data: configurations, isFetching: isFetchingConfigs } = useQuery(
        ['configurations', newLot.product], 
        () => axios.get(`${API_BASE_URL}/products/${newLot.product}/configurations`, { withCredentials: true }).then(res => res.data), 
        { 
            enabled: !!newLot.product 
        }
    );

    const createLotMutation = useMutation(
        (lotData) => axios.post(`${API_BASE_URL}/lots/create`, lotData, { withCredentials: true }),
        {
            onSuccess: (data) => {
                setSuccess(`Lot ${data.data.lot_number} created!`);
                setError('');
                setNewLot({ product: "", config_number: "", quantity: "", lot_number: "" });
                setIsExcluded(false);
                queryClient.invalidateQueries('recentLots');
                queryClient.invalidateQueries('dashboardStats');
                setTimeout(onClose, 1500);
            },
            onError: (err) => setError(err.response?.data?.error || 'Failed to create lot.'),
        }
    );

    const handleProductChange = (e) => {
        const productId = e.target.value;
        setNewLot({ ...newLot, product: productId, config_number: '' });
    };

    const handleGenerateLot = async () => {
        const { data } = await axios.get(`${API_BASE_URL}/lots/generate-number`, { withCredentials: true });
        setNewLot({ ...newLot, lot_number: data.lot_number });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        createLotMutation.mutate({ ...newLot, is_excluded: isExcluded });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><FiX /></button>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New Lot</h2>
                {success ? <p className="text-green-600 bg-green-100 p-3 rounded-lg mb-4 flex items-center gap-2"><FiCheckCircle /> {success}</p> : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <select value={newLot.product} onChange={handleProductChange} className="w-full p-3 border border-slate-300 rounded-lg" required><option value="">Select Product</option>{products?.map(p => <option key={p.mvd_number} value={p.mvd_number}>{p.product_name}</option>)}</select>
                        <select value={newLot.config_number} onChange={(e) => setNewLot({ ...newLot, config_number: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg" disabled={!newLot.product || isFetchingConfigs} required>
                            <option value="">{isFetchingConfigs ? 'Loading...' : 'Select Configuration'}</option>
                            {configurations?.map(c => <option key={c.config_number} value={c.config_number}>{c.config_name}</option>)}
                        </select>
                        <input type="number" placeholder="Quantity" value={newLot.quantity} onChange={(e) => setNewLot({ ...newLot, quantity: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg" min="1" required />
                        <div className="flex gap-2">
                            <input type="text" placeholder="Lot Number" value={newLot.lot_number} onChange={(e) => setNewLot({ ...newLot, lot_number: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg" required />
                            <button type="button" onClick={handleGenerateLot} className="px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200">Generate</button>
                        </div>
                        <div className="flex items-center"><input id="isExcluded" type="checkbox" checked={isExcluded} onChange={(e) => setIsExcluded(e.target.checked)} className="h-4 w-4 text-indigo-600 rounded" /><label htmlFor="isExcluded" className="ml-2 text-sm">Exclude from Analysis</label></div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <button type="submit" disabled={createLotMutation.isLoading} className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg disabled:bg-green-300">
                            {createLotMutation.isLoading ? 'Creating...' : 'Create Lot'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
