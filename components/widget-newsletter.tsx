'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

type Weather = {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
};

export default function WidgetNewsletter() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Get the user's current position and then fetch weather data from Open-Meteo
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Call the Open-Meteo API with current coordinates, including current weather & auto timezone
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
        )
          .then((response) => response.json())
          .then((data) => {
            setWeather(data.current_weather);
            setLoading(false);
          })
          .catch(() => {
            setError('Error fetching weather data.');
            setLoading(false);
          });
      },
      () => {
        setError('Unable to retrieve your location.');
        setLoading(false);
      }
    );
  }, []);

  // Map Open-Meteo weather codes to descriptions and icons
  const getWeatherInfo = (code: number) => {
    if (code === 0) {
      return { description: 'Clear Sky', icon: '☀️' };
    } else if ([1, 2, 3].includes(code)) {
      return { description: 'Partly Cloudy', icon: '⛅️' };
    } else if ([45, 48].includes(code)) {
      return { description: 'Fog', icon: '🌫️' };
    } else if ([51, 53, 55].includes(code)) {
      return { description: 'Drizzle', icon: '🌦️' };
    } else if ([61, 63, 65].includes(code)) {
      return { description: 'Rain', icon: '🌧️' };
    } else if ([66, 67].includes(code)) {
      return { description: 'Freezing Rain', icon: '🌧️' };
    } else if ([71, 73, 75, 77].includes(code)) {
      return { description: 'Snow Fall', icon: '❄️' };
    } else if ([80, 81, 82].includes(code)) {
      return { description: 'Rain Showers', icon: '🌦️' };
    } else if ([85, 86].includes(code)) {
      return { description: 'Snow Showers', icon: '❄️' };
    } else if (code === 95) {
      return { description: 'Thunderstorm', icon: '⛈️' };
    } else if ([96, 99].includes(code)) {
      return { description: 'Thunderstorm with Hail', icon: '⛈️' };
    } else {
      return { description: 'Unknown', icon: '❓' };
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-gradient-to-t dark:from-slate-800 dark:to-slate-800/30 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      <h2 className="text-xl font-semibold mb-4">Current Weather</h2>
      {loading ? (
        <p>Loading weather...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : weather ? (
        <div className="flex items-center space-x-4">
          <div className="text-5xl">{getWeatherInfo(weather.weathercode).icon}</div>
          <div>
            <p className="text-lg">{getWeatherInfo(weather.weathercode).description}</p>
            <p className="text-sm">
              Temperature: {weather.temperature}°C /{' '}
              {((weather.temperature * 9) / 5 + 32).toFixed(1)}°F
            </p>
            <p className="text-sm">Wind: {weather.windspeed} km/h</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
