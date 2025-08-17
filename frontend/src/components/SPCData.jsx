import React, { useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export default function SPCData() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [mean, setMean] = useState(0);
  const [ucl, setUcl] = useState(0);
  const [lcl, setLcl] = useState(0);
  const [cpk, setCpk] = useState(null);
  const [chartType, setChartType] = useState("X̄-R"); // New: Chart type selection

  // Mock dataset
  const products = [
    {
      name: "SOFIA",
      MPs: [
        {
          name: "MPSOFIA1",
          inspections: [
            { 
              id: "MPSOFIA1-Diameter", 
              name: "OD", 
              data: [10.5, 9.8, 11.2, 10.3, 8.9, 9.5, 12.1, 10.7, 9.6, 10.2], 
              usl: 10.7, 
              lsl: 9.3, 
              cpk: 0.8 // Low capability
            },
            { 
              id: "MPSOFIA1-WallThickness", 
              name: "Wall Thickness", 
              data: [2.1, 1.9, 2.2, 2.0, 2.05, 2.3, 1.85, 2.1, 1.95, 2.2], 
              usl: 2.15, 
              lsl: 1.85, 
              cpk: 1.2 // Moderate capability
            },
            { 
              id: "MPSOFIA1-Flexibility", 
              name: "Tracking", 
              data: [48, 55, 50, 52, 46, 60, 45, 50, 55, 42], 
              usl: 55, 
              lsl: 45, 
              cpk: 0.6 // Poor capability
            },
          ],
        },
      ],
    },
    {
      name: "WEB",
      MPs: [
        {
          name: "MPWEB1",
          inspections: [
            { 
              id: "MPWEB1-Adhesion", 
              name: "Tensile Strength", 
              data: [30, 32, 28, 31, 27, 35, 34, 30, 26, 33], 
              usl: 34, 
              lsl: 26, 
              cpk: 0.9 // Slightly unstable
            },
            { 
              id: "MPWEB1-SurfaceRoughness", 
              name: "Surface Roughness", 
              data: [0.79, 0.81, 0.75, 0.78, 0.85, 0.72, 0.88, 0.80, 0.74, 0.82], 
              usl: 0.9, 
              lsl: 0.7, 
              cpk: 1.0 // Acceptable capability
            },
          ],
        },
        {
          name: "MPWEB2",
          inspections: [
            { 
              id: "MPWEB2-CoatingThickness", 
              name: "Coating Thickness", 
              data: [4.8, 5.2, 4.5, 4.9, 5.6, 4.3, 5.8, 5.1, 4.7, 5.3], 
              usl: 5.6, 
              lsl: 4.4, 
              cpk: 0.7 // Low capability
            },
          ],
        },
      ],
    },
    {
      name: "WEDGE",
      MPs: [
        {
          name: "MPWEDGE1",
          inspections: [
            { 
              id: "MPWEDGE1-BondStrength", 
              name: "OD", 
              data: [20, 18, 22, 19, 23, 17, 24, 21, 16, 25], 
              usl: 23, 
              lsl: 17, 
              cpk: 0.6 // Poor capability
            },
            { 
              id: "MPWEDGE1-Elasticity", 
              name: "Coating Thickness", 
              data: [14.8, 16.1, 13.5, 15.3, 17.2, 12.9, 18.0, 14.5, 13.8, 16.7], 
              usl: 17, 
              lsl: 13, 
              cpk: 0.8 // Below standard
            },
          ],
        },
        {
          name: "MPWEDGE2",
          inspections: [
            { 
              id: "MPWEDGE2-DeflectionTest", 
              name: "Length", 
              data: [6.8, 7.5, 6.3, 7.1, 8.2, 5.9, 8.5, 7.3, 6.7, 7.8], 
              usl: 8.0, 
              lsl: 6.0, 
              cpk: 0.5 // Very poor capability
            },
          ],
        },
      ],
    },
  ];
  

  

  

  // Handle product selection
  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setSelectedInspectionId(null);
    setChartData([]);
    setCpk(null);
  };

  // Handle inspection selection
