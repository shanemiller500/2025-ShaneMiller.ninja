"use client";

import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import {
  WiDaySunny,
  WiCloud,
  WiFog,
  WiSprinkle,
  WiRain,
  WiSnow,
  WiThunderstorm,
} from 'react-icons/wi';

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

const getWeatherInfo = (code: number) => {
  if (code === 0) {
    return { description: 'Clear Sky', icon: <WiDaySunny className="text-5xl wi-day-sunny" /> };
  }
  if ([1, 2, 3].includes(code)) {
    return { description: 'Partly Cloudy', icon: <WiCloud className="text-5xl" /> };
  }
  if ([45, 48].includes(code)) {
    return { description: 'Foggy', icon: <WiFog className="text-5xl" /> };
  }
  if ([51, 53, 55].includes(code)) {
    return { description: 'Drizzle', icon: <WiSprinkle className="text-5xl animate-rain" /> };
  }
  if ([61, 63, 65, 80, 81, 82].includes(code)) {
    return { description: 'Rain', icon: <WiRain className="text-5xl animate-rain" /> };
  }
  if ([66, 67].includes(code)) {
    return { description: 'Freezing Rain', icon: <WiRain className="text-5xl animate-rain" /> };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { description: 'Snow', icon: <WiSnow className="text-5xl animate-rain" /> };
  }
  if ([95, 96, 99].includes(code)) {
    return { description: 'Thunderstorm', icon: <WiThunderstorm className="text-5xl animate-storm" /> };
  }
  if ([45, 48].includes(code)) {
    return { description: 'Fog', icon: <WiFog className="text-5xl" /> };
  }

  return { description: 'Unknown', icon: <WiDaySunny className="text-5xl" /> };
};


const getInteractiveBackground = (code: number) => {
  if (code === 0) return 'bg-gradient-to-r from-yellow-300 to-orange-400 animate-bg-pulse';
  if ([1, 2, 3].includes(code)) return 'bg-gradient-to-r from-gray-400 to-gray-600';
  if ([45, 48].includes(code)) return 'bg-gradient-to-r from-gray-500 to-gray-700';
  if ([51, 53, 55].includes(code)) return 'bg-gradient-to-r from-blue-200 to-blue-400';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return 'bg-gradient-to-r from-blue-500 to-blue-800 animate-rainy-bg';
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return 'bg-gradient-to-r from-white to-blue-200 animate-snow-bg';
  if ([95, 96, 99].includes(code))
    return 'bg-gradient-to-r from-purple-600 to-indigo-900 animate-thunder-bg';
  return 'bg-gradient-to-r from-gray-200 to-gray-400';
};

export default function WidgetWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
        )
          .then((res) => res.json())
          .then((data) => {
            setWeather(data.current_weather);
            setForecast(
              data.daily.time.slice(0, 5).map((date: string, idx: number) => ({
                date,
                temperature_max: data.daily.temperature_2m_max[idx],
                temperature_min: data.daily.temperature_2m_min[idx],
                weathercode: data.daily.weathercode[idx],
              }))
            );
            setLoading(false);
          })
          .catch(() => {
            setError('Unable to fetch weather data.');
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
    return <div className="p-5 text-gray-600">Loading weather...</div>;
  }

  if (error || !weather) {
    return <div className="p-5 text-red-500">{error}</div>;
  }

  const currentWeatherInfo = getWeatherInfo(weather.weathercode);
  const bgClass = getInteractiveBackground(weather.weathercode);

  return (
    <div className={`rounded-xl shadow-xl p-6 text-white transition-all duration-700 ease-in-out ${bgClass}`}>
      <h2 className="text-2xl font-semibold mb-4">Current Weather</h2>
      <div className="flex items-center gap-4">
        {currentWeatherInfo.icon}
        <div>
          <p className="text-xl">{currentWeatherInfo.description}</p>
          <p>
            🌡 {weather.temperature}°C / {(weather.temperature * 1.8 + 32).toFixed(1)}°F
          </p>
          <p>💨 {weather.windspeed} km/h</p>
        </div>
      </div>

      {forecast && (
        <>
          <h3 className="text-xl font-semibold mt-6 mb-2">5-Day Forecast</h3>
          <Swiper spaceBetween={10} slidesPerView={1} breakpoints={{ 640: { slidesPerView: 2 }, 1024: { slidesPerView: 2 } }}>
            {forecast.map((day) => {
              const dayWeather = getWeatherInfo(day.weathercode);
              return (
                <SwiperSlide key={day.date}>
                  <div className={`p-3 rounded-lg shadow-md ${getInteractiveBackground(day.weathercode)}`}>
                    <p className="font-medium">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</p>
                    <div className="my-1">{dayWeather.icon}</div>
                    <p className="text-sm">{dayWeather.description}</p>
                    <p className="text-xs">
                      🔺{day.temperature_max}°C 🔻{day.temperature_min}°C
                    </p>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </>
      )}

      <div className="mt-4 text-center">
        <p className="text-xs opacity-70">
          See more weather data{" "}
          <a href="/Weather" className="underline">
            here
          </a>
          .
        </p>
      </div>
    </div>
  );
}
