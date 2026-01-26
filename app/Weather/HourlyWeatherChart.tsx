"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { format } from "date-fns";
import { motion } from "framer-motion";

import { chartColorsRgba, gridColors } from "@/utils/colors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface HourlyData {
  time: string[];
  temperature_2m: number[];
  snowfall: number[];
  rain: number[];
  showers: number[];
}

interface HourlyWeatherChartProps {
  hourly: HourlyData;
  tempUnit: "C" | "F";
}

type TempUnit = "C" | "F";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CM_TO_INCHES = 2.54;
const MM_TO_INCHES = 25.4;

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */
function toF(c: number): number {
  return (c * 9) / 5 + 32;
}

function convertTemp(value: number, tempUnit: TempUnit): number {
  return tempUnit === "F" ? toF(value) : value;
}

function convertSnowfallDisplay(value: number, tempUnit: TempUnit): number {
  return tempUnit === "F" ? 2 + (value / CM_TO_INCHES) * 10 : 2 + value * 10;
}

function convertRainDisplay(value: number, tempUnit: TempUnit): number {
  return tempUnit === "F" ? 7 + (value / MM_TO_INCHES) * 3 : 7 + value * 3;
}

function convertShowersDisplay(value: number, tempUnit: TempUnit): number {
  return tempUnit === "F" ? 8 + (value / MM_TO_INCHES) * 3 : 8 + value * 3;
}

function convertSnowfallAggregate(value: number, tempUnit: TempUnit): number {
  return tempUnit === "F" ? value / CM_TO_INCHES : value;
}

function convertPrecipAggregate(value: number, tempUnit: TempUnit): number {
  return tempUnit === "F" ? value / MM_TO_INCHES : value;
}

