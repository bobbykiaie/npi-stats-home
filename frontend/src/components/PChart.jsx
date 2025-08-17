import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export default function PChart({ data, onClick }) { // Add onClick to props
    if (!data || data.length === 0) {
        return <div className="flex h-full items-center justify-center text-slate-400">Not enough data to display a p-chart.</div>;
    }

    const totalFailed = data.reduce((sum, lot) => sum + (lot.proportion_failed * lot.total_inspected), 0);
    const totalInspected = data.reduce((sum, lot) => sum + lot.total_inspected, 0);
    const pBar = totalInspected > 0 ? totalFailed / totalInspected : 0;

    const avgSampleSize = totalInspected / data.length;
    const sigma = avgSampleSize > 0 ? Math.sqrt((pBar * (1 - pBar)) / avgSampleSize) : 0;
    const ucl = pBar + 3 * sigma;
    const lcl = Math.max(0, pBar - 3 * sigma);

    const chartData = {
        labels: data.map(d => d.lot_number),
        datasets: [
            {
                label: 'Proportion Failed',
                data: data.map(d => d.proportion_failed),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.1,
            },
            {
                label: 'Center Line (p-bar)',
                data: Array(data.length).fill(pBar),
                borderColor: 'rgb(16, 185, 129)',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0
            },
            {
                label: 'UCL',
                data: Array(data.length).fill(ucl),
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 2,
                pointRadius: 0,
            },
            {
                label: 'LCL',
                data: Array(data.length).fill(lcl),
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 2,
                pointRadius: 0
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        // --- THIS IS THE NEW PART ---
        onHover: (event, chartElement) => {
          event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        },
        onClick: (evt, elements) => {
            if (elements.length > 0 && onClick) {
              const dataIndex = elements[0].index;
              onClick(dataIndex);
            }
        },
        // --- END OF NEW PART ---
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'P-Chart: Proportion of Defective Units per Lot' }
        },
        scales: {
            y: {
                title: { display: true, text: 'Proportion Failed' },
                min: 0,
                max: Math.min(1, ucl * 1.2) 
            },
            x: {
                title: { display: true, text: 'Lot Number' }
            }
        }
    };

    return <Line data={chartData} options={options} />;
}