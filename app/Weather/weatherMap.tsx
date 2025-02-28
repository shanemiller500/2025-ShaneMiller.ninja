"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

// Interfaces for city and sidebar forecast data
interface City {
  name: string;
  lat: number;
  lon: number;
}

interface SidebarData {
  name: string;
  weather: {
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    weathercode: number[];
    temperature_2m: number[];
  };
  lat: number;
  lon: number;
}

const initialCities: City[] = [
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { name: "Houston", lat: 29.7604, lon: -95.3698 },
  { name: "Phoenix", lat: 33.4484, lon: -112.074 },
  { name: "Philadelphia", lat: 39.9526, lon: -75.1652 },
  { name: "San Antonio", lat: 29.4241, lon: -98.4936 },
  { name: "San Diego", lat: 32.7157, lon: -117.1611 },
  { name: "Dallas", lat: 32.7767, lon: -96.797 },
  { name: "San Jose", lat: 37.3382, lon: -121.8863 },
  { name: "Austin", lat: 30.2672, lon: -97.7431 },
  { name: "Jacksonville", lat: 30.3322, lon: -81.6557 },
  { name: "Fort Worth", lat: 32.7555, lon: -97.3308 },
  { name: "Columbus", lat: 39.9612, lon: -82.9988 },
  { name: "San Francisco", lat: 37.7749, lon: -122.4194 },
  { name: "Charlotte", lat: 35.2271, lon: -80.8431 },
  { name: "Indianapolis", lat: 39.7684, lon: -86.1581 },
  { name: "Seattle", lat: 47.6062, lon: -122.3321 },
  { name: "Denver", lat: 39.7392, lon: -104.9903 },
  { name: "Washington", lat: 38.9072, lon: -77.0369 },
  { name: "Boston", lat: 42.3601, lon: -71.0589 },
  { name: "El Paso", lat: 31.7619, lon: -106.485 },
  { name: "Detroit", lat: 42.3314, lon: -83.0458 },
  { name: "Nashville", lat: 36.1627, lon: -86.7816 },
  { name: "Portland", lat: 45.5122, lon: -122.6587 },
  { name: "Memphis", lat: 35.1495, lon: -90.049 },
  { name: "Oklahoma City", lat: 35.4676, lon: -97.5164 },
  { name: "Las Vegas", lat: 36.1699, lon: -115.1398 },
  { name: "Louisville", lat: 38.2527, lon: -85.7585 },
  { name: "Baltimore", lat: 39.2904, lon: -76.6122 },
];

// Mapping for human‐readable weather descriptions
const weatherDescriptions: Record<string, string> = {
  clear: "Clear Sky",
  partly: "Partly Cloudy",
  overcast: "Overcast",
  fog: "Foggy",
  drizzle: "Drizzle",
  rain: "Rainy",
  snow: "Snowy",
  thunder: "Thunderstorm",
};

// Mapping to style forecast cards based on condition (using Tailwind classes)
const cardBgMapping: Record<string, string> = {
  clear: "bg-yellow-200",
  partly: "bg-blue-200",
  overcast: "bg-gray-400",
  fog: "bg-gray-300",
  drizzle: "bg-blue-300",
  rain: "bg-blue-500",
  snow: "bg-blue-100",
  thunder: "bg-purple-600",
};

const WeatherMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const loadedCityNamesRef = useRef<Set<string>>(new Set());
  const [currentUnit, setCurrentUnit] = useState<"C" | "F">("C");
  const [sidebarData, setSidebarData] = useState<SidebarData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Convert Celsius temperature to the current unit.
  const convertTemp = (tempC: number): string =>
    currentUnit === "C"
      ? tempC.toFixed(1)
      : ((tempC * 9) / 5 + 32).toFixed(1);

  // Map weather code to a condition string.
  const mapWeatherCodeToCondition = (code: number): string => {
    if (code === 0) return "clear";
    else if (code >= 1 && code <= 2) return "partly";
    else if (code === 3) return "overcast";
    else if ([45, 48].includes(code)) return "fog";
    else if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
    else if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
      return "rain";
    else if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    else if ([95, 96, 99].includes(code)) return "thunder";
    else return "clear";
  };

  // Adds a city marker by fetching weather data; optionally auto-opens the sidebar.
  const addCityMarker = (
    name: string,
    lat: number,
    lon: number,
    autoOpen: boolean = false
  ) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset&hourly=temperature_2m,weathercode&forecast_days=5&timezone=auto`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const weather = data.current_weather;
        const condition = mapWeatherCodeToCondition(weather.weathercode);
        const daily = data.daily;
        const hourly = data.hourly;

        // Create a custom icon using our new, static shapes.
        const iconHtml = `<div class="weather-icon icon-${condition}"></div>`;
        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-icon",
          iconSize: [60, 60],
          iconAnchor: [30, 30],
        });
        const popupContent = `<strong>${name}</strong><br>
                              Temp: ${convertTemp(
                                weather.temperature
                              )}°${currentUnit}<br>
                              Wind: ${weather.windspeed} km/h`;
        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(
          mapRef.current!
        );
        marker.bindPopup(popupContent);

        // Open the sidebar with detailed forecast on marker click.
        marker.on("click", () => {
          setSidebarData({
            name,
            weather,
            daily,
            hourly,
            lat,
            lon,
          });
        });

        // Attach additional properties for filtering.
        // @ts-ignore
        marker.condition = condition;
        // @ts-ignore
        marker.cityName = name;
        markersRef.current.push(marker);

        if (autoOpen) {
          marker.fire("click");
        }
      })
      .catch((err) =>
        console.error(`Error fetching weather for ${name}:`, err)
      );
  };

  // Filter markers by weather condition.
  const filterMarkers = (condition: string) => {
    markersRef.current.forEach((marker) => {
      if (!mapRef.current) return;
      // @ts-ignore
      if (condition === "all" || marker.condition === condition) {
        if (!mapRef.current.hasLayer(marker)) marker.addTo(mapRef.current);
      } else {
        if (mapRef.current.hasLayer(marker)) mapRef.current.removeLayer(marker);
      }
    });
  };

  // Load more cities from the current map bounds.
  const loadMoreCities = () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    const viewbox = [
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast(),
      bounds.getSouth(),
    ].join(",");
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=20&bounded=1&viewbox=${viewbox}&q=city`;
    fetch(nominatimUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WeatherMapDemo/1.0)",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        data.forEach((result: any) => {
          if (
            result.class === "place" &&
            ["city", "town", "village"].includes(result.type)
          ) {
            const cityName = result.display_name.split(",")[0];
            if (!loadedCityNamesRef.current.has(cityName.toLowerCase())) {
              loadedCityNamesRef.current.add(cityName.toLowerCase());
              addCityMarker(
                cityName,
                parseFloat(result.lat),
                parseFloat(result.lon)
              );
            }
          }
        });
      })
      .catch((err) => console.error("Error loading more cities:", err));
  };

  // Handle search input submission.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      searchQuery
    )}`;
    fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WeatherMapDemo/1.0)",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.length > 0) {
          const result = data[0];
          const cityName = result.display_name.split(",")[0];
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);
          // Center map on search result.
          mapRef.current?.setView([lat, lon], 8);
          // Add marker and auto-open its sidebar.
          if (!loadedCityNamesRef.current.has(cityName.toLowerCase())) {
            loadedCityNamesRef.current.add(cityName.toLowerCase());
            addCityMarker(cityName, lat, lon, true);
          } else {
            // If already loaded, simply find the marker and fire click.
            const marker = markersRef.current.find(
              // @ts-ignore
              (m) => m.cityName.toLowerCase() === cityName.toLowerCase()
            );
            if (marker) marker.fire("click");
          }
        }
      })
      .catch((err) => console.error("Search error:", err));
  };

  // Toggle temperature unit between Celsius and Fahrenheit.
  const toggleTemp = () => {
    setCurrentUnit((prev) => (prev === "C" ? "F" : "C"));
  };

  // Initialize map on mount.
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      // Set maxBounds so that the map cannot pan beyond the world.
      mapRef.current = L.map(mapContainerRef.current, {
        maxBounds: L.latLngBounds([-85, -180], [85, 180]),
        maxBoundsViscosity: 1.0,
      }).setView([39.8283, -98.5795], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        noWrap: true,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapRef.current);
      initialCities.forEach((city) => {
        loadedCityNamesRef.current.add(city.name.toLowerCase());
        addCityMarker(city.name, city.lat, city.lon);
      });
    }
  }, []);

  // Format time strings for sunrise and sunset.
  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-[90%] h-[90%] bg-white rounded shadow-lg overflow-hidden">
        {/* Custom CSS for map marker icons and modal popup */}
        <style>{`
          .weather-icon {
            width: 60px;
            height: 60px;
            position: relative;
          }
          /* Map Marker Styles */
          .icon-clear {
            background: radial-gradient(circle, #ffdd00, #ff9900);
            clip-path: circle(50%);
            box-shadow: 0 0 8px rgba(255,221,0,0.8);
          }
          .icon-partly {
            background: radial-gradient(circle, #ffdd00, #ff9900);
            clip-path: ellipse(50% 40% at 50% 50%);
            box-shadow: 0 0 6px rgba(255,221,0,0.7);
          }
          .icon-overcast {
            background: #666;
            clip-path: inset(10% 10% 10% 10% round 15px);
            box-shadow: inset 0 0 10px #444;
          }
          .icon-fog {
            background: #aaa;
            clip-path: ellipse(50% 40% at 50% 50%);
            opacity: 0.9;
          }
          .icon-drizzle {
            background: #0cf;
            clip-path: polygon(50% 0%, 70% 60%, 50% 100%, 30% 60%);
            box-shadow: 0 0 4px #0cf;
          }
          .icon-rain {
            background: #0cf;
            clip-path: polygon(50% 0%, 75% 60%, 50% 100%, 25% 60%);
            box-shadow: 0 0 6px #0cf;
          }
          .icon-snow {
            background: #fff;
            clip-path: circle(45%);
            box-shadow: inset 0 0 4px #00f;
          }
          .icon-thunder {
            background: #444;
            clip-path: polygon(40% 0%, 60% 0%, 55% 40%, 75% 40%, 35% 100%, 45% 60%, 30% 60%);
            box-shadow: 0 0 8px #ff0;
          }
          /* Forecast Card Base Styling */
          .daily-card,
          .hourly-card {
            width: 80px;
            height: 100px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin: 0.5rem;
          }
          /* Card Shapes Based on Weather Condition */
          .card-clear {
            clip-path: circle(50% at 50% 40%);
          }
          .card-partly {
            clip-path: polygon(20% 50%, 40% 20%, 70% 20%, 80% 50%, 70% 80%, 40% 80%);
          }
          .card-overcast {
            clip-path: polygon(10% 50%, 30% 10%, 70% 10%, 90% 50%, 70% 90%, 30% 90%);
          }
          .card-fog {
            clip-path: polygon(10% 30%, 90% 20%, 80% 80%, 20% 90%);
          }
          .card-drizzle {
            clip-path: polygon(50% 0%, 80% 40%, 70% 100%, 30% 100%, 20% 40%);
          }
          .card-rain {
            clip-path: polygon(50% 0%, 85% 40%, 70% 100%, 30% 100%, 15% 40%);
          }
          .card-snow {
            clip-path: polygon(50% 0%, 85% 25%, 85% 75%, 50% 100%, 15% 75%, 15% 25%);
          }
          .card-thunder {
            clip-path: polygon(40% 0%, 60% 0%, 55% 40%, 75% 40%, 40% 100%, 45% 60%, 30% 60%);
          }
          /* Modal Popup Styling */
          @media (max-width: 640px) {
            .modal-content {
              width: 90%;
              max-width: 400px;
            }
          }
        `}</style>

        {/* Header with search and controls */}
        <div className="absolute top-0 left-0 w-full h-14 backdrop-blur-sm flex flex-wrap items-center justify-center gap-2 px-3 shadow-md z-[3000]">
          <form onSubmit={handleSearch} className="flex gap-1">
            <input
              type="text"
              placeholder="Search for a place"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2 py-1 text-xs rounded outline-none text-black"
            />
            <button
              type="submit"
              className="px-2 py-1 text-xs dark:text-white rounded bg-indigo-600 hover:bg-indigo-700 transition transform hover:scale-105"
            >
              Search
            </button>
          </form>
          {["all", "clear", "partly", "overcast", "fog", "drizzle", "rain", "snow", "thunder"].map(
            (cond) => (
              <button
                key={cond}
                onClick={() => filterMarkers(cond)}
                className="px-2 py-1 text-xs dark:text-white rounded bg-indigo-600 hover:bg-indigo-700 transition transform hover:scale-105"
              >
                {cond.charAt(0).toUpperCase() + cond.slice(1)}
              </button>
            )
          )}
          <button
            onClick={loadMoreCities}
            className="px-2 py-1 text-xs dark:text-white rounded bg-indigo-600 hover:bg-indigo-700 transition transform hover:scale-105"
          >
            Load More Cities
          </button>
          <button
            onClick={toggleTemp}
            className="px-2 py-1 text-xs dark:text-white rounded bg-indigo-600 hover:bg-indigo-700 transition transform hover:scale-105"
          >
            °{currentUnit}
          </button>
        </div>

        {/* Map container */}
        <div
          id="map"
          ref={mapContainerRef}
          className="absolute top-14 bottom-0 left-0 right-0"
        ></div>

        {/* Modal Popup for detailed forecast */}
        {sidebarData && (
          <div className="absolute inset-0 flex items-center justify-center z-[3500]">
            {/* Modal overlay */}
            <div
              className="absolute inset-0 bg-black opacity-50"
              onClick={() => setSidebarData(null)}
            ></div>
            {/* Modal content */}
            <div className="modal-content relative bg-[rgba(20,20,20,0.95)] rounded p-5 w-full max-w-md mx-4 max-h-[90%] overflow-y-auto">
              <button
                onClick={() => setSidebarData(null)}
                className="absolute top-2 right-2 text-xl dark:text-white"
              >
                ✕
              </button>
              <h2 className="text-2xl border-b border-white border-opacity-20 pb-1 dark:text-white">
                {sidebarData.name}
              </h2>
              <p className="dark:text-white">
                <strong>Temperature:</strong>{" "}
                {convertTemp(sidebarData.weather.temperature)}°{currentUnit}
              </p>
              <p className="dark:text-white">
                <strong>Wind Speed:</strong> {sidebarData.weather.windspeed} km/h
              </p>
              <p className="dark:text-white">
                <strong>Coordinates:</strong>{" "}
                {sidebarData.lat.toFixed(2)}, {sidebarData.lon.toFixed(2)}
              </p>
              {sidebarData.daily.sunrise && sidebarData.daily.sunrise[0] && (
                <p className="dark:text-white">
                  <strong>Sunrise:</strong>{" "}
                  {formatTime(sidebarData.daily.sunrise[0])}
                </p>
              )}
              {sidebarData.daily.sunset && sidebarData.daily.sunset[0] && (
                <p className="dark:text-white">
                  <strong>Sunset:</strong>{" "}
                  {formatTime(sidebarData.daily.sunset[0])}
                </p>
              )}
              <p className="dark:text-white">
                <strong>Condition:</strong>{" "}
                {weatherDescriptions[
                  mapWeatherCodeToCondition(sidebarData.weather.weathercode)
                ] || "Unknown"}
              </p>

              {/* 5-Day Forecast */}
              <div className="forecast-section mt-4">
                <h3 className="text-xl mb-2 border-b border-white border-opacity-20 pb-1 dark:text-white">
                  5-Day Forecast
                </h3>
                <div className="daily-forecast flex gap-2 overflow-x-auto">
                  {sidebarData.daily.time.map((time, i) => {
                    const cond = mapWeatherCodeToCondition(
                      sidebarData.daily.weathercode[i]
                    );
                    const bgClass = cardBgMapping[cond] || "bg-gray-300";
                    const tempMax = sidebarData.daily.temperature_2m_max[i];
                    const tempMin = sidebarData.daily.temperature_2m_min[i];
                    const dateObj = new Date(time);
                    const day = dateObj.toLocaleDateString(undefined, {
                      weekday: "short",
                    });
                    return (
                      <div
                        key={i}
                        className={`daily-card card-${cond} p-2 text-center min-w-[60px] transition transform hover:scale-105 ${bgClass} bg-opacity-70`}
                      >
                        <div className={`icon weather-icon icon-${cond}`}></div>
                        <div>{day}</div>
                        <div>
                          {convertTemp(tempMin)}° - {convertTemp(tempMax)}°
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next 24 Hours Forecast */}
              <div className="forecast-section mt-4">
                <h3 className="text-xl mb-2 border-b border-white border-opacity-20 pb-1 dark:text-white">
                  Next 24 Hours
                </h3>
                <div className="hourly-forecast flex gap-2 overflow-x-auto">
                  {sidebarData.hourly.time.map((time, i) => {
                    const hourTime = new Date(time);
                    const now = new Date();
                    const diffHours =
                      (hourTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                    if (diffHours >= 0 && diffHours <= 24) {
                      const cond = mapWeatherCodeToCondition(
                        sidebarData.hourly.weathercode[i]
                      );
                      const bgClass = cardBgMapping[cond] || "bg-gray-300";
                      const temp = sidebarData.hourly.temperature_2m[i];
                      const hourLabel =
                        hourTime.getHours().toString().padStart(2, "0") +
                        ":00";
                      return (
                        <div
                          key={i}
                          className={`hourly-card card-${cond} p-2 text-center min-w-[60px] transition transform hover:scale-105 ${bgClass}`}
                        >
                          <div className={`icon weather-icon icon-${cond}`}></div>
                          <div>{hourLabel}</div>
                          <div>{convertTemp(temp)}°</div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherMap;
