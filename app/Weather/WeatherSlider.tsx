"use client";

import { motion } from "framer-motion";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import { WeatherData } from "./types";
import { getForecastCardStyle, getWeatherIcon } from "./weatherHelpers";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface WeatherSliderProps {
  daily: NonNullable<WeatherData["daily"]>;
  tempUnit: "C" | "F";
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SLIDER_SETTINGS = {
  dots: true,
  infinite: false,
  speed: 450,
  slidesToShow: 3,
  slidesToScroll: 1,
  arrows: false,
  responsive: [
    { breakpoint: 1024, settings: { slidesToShow: 3 } },
    { breakpoint: 768, settings: { slidesToShow: 2 } },
    { breakpoint: 520, settings: { slidesToShow: 1 } },
  ],
};

const MM_TO_INCHES = 25.4;

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */
function toF(c: number): number {
  return (c * 9) / 5 + 32;
}

/* ------------------------------------------------------------------ */
/*  WeatherSlider Component                                            */
/* ------------------------------------------------------------------ */
export default function WeatherSlider({ daily, tempUnit }: WeatherSliderProps) {
  const fmtTemp = (c: number): string =>
    tempUnit === "F" ? `${toF(c).toFixed(1)}°F` : `${c}°C`;

  return (
    <div className="relative">
      <Slider {...SLIDER_SETTINGS}>
        {daily.time.map((time: string, index: number) => {
          // Force local midday to avoid UTC -> previous-day shift
          const date = new Date(`${time}T12:00:00`);
          const day = date.toLocaleDateString([], { weekday: "short" });
          const md = date.toLocaleDateString([], { month: "short", day: "numeric" });

          const high = fmtTemp(daily.temperature_2m_max[index]);
          const low = fmtTemp(daily.temperature_2m_min[index]);

          const precipMM = daily.precipitation_sum[index];
          const precip =
            tempUnit === "F"
              ? `${(precipMM / MM_TO_INCHES).toFixed(2)} in`
              : `${precipMM} mm`;

          const sunrise = daily.sunrise?.[index];
          const sunset = daily.sunset?.[index];

          return (
            <motion.div
              key={index}
              className="p-2 sm:p-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.99 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div
                style={getForecastCardStyle(daily.weathercode[index])}
                className="relative overflow-hidden rounded-2xl border border-white/10 p-5 shadow-lg"
              >
                {/* subtle overlay for readability */}
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-white/80">{day}</div>
                      <div className="text-lg font-extrabold text-white">{md}</div>
                    </div>

                    <div className="text-white">{getWeatherIcon(daily.weathercode[index], 56)}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                      <div className="text-[11px] font-bold text-white/70">High</div>
                      <div className="mt-1 text-base font-extrabold text-white">{high}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                      <div className="text-[11px] font-bold text-white/70">Low</div>
                      <div className="mt-1 text-base font-extrabold text-white">{low}</div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-white/10 p-3">
                    <div className="text-[11px] font-bold text-white/70">Precip</div>
                    <div className="mt-1 text-sm font-extrabold text-white">{precip}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold text-white/85">
                    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                      <div className="text-[11px] font-bold text-white/70">Sunrise</div>
                      <div className="mt-1">
                        {sunrise
                          ? new Date(sunrise).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                      <div className="text-[11px] font-bold text-white/70">Sunset</div>
                      <div className="mt-1">
                        {sunset
                          ? new Date(sunset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </Slider>

      <style jsx global>{`
        .slick-dots li button:before {
          color: rgba(255, 255, 255, 0.6);
        }
        .slick-dots li.slick-active button:before {
          color: rgba(255, 255, 255, 0.95);
        }
      `}</style>
    </div>
  );
}
