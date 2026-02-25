"use client";

import { useCallback, useRef, useState } from "react";
import type { CountryPlacesData } from "../lib/types";

const CACHE_PREFIX = "places_v1_";

function cacheKey(country: string) {
  return `${CACHE_PREFIX}${country.toLowerCase().trim()}`;
}

function readCache(country: string): CountryPlacesData | null {
  try {
    const raw = localStorage.getItem(cacheKey(country));
    return raw ? (JSON.parse(raw) as CountryPlacesData) : null;
  } catch {
    return null;
  }
}

function writeCache(country: string, data: CountryPlacesData) {
  try {
    localStorage.setItem(cacheKey(country), JSON.stringify(data));
  } catch {
    // Storage quota exceeded — silently skip
  }
}

export function useCountryPlaces() {
  const [places, setPlaces] = useState<CountryPlacesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadedRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const loadPlaces = useCallback(async (countryName: string) => {
    if (!countryName) return;

    // Already loaded for this country — no-op
    if (loadedRef.current === countryName && (places !== null || loading)) return;

    // Cache hit — instant
    const cached = readCache(countryName);
    if (cached) {
      setPlaces(cached);
      setError(null);
      loadedRef.current = countryName;
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setPlaces(null);
    loadedRef.current = countryName;

    try {
      const res = await fetch("/api/countryplaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: countryName }),
        signal: ctrl.signal,
      });

      if (ctrl.signal.aborted) return;

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "Failed to load places — please try again.");
        return;
      }

      const data = json?.data as CountryPlacesData;
      writeCache(countryName, data);
      setPlaces(data);
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Unable to reach the places service. Please try again.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []); // stable — all mutable state via refs/setters

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPlaces(null);
    setError(null);
    setLoading(false);
    loadedRef.current = "";
  }, []);

  return { places, loading, error, loadPlaces, reset };
}
