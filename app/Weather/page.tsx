"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { motion } from 'framer-motion';
import {
  WiDaySunny,
  WiDayCloudy,
  WiCloud,
  WiRain,
  WiSnow,
  WiFog,
  WiThunderstorm,
} from 'react-icons/wi';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

// Helper: Returns a weather icon based on the weather code.
const getWeatherIcon = (code: number, size: number = 48) => {
  if (code === 0) return <WiDaySunny size={size} />;
  if ([1, 2].includes(code)) return <WiDayCloudy size={size} />;
  if (code === 3) return <WiCloud size={size} />;
  if ([45, 48].includes(code)) return <WiFog size={size} />;
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return <WiRain size={size} />;
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return <WiSnow size={size} />;
  if ([95, 96, 99].includes(code))
    return <WiThunderstorm size={size} />;
  return <WiDaySunny size={size} />;
};

// Helper: Returns a background image URL based on weather code.
const getBackgroundImage = (code: number) => {
  if (code === 0) return "https://source.unsplash.com/1600x900/?sunny";
  if ([1, 2].includes(code)) return "https://source.unsplash.com/1600x900/?partly-cloudy";
  if (code === 3) return "https://source.unsplash.com/1600x900/?cloudy";
  if ([45, 48].includes(code)) return "https://source.unsplash.com/1600x900/?fog";
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return "https://source.unsplash.com/1600x900/?rain";
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return "https://source.unsplash.com/1600x900/?snow";
  if ([95, 96, 99].includes(code))
    return "https://source.unsplash.com/1600x900/?thunderstorm";
  return "https://source.unsplash.com/1600x900/?weather";
};

// Helper: Returns a forecast card background style based on weather code.
const getForecastCardStyle = (code: number) => {
  if (code === 0) return { background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' };
  if ([1, 2].includes(code)) return { background: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' };
  if (code === 3) return { background: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' };
  if ([45, 48].includes(code)) return { background: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)' };
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { background: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' };
  if ([95, 96, 99].includes(code))
    return { background: 'linear-gradient(135deg, #fbd3e9 0%, #bb377d 100%)' };
  return { background: 'linear-gradient(135deg, #ece9e6 0%, #ffffff 100%)' };
};

// Types for location and weather data.
interface Location {
  id?: number | string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

interface WeatherData {
  current_weather?: {
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    sunrise: string[];
    sunset: string[];
    weathercode: number[];
  };
}

/**
 * Reverse geocode using Nominatim.
 * Note: Nominatim's usage policy requires respectful usage.
 */
const fetchLocationName = async (latitude: number, longitude: number): Promise<Location> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
    );
    const data = await res.json();
    const address = data.address || {};
    let name = "";
    if (address.city) {
      name = address.city;
    } else if (address.town) {
      name = address.town;
    } else if (address.village) {
      name = address.village;
    } else if (address.hamlet) {
      name = address.hamlet;
    } else {
      name = data.display_name || "Unknown Location";
    }
    const country = address.country || "";
    return { name, country, latitude, longitude };
  } catch (err) {
    console.error(err);
    return {
      name: "Unknown Location",
      country: "",
      latitude,
      longitude,
    };
  }
};

// Loading Spinner Component
const LoadingSpinner: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="w-16 h-16 border-4 border-t-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// A component to recenter the map when the location changes.
const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 10);
  }, [lat, lng, map]);
  return null;
};

// Forecast slider component.
interface WeatherSliderProps {
  daily: NonNullable<WeatherData["daily"]>;
  tempUnit: 'C' | 'F';
}

