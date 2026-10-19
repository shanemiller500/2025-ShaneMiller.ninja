"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  "Near me" for every atlas map: asks the browser for a position     */
/*  once, on a click. The position is used to sort and fly — it's      */
/*  never stored or sent anywhere.                                     */
/* ------------------------------------------------------------------ */

export type Locating = "idle" | "busy" | "denied";

export function useNearMe(onFound?: (at: [number, number]) => void) {
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState<Locating>("idle");
  const found = useRef(onFound);
  useEffect(() => {
    found.current = onFound;
  });

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setMe(at);
        setLocating("idle");
        found.current?.(at);
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 }
    );
  }, []);

  return { me, setMe, locating, locate };
}
