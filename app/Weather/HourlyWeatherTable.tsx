// app/Weather/components/HourlyWeatherTable.tsx

import React from 'react';
import { motion } from 'framer-motion';

interface HourlyData {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  precipitation: number[];
  rain: number[];
  showers: number[];
  snowfall: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  cloud_cover: number[];
  visibility: number[];
  lightning_potential: number[];
}

interface HourlyWeatherTableProps {
  hourly: HourlyData;
}

const HourlyWeatherTable: React.FC<HourlyWeatherTableProps> = ({ hourly }) => {
  return (
    <div className="overflow-x-auto mt-8">
      <h3 className="text-xl font-semibold text-brand-900 dark:text-slate-200 mb-4">
        Hourly Weather Details
      </h3>
      <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Time</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Temp (°C)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">RH (%)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Dew Point (°C)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Apparent Temp (°C)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Precip Prob (%)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Precip (mm)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Rain (mm)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Showers (mm)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Snowfall (cm)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Wind Speed (km/h)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Wind Dir (°)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Wind Gust (km/h)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Cloud Cover (%)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Visibility (m)</th>
            <th className="px-2 py-2 text-xs font-medium text-gray-500">Lightning Pot (J/kg)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {hourly.time.map((time, index) => (
            <motion.tr
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: index * 0.01 }}
              className="text-xs text-gray-700"
            >
              <td className="px-2 py-1 whitespace-nowrap">
                {new Date(time).toLocaleString()}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.temperature_2m[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.relative_humidity_2m[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.dew_point_2m[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.apparent_temperature[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.precipitation_probability[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.precipitation[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.rain[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.showers[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.snowfall[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.wind_speed_10m[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.wind_direction_10m[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.wind_gusts_10m[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.cloud_cover[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.visibility[index]}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {hourly.lightning_potential[index]}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HourlyWeatherTable;
