import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export default function ParetoChart({ data }) {
    if (!data || data.length === 0) {
        return <div className="flex h-full items-center justify-center text-slate-400">No reject data to display a Pareto chart.</div>;
    }

    const totalDefects = data.reduce((sum, item) => sum + item.count, 0);
    let cumulativePercentage = 0;
    const cumulativeData = data.map(item => {
        cumulativePercentage += (item.count / totalDefects) * 100;
        return cumulativePercentage;
    });

    const chartData = {
        labels: data.map(d => d.reject_code),
        datasets: [
            {
                type: 'bar',
                label: 'Reject Count',
                data: data.map(d => d.count),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1,
                yAxisID: 'y',
            },
            {
                type: 'line',
                label: 'Cumulative %',
                data: cumulativeData,
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: 'rgb(239, 68, 68)',
                yAxisID: 'y1',
                tension: 0.1,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Pareto Chart of Reject Types' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.dataset.type === 'line') {
                            label += context.parsed.y.toFixed(1) + '%';
                        } else {
                            label += context.parsed.y;
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Count'
                },
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                min: 0,
                max: 100,
                grid: {
                    drawOnChartArea: false, // only-show-the-y-axis
                },
                ticks: {
                    callback: function(value) {
                        return value + "%"
                    }
                },
                title: {
                    display: true,
                    text: 'Cumulative Percentage'
                }
            },
        },
    };

    return <Bar data={chartData} options={options} />;
}
