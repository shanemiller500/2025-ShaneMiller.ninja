"use client";

import { useEffect, useState } from "react";
import { connectedPads, padName } from "../input/gamepad";

/** Name of the first connected controller (null when none). */
export function usePadConnected() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const check = () => {
      const p = connectedPads()[0];
      setName(p ? padName(p) : null);
    };
    check();
    window.addEventListener("gamepadconnected", check);
    window.addEventListener("gamepaddisconnected", check);
    // Chrome only exposes an already-paired pad after its first button press
    const id = window.setInterval(check, 1500);
    return () => {
      window.removeEventListener("gamepadconnected", check);
      window.removeEventListener("gamepaddisconnected", check);
      window.clearInterval(id);
    };
  }, []);
  return name;
}
