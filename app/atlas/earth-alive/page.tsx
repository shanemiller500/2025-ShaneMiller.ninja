import type { Metadata } from "next";
import EarthAliveClient from "./EarthAliveClient";

export const metadata: Metadata = {
  title: "Earth Alive | Live earthquakes, plates & volcanoes",
  description: "A live map of every earthquake USGS reports, the plate boundaries and U.S. faults behind them, and the world's active volcanoes with current USGS alert levels.",
};

export default function EarthAlivePage() {
  return <EarthAliveClient />;
}
