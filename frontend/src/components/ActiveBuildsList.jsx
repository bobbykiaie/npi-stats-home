import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from './api';

function ActiveBuildsList({ user }) {
  const [activeBuilds, setActiveBuilds] = useState([]);
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [lotDetails, setLotDetails] = useState(null);
  const [specs, setSpecs] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailsError, setDetailsError] = useState(null);

  useEffect(() => {
    const fetchActiveBuilds = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/builds/active_builds`);
        setActiveBuilds(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch active builds');
        setLoading(false);
      }
    };
    fetchActiveBuilds();
  }, []);

  useEffect(() => {
    if (selectedBuild) {
      const fetchDetails = async () => {
        setDetailsLoading(true);
        setDetailsError(null);
        try {
          const [lotResponse, specsResponse, inspectionsResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/lots/lots/${selectedBuild.lot_number}`),
            axios.get(`${API_BASE_URL}/lots/specs/by-config-mp/${selectedBuild.config_number}/${selectedBuild.mp_number}`),
            axios.get(`${API_BASE_URL}/inspections/inspection_logs/${selectedBuild.lot_number}/${selectedBuild.mp_number}`)
          ]);
          setLotDetails(lotResponse.data);
          setSpecs(specsResponse.data);
          setInspections(inspectionsResponse.data);
        } catch (err) {
          setDetailsError('Failed to fetch build results');
        } finally {
          setDetailsLoading(false);
        }
      };
      fetchDetails();
    }
  }, [selectedBuild]);

  if (!user || user.role !== 'engineer') {
    return <div className="p-4 text-red-500">You do not have permission to view this page.</div>;
  }

  if (loading) return <div className="p-4">Loading active builds...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="w-1/3 p-4 bg-white shadow-md">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Active Builds</h2>
        <div className="space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {activeBuilds.map(build => (
            <div
              key={build.build_id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedBuild?.build_id === build.build_id ? 'bg-blue-100 border-blue-400' : 'bg-white hover:bg-gray-100'}`}
              onClick={() => setSelectedBuild(build)}
            >
              <p><strong>Build ID:</strong> {build.build_id}</p>
              <p><strong>Username:</strong> {build.username}</p>
              <p><strong>Lot Number:</strong> {build.lot_number}</p>
              <p><strong>Start Time:</strong> {new Date(build.start_time).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="w-2/3 p-4">
        {selectedBuild ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Build Details</h2>
            <div className="mb-4 space-y-1">
              <p><strong>Build ID:</strong> {selectedBuild.build_id}</p>
              <p><strong>Username:</strong> {selectedBuild.username}</p>
              <p><strong>Lot Number:</strong> {selectedBuild.lot_number}</p>
              <p><strong>Config Number:</strong> {selectedBuild.config_number}</p>
              <p><strong>MP Number:</strong> {selectedBuild.mp_number}</p>
              <p><strong>Start Time:</strong> {new Date(selectedBuild.start_time).toLocaleString()}</p>
            </div>

            {detailsLoading ? (
              <p className="text-gray-500">Loading build details...</p>
            ) : detailsError ? (
              <p className="text-red-500">{detailsError}</p>
            ) : lotDetails && specs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-blue-200 rounded-lg shadow-md">
                  <thead>
                    <tr className="bg-blue-100 text-gray-800">
                      <th className="border border-blue-200 px-6 py-3 text-left font-semibold">Sample</th>
                      {specs.map(spec => (
                        <th key={spec.spec_name} className="border border-blue-200 px-6 py-3 text-left font-semibold">
                          {spec.spec_name}{spec.type?.toLowerCase() === 'variable' && ' (Value)'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(lotDetails.quantity).keys()].map(i => {
                      const unitNumber = i + 1;
                      return (
                        <tr key={unitNumber} className="hover:bg-blue-50 transition-colors">
                          <td className="border border-blue-200 px-6 py-3 font-medium">{unitNumber}</td>
                          {specs.map(spec => {
                            const type = spec.type?.toLowerCase();
                            const inspection = inspections.find(ins => ins.unit_number === unitNumber && ins.spec_name === spec.spec_name);
                            return (
                              <td key={spec.spec_name} className="border border-blue-200 px-6 py-3 text-center">
                                {inspection ? (
                                  type === 'variable'
                                    ? (inspection.inspection_value !== null && inspection.inspection_value !== undefined
                                        ? `${parseFloat(inspection.inspection_value).toFixed(4)} ${inspection.pass_fail === "pass" ? '✅' : '❌'}`
                                        : 'N/A')
                                    : inspection.pass_fail === 'pass' ? '✅' : '❌'
                                ) : 'N/A'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No inspection details available for this build.</p>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Select a build to view details.</p>
        )}
      </div>
    </div>
  );
}

export default ActiveBuildsList;
