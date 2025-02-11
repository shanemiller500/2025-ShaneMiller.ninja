'use client';

import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

type Weather = {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
};

type ForecastDay = {
  date: string;
  temperature_max: number;
  temperature_min: number;
  weathercode: number;
};

export default function WidgetWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Map weather codes to description and icon
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

  // Get user's location and fetch weather data
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });

        // Fetch current weather and daily forecast data from Open-Meteo
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
        )
          .then((response) => response.json())
          .then((data) => {
            setWeather(data.current_weather);
            if (data.daily) {
              const forecastDays: ForecastDay[] = data.daily.time.map((date: string, index: number) => ({
                date,
                temperature_max: data.daily.temperature_2m_max[index],
                temperature_min: data.daily.temperature_2m_min[index],
                weathercode: data.daily.weathercode[index],
              }));
              // Limit forecast to 3 days
              setForecast(forecastDays.slice(0, 5));
            }
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

  if (loading) {
    return (
      <div className="p-5">
        <p>Loading weather...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg dark:bg-gradient-to-t dark:from-slate-800 dark:to-slate-800/30 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      {/* Current Weather */}
      <h2 className="text-xl font-semibold mb-4">Your Current Weather</h2>
      {weather && (
        <div className="flex items-center space-x-4">
          <div className="text-5xl">{getWeatherInfo(weather.weathercode).icon}</div>
          <div>
            <p className="text-lg">{getWeatherInfo(weather.weathercode).description}</p>
            <p className="text-sm">
              Temperature: {weather.temperature}°C / {((weather.temperature * 9) / 5 + 32).toFixed(1)}°F
            </p>
            <p className="text-sm">Wind: {weather.windspeed} km/h</p>
          </div>
        </div>
      )}

      {/* 3-Day Interactive Forecast */}
      {forecast && (
        <>
          <h3 className="text-lg font-semibold mt-6 mb-2">5-Day Forecast</h3>
          <Swiper
            spaceBetween={16}
            slidesPerView={1}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 3 },
            }}
          >
            {forecast.map((day) => (
              <SwiperSlide key={day.date}>
                <div className="flex flex-col items-center p-4 rounded-md bg-gray-100 dark:bg-gray-800 hover:scale-105 transition-transform">
                  <p className="font-medium">
                    {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                  </p>
                  <div className="text-4xl">{getWeatherInfo(day.weathercode).icon}</div>
                  <p className="text-sm">{getWeatherInfo(day.weathercode).description}</p>
                  <p className="text-sm">
                    {day.temperature_max}°C / {day.temperature_min}°C
                  </p>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </>
      )}

      {/* Map */}
      {/* {coords && (
        <>
          <h3 className="text-lg font-semibold mt-6 mb-2">Location Map</h3>
          <div className="mt-2">
            <iframe
              width="100%"
              height="300"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                coords.longitude - 0.01
              },${coords.latitude - 0.01},${coords.longitude + 0.01},${coords.latitude + 0.01}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`}
              title="User Location Map"
            ></iframe>
            <br />
            <small>
              <a
                href={`https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=15/${coords.latitude}/${coords.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View Larger Map
              </a>
            </small>
          </div>
        </>
      )} */}
    </div>
  );
}
