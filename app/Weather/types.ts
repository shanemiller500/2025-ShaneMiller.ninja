/* ------------------------------------------------------------------ */
/*  Location Interface                                                 */
/* ------------------------------------------------------------------ */
export interface Location {
  id?: number | string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

/* ------------------------------------------------------------------ */
/*  WeatherData Interface                                              */
/* ------------------------------------------------------------------ */
export interface WeatherData {
  current_weather?: {
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    sunrise: string[];
    sunset: string[];
    weathercode: number[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    precipitation: number[];
    rain: number[];
    showers: number[];
    snowfall: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
    cloud_cover: number[];
    visibility: number[];
    lightning_potential: number[];
  };
}
