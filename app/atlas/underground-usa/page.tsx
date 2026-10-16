import type { Metadata } from "next";
import UndergroundClient from "./UndergroundClient";

export const metadata: Metadata = {
  title: "Underground USA | Caves, karst and a 3D dive beneath the surface",
  description:
    "Explore the rock that hollows into caves across the U.S. (USGS karst map), find every cave you can visit, X-ray the country, and dive through 3D reconstructions of Mammoth, Carlsbad, Wind, Jewel and more.",
};

export default function UndergroundPage() {
  return <UndergroundClient />;
}
