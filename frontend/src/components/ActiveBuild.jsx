import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import axios from "axios";
import { SampleContext } from "./SampleContext";
import { useNavigate, useLocation } from "react-router-dom";
import API_BASE_URL from "./api";
import { FiPlus, FiLogOut, FiCheck, FiX, FiInfo, FiClipboard, FiEdit3, FiSliders, FiSave, FiHardDrive, FiCamera, FiPaperclip, FiTrash2, FiZap } from 'react-icons/fi';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import CameraView from "./CameraView";

// --- Reusable Hooks ---
const useActiveBuilds = (user) => {
    return useQuery('activeBuilds', async () => {
        const { data } = await axios.get(`${API_BASE_URL}/builds/active_builds`, { withCredentials: true });
        return data || [];
    }, {
        enabled: !!user,
        refetchOnWindowFocus: true,
    });
};

const useBuildData = (build) => {
    const { data: lotDetails, refetch: refetchLotDetails } = useQuery(['lotDetails', build?.lot_number], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/lots/overview`, { withCredentials: true });
        return data.find(l => l.lot_number === build.lot_number);
    }, { enabled: !!build });

    const { data: specs, refetch: refetchSpecs } = useQuery(['specs', build?.config_number, build?.mp_number], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/specifications/${build.config_number}/${build.mp_number}`, { withCredentials: true });
        return data.filter(spec => spec.spec_name !== 'PLACEHOLDER_DO_NOT_DELETE');
    }, { enabled: !!build });
    
    const { data: inspections, refetch: refetchInspections } = useQuery(['inspections', build?.lot_number, build?.mp_number], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/inspections/inspection_logs/${build.lot_number}/${build.mp_number}`, { withCredentials: true });
        return data || [];
    }, { enabled: !!build });

    const { data: yieldData, refetch: refetchYield } = useQuery(['yield', build?.lot_number, build?.mp_number], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/inspections/yield/${build.lot_number}/${build.mp_number}`, { withCredentials: true });
        return data;
    }, { enabled: !!build });

    const refetchAll = () => {
        refetchLotDetails();
        refetchSpecs();
        refetchInspections();
        refetchYield();
    };

    return { lotDetails, specs, inspections, yieldData, refetchAll };
};

// --- Main Component ---
export default function ActiveBuildPage({ user }) {
    const { data: activeBuilds, isLoading } = useActiveBuilds(user);
    const [selectedBuild, setSelectedBuild] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const initialBuildIdRef = useRef(location.state?.selectedBuildId);

    useEffect(() => {
        if (isLoading || !activeBuilds) return;

        if (activeBuilds.length === 0) {
            if (!isLoading) navigate('/spc-tracking-app/Home');
            return;
        }

        if (!selectedBuild || !activeBuilds.some(b => b.build_id === selectedBuild.build_id)) {
            const initialBuild = activeBuilds.find(b => b.build_id === initialBuildIdRef.current);
            setSelectedBuild(initialBuild || activeBuilds[0]);
        }
        
    }, [activeBuilds, isLoading, selectedBuild, navigate]);


    if (isLoading || !selectedBuild) {
        return <div className="p-8 text-center">Loading Active Builds...</div>;
    }

    return (
        <div className="flex h-screen bg-slate-100">
            <BuildsSidebar
                builds={activeBuilds}
                selectedBuild={selectedBuild}
                onSelectBuild={setSelectedBuild}
                user={user}
            />
            <main className="flex-1 p-8 overflow-y-auto">
                <BuildContent build={selectedBuild} user={user} />
            </main>
        </div>
    );
}

