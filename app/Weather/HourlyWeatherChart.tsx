import React, { useRef, useEffect, useState } from 'react';
import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface HourlyData {
  time: string[];
  temperature_2m: number[];
  snowfall: number[];
  rain: number[];
  showers: number[];
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

  // Use date-fns to format a Date to local 'yyyy-MM-dd' (instead of using toISOString())
  const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');

  // Compute unique days from the hourly time data.
  const uniqueDays = Array.from(
    new Set((hourly.time || []).map((t) => formatDate(new Date(t))))
  );

  // State to track the selected day. Default to the first available day.
  const [selectedDay, setSelectedDay] = useState<string>(uniqueDays[0] || '');

  // Fixed baseline labels for the yFixed axis.
  const fixedLabels: { [key: number]: string } = {
    2: 'Snowfall (cm)',
    7: 'Rain (mm)',
    8: 'Showers (mm)',
  };

  useEffect(() => {
    if (!selectedDay) return;

    // Use fallback arrays for safety.
    const times = hourly.time || [];
    const temperatures = hourly.temperature_2m || [];
    const snowfalls = hourly.snowfall || [];
    const rains = hourly.rain || [];
    const showersData = hourly.showers || [];

    // Filter the hourly data for the selected day.
    const filteredTimes: Date[] = [];
    const filteredTemperature: number[] = [];
    const filteredSnowfall: number[] = [];
    const filteredRain: number[] = [];
    const filteredShowers: number[] = [];

    for (let i = 0; i < times.length; i++) {
      const currentDate = new Date(times[i]);
      if (formatDate(currentDate) === selectedDay) {
        filteredTimes.push(currentDate);
        filteredTemperature.push(temperatures[i]);
        filteredSnowfall.push(snowfalls[i]);
        filteredRain.push(rains[i]);
        filteredShowers.push(showersData[i]);
      }
    }

    // Build datasets for all metrics.
    const datasets = [
      {
        label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
        data: filteredTemperature.map((val) => convertTemp(val)),
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.3,
        yAxisID: 'yTemp',
      },
      {
        label: 'Snowfall (cm)',
        data: filteredSnowfall.map((val) => 2 + val * 10), // Normalized with a base offset of 2.
        borderColor: 'rgba(255, 206, 86, 1)',
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        tension: 0.3,
        yAxisID: 'yFixed',
      },
      {
        label: 'Rain (mm)',
        data: filteredRain.map((val) => 7 + val * 3), // Normalized with a base offset of 7.
        borderColor: 'rgba(255, 159, 64, 1)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
        tension: 0.3,
        yAxisID: 'yFixed',
      },
      {
        label: 'Showers (mm)',
        data: filteredShowers.map((val) => 8 + val * 3), // Normalized with a base offset of 8.
        borderColor: 'rgba(201, 203, 207, 1)',
        backgroundColor: 'rgba(201, 203, 207, 0.2)',
        tension: 0.3,
        yAxisID: 'yFixed',
      },
    ];

    // Destroy any previous chart instance.
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx) return;

    // Create a new Chart.
    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filteredTimes,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              tooltipFormat: 'EEE, MMM d, yyyy, h:mm a',
              displayFormats: {
                hour: 'h a',
              },
            },
            title: {
              display: true,
              text: 'Date & Time',
            },
            ticks: {
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
            },
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
            },
          },
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
              callback: function (value) {
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
              label: function (context) {
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

    // Cleanup: Destroy chart on unmount or when dependencies change.
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [hourly, tempUnit, selectedDay]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mt-8 mb-20 w-full"
    >
      <h3 className="text-xl font-semibold text-brand-900 dark:text-slate-200 mb-4">
       7 Day Hourly Weather Chart
      </h3>

      {/* Day Tabs (scrollable on mobile) */}
      <div className="mb-4 flex space-x-2 overflow-x-auto whitespace-nowrap">
        {uniqueDays.map((day) => {
          const dateObj = new Date(day);
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-2 border rounded flex flex-col items-center text-xs min-w-[60px] ${
                selectedDay === day
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                  : 'bg-white text-black dark:bg-indigo-900 dark:text-slate-200'
              }`}
            >
              <span>{format(dateObj, 'EEE')}</span>
              <span>{format(dateObj, 'MM/dd')}</span>
            </button>
          );
        })}
      </div>

      {/* Chart Container (horizontally scrollable on mobile) */}
      <div className="relative overflow-x-auto">
        {/* Set a min-width to allow horizontal scrolling on small screens */}
        <div className="min-w-[800px] h-[400px]">
          <canvas ref={chartRef} />
        </div>
      </div>
    </motion.div>
  );
};

export default HourlyWeatherChart;
