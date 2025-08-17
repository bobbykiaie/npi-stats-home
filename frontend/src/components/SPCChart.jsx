import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const SPCChart = ({ data, labels, chartType }) => {
  if (!data || data.length === 0) {
    return <p>No data available</p>;
  }

  // Calculate Mean and Control Limits (UCL, LCL)
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const stdDev = Math.sqrt(
    data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
  );
  const ucl = mean + 3 * stdDev;
  const lcl = mean - 3 * stdDev;

  const chartData = {
    labels,
    datasets: [
      {
        label: chartType === "X̄-R" ? "X̄ (Mean)" : "Individual Measurements",
        data,
        borderColor: "blue",
        borderWidth: 2,
        fill: false,
      },
      {
        label: "UCL (Upper Control Limit)",
        data: Array(labels.length).fill(ucl),
        borderColor: "red",
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
      },
      {
        label: "LCL (Lower Control Limit)",
        data: Array(labels.length).fill(lcl),
        borderColor: "red",
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
      },
      {
        label: "Mean (Center Line)",
        data: Array(labels.length).fill(mean),
        borderColor: "green",
        borderWidth: 2,
        borderDash: [2, 2],
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: `${chartType} Control Chart` },
    },
    scales: {
      y: { beginAtZero: false },
    },
  };

  return <Line data={chartData} options={options} />;
};

export default SPCChart;
