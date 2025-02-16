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

// Helper to format a Date as 'yyyy-MM-dd'
const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');

// Helper to adjust a date by adding one day (for tab display only)
const adjustDate = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + 1);
  return newDate;
};

// Helper to convert temperature if needed.
const convertTemp = (value: number, tempUnit: 'C' | 'F'): number =>
  tempUnit === 'F' ? value * 9 / 5 + 32 : value;

const HourlyWeatherChart: React.FC<HourlyWeatherChartProps> = ({ hourly, tempUnit }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Use fallback arrays
  const timesArray = hourly.time || [];
  // uniqueDays based on original date strings
  const uniqueDays = Array.from(new Set(timesArray.map((t) => formatDate(new Date(t)))));

  const [selectedDay, setSelectedDay] = useState<string>(uniqueDays[0] || '');
  // Supported chart types: line, bar, scatter, bubble, radar, pie, doughnut, polarArea
  const [chartType, setChartType] = useState<string>('line');

  useEffect(() => {
    if (!selectedDay) return;

    // Fallback arrays for safety
    const timesData = hourly.time || [];
    const temperaturesData = hourly.temperature_2m || [];
    const snowfallsData = hourly.snowfall || [];
    const rainsData = hourly.rain || [];
    const showersDataArray = hourly.showers || [];

    // Filter data for the selected day (using original dates)
    const times: Date[] = [];
    const temperatures: number[] = [];
    const snowfalls: number[] = [];
    const rains: number[] = [];
    const showers: number[] = [];

    for (let i = 0; i < timesData.length; i++) {
      const currentDate = new Date(timesData[i]);
      if (formatDate(currentDate) === selectedDay) {
        times.push(currentDate);
        temperatures.push(temperaturesData[i]);
        snowfalls.push(snowfallsData[i]);
        rains.push(rainsData[i]);
        showers.push(showersDataArray[i]);
      }
    }

    // Destroy any previous chart instance.
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current?.getContext('2d');
    if (!ctx) return;

    let chartData: any;
    let options: any = {};

    // We'll switch on the selected chart type.
    switch (chartType) {
      // Time-series charts: each will display 4 datasets.
      case 'line':
      case 'bar': {
        chartData = {
          labels: times,
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: temperatures.map((val) => convertTemp(val, tempUnit)),
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              tension: 0.3,
              yAxisID: 'yTemp',
            },
            {
              label: 'Snowfall (cm)',
              data: snowfalls.map((val) => 2 + val * 10),
              borderColor: 'rgba(255, 206, 86, 1)',
              backgroundColor: 'rgba(255, 206, 86, 0.2)',
              tension: 0.3,
              yAxisID: 'yFixed',
            },
            {
              label: 'Rain (mm)',
              data: rains.map((val) => 7 + val * 3),
              borderColor: 'rgba(255, 159, 64, 1)',
              backgroundColor: 'rgba(255, 159, 64, 0.2)',
              tension: 0.3,
              yAxisID: 'yFixed',
            },
            {
              label: 'Showers (mm)',
              data: showers.map((val) => 8 + val * 3),
              borderColor: 'rgba(201, 203, 207, 1)',
              backgroundColor: 'rgba(201, 203, 207, 0.2)',
              tension: 0.3,
              yAxisID: 'yFixed',
            },
          ],
        };

        options = {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'hour',
                tooltipFormat: 'EEE, MMM d, yyyy, h:mm a',
                displayFormats: { hour: 'h a' },
              },
              title: { display: true, text: 'Date & Time' },
              ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 },
            },
            yTemp: {
              type: 'linear',
              position: 'left',
              title: { display: true, text: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})` },
            },
            yFixed: {
              type: 'linear',
              position: 'right',
              min: 0,
              max: 10,
              grid: { drawOnChartArea: false },
              ticks: {
                stepSize: 1,
                callback: (value: number) => {
                  const fixedLabels: { [key: number]: string } = {
                    2: 'Snowfall (cm)',
                    7: 'Rain (mm)',
                    8: 'Showers (mm)',
                  };
                  return fixedLabels[value] || '';
                },
              },
              title: { display: true, text: 'Other Variables (normalized)' },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  let label = context.dataset.label || '';
                  if (label) label += ': ';
                  if (context.parsed.y !== null) label += context.parsed.y.toFixed(2);
                  return label;
                },
              },
            },
            legend: { position: 'top' },
          },
        };
        break;
      }
      case 'scatter': {
        // For scatter, each dataset is mapped to {x, y} points.
        chartData = {
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: times.map((t, i) => ({
                x: t,
                y: convertTemp(temperatures[i], tempUnit),
              })),
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
            },
            {
              label: 'Snowfall (cm)',
              data: times.map((t, i) => ({ x: t, y: 2 + snowfalls[i] * 10 })),
              backgroundColor: 'rgba(255, 206, 86, 0.6)',
            },
            {
              label: 'Rain (mm)',
              data: times.map((t, i) => ({ x: t, y: 7 + rains[i] * 3 })),
              backgroundColor: 'rgba(255, 159, 64, 0.6)',
            },
            {
              label: 'Showers (mm)',
              data: times.map((t, i) => ({ x: t, y: 8 + showers[i] * 3 })),
              backgroundColor: 'rgba(201, 203, 207, 0.6)',
            },
          ],
        };

        options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              title: { display: true, text: 'Time' },
            },
            y: {
              type: 'linear',
              title: { display: true, text: `Value (${tempUnit === 'F' ? '°F' : '°C'})` },
            },
          },
          plugins: { legend: { position: 'top' } },
        };
        break;
      }
      case 'bubble': {
        // For bubble, we use the same datasets as scatter but with a fixed radius (or computed if desired)
        chartData = {
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: times.map((t, i) => ({
                x: t,
                y: convertTemp(temperatures[i], tempUnit),
                r: 5,
              })),
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
            },
            {
              label: 'Snowfall (cm)',
              data: times.map((t, i) => ({
                x: t,
                y: 2 + snowfalls[i] * 10,
                r: 5,
              })),
              backgroundColor: 'rgba(255, 206, 86, 0.6)',
            },
            {
              label: 'Rain (mm)',
              data: times.map((t, i) => ({
                x: t,
                y: 7 + rains[i] * 3,
                r: 5,
              })),
              backgroundColor: 'rgba(255, 159, 64, 0.6)',
            },
            {
              label: 'Showers (mm)',
              data: times.map((t, i) => ({
                x: t,
                y: 8 + showers[i] * 3,
                r: 5,
              })),
              backgroundColor: 'rgba(201, 203, 207, 0.6)',
            },
          ],
        };

        options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              title: { display: true, text: 'Time' },
            },
            y: {
              type: 'linear',
              title: { display: true, text: `Value (${tempUnit === 'F' ? '°F' : '°C'})` },
            },
          },
          plugins: { legend: { position: 'top' } },
        };
        break;
      }
      case 'radar': {
        // For radar, we'll use the hour labels (formatted) as the common labels.
        // Note: Radar charts are best with fewer points.
        const radarLabels = times.map((t) => format(t, 'ha'));
        chartData = {
          labels: radarLabels,
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: temperatures.map((val) => convertTemp(val, tempUnit)),
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
            },
            {
              label: 'Snowfall (cm)',
              data: snowfalls.map((val) => 2 + val * 10),
              borderColor: 'rgba(255, 206, 86, 1)',
              backgroundColor: 'rgba(255, 206, 86, 0.2)',
            },
            {
              label: 'Rain (mm)',
              data: rains.map((val) => 7 + val * 3),
              borderColor: 'rgba(255, 159, 64, 1)',
              backgroundColor: 'rgba(255, 159, 64, 0.2)',
            },
            {
              label: 'Showers (mm)',
              data: showers.map((val) => 8 + val * 3),
              borderColor: 'rgba(201, 203, 207, 1)',
              backgroundColor: 'rgba(201, 203, 207, 0.2)',
            },
          ],
        };

        options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: { r: { beginAtZero: true } },
          plugins: { legend: { position: 'top' } },
        };
        break;
      }
      // For pie, doughnut, and polarArea, we aggregate the data for each metric.
      case 'pie':
      case 'doughnut':
      case 'polarArea': {
        const count = temperatures.length;
        const avgTemp =
          count > 0
            ? temperatures.reduce((sum, val) => sum + convertTemp(val, tempUnit), 0) / count
            : 0;
        const totalSnowfall = snowfalls.reduce((sum, val) => sum + val, 0);
        const totalRain = rains.reduce((sum, val) => sum + val, 0);
        const totalShowers = showers.reduce((sum, val) => sum + val, 0);

        chartData = {
          labels: ['Temperature', 'Snowfall', 'Rain', 'Showers'],
          datasets: [
            {
              label: `Aggregated Data for ${selectedDay}`,
              data: [avgTemp, totalSnowfall, totalRain, totalShowers],
              backgroundColor: [
                'rgba(255, 99, 132, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(201, 203, 207, 0.6)',
              ],
              borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(201, 203, 207, 1)',
              ],
              borderWidth: 1,
            },
          ],
        };

        options = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
        };
        break;
      }
      default:
        break;
    }

    // Create the new chart with the chosen type.
    chartInstanceRef.current = new Chart(ctx, {
      type: chartType as any,
      data: chartData,
      options,
    });

    // Cleanup: destroy the chart on dependency changes.
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [hourly, tempUnit, selectedDay, chartType]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mt-8 mb-20 w-full"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-brand-900 dark:text-slate-200">
          7 Day Hourly Weather Chart
        </h3>
        <div className="flex items-center">
          <label htmlFor="chartType" className="mr-2 font-medium">
            Chart Type:
          </label>
          <select
            id="chartType"
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="border rounded p-1"
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="scatter">Scatter</option>
            <option value="bubble">Bubble</option>
            <option value="radar">Radar</option>
            <option value="pie">Pie (Aggregated)</option>
            <option value="doughnut">Doughnut (Aggregated)</option>
            <option value="polarArea">Polar Area (Aggregated)</option>
          </select>
        </div>
      </div>

      {/* Day Tabs (with display date adjusted by one day) */}
      <div className="mb-4 flex space-x-2 overflow-x-auto whitespace-nowrap">
        {uniqueDays.map((day) => {
          const dateObj = new Date(day);
          const displayDate = adjustDate(dateObj);
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
              <span>{format(displayDate, 'EEE')}</span>
              <span>{format(displayDate, 'MM/dd')}</span>
            </button>
          );
        })}
      </div>

      {/* Chart Container */}
      <div className="relative overflow-x-auto">
        <div className="min-w-[800px] h-[400px]">
          <canvas ref={chartRef} />
        </div>
      </div>
    </motion.div>
  );
};

export default HourlyWeatherChart;
