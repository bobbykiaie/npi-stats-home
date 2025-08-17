// src/components/ProductDetail.jsx (Bento Design)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import API_BASE_URL from '../api';
import {
  FiChevronsLeft,
  FiPlus,
  FiTrash2,
  FiEdit3,
  FiDatabase,
  FiCpu,
  FiClipboard
} from 'react-icons/fi';
import Modal from './Modal';

/* ---------- reusable data-fetch hook ---------- */
const useDataFetcher = (url) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!url) { setData([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await axios.get(url, { withCredentials: true });
      setData(res.data);
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
      setData([]);
    } finally { setLoading(false); }
  }, [url]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
};

/* ---------- main component ---------- */
export default function ProductDetail({ product, onBack, onUpdate }) {
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [selectedMp, setSelectedMp] = useState(null);
  const [modalContent, setModalContent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /* data fetches */
  const { data: configurations, refetch: refetchConfigs } = useDataFetcher(
    `${API_BASE_URL}/products/${product.mvd_number}/configurations`
  );
 
  const mpsForConfig = selectedConfig ? selectedConfig.manufacturing_procedures : [];

  const { data: specsForMp, refetch: refetchSpecs } = useDataFetcher(
    selectedConfig && selectedMp
      ? `${API_BASE_URL}/specifications/${selectedConfig.config_number}/${selectedMp.mp_number}`
      : null
  );

  /* helpers */
  useEffect(() => {
    if (!selectedConfig && configurations.length) setSelectedConfig(configurations[0]);
  }, [configurations, selectedConfig]);

  // --- BUG FIX: This useEffect hook ensures that when the configurations list is
  // refetched (e.g., after adding a new MP), the `selectedConfig` state is
  // updated to the new version of that object, which contains the new data.
  useEffect(() => {
    if (selectedConfig && configurations.length > 0) {
      const updatedSelectedConfig = configurations.find(c => c.config_number === selectedConfig.config_number);
      // This check prevents an infinite loop by only updating the state if the number of MPs has actually changed.
      if (updatedSelectedConfig && (!selectedConfig.manufacturing_procedures || updatedSelectedConfig.manufacturing_procedures.length !== selectedConfig.manufacturing_procedures.length)) {
        setSelectedConfig(updatedSelectedConfig);
      }
    }
  }, [configurations, selectedConfig]);


  const openModal = (type, data = null) => { setModalContent({ type, data }); setIsModalOpen(true); };

  const handleActionSuccess = () => {
    refetchConfigs();
    if (selectedMp) refetchSpecs();
    setIsModalOpen(false);
  };

  const handleConfigSelect = (cfg) => { setSelectedConfig(cfg); setSelectedMp(null); };

  /* ---------- UI ------------------------------------------------------- */
  return (
    <>
      <motion.div
        layoutId={product.mvd_number}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className="flex-1 bg-slate-100 flex flex-col overflow-hidden"
      >
        {/* header */}
        <div className="flex items-center p-4 bg-slate-100 h-20 flex-shrink-0">
          <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-slate-200 transition-colors">
            <FiChevronsLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {product.product_name}
            </h1>
            <p className="text-slate-500 text-sm">{product.mvd_number}</p>
          </div>
        </div>

        {/* --- Bento Grid Layout --- */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Configurations */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><FiDatabase /> Configurations</h2>
              <button onClick={() => openModal('config', null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600">
                <FiPlus />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {configurations.map((cfg) => (
                <div key={cfg.config_number} className={`group p-3 rounded-lg flex justify-between items-center cursor-pointer ${selectedConfig?.config_number === cfg.config_number ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'hover:bg-slate-50'}`} onClick={() => handleConfigSelect(cfg)}>
                  <span>{cfg.config_name}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                    <button onClick={(e) => { e.stopPropagation(); openModal('config', cfg); }} className="p-1 hover:text-indigo-600 text-slate-500"><FiEdit3 size={14} /></button>
                    <button onClick={async (e) => { e.stopPropagation(); if (window.confirm(`Delete "${cfg.config_name}"?`)) { try { await axios.delete(`${API_BASE_URL}/configurations/${cfg.config_number}`, { withCredentials: true }); refetchConfigs(); setSelectedConfig(null); setSelectedMp(null); } catch (e) { alert(e.response?.data?.error || 'Delete failed'); } } }} className="p-1 hover:text-red-600 text-slate-500"><FiTrash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Procedures */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-4 flex flex-col">
           <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><FiCpu /> Procedures</h2>
             {selectedConfig && <button onClick={() => openModal('new-mp')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600"><FiPlus /></button>}
           </div>
           <div className="space-y-2 overflow-y-auto">
             {selectedConfig ? (mpsForConfig || []).map((mp) => (
               <div key={mp.mp_number} className={`group p-3 rounded-lg flex justify-between items-center cursor-pointer ${selectedMp?.mp_number === mp.mp_number ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'hover:bg-slate-50'}`} onClick={() => setSelectedMp(mp)}>
                 <span>{mp.procedure_name}</span>
                 <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                   <button onClick={(e) => { e.stopPropagation(); openModal('mp', mp); }} className="p-1 hover:text-indigo-600 text-slate-500"><FiEdit3 size={14} /></button>
                   <button onClick={async (e) => { e.stopPropagation(); if (window.confirm(`Delete "${mp.procedure_name}"?`)) { try { await axios.delete(`${API_BASE_URL}/manufacturing-procedures/${mp.mp_number}`, { withCredentials: true }); refetchConfigs(); setSelectedMp(null); } catch (e) { alert(e.response?.data?.error || 'Delete failed'); } } }} className="p-1 hover:text-red-600 text-slate-500"><FiTrash2 size={14} /></button>
                 </div>
               </div>
             )) : <p className="p-2 text-slate-500 text-center mt-4">Select a configuration.</p>}
           </div>
          </div>
          
          {/* Column 3: Specs (Spans 2 columns on larger screens) */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-4 flex flex-col">
           <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><FiClipboard /> Inspection Specs</h2>
           </div>
           {selectedMp ? (
             <div className="flex-1 flex flex-col overflow-y-auto">
               <div className="p-2 mb-4 bg-slate-50 rounded-lg">
                 <p className="text-sm font-semibold text-slate-700">For MP: {selectedMp.procedure_name}</p>
               </div>

               <div className="space-y-4">
                 {/* Variable Specs Table */}
                 {specsForMp.filter(s => s.type === 'Variable').length > 0 && (
                   <div className="text-sm">
                     <h4 className="font-semibold text-slate-600 mb-2 px-1">Variable Specs</h4>
                     <table className="w-full">
                       <thead className="text-left text-slate-500">
                         <tr className="border-b">
                           <th className="py-2 px-1 font-medium">Name</th>
                           <th className="py-2 px-1 font-medium text-center">LSL</th>
                           <th className="py-2 px-1 font-medium text-center">Nominal</th>
                           <th className="py-2 px-1 font-medium text-center">USL</th>
                           <th className="w-8"></th>
                         </tr>
                       </thead>
                       <tbody>
                         {specsForMp.filter(s => s.type === 'Variable').map(sp => (
                           <tr key={sp.spec_name} className="border-b last:border-0 hover:bg-slate-50">
                             <td className="py-2 px-1">{sp.spec_name}</td>
                             <td className="py-2 px-1 text-center font-mono text-xs">{sp.lower_spec ?? '–'}</td>
                             <td className="py-2 px-1 text-center font-mono text-xs">{sp.nominal ?? '–'}</td>
                             <td className="py-2 px-1 text-center font-mono text-xs">{sp.upper_spec ?? '–'}</td>
                             <td className="py-2 px-1 text-right">
                               <button className="text-slate-400 hover:text-red-500" onClick={async () => { if (window.confirm(`Delete "${sp.spec_name}"?`)) { try { await axios.delete(`${API_BASE_URL}/specifications/${sp.config_number}/${sp.mp_number}/${sp.spec_name}`, { withCredentials: true }); refetchSpecs(); } catch (e) { alert('Delete failed'); } } }}><FiTrash2 size={14}/></button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}

                 {/* Attribute Specs Table */}
                 {specsForMp.filter(s => s.type === 'Attribute').length > 0 && (
                   <div className="text-sm mt-4">
                     <h4 className="font-semibold text-slate-600 mb-2 px-1">Attribute Specs</h4>
                     <table className="w-full">
                       <thead className="text-left text-slate-500">
                         <tr className="border-b">
                           <th className="py-2 px-1 font-medium">Name</th>
                           <th className="py-2 px-1 font-medium">Expected Value</th>
                           <th className="w-8"></th>
                         </tr>
                       </thead>
                       <tbody>
                         {specsForMp.filter(s => s.type === 'Attribute').map(sp => (
                           <tr key={sp.spec_name} className="border-b last:border-0 hover:bg-slate-50">
                             <td className="py-2 px-1">{sp.spec_name}</td>
                             <td className="py-2 px-1 font-mono text-xs">{sp.attribute_value ?? '–'}</td>
                             <td className="py-2 px-1 text-right">
                               <button className="text-slate-400 hover:text-red-500" onClick={async () => { if (window.confirm(`Delete "${sp.spec_name}"?`)) { try { await axios.delete(`${API_BASE_URL}/specifications/${sp.config_number}/${sp.mp_number}/${sp.spec_name}`, { withCredentials: true }); refetchSpecs(); } catch (e) { alert('Delete failed'); } } }}><FiTrash2 size={14}/></button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
               </div>

               {specsForMp.length === 0 && <p className="p-2 text-sm text-slate-500 text-center mt-4">No specs defined for this procedure.</p>} 
               
               <SpecCreator config={selectedConfig} mp={selectedMp} onSuccess={refetchSpecs} />
             </div>
           ) : <p className="p-2 text-slate-500 text-center mt-4">Select a procedure to view or add specs.</p>}
          </div>
        </div>
      </motion.div>

      {/* modal area */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {modalContent?.type === 'config' && (
          <ConfigForm productMvd={product.mvd_number} existingConfig={modalContent.data} onSuccess={handleActionSuccess} />
        )}
        {modalContent?.type === 'mp' && (
          <MpForm existingMp={modalContent.data} onSuccess={handleActionSuccess} />
        )}
        {modalContent?.type === 'new-mp' && (
          <NewMpForm config={selectedConfig} onSuccess={handleActionSuccess} />
        )}
      </Modal>
    </>
  );
}

// --- Modal Helper Forms (with updated styling) ---
// (The rest of the file remains unchanged)

function ConfigForm({ productMvd, existingConfig, onSuccess }) {
  const isEditing = !!existingConfig?.config_number;
  const [config_number, setConfigNumber] = useState(existingConfig?.config_number || '');
  const [config_name,   setConfigName]   = useState(existingConfig?.config_name   || '');
  const [mvd_number,    setMvdNumber]    = useState(existingConfig?.mvd_number    || productMvd);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_BASE_URL}/configurations/${existingConfig.config_number}`, { config_name, mvd_number }, { withCredentials: true });
      } else {
        await axios.post(`${API_BASE_URL}/configurations`, { config_number, config_name, mvd_number }, { withCredentials: true });
      }
      onSuccess();
    } catch (err) { alert(err.response?.data?.error || 'Save failed'); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h3 className="text-xl font-semibold">{isEditing ? 'Edit Configuration' : 'Add Configuration'}</h3>
      <input value={config_number} onChange={(e) => setConfigNumber(e.target.value)} placeholder="Configuration Number" className={`w-full p-2 border rounded ${isEditing ? 'bg-slate-100' : ''}`} required disabled={isEditing} />
      <input value={mvd_number} onChange={(e) => setMvdNumber(e.target.value)} placeholder="Product MVD Number" className="w-full p-2 border rounded" required />
      <input value={config_name} onChange={(e) => setConfigName(e.target.value)} placeholder="Configuration Name" className="w-full p-2 border rounded" required />
      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Save</button>
    </form>
  );
}

function MpForm({ existingMp, onSuccess }) {
  const [mp_number] = useState(existingMp?.mp_number || '');
  const [procedure_name, setProcedureName] = useState(existingMp?.procedure_name || '');
  const isEditing = !!existingMp;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_BASE_URL}/manufacturing-procedures/${existingMp.mp_number}`, { procedure_name }, { withCredentials: true });
      } else {
        await axios.post(`${API_BASE_URL}/manufacturing-procedures`, [{ mp_number, procedure_name }], { withCredentials: true });
      }
      onSuccess();
    } catch (err) { alert(err.response?.data?.error || 'Operation failed'); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h3 className="text-xl font-semibold">{isEditing ? 'Edit Procedure' : 'Add New Procedure'}</h3>
      <input value={mp_number} disabled className="w-full p-2 border rounded bg-slate-100" />
      <input value={procedure_name} onChange={(e) => setProcedureName(e.target.value)} placeholder="Procedure Name" className="w-full p-2 border rounded" required />
      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Save</button>
    </form>
  );
}

function NewMpForm({ config, onSuccess }) {
  const [mp_number, setMpNumber] = useState('');
  const [procedure_name, setProcName] = useState('');
  const saving = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    try {
      // 1. Create the new MP
      await axios.post(`${API_BASE_URL}/manufacturing-procedures`, [{ mp_number, procedure_name }], { withCredentials: true })
        .catch(err => { if (err.response?.status !== 409) throw err; });

      // 2. Associate it with the current config
      await axios.put(`${API_BASE_URL}/configurations/${config.config_number}/mps`, { mp_numbers: [mp_number], associate: true }, { withCredentials: true });
      
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    } finally { saving.current = false; }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h3 className="text-xl font-semibold">Add & Link New Procedure</h3>
      <input value={mp_number} onChange={(e) => setMpNumber(e.target.value)} placeholder="MP Number" className="w-full p-2 border rounded" required />
      <input value={procedure_name} onChange={(e) => setProcName(e.target.value)} placeholder="Procedure Name" className="w-full p-2 border rounded" required />
      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Add and Link</button>
    </form>
  );
}

function SpecCreator({ config, mp, onSuccess }) {
  const [specName, setSpecName] = useState('');
  const [type, setType] = useState('Variable');
  const [upper, setUpper] = useState('');
  const [lower, setLower] = useState('');
  const [nominal, setNominal] = useState('');
  
  // REMOVED: The state for attribute value is no longer needed.
  // const [attrVal, setAttrVal] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/specifications`, {
        config_number: config.config_number,
        mp_number: mp.mp_number,
        spec_name: specName,
        type,
        upper_spec: upper || null,
        lower_spec: lower || null,
        nominal: nominal || null,
        // CORRECTED: Always send "Pass" for Attribute specs.
        attribute_value: type === 'Attribute' ? 'Pass' : null,
      }, { withCredentials: true });
      onSuccess();
      // Clear the form fields
      setSpecName(''); setUpper(''); setLower(''); setNominal('');
    } catch (err) {
      alert(err.response?.data?.error || 'Create failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-auto pt-4 border-t space-y-3">
      <h4 className="font-semibold text-slate-800">Add New Spec</h4>
      <input value={specName} onChange={(e) => setSpecName(e.target.value)} placeholder="Specification Name" className="w-full p-2 border rounded-md" required />
      <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2 border rounded-md"><option>Variable</option><option>Attribute</option></select>
      {type === 'Variable' && (
        <>
          <div className="flex gap-2">
            <input type="number" step="any" value={lower} onChange={(e) => setLower(e.target.value)} placeholder="LSL" className="w-1/2 p-2 border rounded-md" />
            <input type="number" step="any" value={upper} onChange={(e) => setUpper(e.target.value)} placeholder="USL" className="w-1/2 p-2 border rounded-md" />
          </div>
          <input type="number" step="any" value={nominal} onChange={(e) => setNominal(e.target.value)} placeholder="Nominal" className="w-full p-2 border rounded-md" />
        </>
      )}
      {/* REMOVED: The input field for attribute value is gone. */}
      <button type="submit" className="w-full bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"><FiPlus />Add Spec</button>
    </form>
  );
}
