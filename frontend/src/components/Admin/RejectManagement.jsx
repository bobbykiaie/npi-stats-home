import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from 'react-query';
import API_BASE_URL from '../api';
import { FiTag, FiPlus, FiBox, FiCheck, FiTool, FiList } from 'react-icons/fi';

// --- Reusable Hooks for Data Fetching (from your original code) ---
const useMasterRejects = () => useQuery('masterRejects', async () => {
    const { data } = await axios.get(`${API_BASE_URL}/rejects`, { withCredentials: true });
    return data;
});

const useProducts = () => useQuery('products', async () => {
    const { data } = await axios.get(`${API_BASE_URL}/products`, { withCredentials: true });
    return data;
});

// Fetches all reject-to-procedure links for a given product
const useProductRejects = (mvd_number) => useQuery(['productRejects', mvd_number], async () => {
    const { data } = await axios.get(`${API_BASE_URL}/rejects/product/${mvd_number}`, { withCredentials: true });
    return data;
}, { enabled: !!mvd_number });


// --- Main Component ---
export default function RejectManagement() {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const { data: products, isLoading: productsLoading } = useProducts();

    const handleProductSelect = (mvd_number) => {
        const product = products.find(p => p.mvd_number === mvd_number);
        setSelectedProduct(product);
    }

    return (
        <div className="p-6 bg-slate-50 flex-1 overflow-y-auto">
            <h2 className="text-3xl font-bold mb-6 text-slate-800">Reject Management</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1: Master Reject List */}
                <div className="lg:col-span-1">
                    <MasterRejectList />
                </div>
                {/* Column 2 & 3: New Flipped Workflow */}
                <div className="lg:col-span-2 space-y-6">
                    <ProductSelector 
                        products={products} 
                        isLoading={productsLoading} 
                        onSelect={handleProductSelect} 
                        selectedValue={selectedProduct?.mvd_number || ''}
                    />
                    {selectedProduct && <ProcedureAssignmentManager key={selectedProduct.mvd_number} product={selectedProduct} />}
                </div>
            </div>
        </div>
    );
}

