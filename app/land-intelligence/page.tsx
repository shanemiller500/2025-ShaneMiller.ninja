import type { Metadata } from "next";
import LandClient from "./LandClient";
import "./land-intelligence.css";

export const metadata: Metadata = {
  title: "Land Intelligence | Explore a location on the map",
  description: "Draw a point, route or study area on a U.S.-facing globe and explore sourced terrain, soils, water, hazards, facilities, public parcels and fatal crash records.",
};

export default function LandIntelligencePage() { return <LandClient />; }
