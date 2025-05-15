'use client';

import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import { motion } from 'framer-motion';
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
};

type ForecastDay = {
  date: string;
  temperature_max: number;
  temperature_min: number;
  weathercode: number;
};

const getWeatherInfo = (code: number) => {
  if (code === 0) return { description: 'Clear Sky', Icon: WiDaySunny };
  if ([1, 2, 3].includes(code)) return { description: 'Partly Cloudy', Icon: WiCloud };
  if ([45, 48].includes(code)) return { description: 'Foggy', Icon: WiFog };
  if ([51, 53, 55].includes(code)) return { description: 'Drizzle', Icon: WiSprinkle };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { description: 'Rain', Icon: WiRain };
  if ([66, 67].includes(code)) return { description: 'Freezing Rain', Icon: WiRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { description: 'Snow', Icon: WiSnow };
  if ([95, 96, 99].includes(code)) return { description: 'Thunderstorm', Icon: WiThunderstorm };
  return { description: 'Unknown', Icon: WiDaySunny };
};

const getColorClass = (code: number) => {
  if (code === 0) return 'text-yellow-500';
  if ([1, 2, 3].includes(code)) return 'text-gray-500';
  if ([45, 48].includes(code)) return 'text-gray-400';
  if ([51, 53, 55].includes(code)) return 'text-blue-400';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'text-blue-600';
  if ([66, 67].includes(code)) return 'text-blue-600';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'text-blue-300';
  if ([95, 96, 99].includes(code)) return 'text-purple-700';
  return 'text-gray-500';
};

const getBgClass = (code: number) => {
  if (code === 0) return 'bg-yellow-100 dark:bg-yellow-900';
  if ([1, 2, 3].includes(code)) return 'bg-gray-200 dark:bg-gray-700';
  if ([45, 48].includes(code)) return 'bg-gray-300 dark:bg-gray-600';
  if ([51, 53, 55].includes(code)) return 'bg-blue-100 dark:bg-blue-900';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'bg-blue-200 dark:bg-blue-900';
  if ([66, 67].includes(code)) return 'bg-blue-200 dark:bg-blue-900';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'bg-blue-50 dark:bg-blue-700';
  if ([95, 96, 99].includes(code)) return 'bg-purple-200 dark:bg-purple-900';
  return 'bg-gray-100 dark:bg-gray-700';
};

// ensure correct local-day mapping
const formatDate = (dateString: string) =>
  new Date(dateString + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

export default function WidgetWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => setLocation(`${data.city}, ${data.region}`))
      .catch(() => setLocation(''));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
        )
          .then(res => res.json())
          .then(data => {
            setWeather(data.current_weather);

            // Use your corrected upcoming logic:
            const todayStr = new Date().toISOString().split('T')[0];
            const upcoming: ForecastDay[] = data.daily.time
              .map((date: string, idx: number) => ({ date, idx }))
              .filter((d: { date: string; idx: number }) => d.date >= todayStr)
              .slice(0, 5)
              .map((d: { date: string; idx: number }) => ({
                date: d.date,
                temperature_max: data.daily.temperature_2m_max[d.idx],
                temperature_min: data.daily.temperature_2m_min[d.idx],
                weathercode: data.daily.weathercode[d.idx],
              }));

            setForecast(upcoming);
            setLoading(false);
          })
          .catch(() => {
            setError('Failed to fetch weather');
            setLoading(false);
          });
      },
      () => {
        setError('Unable to retrieve location');
        setLoading(false);
      }
    );
  }, []);

  const containerBg = 'dark:bg-brand-900';
  const primary = weather ? getColorClass(weather.weathercode) : 'text-gray-500';
  const borderClass = primary.replace('text', 'border');

  const viewMore = (
    <div className="p-2">
    <p className="text-xs text-gray-500 text-center">
      More weather {" "}
      <a href="/Weather" className="text-indigo-500 underline">
        here
      </a>
      
    </p>
  </div>
  );

  if (loading) {
    return (
      <div className={`rounded-2xl shadow-lg p-6 max-w-md mx-auto  ${containerBg} ${borderClass}`}>
        <div className="text-center py-8 text-gray-500">Loading weather...</div>
        {viewMore}
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className={`rounded-2xl shadow-lg p-6 max-w-md mx-auto ${containerBg} ${borderClass}`}>
        <div className="text-center py-8 text-red-500">{error}</div>
        {viewMore}
      </div>
    );
  }

  const { description, Icon } = getWeatherInfo(weather.weathercode);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`rounded-2xl shadow-lg p-6 max-w-md mx-auto bg-white dark:bg-brand-950 ${containerBg} ${borderClass}`}
    >
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {location || 'Your Location'}
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-200">
          {currentTime.toLocaleTimeString()}
        </span>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className={`text-6xl ${primary}`}>
          <Icon />
        </div>
        <div className="ml-4 text-gray-900 dark:text-gray-100">
          <p className="text-xl font-medium">{description}</p>
          <p className="text-lg">
            {weather.temperature}°C / {(weather.temperature * 1.8 + 32).toFixed(1)}°F
          </p>
          <p className="text-sm">Wind: {weather.windspeed} km/h</p>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        5-Day Forecast
      </h3>
      <Swiper
        spaceBetween={10}
        slidesPerView={2}
        breakpoints={{
          320: { slidesPerView: 2 },
          640: { slidesPerView: 2 },
          1024: { slidesPerView: 2 },
        }}
      >
        {forecast?.map((day, idx) => {
          const { description: dayDesc, Icon: DayIcon } = getWeatherInfo(day.weathercode);
          const bgClass = getBgClass(day.weathercode);
          const dayColor = getColorClass(day.weathercode);

          return (
            <SwiperSlide key={day.date}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-4 rounded-xl shadow-sm text-center flex flex-col justify-between h-52 w-30 ${bgClass}`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(day.date)}
                </p>
                <div className={`my-2 text-4xl ${dayColor}`}>
                  <DayIcon />
                </div>
                <p className="text-sm text-gray-900 dark:text-gray-100">{dayDesc}</p>
                <p className="text-xs mt-1 text-gray-900 dark:text-gray-100">
                  H {day.temperature_max}°C &nbsp;L {day.temperature_min}°C
                </p>
              </motion.div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {viewMore}
    </motion.div>
  );
}