// --- Sub-Component: ProcedureAssignmentManager (New Flipped Workflow) ---
function ProcedureAssignmentManager({ product }) {
    const { data: productRejects, isLoading: isLoadingProductRejects } = useProductRejects(product.mvd_number);
    const { data: masterRejects, isLoading: isLoadingMasterRejects } = useMasterRejects();
    const queryClient = useQueryClient();

    const [selectedProcedure, setSelectedProcedure] = useState(null);
    const [assignedRejectCodes, setAssignedRejectCodes] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // Derive procedures from the product data, as per your original code
    const procedures = product.configurations.flatMap(c => c.manufacturing_procedures);

    // When a procedure is selected, or when the product's reject data loads, update the checkboxes
    useEffect(() => {
        if (selectedProcedure && productRejects) {
            const rejectCodesForProcedure = new Set();
            // Iterate through all reject assignments for the product
            productRejects.forEach(pr => {
                // If a reject is assigned to the currently selected procedure, add it to the set
                if (pr.assignments.some(a => a.mp_number === selectedProcedure.mp_number)) {
                    rejectCodesForProcedure.add(pr.rejectType.reject_code);
                }
            });
            setAssignedRejectCodes(rejectCodesForProcedure);
        } else {
            // Clear checkboxes if no procedure is selected
            setAssignedRejectCodes(new Set());
        }
    }, [selectedProcedure, productRejects]);

    const handleProcedureSelect = (procedure) => {
        setSelectedProcedure(procedure);
    };

    const handleCheckboxChange = (rejectCode) => {
        setAssignedRejectCodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rejectCode)) {
                newSet.delete(rejectCode);
            } else {
                newSet.add(rejectCode);
            }
            return newSet;
        });
    };

    const handleSaveAssignments = async () => {
        if (!selectedProcedure || !masterRejects) return;
        setIsSaving(true);
    
        try {
            // Step 1: Ensure all rejects the user WANTS to assign are linked to the product.
            const existingProductRejectCodes = new Set(productRejects.map(pr => pr.rejectType.reject_code));
            
            const newCodesToLinkToProduct = Array.from(assignedRejectCodes)
                .filter(code => !existingProductRejectCodes.has(code));
    
            // If there are any new rejects to link to the product, do that first.
            if (newCodesToLinkToProduct.length > 0) {
                await axios.post(`${API_BASE_URL}/rejects/product/${product.mvd_number}`, {
                    reject_codes: newCodesToLinkToProduct
                }, { withCredentials: true });
            }
    
            // Step 2: Refetch the product's rejects to get a complete, up-to-date list with IDs.
            const freshProductRejects = await queryClient.fetchQuery(['productRejects', product.mvd_number]);
    
            // Step 3: Now, with the complete list, update the procedure assignments for every reject.
            const updatePromises = [];
    
            freshProductRejects.forEach(productReject => {
                const rejectCode = productReject.rejectType.reject_code;
    
                const isCurrentlyAssigned = productReject.assignments.some(a => a.mp_number === selectedProcedure.mp_number);
                const shouldBeAssigned = assignedRejectCodes.has(rejectCode);
    
                if (isCurrentlyAssigned === shouldBeAssigned) {
                    return; // No change needed for this reject's assignment to this procedure
                }
    
                const otherAssignedMps = productReject.assignments
                    .map(a => a.mp_number)
                    .filter(mp => mp !== selectedProcedure.mp_number);
                
                const newMpNumbersForReject = shouldBeAssigned
                    ? [...otherAssignedMps, selectedProcedure.mp_number]
                    : otherAssignedMps;
    
                const promise = axios.put(`${API_BASE_URL}/rejects/product-reject/${productReject.id}/assign-mps`, {
                    mp_numbers: newMpNumbersForReject
                }, { withCredentials: true });
                
                updatePromises.push(promise);
            });
    
            await Promise.all(updatePromises);
            
            alert("Assignments saved successfully!");
            queryClient.invalidateQueries(['productRejects', product.mvd_number]);
    
        } catch (error) {
            console.error("Error saving assignments:", error);
            alert("Failed to save assignments. Check console for details.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            {/* Step 2: Select Procedure */}
            <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center"><FiTool className="mr-2 text-indigo-500"/>Select a Manufacturing Procedure</h3>
                <div className="space-y-2">
                    {procedures.length > 0 ? procedures.map(proc => (
                        <div
                            key={proc.mp_number}
                            onClick={() => handleProcedureSelect(proc)}
                            className={`p-3 rounded-lg cursor-pointer transition ${selectedProcedure?.mp_number === proc.mp_number ? 'bg-indigo-100 border-indigo-500 border-2' : 'bg-slate-50 hover:bg-slate-100'}`}
                        >
                            <p className="font-medium text-slate-800">{proc.procedure_name || proc.mp_number}</p>
                        </div>
                    )) : <p className="text-slate-500">No procedures found for this product.</p>}
                </div>
            </div>

            {/* Step 3: Assign Rejects */}
            {selectedProcedure && (
                <div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center"><FiList className="mr-2 text-indigo-500"/>Assign Reject Codes to "{selectedProcedure.procedure_name}"</h3>
                    {isLoadingProductRejects || isLoadingMasterRejects ? <p>Loading rejects...</p> : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-lg max-h-60 overflow-y-auto">
                                {masterRejects.map(reject => (
                                    <label key={reject.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-slate-50">
                                        <input
                                            type="checkbox"
                                            checked={assignedRejectCodes.has(reject.reject_code)}
                                            onChange={() => handleCheckboxChange(reject.reject_code)}
                                            className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="font-medium text-slate-700">{reject.reject_code}</span>
                                    </label>
                                ))}
                            </div>
                            <button
                                onClick={handleSaveAssignments}
                                disabled={isSaving}
                                className="mt-4 w-full flex justify-center items-center gap-2 p-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : <><FiCheck/> Save Assignments for Procedure</>}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}


// --- Sub-Component: MasterRejectList (from your original code) ---
function MasterRejectList() {
    const queryClient = useQueryClient();
    const { data: masterRejects, isLoading } = useMasterRejects();
    const [newRejectCode, setNewRejectCode] = useState('');
    const [newRejectDesc, setNewRejectDesc] = useState('');

    const handleAddReject = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE_URL}/rejects`, { reject_code: newRejectCode, description: newRejectDesc }, { withCredentials: true });
            setNewRejectCode('');
            setNewRejectDesc('');
            queryClient.invalidateQueries('masterRejects');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to add reject.');
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm h-full">
            <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center"><FiTag className="mr-2 text-indigo-500"/>Master Reject List</h3>
            <form onSubmit={handleAddReject} className="space-y-3 mb-4">
                <input value={newRejectCode} onChange={(e) => setNewRejectCode(e.target.value)} placeholder="New Reject Code (e.g., 'SCR')" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500" required />
                <input value={newRejectDesc} onChange={(e) => setNewRejectDesc(e.target.value)} placeholder="Description (e.g., 'Scratch on Surface')" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500" required />
                <button type="submit" className="w-full flex justify-center items-center gap-2 p-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition"><FiPlus /> Add to Master List</button>
            </form>
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {isLoading ? <p>Loading...</p> : masterRejects?.map(reject => (
                    <div key={reject.id} className="bg-slate-50 p-3 rounded-md">
                        <p className="font-semibold text-slate-700">{reject.reject_code}</p>
                        <p className="text-sm text-slate-500">{reject.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Sub-Component: ProductSelector (from your original code) ---
function ProductSelector({ products, isLoading, onSelect, selectedValue }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center"><FiBox className="mr-2 text-indigo-500"/>Select a Product</h3>
            {isLoading ? <p>Loading products...</p> : (
                <select onChange={(e) => onSelect(e.target.value)} value={selectedValue} className="w-full p-3 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-500">
                    <option value="" disabled>-- Select a Product to Manage Rejects --</option>
                    {products?.map(p => <option key={p.mvd_number} value={p.mvd_number}>{p.product_name} ({p.mvd_number})</option>)}
                </select>
            )}
        </div>
    );
}
