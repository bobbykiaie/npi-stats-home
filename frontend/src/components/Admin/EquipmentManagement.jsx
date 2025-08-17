import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from 'react-query';
import API_BASE_URL from '../api';
import { FiHardDrive, FiList, FiPlus, FiSave, FiTool } from 'react-icons/fi';

// --- Reusable Data-Fetching Hooks ---
const useEquipment = () => useQuery('equipment', async () => {
    const { data } = await axios.get(`${API_BASE_URL}/process-management/equipment`, { withCredentials: true });
    return data;
});

const useParameters = () => useQuery('parameters', async () => {
    const { data } = await axios.get(`${API_BASE_URL}/process-management/parameters`, { withCredentials: true });
    return data;
});

// --- Main Component ---
export default function EquipmentManagement() {
    return (
        <div className="p-6 bg-slate-50 flex-1 overflow-y-auto">
            <h2 className="text-3xl font-bold mb-6 text-slate-800">Equipment & Parameter Library</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <MasterList
                    title="Equipment Library"
                    queryHook={useEquipment}
                    addEndpoint={`${API_BASE_URL}/process-management/equipment`}
                    queryKey="equipment"
                    Icon={FiHardDrive}
                />
                <MasterList
                    title="Parameter Library"
                    queryHook={useParameters}
                    addEndpoint={`${API_BASE_URL}/process-management/parameters`}
                    queryKey="parameters"
                    Icon={FiList}
                />
                <div className="lg:col-span-2">
                    <Linker />
                </div>
            </div>
        </div>
    );
}

// --- Reusable Master List Component ---
function MasterList({ title, queryHook, addEndpoint, queryKey, Icon }) {
    const queryClient = useQueryClient();
    const { data, isLoading } = queryHook();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(addEndpoint, { name, description }, { withCredentials: true });
            setName('');
            setDescription('');
            queryClient.invalidateQueries(queryKey);
        } catch (error) {
            alert(error.response?.data?.error || `Failed to add new item to ${title}.`);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm h-full flex flex-col">
            <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center">
                <Icon className="mr-3 text-indigo-500" size={24}/>
                {title}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3 mb-4">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New Name" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500" required />
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                <button type="submit" className="w-full flex justify-center items-center gap-2 p-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition"><FiPlus /> Add New</button>
            </form>
            <div className="space-y-2 flex-grow overflow-y-auto">
                {isLoading ? <p>Loading...</p> : data?.map(item => (
                    <div key={item.id} className="bg-slate-50 p-3 rounded-md">
                        <p className="font-semibold text-slate-700">{item.name}</p>
                        <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Parameter to Equipment Linker Component ---
function Linker() {
    const queryClient = useQueryClient();
    const { data: equipmentList, isLoading: equipmentLoading } = useEquipment();
    const { data: parameterList, isLoading: parametersLoading } = useParameters();
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [linkedParams, setLinkedParams] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (selectedEquipment) {
            const initialParams = new Set(selectedEquipment.parameters.map(p => p.parameter_id));
            setLinkedParams(initialParams);
        } else {
            setLinkedParams(new Set());
        }
    }, [selectedEquipment]);

    const handleEquipmentSelect = (id) => {
        const eq = equipmentList.find(e => e.id === parseInt(id));
        setSelectedEquipment(eq || null);
    };

    const handleParamToggle = (paramId) => {
        setLinkedParams(prev => {
            const next = new Set(prev);
            if (next.has(paramId)) {
                next.delete(paramId);
            } else {
                next.add(paramId);
            }
            return next;
        });
    };

    const handleSaveChanges = async () => {
        if (!selectedEquipment) return;
        setIsSaving(true);
        try {
            await axios.post(`${API_BASE_URL}/process-management/equipment/${selectedEquipment.id}/link-parameters`, {
                parameter_ids: Array.from(linkedParams)
            }, { withCredentials: true });
            queryClient.invalidateQueries('equipment');
        } catch (error) {
            alert(error.response?.data?.error || "Failed to save links.");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center"><FiTool className="mr-2 text-indigo-500"/>Link Parameters to Equipment</h3>
            {equipmentLoading ? <p>Loading...</p> : (
                <select onChange={(e) => handleEquipmentSelect(e.target.value)} className="w-full p-3 border border-slate-300 rounded-md bg-white" defaultValue="">
                     <option value="" disabled>-- Select Equipment to Configure --</option>
                     {equipmentList?.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                </select>
            )}

            {selectedEquipment && (
                <div className="mt-4">
                    <h4 className="font-semibold text-slate-600 mb-2">Available Parameters:</h4>
                    {parametersLoading ? <p>Loading...</p> : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {parameterList?.map(param => (
                                <label key={param.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={linkedParams.has(param.id)}
                                        onChange={() => handleParamToggle(param.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-slate-800">{param.name}</span>
                                </label>
                            ))}
                        </div>
                    )}
                    <button onClick={handleSaveChanges} disabled={isSaving} className="mt-6 w-full flex justify-center items-center gap-2 p-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-50">
                       <FiSave/> {isSaving ? 'Saving...' : 'Save Links for ' + selectedEquipment.name}
                    </button>
                </div>
            )}
        </div>
    );
}
