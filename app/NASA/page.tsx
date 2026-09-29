"use client";

import { type ReactNode, useEffect } from "react";
import { Orbit, Sun, Telescope } from "lucide-react";

import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { trackEvent } from "@/utils/mixpanel";
import MarsRoverPhotos from "./marsRover";
import NasaCMEPage from "./NasaCMEPage";
import NasaPhotoOfTheDay from "./nasaPhotoOfTheDay";
// Shared starfield styles (also used by the ISS page)
import "../ISS/iss.css";

type TabKey = "apod" | "mars" | "sun";

const TABS: DashboardTab<TabKey>[] = [
  { key: "apod", label: "Picture of the day", hint: "Since 1995", icon: <Telescope className="h-4 w-4" /> },
  { key: "mars", label: "Perseverance", hint: "Raw from Mars", icon: <Orbit className="h-4 w-4" /> },
  { key: "sun", label: "Space weather", hint: "Flares & CMEs", icon: <Sun className="h-4 w-4" /> },
];

const PANELS: Record<TabKey, () => ReactNode> = {
  apod: () => <NasaPhotoOfTheDay />,
  mars: () => <MarsRoverPhotos />,
  sun: () => <NasaCMEPage />,
};

export default function NasaMediaPage() {
  useEffect(() => {
    trackEvent("NASA API Page Viewed", { page: "NASA API Page" });
  }, []);

  return (
    <DashboardShell
      id="nasa"
      path="~/nasa"
      liveLabel="live from space"
      title="NASA Mission Control"
      description="Today's astronomy picture, the latest raw photos from the Perseverance rover on Mars, and what the sun's been throwing at us, all from NASA's open data."
      tabs={TABS}
      renderPanel={(key) => PANELS[key]()}
      onTabChange={(key) => trackEvent("NASA Tab Clicked", { tab: key })}
    />
  );
}
