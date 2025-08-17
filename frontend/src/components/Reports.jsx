import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import API_BASE_URL from './api';

export default function Reports({ user }) {
  /* ───────── access control ───────── */
  if (!user || user.role !== 'engineer') {
    return (
      <div className="p-4 text-red-500">
        You do not have permission to view this page.
      </div>
    );
  }

  /* ───────── state ───────── */
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfigNum, setSelectedConfigNum] = useState('');
  const [inspectionLogs, setInspectionLogs]   = useState([]);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* ───────── 1. fetch products (+ their configs) once ───────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/products`, {
          withCredentials: true,
        });

        const allConfigs = data.flatMap((product) =>
          product.configurations.map((cfg) => ({
            ...cfg,
            product_name: product.product_name,
          }))
        );
        setConfigurations(allConfigs);
      } catch (err) {
        setError('Failed to fetch products and configurations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ───────── 2. fetch logs whenever a config is chosen ───────── */
  useEffect(() => {
    if (!selectedConfigNum) {
      setInspectionLogs([]);
      return;
    }

    (async () => {
      try {
        /* FIXED ENDPOINT ↓↓↓ */
        const { data } = await axios.get(
          `${API_BASE_URL}/inspections/inspection-logs/${selectedConfigNum}`,
          { withCredentials: true }
        );

        setInspectionLogs(data.inspection_logs || []);
      } catch (err) {
        setError('Failed to fetch inspection logs.');
        setInspectionLogs([]);
      }
    })();
  }, [selectedConfigNum]);

  /* ───────── 3. excel download ───────── */
  const downloadExcel = () => {
    if (!selectedConfigNum || inspectionLogs.length === 0) {
      alert('No data available to download.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(inspectionLogs);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'InspectionLogs');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob   = new Blob([buffer], {
      type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    saveAs(blob, `${selectedConfigNum}_InspectionReport.xlsx`);
  };

  /* ───────── ui ───────── */
  if (loading) return <p className="p-4">Loading data…</p>;
  if (error)   return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Reports</h1>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <label
          htmlFor="config-select"
          className="block text-lg font-medium mb-2 text-gray-700"
        >
          Select a Product Configuration:
        </label>

        <select
          id="config-select"
          className="p-3 border border-gray-300 rounded-lg w-full mb-6"
          value={selectedConfigNum}
          onChange={(e) => setSelectedConfigNum(e.target.value)}
        >
          <option value="">-- Select --</option>
          {configurations.map((cfg) => (
            <option key={cfg.config_number} value={cfg.config_number}>
              {cfg.product_name} – {cfg.config_name} ({cfg.config_number})
            </option>
          ))}
        </select>

        {selectedConfigNum && (
          <button
            onClick={downloadExcel}
            disabled={inspectionLogs.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
          >
            {inspectionLogs.length > 0
              ? `Download Excel for ${selectedConfigNum}`
              : 'No Logs to Download'}
          </button>
        )}
      </div>
    </div>
  );
}
