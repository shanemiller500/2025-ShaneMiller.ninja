/* ------------------------------------------------------------------ */
/*  Local persistence. Everything is wrapped in try/catch: private     */
/*  windows, full storage or blocked site data just mean "no save".    */
/* ------------------------------------------------------------------ */
import { World, type SaveData } from "../sim/world";

const WORLD_KEY = "dinosors:world:v1";
const SETTINGS_KEY = "dinosors:settings:v1";

export interface Settings {
  muted: boolean;
  volume: number;
  /** first-visit hint already shown */
  welcomed: boolean;
}

export const DEFAULT_SETTINGS: Settings = { muted: false, volume: 0.8, welcomed: false };

export function loadWorld(): World | null {
  try {
    const raw = localStorage.getItem(WORLD_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data?.v !== 1) return null;
    return World.deserialize(data);
  } catch {
    return null;
  }
}

export function saveWorld(w: World) {
  try {
    localStorage.setItem(WORLD_KEY, JSON.stringify(w.serialize()));
    return true;
  } catch {
    return false;
  }
}

export function clearWorld() {
  try {
    localStorage.removeItem(WORLD_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
