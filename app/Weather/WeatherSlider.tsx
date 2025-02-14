// app/Weather/components/WeatherSlider.tsx

import React from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { motion } from 'framer-motion';
import { getForecastCardStyle, getWeatherIcon } from './weatherHelpers';
import { WeatherData } from './types';

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
      : `${(temp * 9 / 5 + 32).toFixed(1)}°F`;
  };

  return (
    <Slider {...settings}>
      {daily.time.map((time: string, index: number) => (
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

export default WeatherSlider;