/* ------------------------------------------------------------------ */
/*  HourlyWeatherChart Component                                       */
/* ------------------------------------------------------------------ */
export default function HourlyWeatherChart({ hourly, tempUnit }: HourlyWeatherChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<Chart | null>(null)

  const timesArray = hourly.time || []

  // ✅ Avoid timezone shifting: use raw YYYY-MM-DD from API string
const uniqueDays = useMemo(() => {
  return Array.from(new Set((timesArray || []).map((t) => String(t).split('T')[0])))
}, [timesArray])


  const [selectedDay, setSelectedDay] = useState<string>(uniqueDays[0] || '')
  const [chartType, setChartType] = useState<string>('line')

  // keep selectedDay in sync if hourly changes
  useEffect(() => {
    if (!selectedDay && uniqueDays[0]) setSelectedDay(uniqueDays[0])
    if (selectedDay && uniqueDays.length && !uniqueDays.includes(selectedDay)) setSelectedDay(uniqueDays[0])
  }, [uniqueDays, selectedDay])

  useEffect(() => {
    if (!selectedDay) return

    const timesData = hourly.time || []
    const temperaturesData = hourly.temperature_2m || []
    const snowfallsData = hourly.snowfall || []
    const rainsData = hourly.rain || []
    const showersDataArray = hourly.showers || []

    const times: Date[] = []
    const temperatures: number[] = []
    const snowfalls: number[] = []
    const rains: number[] = []
    const showers: number[] = []

    for (let i = 0; i < timesData.length; i++) {
  const dayKey = String(timesData[i]).split('T')[0] // ✅ raw YYYY-MM-DD
  if (dayKey === selectedDay) {
    const currentDate = new Date(timesData[i]) // keep Date for chart x-axis
    times.push(currentDate)
    temperatures.push(temperaturesData[i])
    snowfalls.push(snowfallsData[i])
    rains.push(rainsData[i])
    showers.push(showersDataArray[i])
  }
}


    if (chartInstanceRef.current) chartInstanceRef.current.destroy()

    const ctx = chartRef.current?.getContext('2d')
    if (!ctx) return

    let chartData: any
    let options: any = {}

    switch (chartType) {
      case 'line':
      case 'bar': {
        chartData = {
          labels: times,
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: temperatures.map((val) => convertTemp(val, tempUnit)),
              borderColor: chartColorsRgba.temperature.solid,
              backgroundColor: chartColorsRgba.temperature.light,
              tension: 0.3,
              yAxisID: 'yTemp',
            },
            {
              label: `Snowfall (${tempUnit === 'F' ? 'in' : 'cm'})`,
              data: snowfalls.map((val) => convertSnowfallDisplay(val, tempUnit)),
              borderColor: chartColorsRgba.snowfall.solid,
              backgroundColor: chartColorsRgba.snowfall.light,
              tension: 0.3,
              yAxisID: 'yFixed',
            },
            {
              label: `Rain (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: rains.map((val) => convertRainDisplay(val, tempUnit)),
              borderColor: chartColorsRgba.rain.solid,
              backgroundColor: chartColorsRgba.rain.light,
              tension: 0.3,
              yAxisID: 'yFixed',
            },
            {
              label: `Showers (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: showers.map((val) => convertShowersDisplay(val, tempUnit)),
              borderColor: chartColorsRgba.showers.solid,
              backgroundColor: chartColorsRgba.showers.light,
              tension: 0.3,
              yAxisID: 'yFixed',
            },
          ],
        }

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
              ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 },
              grid: { color: gridColors.dark },
            },
            yTemp: {
              type: 'linear',
              position: 'left',
              title: { display: true, text: `Temp (${tempUnit === 'F' ? '°F' : '°C'})` },
              grid: { color: gridColors.dark },
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
                    2: `Snow`,
                    7: `Rain`,
                    8: `Showers`,
                  }
                  return fixedLabels[value] || ''
                },
              },
              title: { display: true, text: 'Precip (normalized)' },
            },
          },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  let label = context.dataset.label || ''
                  if (label) label += ': '
                  if (context.parsed.y !== null) label += context.parsed.y.toFixed(2)
                  return label
                },
              },
            },
          },
        }
        break
      }

      case 'scatter': {
        chartData = {
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: times.map((t, i) => ({ x: t, y: convertTemp(temperatures[i], tempUnit) })),
              backgroundColor: chartColorsRgba.temperature.medium,
            },
            {
              label: `Snowfall (${tempUnit === 'F' ? 'in' : 'cm'})`,
              data: times.map((t, i) => ({ x: t, y: convertSnowfallDisplay(snowfalls[i], tempUnit) })),
              backgroundColor: chartColorsRgba.snowfall.medium,
            },
            {
              label: `Rain (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: times.map((t, i) => ({ x: t, y: convertRainDisplay(rains[i], tempUnit) })),
              backgroundColor: chartColorsRgba.rain.medium,
            },
            {
              label: `Showers (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: times.map((t, i) => ({ x: t, y: convertShowersDisplay(showers[i], tempUnit) })),
              backgroundColor: chartColorsRgba.showers.medium,
            },
          ],
        }
        options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'time', grid: { color: gridColors.dark } },
            y: { grid: { color: gridColors.dark } },
          },
          plugins: { legend: { position: 'top' } },
        }
        break
      }

      case 'bubble': {
        chartData = {
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: times.map((t, i) => ({ x: t, y: convertTemp(temperatures[i], tempUnit), r: 5 })),
              backgroundColor: chartColorsRgba.temperature.medium,
            },
            {
              label: `Snowfall (${tempUnit === 'F' ? 'in' : 'cm'})`,
              data: times.map((t, i) => ({ x: t, y: convertSnowfallDisplay(snowfalls[i], tempUnit), r: 5 })),
              backgroundColor: chartColorsRgba.snowfall.medium,
            },
            {
              label: `Rain (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: times.map((t, i) => ({ x: t, y: convertRainDisplay(rains[i], tempUnit), r: 5 })),
              backgroundColor: chartColorsRgba.rain.medium,
            },
            {
              label: `Showers (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: times.map((t, i) => ({ x: t, y: convertShowersDisplay(showers[i], tempUnit), r: 5 })),
              backgroundColor: chartColorsRgba.showers.medium,
            },
          ],
        }
        options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'time', grid: { color: gridColors.dark } },
            y: { grid: { color: gridColors.dark } },
          },
          plugins: { legend: { position: 'top' } },
        }
        break
      }

      case 'radar': {
        const radarLabels = times.map((t) => format(t, 'ha'))
        chartData = {
          labels: radarLabels,
          datasets: [
            {
              label: `Temperature (${tempUnit === 'F' ? '°F' : '°C'})`,
              data: temperatures.map((val) => convertTemp(val, tempUnit)),
              borderColor: chartColorsRgba.temperature.solid,
              backgroundColor: chartColorsRgba.temperature.light,
            },
            {
              label: `Snowfall (${tempUnit === 'F' ? 'in' : 'cm'})`,
              data: snowfalls.map((val) => convertSnowfallDisplay(val, tempUnit)),
              borderColor: chartColorsRgba.snowfall.solid,
              backgroundColor: chartColorsRgba.snowfall.light,
            },
            {
              label: `Rain (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: rains.map((val) => convertRainDisplay(val, tempUnit)),
              borderColor: chartColorsRgba.rain.solid,
              backgroundColor: chartColorsRgba.rain.light,
            },
            {
              label: `Showers (${tempUnit === 'F' ? 'in' : 'mm'})`,
              data: showers.map((val) => convertShowersDisplay(val, tempUnit)),
              borderColor: chartColorsRgba.showers.solid,
              backgroundColor: chartColorsRgba.showers.light,
            },
          ],
        }
        options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: { r: { beginAtZero: true } },
          plugins: { legend: { position: 'top' } },
        }
        break
      }

      case 'pie':
      case 'doughnut':
      case 'polarArea': {
        const count = temperatures.length
        const avgTemp = count > 0 ? temperatures.reduce((sum, val) => sum + convertTemp(val, tempUnit), 0) / count : 0
        const totalSnowfall = snowfalls.reduce((sum, val) => sum + convertSnowfallAggregate(val, tempUnit), 0)
        const totalRain = rains.reduce((sum, val) => sum + convertPrecipAggregate(val, tempUnit), 0)
        const totalShowers = showers.reduce((sum, val) => sum + convertPrecipAggregate(val, tempUnit), 0)

        const aggregatedLabels = [
          `Avg Temp (${tempUnit === 'F' ? '°F' : '°C'})`,
          `Snowfall (${tempUnit === 'F' ? 'in' : 'cm'})`,
          `Rain (${tempUnit === 'F' ? 'in' : 'mm'})`,
          `Showers (${tempUnit === 'F' ? 'in' : 'mm'})`,
        ]

        chartData = {
          labels: aggregatedLabels,
          datasets: [
            {
              label: `Aggregated for ${selectedDay}`,
              data: [avgTemp, totalSnowfall, totalRain, totalShowers],
              backgroundColor: [
                chartColorsRgba.temperature.medium,
                chartColorsRgba.snowfall.medium,
                chartColorsRgba.rain.medium,
                chartColorsRgba.showers.medium,
              ],
              borderWidth: 1,
            },
          ],
        }

        options = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
        }
        break
      }

      default:
        return
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: chartType as any,
      data: chartData,
      options,
    })

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy()
    }
  }, [hourly, tempUnit, selectedDay, chartType])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="w-full">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-extrabold dark:text-white">Hourly Chart</h3>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor="chartType" className="text-xs font-bold dark:text-white/70">
            Chart
          </label>
          <select
            id="chartType"
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="rounded-xl border border-white/10 dark:bg-black/30 px-3 py-2 text-xs font-bold dark:text-white outline-none
                       hover:dark:bg-black/40 focus:border-white/25"
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="scatter">Scatter</option>
            <option value="bubble">Bubble</option>
            <option value="radar">Radar</option>
            <option value="pie">Pie (Aggregated)</option>
            <option value="doughnut">Doughnut (Aggregated)</option>
            <option value="polarArea">Polar (Aggregated)</option>
          </select>
        </div>
      </div>

      {/* Day tabs */}
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto whitespace-nowrap">
        {uniqueDays.map((day) => {
  // day is "YYYY-MM-DD"
  const displayDate = new Date(`${day}T12:00:00`) // ✅ prevents previous-day shift
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
  )
})}

      </div>

      {/* Chart */}
      <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-white/ bg-black/5 p-3 sm:h-[420px]">
        <canvas ref={chartRef} />
      </div>
    </motion.div>
  )
}