const handleInspectionClick = (inspection) => {
  setSelectedInspectionId(inspection.id);
  setChartData(inspection.data);
  setMean(inspection.data.reduce((a, b) => a + b, 0) / inspection.data.length);
  setUcl(inspection.usl);
  setLcl(inspection.lsl);
  setCpk(inspection.cpk.toFixed(2)); // Display calculated Cpk
};


  // New: Chart Type Selection
  const handleChartTypeChange = (e) => {
    setChartType(e.target.value);
  };

  // Dynamic dataset based on chart type
  const datasets = [
    {
      label: selectedInspectionId || "Sample Data",
      data: chartData,
      borderColor: "blue",
      backgroundColor: "rgba(0, 0, 255, 0.1)",
      fill: false,
      tension: 0,
      pointRadius: 6,
    },
    {
      label: "Mean",
      data: Array(chartData.length).fill(mean),
      borderColor: "green",
      borderDash: [5, 5],
    },
    {
      label: "UCL",
      data: Array(chartData.length).fill(ucl),
      borderColor: "red",
      borderDash: [10, 5],
    },
    {
      label: "LCL",
      data: Array(chartData.length).fill(lcl),
      borderColor: "red",
      borderDash: [10, 5],
    },
  ];

  // P Chart: Proportion Defective (Mock)
  if (chartType === "P Chart") {
    datasets.push({
      label: "Defect Rate",
      data: chartData.map((val) => val / 15), // Example scaling
      borderColor: "purple",
      borderDash: [3, 3],
    });
  }

  // C Chart: Count of Defects per Sample (Mock)
// C Chart: Count of Defects per Sample (Corrected)
// Compute Defects Across All Inspections (for C Chart at the Product Level)
const computeTotalDefectsPerSample = () => {
  if (!selectedProduct) return Array(chartData.length).fill(0);

  return chartData.map((_, sampleIndex) => {
    let defectCount = 0;

    selectedProduct.MPs.forEach((mp) => {
      mp.inspections.forEach((inspection) => {
        if (inspection.data[sampleIndex] < inspection.lsl || inspection.data[sampleIndex] > inspection.usl) {
          defectCount++;
        }
      });
    });

    return defectCount; // Total defects in this unit across all inspections
  });
};

// Get total defects across all inspections for each sample
const totalDefectsPerSample = computeTotalDefectsPerSample();

// C Chart: Now Tracks All Defects for a Product (Not Just One Inspection)
if (chartType === "C Chart") {
  datasets.push({
    label: "Defects per Unit (All Inspections)",
    data: totalDefectsPerSample,
    borderColor: "orange",
    backgroundColor: "rgba(255, 165, 0, 0.3)",
    fill: true,
  });
}



  const data = {
    labels: chartData.map((_, index) => `Sample ${index + 1}`),
    datasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: true, position: "top" },
    },
    scales: {
      y: { title: { display: true, text: "Value" } },
      x: { title: { display: true, text: "Samples" } },
    },
  };

  return (
    <div className="flex flex-row min-h-screen">
      <div className="w-1/4 p-4 bg-gray-100">
        <h1 className="text-2xl font-bold mb-4">Products</h1>
        {products.map((product) => (
          <div
            key={product.name}
            onClick={() => handleProductClick(product)}
            className={`p-4 mb-4 cursor-pointer rounded-lg shadow-md ${
              selectedProduct?.name === product.name ? "bg-blue-200" : "bg-white"
            } hover:bg-blue-100`}
          >
            <h2 className="text-xl font-semibold text-center">{product.name}</h2>
          </div>
        ))}

        {selectedProduct && (
          <div>
            <h2 className="text-xl font-bold mt-6 mb-4">{selectedProduct.name} - MPs</h2>
            {selectedProduct.MPs.map((mp) => (
              <div key={mp.name} className="mb-4">
                <h3 className="font-semibold mb-2">{mp.name}</h3>
                {mp.inspections.map((inspection) => (
                  <button
                    key={inspection.id}
                    onClick={() => handleInspectionClick(inspection)}
                    className={`block w-full text-left px-4 py-2 rounded-lg ${
                      selectedInspectionId === inspection.id
                        ? "bg-blue-300"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {inspection.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-grow p-4">
        <h1 className="text-2xl font-bold mb-4">SPC Chart</h1>
        <label>Select Chart Type: </label>
        <select onChange={handleChartTypeChange} value={chartType} className="mb-4">
          <option value="X̄-R">X̄-R Chart</option>
          <option value="I-MR">I-MR Chart</option>
          <option value="P Chart">P Chart</option>
          <option value="C Chart">C Chart</option>
        </select>
        <Line data={data} options={options} />
        {cpk !== null && <p className="mt-4 text-lg font-semibold">Cpk: {cpk}</p>}
      </div>
    </div>
  );
}
