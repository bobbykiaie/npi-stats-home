import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../api';
import { FiPlus, FiX } from 'react-icons/fi';

export default function CreateProduct({ onSuccess, onCancel }) {
  // State for all form fields
  const [mvdNumber, setMvdNumber] = useState('');
  const [productName, setProductName] = useState('');
  const [configurations, setConfigurations] = useState([
    { id: Date.now(), config_number: '', config_name: '', mps: [{ mp_number: '', procedure_name: '' }] }
  ]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- Handlers for Configurations ---
  const handleConfigChange = (index, event) => {
    const newConfigs = [...configurations];
    newConfigs[index][event.target.name] = event.target.value;
    setConfigurations(newConfigs);
  };

  const addConfig = () => {
    setConfigurations([...configurations, { id: Date.now(), config_number: '', config_name: '', mps: [{ mp_number: '', procedure_name: '' }] }]);
  };

  const removeConfig = (index) => {
    const newConfigs = [...configurations];
    newConfigs.splice(index, 1);
    setConfigurations(newConfigs);
  };

  // --- Handlers for MPs within a specific Configuration ---
  const handleMpChange = (configIndex, mpIndex, event) => {
    const newConfigs = [...configurations];
    newConfigs[configIndex].mps[mpIndex][event.target.name] = event.target.value;
    setConfigurations(newConfigs);
  };

  const addMpToConfig = (configIndex) => {
    const newConfigs = [...configurations];
    newConfigs[configIndex].mps.push({ mp_number: '', procedure_name: '' });
    setConfigurations(newConfigs);
  };

  const removeMpFromConfig = (configIndex, mpIndex) => {
    const newConfigs = [...configurations];
    newConfigs[configIndex].mps.splice(mpIndex, 1);
    setConfigurations(newConfigs);
  };

  // --- Main Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!mvdNumber || !productName) {
      setError('Product MVD Number and Name are required.');
      return;
    }
    setIsLoading(true);

    // Prepare configurations, ensuring they are valid
    const validConfigs = configurations
      .filter(c => c.config_number && c.config_name)
      .map(c => ({
          config_number: c.config_number,
          config_name: c.config_name,
          // For each config, also filter for valid MPs
          mps: c.mps.filter(mp => mp.mp_number && mp.procedure_name)
      }));

    // Collect all unique procedures from all configurations to be created
    const allProcedures = validConfigs.flatMap(c => c.mps);
    const uniqueProcedures = Array.from(new Map(allProcedures.map(p => [p.mp_number, p])).values());

    const payload = {
      mvd_number: mvdNumber,
      product_name: productName,
      configurations: validConfigs,
      procedures: uniqueProcedures,
    };

    try {
      await axios.post(`${API_BASE_URL}/products`, payload, { withCredentials: true });
      onSuccess();
    } catch (err) {
      console.error('❌ Creation Error:', err);
      setError(err.response?.data?.error || 'An error occurred during creation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-center pb-4 mb-6 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Create New Product</h1>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 text-3xl">&times;</button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* === Product Details Section === */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-700 mb-4">Product Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="mvdNumber" className="block text-gray-700 font-medium mb-1">MVD Number</label>
              <input type="text" id="mvdNumber" value={mvdNumber} onChange={(e) => setMvdNumber(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label htmlFor="productName" className="block text-gray-700 font-medium mb-1">Product Name</label>
              <input type="text" id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" required />
            </div>
          </div>
        </div>

        {/* === Configurations Section === */}
        <div className="p-4 border border-gray-200 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-blue-700">Configurations</h2>
            <button type="button" onClick={addConfig} className="bg-indigo-100 text-indigo-700 font-semibold px-3 py-1 rounded-lg hover:bg-indigo-200 text-sm flex items-center gap-1">
              <FiPlus size={16}/> Add Config
            </button>
          </div>
          
          <div className="space-y-4">
            {configurations.map((config, configIndex) => (
              <div key={config.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <input
                    type="text" name="config_number" placeholder="Config Number (e.g., MVD-01)"
                    value={config.config_number} onChange={(e) => handleConfigChange(configIndex, e)}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                  <div className="md:col-span-2 flex gap-3">
                    <input
                      type="text" name="config_name" placeholder="Config Name (e.g., Short)"
                      value={config.config_name} onChange={(e) => handleConfigChange(configIndex, e)}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    {configurations.length > 1 && (
                      <button type="button" onClick={() => removeConfig(configIndex)} className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 flex-shrink-0" aria-label="Remove Configuration">
                        <FiX />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h3 className="text-md font-semibold text-gray-600 mb-3 ml-1">Procedures for this Config</h3>
                  <div className="space-y-2">
                    {config.mps.map((mp, mpIndex) => (
                      <div key={mpIndex} className="flex items-center gap-2">
                        <input type="text" name="mp_number" placeholder="MP Number" value={mp.mp_number} onChange={(e) => handleMpChange(configIndex, mpIndex, e)} className="w-full p-2 border rounded-md" />
                        <input type="text" name="procedure_name" placeholder="Procedure Name" value={mp.procedure_name} onChange={(e) => handleMpChange(configIndex, mpIndex, e)} className="w-full p-2 border rounded-md" />
                        <button type="button" onClick={() => removeMpFromConfig(configIndex, mpIndex)} className="bg-red-100 text-red-600 px-2 py-2 rounded-lg hover:bg-red-200 flex-shrink-0" aria-label="Remove Procedure">
                          <FiX size={16} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addMpToConfig(configIndex)} className="text-sm font-medium text-indigo-600 hover:underline pt-2">+ Add Procedure</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {error && <p className="text-red-500 text-center py-2">{error}</p>}
        <div className="flex justify-end gap-4 pt-4 border-t mt-6">
          <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-semibold px-6 py-2 rounded-lg hover:bg-gray-300" disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}