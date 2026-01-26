import { type ReactElement } from "react";

import {
  WiCloud,
  WiDayCloudy,
  WiDaySunny,
  WiFog,
  WiRain,
  WiSnow,
  WiThunderstorm,
} from "react-icons/wi";

import { weatherGradients } from "@/utils/colors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ForecastCardStyle {
  background: string;
  animation?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants - Weather Code Groups                                    */
/* ------------------------------------------------------------------ */
const PARTLY_CLOUDY_CODES = [1, 2];
const FOG_CODES = [45, 48];
const RAIN_CODES = [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];
const THUNDER_CODES = [95, 96, 99];

const DEFAULT_ICON_SIZE = 48;

/* ------------------------------------------------------------------ */
/*  getWeatherIcon                                                     */
/* ------------------------------------------------------------------ */
export function getWeatherIcon(code: number, size: number = DEFAULT_ICON_SIZE): ReactElement {
  if (code === 0) return <WiDaySunny size={size} />;
  if (PARTLY_CLOUDY_CODES.includes(code)) return <WiDayCloudy size={size} />;
  if (code === 3) return <WiCloud size={size} />;
  if (FOG_CODES.includes(code)) return <WiFog size={size} />;
  if (RAIN_CODES.includes(code)) return <WiRain size={size} />;
  if (SNOW_CODES.includes(code)) return <WiSnow size={size} />;
  if (THUNDER_CODES.includes(code)) return <WiThunderstorm size={size} />;
  return <WiDaySunny size={size} />;
}

/* ------------------------------------------------------------------ */
/*  getBackgroundImage                                                 */
/* ------------------------------------------------------------------ */
export function getBackgroundImage(code: number): string {
  if (code === 0) return "https://source.unsplash.com/1600x900/?sunny";
  if (PARTLY_CLOUDY_CODES.includes(code)) return "https://source.unsplash.com/1600x900/?partly-cloudy";
  if (code === 3) return "https://source.unsplash.com/1600x900/?cloudy";
  if (FOG_CODES.includes(code)) return "https://source.unsplash.com/1600x900/?fog";
  if (RAIN_CODES.includes(code)) return "https://source.unsplash.com/1600x900/?rain";
  if (SNOW_CODES.includes(code)) return "https://source.unsplash.com/1600x900/?snow";
  if (THUNDER_CODES.includes(code)) return "https://source.unsplash.com/1600x900/?thunderstorm";
  return "https://source.unsplash.com/1600x900/?weather";
}

/* ------------------------------------------------------------------ */
/*  getForecastCardStyle                                               */
/* ------------------------------------------------------------------ */
export function getForecastCardStyle(code: number): ForecastCardStyle {
  switch (true) {
    case code === 0:
      return {
        background: weatherGradients.sunny,
        animation: "sunshine 10s infinite alternate ease-in-out",
      };
    case [1, 2, 3].includes(code):
      return { background: weatherGradients.cloudy };
    case FOG_CODES.includes(code):
      return { background: weatherGradients.foggy };
    case RAIN_CODES.includes(code):
      return { background: weatherGradients.rainy };
    case SNOW_CODES.includes(code):
      return { background: weatherGradients.snowy };
    case THUNDER_CODES.includes(code):
      return { background: weatherGradients.stormy };
    default:
      return { background: weatherGradients.neutral };
  }
}
