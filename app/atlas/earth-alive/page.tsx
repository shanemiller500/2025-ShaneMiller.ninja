import type { Metadata } from "next";
import EarthAliveClient from "./EarthAliveClient";

export const metadata: Metadata = {
  title: "Earth Alive | Live earthquakes, plates & volcanoes",
  description:
    "Earthquakes worldwide as USGS reports them, live — with the plate boundaries and active faults behind them, the world's volcanoes, and NOAA's records of the great earthquakes and tsunamis since 2150 BC.",
};

export default function EarthAlivePage() {
  return <EarthAliveClient />;
}
