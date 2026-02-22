"use client";

import { useCallback, useRef, useState } from "react";
import type { FullCountry, Extras } from "../lib/types";
import { trackEvent } from "@/utils/mixpanel";

export function useCountryDetails() {
  const [full, setFull] = useState<FullCountry | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [mapURL, setMapURL] = useState("");

  const detailsAbort = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);

  const loadDetails = useCallback(async (cca3: string) => {
    detailsAbort.current?.abort();
    const ctrl = new AbortController();
    detailsAbort.current = ctrl;
    setLoadingDetails(true);
    setExtras(null);
    const seq = ++requestSeq.current;

    try {
      trackEvent("Country Details Load Start", { cca3 });
      const fullData: FullCountry = (
        await fetch(`https://restcountries.com/v3.1/alpha/${cca3}`, { signal: ctrl.signal }).then((r) => r.json())
      )[0];

      if (ctrl.signal.aborted || requestSeq.current !== seq) return;
      setFull(fullData);

      if (fullData.latlng?.length === 2) {
        const [lat, lng] = fullData.latlng;
        setMapURL(`https://maps.google.com/maps?q=${lat},${lng}&z=5&output=embed`);
      } else {
        setMapURL("");
      }

      const [weather, fx, wiki, geo, pics] = await Promise.all([
        fullData.latlng
          ? fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${fullData.latlng[0]}&longitude=${fullData.latlng[1]}&current_weather=true`,
              { signal: ctrl.signal },
            )
              .then((r) => r.json())
              .then((j) =>
                j?.current_weather
                  ? { temperature: j.current_weather.temperature, windspeed: j.current_weather.windspeed, weathercode: j.current_weather.weathercode }
                  : undefined,
              )
              .catch(() => undefined)
          : undefined,

        (() => {
          const code = fullData.currencies ? Object.keys(fullData.currencies)[0] : "USD";
          return fetch(`https://api.exchangerate.host/latest?base=${code}&symbols=USD`, { signal: ctrl.signal })
            .then((r) => r.json())
            .then((j) => j?.rates?.USD ?? null)
            .catch(() => null);
        })(),

        fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(fullData.name.common)}`,
          { signal: ctrl.signal },
        )
          .then((r) => r.json())
          .catch(() => ({})),

        fullData.latlng
          ? fetch(
              `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=20000&gslimit=8&gscoord=${fullData.latlng[0]}|${fullData.latlng[1]}&format=json&origin=*`,
              { signal: ctrl.signal },
            )
              .then((r) => r.json())
              .then((j) => j?.query?.geosearch)
              .catch(() => [])
          : undefined,

        fetch(
          `https://u-mail.co/api/photo?tags=${encodeURIComponent(fullData.name.common)}&limit=12`,
          { signal: ctrl.signal },
        )
          .then((r) => r.json())
          .catch(() => []),
      ]);

      if (ctrl.signal.aborted || requestSeq.current !== seq) return;

      setExtras({
        weather,
        fx,
        wiki,
        sights: geo?.map((g: any) => ({ title: g.title, dist: g.dist })) ?? [],
        photos: Array.isArray(pics) ? pics : [],
      });

      trackEvent("Country Details Load Success", { cca3 });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("loadDetails error:", err);
      trackEvent("Country Details Load Fail", { cca3, error: String(err?.message || err) });
    } finally {
      if (!ctrl.signal.aborted && requestSeq.current === seq) setLoadingDetails(false);
    }
  }, []);

  return { full, extras, loadingDetails, mapURL, loadDetails };
}
