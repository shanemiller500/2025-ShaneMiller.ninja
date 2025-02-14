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
  if (code === 0)
    return { background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' };
  if ([1, 2].includes(code))
    return { background: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' };
  if (code === 3)
    return { background: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' };
  if ([45, 48].includes(code))
    return { background: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)' };
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { background: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' };
  if ([95, 96, 99].includes(code))
    return { background: 'linear-gradient(135deg, #fbd3e9 0%, #bb377d 100%)' };
  return { background: 'linear-gradient(135deg, #ece9e6 0%, #ffffff 100%)' };
};
