// app/Weather/helpers/weatherHelpers.ts

import React from 'react';
import {
  WiDaySunny,
  WiDayCloudy,
  WiCloud,
  WiRain,
  WiSnow,
  WiFog,
  WiThunderstorm,
} from 'react-icons/wi';

export const getWeatherIcon = (code: number, size: number = 48) => {
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

export const getBackgroundImage = (code: number) => {
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

export const getForecastCardStyle = (code: number) => {
  switch (true) {
    case code === 0:
      // Clear Sky - Sunny animation
      return {
        background: 'linear-gradient(135deg, #fceabb 0%, #f7b733 100%)',
        animation: 'sunshine 10s infinite alternate ease-in-out'
      };
    case [1, 2, 3].includes(code):
      return { background: 'linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)' }; // Cloudy
    case [45, 48].includes(code):
      return { background: 'linear-gradient(135deg, #d7d2cc 0%, #304352 100%)' }; // Foggy
    case [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code):
      return { background: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' }; // Rainy
    case [71, 73, 75, 77, 85, 86].includes(code):
      return { background: 'linear-gradient(135deg, #e6dada 0%, #bdc3c7 100%)' }; // Snowy
    case [95, 96, 99].includes(code):
      return { background: 'linear-gradient(135deg, #283048 0%, #859398 100%)' }; // Stormy
    default:
      return { background: 'linear-gradient(135deg, #ece9e6 0%, #ffffff 100%)' }; // Neutral
  }
};