const WeatherSlider: React.FC<WeatherSliderProps> = ({ daily, tempUnit }) => {
  const settings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 3 } },
      { breakpoint: 768, settings: { slidesToShow: 2 } },
      { breakpoint: 480, settings: { slidesToShow: 1 } },
    ],
  };

  const convertTemperature = (temp: number) => {
    return tempUnit === 'C'
      ? `${temp}°C`
      : `${(temp * 9/5 + 32).toFixed(1)}°F`;
  };

  return (
    <Slider {...settings}>
      {daily.time.map((time, index) => (
        <motion.div
          key={index}
          className="p-4"
          whileHover={{ scale: 1.03 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div
            className="rounded-lg shadow p-4 flex flex-col items-center text-white"
            style={getForecastCardStyle(daily.weathercode[index])}
          >
            <p className="font-medium">
              {new Date(time).toLocaleDateString()}
            </p>
            <div className="my-3">
              {getWeatherIcon(daily.weathercode[index], 60)}
            </div>
            <p className="text-sm">
              High: {convertTemperature(daily.temperature_2m_max[index])}
            </p>
            <p className="text-sm">
              Low: {convertTemperature(daily.temperature_2m_min[index])}
            </p>
            <p className="text-sm">
              Precip: {daily.precipitation_sum[index]} mm
            </p>
            <p className="text-xs">
              Sunrise:{" "}
              {new Date(daily.sunrise[index]).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="text-xs">
              Sunset:{" "}
              {new Date(daily.sunset[index]).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </motion.div>
      ))}
    </Slider>
  );
};

// Minimal ToggleSwitch component for temperature unit.
interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle }) => {
  return (
    <label className="flex items-center cursor-pointer select-none">
      {/* Display the current unit on the left */}
      <span className="mr-2 text-white font-medium">{isOn ? '°F' : '°C'}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={isOn}
          onChange={onToggle}
          className="sr-only"
        />
        <div className="w-10 h-4 bg-gray-400 rounded-full shadow-inner"></div>
        <div
          className={`dot absolute w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ease-in-out -top-1 -left-1 ${
            isOn ? 'transform translate-x-full bg-indigo-600' : ''
          }`}
        ></div>
      </div>
    </label>
  );
};

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

  // Temperature unit state: 'C' for Celsius, 'F' for Fahrenheit.
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  // Function to convert temperature based on unit.
  const convertTemperature = (temp: number): string => {
    return tempUnit === 'C'
      ? `${temp}°C`
      : `${(temp * 9/5 + 32).toFixed(1)}°F`;
  };

  // Update time every second.
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update background image when weatherData changes
  useEffect(() => {
    if (weatherData && weatherData.current_weather) {
      const bg = getBackgroundImage(weatherData.current_weather.weathercode);
      setBackgroundImage(bg);
    }
  }, [weatherData]);

  // Get user's current location and use reverse geocoding via Nominatim.
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

  // Search for location using Open-Meteo's geocoding API.
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

  // Fetch weather details with a minimum 2-second loading spinner.
  const fetchWeatherData = async (latitude: number, longitude: number) => {
    setLoading(true);
    setWeatherData(null); // Clear current data to blank out UI.
    setBackgroundImage(""); // Clear background image during loading.
    const startTime = Date.now();
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&hourly=temperature_2m,relative_humidity_2m,precipitation,weathercode` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,weathercode` +
          `&current_weather=true&timezone=auto`
      );
      const data = await res.json();
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 2000 - elapsedTime));
      }
      setWeatherData(data);
    } catch (err) {
      console.error(err);
      setError("Error fetching weather data");
    }
    setLoading(false);
  };

  // Handle location selection from search results.
  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
    setSearchResults([]);
    setSearchTerm(location.name);
    // Clear data and background before fetching new data.
    setWeatherData(null);
    setBackgroundImage("");
    fetchWeatherData(location.latitude, location.longitude);
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
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 "></div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="shadow bg-transparent">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h1 className="text-3xl font-semibold text-white">Weather Dashboard</h1>
              <p className="text-sm text-gray-300">
                {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
              </p>
             
            </div>
            {/* Search Section */}
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

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {error && <p className="text-center text-red-400 mb-4">{error}</p>}
          {loading && (
            <p className="text-center text-white mb-4">Loading weather data...</p>
          )}

          {/* Weather Details */}
          {weatherData && selectedLocation && (
            <div className="grid grid-cols-1 gap-8">
                 {/* Temperature Unit Toggle Switch */}
              <div className="mt-2">
                <ToggleSwitch
                  isOn={tempUnit === 'F'}
                  onToggle={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
                />
              </div>
              <section className="p-6 rounded-lg shadow bg-opacity-80">
                <h2 className="text-2xl font-semibold  text-brand-900 dark:text-slate-200 mb-4">
                  {selectedLocation.name}
                  {selectedLocation.country && `, ${selectedLocation.country}`}
                </h2> 
                {weatherData.current_weather && (
                  <div className="flex flex-col md:flex-row items-center justify-between mb-6">
                    {/* Weather Icon & Stats */}
                    <div className="flex items-center space-x-6">
                      <div className="text-5xl dark:text-white">
                        {getWeatherIcon(weatherData.current_weather.weathercode, 60)}
                      </div>
                      <div>
                        <p className="text-3xl font-medium  text-brand-900 dark:text-slate-200">
                          {convertTemperature(weatherData.current_weather.temperature)}
                        </p>
                        <p className="text-lg text-gray-600">
                          Wind: {weatherData.current_weather.windspeed} km/h
                        </p>
                      
                      </div>
                    </div>
                    {/* Animated Map Container */}
                    {mounted && selectedLocation && (
                      <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full md:w-1/2 h-56 rounded-lg overflow-hidden border mt-4 md:mt-0"
                      >
                        <MapContainer
                          key={`map-${selectedLocation.latitude}-${selectedLocation.longitude}`}
                          center={[selectedLocation.latitude, selectedLocation.longitude] as L.LatLngExpression}
                          zoom={10}
                          scrollWheelZoom={false}
                          style={{ height: "100%", width: "100%" }}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution="&copy; OpenStreetMap contributors"
                          />
                          <Marker
                            position={[selectedLocation.latitude, selectedLocation.longitude] as L.LatLngExpression}
                          >
                            <Popup>
                              {selectedLocation.name}
                              {selectedLocation.country && `, ${selectedLocation.country}`}
                            </Popup>
                          </Marker>
                          <RecenterMap lat={selectedLocation.latitude} lng={selectedLocation.longitude} />
                        </MapContainer>
                      </motion.div>
                    )}
                  </div>
                )}

                {weatherData.daily?.time && (
                  <>
                    <h3 className="text-xl font-semibold  text-brand-900 dark:text-slate-200 mb-4">
                      7-Day Forecast
                    </h3>
                    <WeatherSlider daily={weatherData.daily} tempUnit={tempUnit} />
                  </>
                )}
              </section>
            </div>
          )}
        </main>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="rounded-lg shadow-lg max-w-sm w-full p-6 bg-white">
              <h2 className="text-2xl font-semibold  text-brand-900 dark:text-slate-200 mb-4">
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
    </div>
  );
};

export default WeatherPage;
