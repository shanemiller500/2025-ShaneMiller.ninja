"use client";

import { useCallback, useRef, useState } from "react";
import type { AITravelInsights } from "../lib/types";

const CACHE_PREFIX = "travel_ai_v2_";

function cacheKey(country: string) {
  return `${CACHE_PREFIX}${country.toLowerCase().trim()}`;
}

function readCache(country: string): AITravelInsights | null {
  try {
    const raw = localStorage.getItem(cacheKey(country));
    return raw ? (JSON.parse(raw) as AITravelInsights) : null;
  } catch {
    return null;
  }
}

function writeCache(country: string, data: AITravelInsights) {
  try {
    localStorage.setItem(cacheKey(country), JSON.stringify(data));
  } catch {
    // Storage quota exceeded — silently skip caching
  }
}

export function useAITravelInsights() {
  const [insights, setInsights] = useState<AITravelInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which country is currently loaded so we don't re-fetch unnecessarily
  const loadedRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const loadInsights = useCallback(async (countryName: string) => {
    if (!countryName) return;

    // Same country already loaded — no-op
    if (loadedRef.current === countryName && (insights !== null || loading)) return;

    // Cache hit — instant
    const cached = readCache(countryName);
    if (cached) {
      setInsights(cached);
      setError(null);
      loadedRef.current = countryName;
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setInsights(null);
    loadedRef.current = countryName;

    try {
      const res = await fetch("/api/countryinsights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: countryName }),
        signal: ctrl.signal,
      });

      if (ctrl.signal.aborted) return;

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "Failed to load travel insights — please try again.");
        return;
      }

      const data = json?.data as AITravelInsights;
      writeCache(countryName, data);
      setInsights(data);
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Unable to reach the AI travel insights service. Please try again.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []); // stable — all mutable state via refs/setters

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setInsights(null);
    setError(null);
    setLoading(false);
    loadedRef.current = "";
  }, []);

  return { insights, loading, error, loadInsights, reset };
}
