import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { motion } from 'framer-motion';

interface HourlyData {
  time: string[];
  temperature_2m: number[];
  precipitation: number[];
  snowfall: number[];
  relative_humidity_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  rain: number[];
  showers: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  cloud_cover: number[];
  visibility: number[];
  lightning_potential: number[];
}

interface HourlyWeatherChartProps {
  hourly: HourlyData;
  tempUnit: 'C' | 'F';
}

const HourlyWeatherChart: React.FC<HourlyWeatherChartProps> = ({ hourly, tempUnit }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Helper: Convert temperature if needed.
  const convertTemp = (value: number) => (tempUnit === 'F' ? value * 9 / 5 + 32 : value);

  // Build datasets using fallback empty arrays to prevent undefined.map errors
  const datasets = [
    {
      label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
      data: (hourly.temperature_2m || []).map(val => convertTemp(val)),
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      tension: 0.3,
      yAxisID: 'yTemp',
    },
    {
      label: 'Snowfall (cm)',
      data: (hourly.snowfall || []).map(val => 2 + val * 10),
      borderColor: 'rgba(255, 206, 86, 1)',
      backgroundColor: 'rgba(255, 206, 86, 0.2)',
      tension: 0.3,
      yAxisID: 'yFixed',
    },
    {
      label: 'Rain (mm)',
      data: (hourly.rain || []).map(val => 7 + val * 3),
      borderColor: 'rgba(255, 159, 64, 1)',
      backgroundColor: 'rgba(255, 159, 64, 0.2)',
      tension: 0.3,
      yAxisID: 'yFixed',
    },
    {
      label: 'Showers (mm)',
      data: (hourly.showers || []).map(val => 8 + val * 3),
      borderColor: 'rgba(201, 203, 207, 1)',
      backgroundColor: 'rgba(201, 203, 207, 0.2)',
      tension: 0.3,
      yAxisID: 'yFixed',
    },
  ];

  // Fixed baseline labels for the yFixed axis.
  const fixedLabels: { [key: number]: string } = {
    2: 'Snowfall (cm)',
    7: 'Rain (mm)',
    8: 'Showers (mm)',
  };

  useEffect(() => {
    if (chartRef.current) {
      // Destroy the previous chart instance if it exists
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: (hourly.time || []).map(t => new Date(t)),
          datasets: datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false, // Allow the chart to fill its container
          interaction: {
            mode: 'index',
            intersect: false,
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'hour',
                tooltipFormat: 'PPpp',
              },
              title: {
                display: true,
                text: 'Time',
              },
            },
            // Axis for actual temperature values
            yTemp: {
              type: 'linear',
              position: 'left',
              title: {
                display: true,
                text: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              },
            },
            // Fixed axis for the additional variables
            yFixed: {
              type: 'linear',
              position: 'right',
              min: 0,
              max: 10,
              grid: {
                drawOnChartArea: false,
              },
              ticks: {
                stepSize: 1,
                callback: function(value) {
                  const rounded = Math.round(Number(value));
                  return fixedLabels[rounded] || '';
                },
              },
              title: {
                display: true,
                text: 'Other Variables (normalized)',
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed.y !== null) {
                    label += context.parsed.y.toFixed(2);
                  }
                  return label;
                },
              },
            },
            legend: {
              position: 'top',
            },
          },
        },
      });
    }
    // Cleanup on unmount or when dependencies change
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [hourly, tempUnit]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mt-8 mb-20 w-full" // Ensure full width on mobile
    >
      <h3 className="text-xl font-semibold text-brand-900 dark:text-slate-200 mb-4">
        Hourly Weather Chart
      </h3>
      {/* The container div with relative positioning helps Chart.js fill the space */}
      <div className="relative w-full h-[400px]">
        <canvas ref={chartRef} />
      </div>
    </motion.div>
  );
};

export default HourlyWeatherChart;