// --- Sidebar Component ---
function BuildsSidebar({ builds, selectedBuild, onSelectBuild, user }) {
    const queryClient = useQueryClient();
    const endBuildMutation = useMutation(
        (buildId) => axios.post(`${API_BASE_URL}/builds/end_build`, { username: user.username, build_id: buildId }, { withCredentials: true }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('activeBuilds');
            },
        }
    );

    return (
        <aside className="w-80 bg-white shadow-md flex flex-col p-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><FiZap/> Active Builds</h2>
            <ul className="space-y-2 flex-1 overflow-y-auto">
                {builds.map(build => (
                    <li key={build.build_id}>
                        <button
                            onClick={() => onSelectBuild(build)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${selectedBuild.build_id === build.build_id ? 'bg-indigo-100 border-indigo-500' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                        >
                            <p className="font-semibold text-slate-800">{build.lot_number}</p>
                            <p className="text-sm text-slate-600 truncate">{build.procedure_name}</p>
                            <p className="text-xs text-indigo-600 font-medium mt-1">{build.mp_number}</p>
                        </button>
                    </li>
                ))}
            </ul>
            <div className="mt-4 pt-4 border-t">
                <button
                    onClick={() => endBuildMutation.mutate(selectedBuild.build_id)}
                    disabled={endBuildMutation.isLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition disabled:opacity-50"
                >
                    <FiLogOut/> End Selected Build
                </button>
            </div>
        </aside>
    );
}

// --- Main Content Area ---
function BuildContent({ build, user }) {
    const [activeTab, setActiveTab] = useState('inspections');
    const { lotDetails, specs, inspections, yieldData, refetchAll } = useBuildData(build);
    const { setSelectedSample } = useContext(SampleContext);

    // --- MODIFIED: This effect is now more robust ---
    useEffect(() => {
        // Wait until we have the full lotDetails object, which contains the database ID.
        if (lotDetails && lotDetails.id) {
            axios.post(`${API_BASE_URL}/camera/load-program-for-lot/${lotDetails.id}`, {}, { withCredentials: true })
                .then(response => console.log(response.data.message))
                .catch(error => {
                    console.error("Could not auto-load camera program:", error.response?.data?.message || error.message);
                });
        }
    }, [lotDetails]); // Depend directly on lotDetails


    useEffect(() => {
        setActiveTab('inspections');
        setSelectedSample(null);
    }, [build, setSelectedSample]);

    return (
        <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800 mb-1">Lot: {build.lot_number}</h1>
            <div className="mb-6">
                <p className="text-lg text-slate-600">Procedure: {build.mp_number} - {build.procedure_name}</p>
                <p className="text-md text-slate-500">{build.product_name}</p>
            </div>
            
            <div className="mb-6 border-b border-slate-200">
                <nav className="-mb-px flex space-x-6">
                    <button onClick={() => setActiveTab('inspections')} className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'inspections' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        <FiClipboard/> Inspections
                    </button>
                    <button onClick={() => setActiveTab('inputs')} className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'inputs' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        <FiSliders/> Process Inputs
                    </button>
                </nav>
            </div>

            {activeTab === 'inspections' && <InspectionsTab user={user} activeBuild={build} lotDetails={lotDetails} specs={specs} inspections={inspections} yieldData={yieldData} refetchAllData={refetchAll} />}
            {activeTab === 'inputs' && <ProcessInputsTab build={build} />}
        </div>
    );
}


// --- Inspections Tab Component ---
function InspectionsTab({ user, activeBuild, lotDetails, specs, inspections, yieldData, refetchAllData }) {
    const { selectedSample, setSelectedSample } = useContext(SampleContext);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [inspectionValues, setInspectionValues] = useState({});
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [currentSpecForReject, setCurrentSpecForReject] = useState(null);
    
    const [attachedImage, setAttachedImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [viewImage, setViewImage] = useState(null);
    
    const queryClient = useQueryClient();
    const useRejectTypes = (mp_number) => {
        const { data } = useQuery(['rejectTypes', mp_number], async () => {
            const { data } = await axios.get(`${API_BASE_URL}/rejects/for-mp/${mp_number}`, { withCredentials: true });
            return data;
        }, { enabled: !!mp_number });
        return data || [];
    };
    const availableRejects = useRejectTypes(activeBuild?.mp_number);
const batchTriggerMutation = useMutation(
  () => axios.post(
    `${API_BASE_URL}/camera/trigger`,
    { lot_number: activeBuild.lot_number, mp_number: activeBuild.mp_number },
    { withCredentials: true }
  ),
  {
    onSuccess: async ({ data }) => {
      const { measurements } = data;
     // For every spec in this build that we got back, log it.
      const promises = specs
        .filter(spec => measurements[spec.spec_name] != null)
        .map(spec => {
          const measured = measurements[spec.spec_name];
          if (spec.type === "Variable") {
            return handleLogInspection({
              spec,
              status: null,
              value: measured
            });
          } else {
            // attribute: Pass/Fail — default reject_code to "none" on camera fails
            const rejectCode = (measured === "Fail") ? "none" : null;
            return handleLogInspection({
              spec,
              status: measured,   // "Pass" or "Fail"
              value: null,
              rejectCode
            });
          }
        });
      await Promise.all(promises);
      refetchAllData();
    },
    onError: err => {
      alert(`Camera batch failed: ${err.response?.data?.error || err.message}`);
    }
  }
);

    useEffect(() => {
        setInspectionValues({});
        setAttachedImage(null);
    }, [activeBuild]);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('inspectionImage', file);
        try {
            const { data } = await axios.post(`${API_BASE_URL}/inspections/upload-image`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true });
            setAttachedImage({ url: data.imageUrl, preview: URL.createObjectURL(file) });
        } catch (err) {
            alert('Image upload failed.');
        } finally {
            setIsUploading(false);
        }
    };
    
    const saveImageMutation = useMutation(
        (imageData) => axios.post(`${API_BASE_URL}/inspections/save-image-for-sample`, imageData, { withCredentials: true }),
        {
            onSuccess: () => {
                refetchAllData();
                setAttachedImage(null);
            },
            onError: (error) => {
                alert(error.response?.data?.error || "Failed to save photo.");
            }
        }
    );

    const handleSaveImage = () => {
        if (!selectedSample || !attachedImage) {
            alert("Please select a sample and attach a photo first.");
            return;
        }
        saveImageMutation.mutate({
            lot_number: activeBuild.lot_number,
            mp_number: activeBuild.mp_number,
            config_number: activeBuild.config_number,
            unit_number: selectedSample,
            image_url: attachedImage.url
        });
    };

    const handleLogInspection = async ({ spec, status, rejectCode = null, value = null }) => {
        if (!selectedSample) return alert("Please select a sample number first.");
        
        if (lotDetails && selectedSample > lotDetails.quantity) {
            alert(`Invalid sample number. This lot only has ${lotDetails.quantity} units.`);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const setpoints = queryClient.getQueryData(['lotSetpoints', activeBuild.lot_number, activeBuild.mp_number]) || [];
            const snapshot = setpoints.reduce((obj, item) => {
                const recipeName = item.recipe_name || 'Default Recipe';
                if (!obj[recipeName]) obj[recipeName] = {};
                obj[recipeName][item.parameter_name] = item.setpoint_value;
                return obj;
            }, {});
            const inspectionType = spec.type;
            const inspectionValue = value !== null ? value : (inspectionType === "Variable" ? parseFloat(inspectionValues[spec.spec_name]) : null);

            await axios.post(`${API_BASE_URL}/inspections/log_inspection`, {
                username: user.username, lot_number: activeBuild.lot_number, config_number: activeBuild.config_number,
                mp_number: activeBuild.mp_number, spec_name: spec.spec_name, inspection_type: inspectionType,
                unit_number: selectedSample, inspection_value: inspectionValue,
                pass_fail: status, reject_code: rejectCode,
                image_url: attachedImage?.url,
                process_parameters_snapshot: snapshot
            }, { withCredentials: true });
            
            refetchAllData();
            setAttachedImage(null);
        } catch (error) {
            setError(error.response?.data?.error || "Failed to log inspection.");
        } finally {
            setIsSubmitting(false);
            setIsRejectModalOpen(false);
            setCurrentSpecForReject(null);
        }
    };

 const triggerCameraMutation = useMutation(
        // --- MODIFIED: Send activeBuild in the request body ---
        (variables) => axios.post(`${API_BASE_URL}/camera/trigger`, { 
            lot_number: activeBuild.lot_number,
            mp_number: activeBuild.mp_number
        }, { withCredentials: true }),
        {
            onSuccess: (response, variables) => {
                const { spec } = variables;
                const { inspection_value } = response.data;
                console.log(`Camera returned: ${inspection_value}. Logging for spec: ${spec.spec_name}`);
                handleLogInspection({ spec: spec, status: null, value: inspection_value });
            },
            onError: (error) => {
                alert(`Camera inspection failed: ${error.response?.data?.error || error.message}`);
            }
        }
    );
    const openRejectModal = (spec) => {
        setCurrentSpecForReject(spec);
        setIsRejectModalOpen(true);
    };
    
    const handleIncreaseQuantity = async () => {
        if (!lotDetails || !activeBuild) return;
        setIsSubmitting(true);
        try {
            const newQuantity = lotDetails.quantity + 1;
            await axios.post(`${API_BASE_URL}/lots/update-quantity`,{ lot_number: activeBuild.lot_number, quantity: newQuantity },{ withCredentials: true });
            refetchAllData();
        } catch (error) {
            setError(error.response?.data?.error || "Failed to add sample.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatSpecPlaceholder = (spec) => {
        if (!spec) return "";
        const { lower_spec, upper_spec } = spec;
        if (upper_spec !== null && lower_spec !== null) return `(${lower_spec} to ${upper_spec})`;
        if (upper_spec !== null) return `(Max ${upper_spec})`;
        if (lower_spec !== null) return `(Min ${lower_spec})`;
        return "(No specification)";
    };

    return (
        <>
            {isRejectModalOpen && <RejectModal spec={currentSpecForReject} rejectTypes={availableRejects} onClose={() => setIsRejectModalOpen(false)} onLogReject={(rejectCode) => handleLogInspection({ spec: currentSpecForReject, status: 'Fail', rejectCode })} />}
            {viewImage && <ImageViewModal imageUrl={viewImage} onClose={() => setViewImage(null)} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center"><FiInfo className="mr-2 text-indigo-500"/>Current Build</h2>
                            <div className="space-y-2 text-slate-700">
                                <p><strong className="font-medium text-slate-500">Lot:</strong> {activeBuild.lot_number}</p>
                                <p><strong className="font-medium text-slate-500">Config:</strong> {activeBuild.config_number}</p>
                                <p><strong className="font-medium text-slate-500">MP:</strong> {activeBuild.mp_number}</p>
                                {lotDetails && <p><strong className="font-medium text-slate-500">Quantity:</strong> {lotDetails.quantity} units</p>}
                            </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-green-700">Yield</p>
                                <p className="text-3xl font-bold text-green-600">{yieldData?.yield}%</p>
                                <p className="text-xs text-slate-500 mt-1">{yieldData?.passedUnits} Passed / {yieldData?.rejectedUnits} Rejected</p>
                            </div>
                            <FiCheck size={32} className="text-green-500"/>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                           <h2 className="text-xl font-semibold text-slate-800 flex items-center"><FiClipboard className="mr-2 text-indigo-500"/>Samples</h2>
                           <div className="flex items-center gap-2">
                                {lotDetails && <button onClick={handleIncreaseQuantity} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-green-600 transition disabled:opacity-50" disabled={isSubmitting || (lotDetails.quantity >= 999)}><FiPlus/> Add Sample</button>}
                           </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="p-3 text-left font-semibold text-slate-600">Sample</th>
                                        {specs?.map((spec) => (<th key={spec.spec_name} className="p-3 text-left font-semibold text-slate-600">{spec.spec_name}</th>))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...Array(lotDetails?.quantity || 0)].map((_, i) => {
                                        const unitNumber = i + 1;
                                        return (
                                            <tr key={unitNumber} className={`border-b border-slate-100 transition-colors ${selectedSample === unitNumber ? "bg-indigo-100" : "hover:bg-slate-50"}`} onClick={() => setSelectedSample(unitNumber)}>
                                                <td className="p-3 font-medium text-slate-800">{unitNumber}</td>
                                                {specs?.map((spec) => {
                                                    const inspection = inspections?.find((ins) => ins.unit_number === unitNumber && ins.spec_name === spec.spec_name);
                                                    return (
                                                        <td key={spec.spec_name} className="p-3 text-center">
                                                            {inspection ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className={inspection.pass_fail === "Pass" ? "text-green-600" : "text-red-600"}>{inspection.pass_fail === "Pass" ? <FiCheck/> : <FiX/>}</span>
                                                                    {inspection.inspection_value !== null && (<span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full font-mono">{inspection.inspection_value}</span>)}
                                                                    {inspection.reject_code && (<span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded-full font-semibold">{inspection.reject_code}</span>)}
                                                                    {inspection.image_url && <button onClick={(e) => { e.stopPropagation(); setViewImage(inspection.image_url); }} className="text-blue-500 hover:text-blue-700"><FiCamera /></button>}
                                                                </div>
                                                            ) : null}
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
                </div>
               
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-xl shadow-sm sticky top-6">
                        <h2 className="text-xl font-semibold text-slate-800 mb-4"><FiEdit3 className="mr-2 text-indigo-500 inline-block"/>Inspections for Sample <span className="text-indigo-600 font-bold">{selectedSample || '-'}</span></h2>
                        <div className="mb-6">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <div className="flex gap-2">
                                <button onClick={() => fileInputRef.current.click()} disabled={!selectedSample || isUploading} className="w-full flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition disabled:opacity-50">
                                    <FiPaperclip/> {isUploading ? 'Uploading...' : (attachedImage ? 'Change Photo' : 'Attach Photo')}
                                </button>
                                {attachedImage && (
                                    <button
                                        onClick={handleSaveImage}
                                        disabled={saveImageMutation.isLoading || isUploading}
                                        className="flex-shrink-0 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                        title="Save Photo"
                                    >
                                        <FiSave/>
                                    </button>
                                )}
                                
                            </div>
                            {attachedImage && (
                                <div className="mt-2 relative">
                                    <img src={attachedImage.preview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                                    <button onClick={() => setAttachedImage(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><FiTrash2 size={14}/></button>
                                </div>
                            )}
                          
                        </div>
                        
                        <div className="space-y-6">
                            {specs?.map((spec) => (
                                <div key={spec.spec_name}>
                                    <label className="block font-medium mb-2 text-slate-700">{spec.spec_name} <span className="text-xs text-slate-400">({spec.type})</span></label>
                                    {spec.type === "Variable" ? (
                                        <div className="flex items-center gap-2">
                                            <input type="number" placeholder={formatSpecPlaceholder(spec)} value={inspectionValues[spec.spec_name] || ""} onChange={(e) => setInspectionValues({ ...inspectionValues, [spec.spec_name]: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg" step="any"/>
                                            <button 
                                                onClick={() => {
                                                    if (!selectedSample) {
                                                        alert("Please select a sample number first.");
                                                        return;
                                                    }
                                                    triggerCameraMutation.mutate({ spec });
                                                }} 
                                                disabled={!selectedSample || triggerCameraMutation.isLoading} 
                                                className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex-shrink-0 disabled:opacity-50"
                                                title="Use Camera Inspection"
                                            >
                                                {triggerCameraMutation.isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <FiCamera/>}
                                            </button>
                                            <button onClick={() => handleLogInspection({ spec, status: null, value: inspectionValues[spec.spec_name] || null })} disabled={!selectedSample || isSubmitting} className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex-shrink-0 disabled:opacity-50">Log</button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleLogInspection({ spec, status: 'Pass' })} disabled={!selectedSample || isSubmitting} className="flex items-center justify-center gap-2 w-full bg-green-100 text-green-700 font-semibold py-2 rounded-lg hover:bg-green-200 transition disabled:opacity-50"><FiCheck/> Pass</button>
                                            <button onClick={() => openRejectModal(spec)} disabled={!selectedSample || isSubmitting} className="flex items-center justify-center gap-2 w-full bg-red-100 text-red-700 font-semibold py-2 rounded-lg hover:bg-red-200 transition disabled:opacity-50"><FiX/> Fail</button>
                                        </div>
                                    )}
                                </div>
                                
                            ))}
                            <button
  onClick={() => batchTriggerMutation.mutate()}
  disabled={!selectedSample || batchTriggerMutation.isLoading}
  className="mb-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
>
  {batchTriggerMutation.isLoading ? "Working…" : "Use Camera for All"}
</button>
                        </div>
              
                    </div>
                    
                </div>
                
            </div>
        </>
    );
}

// --- Modals and other helper components (ImageViewModal, RejectModal, ProcessInputsTab) remain unchanged ---
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

function RejectModal({ spec, rejectTypes, onClose, onLogReject }) {
    const [selectedReject, setSelectedReject] = useState('');
    const handleSubmit = () => { if (!selectedReject) { alert("Please select a reason for the failure."); return; } onLogReject(selectedReject); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
                <h3 className="text-2xl font-bold mb-2">Log Failure</h3>
                <p className="text-slate-600 mb-6">Select a reject type for <span className="font-semibold text-slate-800">{spec.spec_name}</span>.</p>
                <select value={selectedReject} onChange={(e) => setSelectedReject(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg mb-6 focus:ring-2 focus:ring-indigo-500">
                    <option value="" disabled>-- Select a Reject Type --</option>
                    {rejectTypes.map(rt => (<option key={rt.reject_code} value={rt.reject_code}>{rt.reject_code} - {rt.description}</option>))}
                </select>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="px-5 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 font-semibold text-slate-700">Cancel</button>
                    <button onClick={handleSubmit} className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">Log Failure</button>
                </div>
            </div>
        </div>
    );
}
function useProcessSetpoints(build) {
    return useQuery(['lotSetpoints', build?.lot_number, build?.mp_number], async () => {
        const { data } = await axios.get(`${API_BASE_URL}/lots/${build.lot_number}/setpoints/${build.mp_number}`, { withCredentials: true });
        return data;
    }, { enabled: !!build?.lot_number && !!build?.mp_number });
};

function ProcessInputsTab({ build }) {
    const { data: setpoints, isLoading, refetch } = useProcessSetpoints(build);
    const [editableSetpoints, setEditableSetpoints] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if(setpoints) setEditableSetpoints(setpoints);
    }, [setpoints]);

    const setpointsByRecipe = useMemo(() => {
        if (!editableSetpoints) return {};
        return editableSetpoints.reduce((acc, setpoint) => {
            const recipeName = setpoint.recipe_name || 'Default Recipe';
            if (!acc[recipeName]) {
                acc[recipeName] = {
                    equipment_name: setpoint.equipment_name || 'General',
                    parameters: []
                };
            }
            acc[recipeName].parameters.push(setpoint);
            return acc;
        }, {});
    }, [editableSetpoints]);

    const handleSetpointChange = (id, value) => {
        setEditableSetpoints(current =>
            current.map(sp => sp.id === id ? { ...sp, setpoint_value: parseFloat(value) || 0 } : sp)
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await axios.put(`${API_BASE_URL}/lots/${build.lot_number}/setpoints`, { setpoints: editableSetpoints }, { withCredentials: true });
            alert("Setpoints saved successfully!");
            refetch();
        } catch (error) {
            alert("Failed to save setpoints.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-6 text-center">Loading setpoints...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center"><FiSliders className="mr-2 text-indigo-500"/>Process Input Setpoints</h2>
                <p className="text-sm text-slate-500">These are the current setpoints for the machine. Adjust them here if settings change during the build. These values will be recorded with every inspection.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {Object.entries(setpointsByRecipe).map(([recipeName, recipeData]) => (
                    <div key={recipeName} className="bg-white p-6 rounded-xl shadow-sm flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800">{recipeName}</h3>
                        <p className="text-sm text-slate-500 mb-4">Equipment: {recipeData.equipment_name}</p>
                        
                        <div className="space-y-4 flex-grow">
                            {recipeData.parameters.map(sp => (
                                <div key={sp.id} className="grid grid-cols-2 gap-4 items-center">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700">{sp.parameter_name}</label>
                                        <p className="text-xs text-slate-500">
                                            Range: {sp.min_setpoint} – {sp.max_setpoint}
                                        </p>
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            step="any"
                                            value={sp.setpoint_value}
                                            onChange={(e) => handleSetpointChange(sp.id, e.target.value)}
                                            className="w-full p-2 text-center border border-slate-300 rounded-md shadow-inner bg-white"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end mt-2">
                <button onClick={handleSave} disabled={isSaving} className="flex justify-center items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition disabled:opacity-50">
                    <FiSave/> {isSaving ? 'Saving...' : 'Save All Setpoints'}
                </button>
            </div>
        </div>
    );
}