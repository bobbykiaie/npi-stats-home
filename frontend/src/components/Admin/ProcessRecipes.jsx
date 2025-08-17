import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import axios from 'axios';
import API_BASE_URL from '../api';
import { FiPlus, FiEdit, FiTrash2, FiHardDrive, FiSliders, FiSave } from 'react-icons/fi';
import Modal from './Modal';

// --- Reusable Data Fetching Hooks ---
const useAdminData = (endpoint) => {
    return useQuery(endpoint, async () => {
        if (!endpoint) return null;
        const { data } = await axios.get(`${API_BASE_URL}/${endpoint}`, { withCredentials: true });
        return data;
    });
};

const useProcessRecipes = (configNumber, mpNumber) => {
    return useQuery(['processRecipes', configNumber, mpNumber], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/recipes/${configNumber}/${mpNumber}`, { withCredentials: true });
        return data;
    }, {
        enabled: !!configNumber && !!mpNumber,
    });
};

// --- Main Component ---
export default function ProcessRecipes() {
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedConfig, setSelectedConfig] = useState('');
    const [selectedMp, setSelectedMp] = useState('');
    
    const [modalInfo, setModalInfo] = useState({ isOpen: false, mode: 'add', data: null });

    const { data: products } = useAdminData('products');
    const { data: recipes, isLoading, refetch } = useProcessRecipes(selectedConfig, selectedMp);

    const configsForSelectedProduct = useMemo(() => {
        if (!selectedProduct || !products) return [];
        return products.find(p => p.mvd_number === selectedProduct)?.configurations || [];
    }, [selectedProduct, products]);

    const mpsForSelectedConfig = useMemo(() => {
        if (!selectedConfig || !configsForSelectedProduct) return [];
        const config = configsForSelectedProduct.find(c => c.config_number === selectedConfig);
        return config ? config.manufacturing_procedures : [];
    }, [selectedConfig, configsForSelectedProduct]);

    const recipesByName = useMemo(() => {
        if (!recipes) return {};
        return recipes.reduce((acc, recipe) => {
            const recipeName = recipe.recipe_name || 'Unnamed Recipe';
            if (!acc[recipeName]) {
                acc[recipeName] = [];
            }
            acc[recipeName].push(recipe);
            return acc;
        }, {});
    }, [recipes]);

    const openModal = (mode, data = null) => {
        setModalInfo({ isOpen: true, mode, data });
    };
    
    const closeModal = () => {
        setModalInfo({ isOpen: false, mode: 'add', data: null });
    };

    const handleDeleteRecipe = async (recipeId) => {
        if (window.confirm('Are you sure you want to delete this recipe parameter?')) {
            try {
                await axios.delete(`${API_BASE_URL}/recipes/${recipeId}`, { withCredentials: true });
                refetch();
            } catch (error) {
                alert(error.response?.data?.error || 'Failed to delete.');
            }
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Process Recipes</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-white rounded-xl shadow-sm">
                <Select id="product-select" label="Product" value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); setSelectedConfig(''); setSelectedMp(''); }} options={products || []} optionValue="mvd_number" optionLabel="product_name" />
                <Select id="config-select" label="Configuration" value={selectedConfig} onChange={(e) => { setSelectedConfig(e.target.value); setSelectedMp(''); }} options={configsForSelectedProduct} optionValue="config_number" optionLabel="config_name" disabled={!selectedProduct} />
                <Select id="mp-select" label="Manufacturing Procedure" value={selectedMp} onChange={(e) => setSelectedMp(e.target.value)} options={mpsForSelectedConfig} optionValue="mp_number" optionLabel="procedure_name" disabled={!selectedConfig} />
            </div>

            {selectedConfig && selectedMp ? (
                isLoading ? <p>Loading recipes...</p> : (
                    <div className="space-y-8">
                        {Object.keys(recipesByName).length > 0 ? Object.entries(recipesByName).map(([recipeName, recipeGroup]) => (
                            <RecipeGroup
                                key={recipeName}
                                recipeName={recipeName}
                                recipes={recipeGroup}
                                onEditParameter={(recipe) => openModal('editParameter', recipe)}
                                onEditGroup={(group) => openModal('editGroup', group)}
                                onDelete={handleDeleteRecipe}
                            />
                        )) : <p className="text-center text-slate-500 py-4">No recipes found for this selection.</p>}
                         <button onClick={() => openModal('addGroup')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                            <FiPlus /> Add New Recipe
                        </button>
                    </div>
                )
            ) : <p className="text-center text-slate-500 p-8 bg-white rounded-xl shadow-sm">Please select a Product, Configuration, and Procedure to view or create recipes.</p>}
            
            <Modal isOpen={modalInfo.isOpen} onClose={closeModal}>
                { (modalInfo.mode === 'addGroup' || modalInfo.mode === 'editParameter') &&
                    <RecipeForm
                        mode={modalInfo.mode}
                        recipe={modalInfo.data}
                        configNumber={selectedConfig}
                        mpNumber={selectedMp}
                        onSuccess={() => {
                            closeModal();
                            refetch();
                        }}
                    />
                }
                { modalInfo.mode === 'editGroup' &&
                    <EditRecipeGroupModal
                        recipeGroup={modalInfo.data}
                        configNumber={selectedConfig}
                        mpNumber={selectedMp}
                        onSuccess={() => {
                            closeModal();
                            refetch();
                        }}
                    />
                }
            </Modal>
        </div>
    );
}

const Select = ({ id, label, value, onChange, options, optionValue, optionLabel, disabled }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <select id={id} value={value} onChange={onChange} disabled={disabled} className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            <option value="">-- Select --</option>
            {options.map(option => (
                <option key={option[optionValue]} value={option[optionValue]}>{option[optionLabel]}</option>
            ))}
        </select>
    </div>
);

const RecipeGroup = ({ recipeName, recipes, onEditParameter, onEditGroup, onDelete }) => (
    <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
                <FiSliders className="text-slate-500" />
                <h2 className="text-2xl font-semibold text-slate-800">{recipeName}</h2>
            </div>
            <button onClick={() => onEditGroup({ recipeName, recipes })} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition"><FiEdit /> Edit Recipe</button>
        </div>
        <h3 className="text-lg font-medium text-slate-600 mb-4 ml-9 -mt-4 flex items-center gap-2">
            <FiHardDrive className="text-slate-400" size={16}/> {recipes[0]?.equipment.name}
        </h3>
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-left bg-slate-50">
                    <tr>
                        <th className="p-3 font-semibold text-slate-600">Parameter</th>
                        <th className="p-3 font-semibold text-slate-600 text-center">Min</th>
                        <th className="p-3 font-semibold text-slate-600 text-center">Nominal</th>
                        <th className="p-3 font-semibold text-slate-600 text-center">Max</th>
                        <th className="p-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {recipes.map(recipe => (
                        <tr key={recipe.id} className="border-b border-slate-100">
                            <td className="p-3 font-medium text-slate-700">{recipe.parameter.name}</td>
                            <td className="p-3 text-center font-mono">{recipe.min_setpoint}</td>
                            <td className="p-3 text-center font-mono text-indigo-600 font-bold">{recipe.nominal_setpoint}</td>
                            <td className="p-3 text-center font-mono">{recipe.max_setpoint}</td>
                            <td className="p-3 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => onEditParameter(recipe)} className="p-2 text-slate-500 hover:text-indigo-600"><FiEdit /></button>
                                    <button onClick={() => onDelete(recipe.id)} className="p-2 text-slate-500 hover:text-red-600"><FiTrash2 /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);


function RecipeForm({ mode, recipe, configNumber, mpNumber, onSuccess }) {
    const { data: equipmentList } = useAdminData('process-management/equipment');
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        recipe_name: '',
        equipment_id: '',
        parameter_id: '',
        nominal_setpoint: '',
        min_setpoint: '',
        max_setpoint: ''
    });

    const { data: parametersForEquipment } = useQuery(
        ['equipmentParameters', formData.equipment_id], 
        async () => {
            const { data } = await axios.get(`${API_BASE_URL}/process-management/equipment/${formData.equipment_id}/parameters`, { withCredentials: true });
            return data;
        }, 
        { enabled: !!formData.equipment_id }
    );

    useEffect(() => {
        if (mode === 'editParameter' && recipe) {
            setFormData({
                recipe_name: recipe.recipe_name,
                equipment_id: recipe.equipment_id,
                parameter_id: recipe.parameter_id,
                nominal_setpoint: recipe.nominal_setpoint,
                min_setpoint: recipe.min_setpoint,
                max_setpoint: recipe.max_setpoint
            });
        }
    }, [mode, recipe]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        
        const payload = { ...formData, config_number: configNumber, mp_number: mpNumber };
        // The backend expects an array for the POST route
        const postPayload = { ...payload, parameters: [{ ...formData }] };

        try {
            if (mode === 'editParameter') {
                await axios.put(`${API_BASE_URL}/recipes/${recipe.id}`, payload, { withCredentials: true });
            } else {
                // 'addGroup' mode creates a new recipe with a single parameter
                await axios.post(`${API_BASE_URL}/recipes`, postPayload, { withCredentials: true });
            }
            onSuccess();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to save recipe.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <h3 className="text-2xl font-semibold text-slate-800">{mode === 'editParameter' ? 'Edit Parameter' : 'Add New Recipe'}</h3>
            
            <FormInput id="recipe_name" name="recipe_name" label="Recipe Name" type="text" value={formData.recipe_name} onChange={handleChange} required disabled={mode === 'editParameter'} />
            <FormSelect id="equipment_id" name="equipment_id" label="Equipment" value={formData.equipment_id} onChange={handleChange} options={equipmentList || []} optionValue="id" optionLabel="name" required disabled={mode === 'editParameter'}/>
            <FormSelect id="parameter_id" name="parameter_id" label="Parameter" value={formData.parameter_id} onChange={handleChange} options={parametersForEquipment || []} optionValue="id" optionLabel="name" required disabled={mode === 'editParameter'}/>

            <div className="grid grid-cols-3 gap-4">
                <FormInput id="min_setpoint" name="min_setpoint" label="Min Setpoint" type="number" value={formData.min_setpoint} onChange={handleChange} required />
                <FormInput id="nominal_setpoint" name="nominal_setpoint" label="Nominal Setpoint" type="number" value={formData.nominal_setpoint} onChange={handleChange} required />
                <FormInput id="max_setpoint" name="max_setpoint" label="Max Setpoint" type="number" value={formData.max_setpoint} onChange={handleChange} required />
            </div>

            <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    )
}

function EditRecipeGroupModal({ recipeGroup, configNumber, mpNumber, onSuccess }) {
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);
    const [recipeName, setRecipeName] = useState(recipeGroup.recipeName);
    const [newParameters, setNewParameters] = useState([]);
    
    const equipmentId = recipeGroup.recipes[0].equipment_id;
    const { data: allEquipmentParams } = useQuery(
        ['equipmentParameters', equipmentId],
        async () => {
            const { data } = await axios.get(`${API_BASE_URL}/process-management/equipment/${equipmentId}/parameters`, { withCredentials: true });
            return data;
        },
        { enabled: !!equipmentId }
    );

    const existingParamIds = useMemo(() => new Set(recipeGroup.recipes.map(r => r.parameter_id)), [recipeGroup]);
    const availableParams = useMemo(() => allEquipmentParams?.filter(p => !existingParamIds.has(p.id)) || [], [allEquipmentParams, existingParamIds]);

    const handleAddParam = () => {
        if (availableParams.length > 0) {
            const paramToAdd = availableParams[0];
            setNewParameters(prev => [...prev, {
                parameter_id: paramToAdd.id,
                name: paramToAdd.name,
                min_setpoint: '',
                nominal_setpoint: '',
                max_setpoint: ''
            }]);
        }
    };

    const handleNewParamChange = (index, field, value) => {
        setNewParameters(prev => {
            const updated = [...prev];
            updated[index][field] = value;
            return updated;
        });
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        
        try {
            // Task 1: Rename the existing recipe parameters if the name has changed
            if (recipeName !== recipeGroup.recipeName) {
                await axios.put(`${API_BASE_URL}/recipes/group/rename`, {
                    old_recipe_name: recipeGroup.recipeName,
                    new_recipe_name: recipeName,
                    config_number: configNumber,
                    mp_number: mpNumber,
                }, { withCredentials: true });
            }

            // Task 2: Add any new parameters
            if (newParameters.length > 0) {
                const payload = {
                    config_number: configNumber,
                    mp_number: mpNumber,
                    recipe_name: recipeName, // Use the new name
                    equipment_id: equipmentId,
                    parameters: newParameters
                };
                await axios.post(`${API_BASE_URL}/recipes`, payload, { withCredentials: true });
            }
            
            onSuccess();

        } catch (error) {
            alert(error.response?.data?.error || 'Failed to update recipe.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <h3 className="text-2xl font-semibold text-slate-800">Edit Recipe: {recipeGroup.recipeName}</h3>
            
            <FormInput id="recipe_name_edit" name="recipe_name" label="Recipe Name" type="text" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} required />
            
            {newParameters.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-lg font-semibold text-slate-700">New Parameters</h4>
                    {newParameters.map((param, index) => (
                        <div key={param.parameter_id} className="p-4 bg-slate-50 rounded-lg">
                            <label className="block font-medium text-slate-800 mb-2">{param.name}</label>
                            <div className="grid grid-cols-3 gap-3">
                                <FormInput type="number" placeholder="Min" value={param.min_setpoint} onChange={(e) => handleNewParamChange(index, 'min_setpoint', e.target.value)} required />
                                <FormInput type="number" placeholder="Nominal" value={param.nominal_setpoint} onChange={(e) => handleNewParamChange(index, 'nominal_setpoint', e.target.value)} required />
                                <FormInput type="number" placeholder="Max" value={param.max_setpoint} onChange={(e) => handleNewParamChange(index, 'max_setpoint', e.target.value)} required />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {availableParams.length > newParameters.length && (
                 <button type="button" onClick={handleAddParam} className="flex items-center gap-2 text-sm text-indigo-600 font-semibold">
                    <FiPlus /> Add Parameter
                </button>
            )}

            <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
}


// Helper components for the form
const FormInput = ({ id, name, label, type, value, onChange, required, placeholder, disabled }) => (
    <div>
        {label && <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
        <input id={id} name={name} type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} step="any" disabled={disabled} className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm disabled:bg-slate-200" />
    </div>
);

const FormSelect = ({ id, name, label, value, onChange, options, optionValue, optionLabel, disabled, required }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} disabled={disabled} required={required} className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm disabled:bg-slate-100">
            <option value="">-- Select --</option>
            {options.map(option => (
                <option key={option[optionValue]} value={option[optionValue]}>{option[optionLabel]}</option>
            ))}
        </select>
    </div>
);
