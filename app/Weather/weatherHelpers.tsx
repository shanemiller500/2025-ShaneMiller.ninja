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
import { weatherGradients } from '@/utils/colors';

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
        background: weatherGradients.sunny,
        animation: 'sunshine 10s infinite alternate ease-in-out'
      };
    case [1, 2, 3].includes(code):
      return { background: weatherGradients.cloudy };
    case [45, 48].includes(code):
      return { background: weatherGradients.foggy };
    case [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code):
      return { background: weatherGradients.rainy };
    case [71, 73, 75, 77, 85, 86].includes(code):
      return { background: weatherGradients.snowy };
    case [95, 96, 99].includes(code):
      return { background: weatherGradients.stormy };
    default:
      return { background: weatherGradients.neutral };
  }
};

