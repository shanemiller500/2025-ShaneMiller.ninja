"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBackgroundImage, getWeatherIcon } from './weatherHelpers';
import { fetchLocationName } from './api';
import { Location, WeatherData } from './types';

import LoadingSpinner from './LoadingSpinner';
import WeatherSlider from './WeatherSlider';
import ToggleSwitch from './ToggleSwitch';
import LeafletMap from './LeafletMap';
import HourlyWeatherChart from './HourlyWeatherChart';

const WeatherPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  // Mark component as mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Merge Leaflet icons (client-only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const L = require('leaflet');
      const markerIconUrl = require('leaflet/dist/images/marker-icon.png');
      const markerShadowUrl = require('leaflet/dist/images/marker-shadow.png');
      L.Icon.Default.mergeOptions({
        iconUrl: markerIconUrl,
        shadowUrl: markerShadowUrl,
       responsive: true,
        maintainAspectRatio: false,
      });
    }
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update background image when weatherData changes
  useEffect(() => {
    if (weatherData && weatherData.current_weather) {
      const bg = getBackgroundImage(weatherData.current_weather.weathercode);
      setBackgroundImage(bg);
    }
  }, [weatherData]);

  // Get user's location and fetch weather data
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const locationData = await fetchLocationName(latitude, longitude);
          setSelectedLocation(locationData);
          fetchWeatherData(latitude, longitude);
        },
        (err) => {
          console.error(err);
          setError("Geolocation permission denied. Please search for a location.");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  }, []);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm) return;
    setError("");
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
      setError("Error fetching location data");
    }
  };

  const fetchWeatherData = async (latitude: number, longitude: number) => {
    setLoading(true);
    setWeatherData(null);
    setBackgroundImage("");
    const startTime = Date.now();
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&hourly=temperature_2m,precipitation,snowfall,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,lightning_potential` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,weathercode` +
          `&current_weather=true&timezone=auto`
      );
      const data = await res.json();
      const elapsedTime = Date.now() - startTime;
      // Ensure a minimum wait time without negative delay
      const waitTime = Math.max(0, 1000 - elapsedTime);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      setWeatherData(data);
    } catch (err) {
      console.error(err);
      setError("Error fetching weather data");
    }
    setLoading(false);
  };

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
    setSearchResults([]);
    setSearchTerm(location.name);
    setWeatherData(null);
    setBackgroundImage("");
    fetchWeatherData(location.latitude, location.longitude);
  };

  const convertTemperature = (temp: number): string => {
    return tempUnit === 'C'
      ? `${temp}°C`
      : `${(temp * 9 / 5 + 32).toFixed(1)}°F`;
  };

  return (
    <div
      className="relative min-h-screen text-gray-900"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!mounted ? (
        <div style={{ minHeight: "100vh" }} />
      ) : (
        <div className="relative z-10">
          <header className="shadow bg-transparent">
            <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <h1 className="text-3xl font-semibold dark:text-white">Weather Dashboard</h1>
                <p className="text-sm dark:text-gray-300">
                  {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
                </p>
              </div>
              <div className="mb-8">
                <form onSubmit={handleSearch} className="flex max-w-md mx-auto">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Enter location..."
                    className="flex-grow p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-3 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 transition"
                  >
                    Search
                  </button>
                </form>
                {searchResults.length > 0 && (
                  <ul className="mt-2 max-w-md mx-auto border border-gray-300 rounded-md shadow bg-white">
                    {searchResults.map((result) => (
                      <li
                        key={result.id || result.name}
                        onClick={() => handleSelectLocation(result)}
                        className="p-3 border-b border-gray-200 hover:bg-gray-100 cursor-pointer"
                      >
                        {result.name}
                        {result.country ? `, ${result.country}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 py-8">
            {error && <p className="text-center text-red-400 mb-4">{error}</p>}
            {loading && <p className="text-center text-white mb-4">Loading weather data...</p>}
            {weatherData && selectedLocation && (
              <div className="grid grid-cols-1 gap-8">
                <div className="mt-2 dark:text-white">
                  <ToggleSwitch
                    isOn={tempUnit === "F"}
                    onToggle={() => setTempUnit(tempUnit === "C" ? "F" : "C")}
                  />
                </div>
                <section className="p-6 rounded-lg shadow bg-opacity-80">
                  <h2 className="text-2xl font-semibold text-brand-900 dark:text-slate-200 mb-4">
                    {selectedLocation.name}
                    {selectedLocation.country && `, ${selectedLocation.country}`}
                  </h2>
                  {weatherData.current_weather && (
                    <div className="flex flex-col md:flex-row items-center justify-between mb-6">
                      <div className="flex items-center space-x-6">
                        <div className="text-5xl dark:text-white">
                          {getWeatherIcon(weatherData.current_weather.weathercode, 60)}
                        </div>
                        <div>
                          <p className="text-3xl font-medium text-brand-900 dark:text-slate-200">
                            {convertTemperature(weatherData.current_weather.temperature)}
                          </p>
                          <p className="text-lg text-gray-600">
                            Wind: {weatherData.current_weather.windspeed} km/h
                          </p>
                        </div>
                      </div>
                      {selectedLocation && (
                        <motion.div
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5 }}
                          className="w-full md:w-1/2 h-56 sm:h-64 rounded-lg overflow-hidden border mt-4 md:mt-0"
                        >
                          <LeafletMap location={selectedLocation} />
                        </motion.div>
                      )}
                    </div>
                  )}
                  {weatherData.hourly && weatherData.hourly.time && (
                    <HourlyWeatherChart hourly={weatherData.hourly} tempUnit={tempUnit} />
                  )}
                  {weatherData.daily?.time && (
                    <>
                      <h3 className="text-xl font-semibold text-brand-900 dark:text-slate-200 mb-4">
                        7-Day Forecast
                      </h3>
                      <WeatherSlider daily={weatherData.daily} tempUnit={tempUnit} />
                    </>
                  )}
                </section>
              </div>
            )}
          </main>
          {showModal && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
              <div className="rounded-lg shadow-lg max-w-sm w-full p-6 bg-white">
                <h2 className="text-2xl font-semibold text-brand-900 dark:text-slate-200 mb-4">
                  Additional Information
                </h2>
                <p className="text-gray-600 mb-4">
                  Stay updated with the latest weather conditions and forecasts for{" "}
                  <strong>{selectedLocation?.name}</strong>
                  {selectedLocation?.country ? `, ${selectedLocation.country}` : ""}.
                </p>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
          {loading && <LoadingSpinner />}
        </div>
      )}
    </div>
  );
};

export default WeatherPage;
