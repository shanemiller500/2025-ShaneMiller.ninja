import type { Metadata } from "next";
import ShipwrecksClient from "./ShipwrecksClient";

export const metadata: Metadata = {
  title: "Shipwrecks | Every wreck on NOAA's charts, 30,000 named wrecks and their stories",
  description:
    "Explore the 12,000+ wrecks on NOAA's nautical charts, 30,000 named shipwrecks worldwide, the National Marine Sanctuaries that protect them, and the stories of the Titanic, USS Monitor, USS Arizona, the Edmund Fitzgerald and more.",
};

export default function ShipwrecksPage() {
  return <ShipwrecksClient />;
}
