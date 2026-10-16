import type { Metadata } from "next";
import HiddenClient from "./HiddenClient";

export const metadata: Metadata = {
  title: "Hidden Earth | Lidar reveals earthworks, faults and landslides under the trees",
  description:
    "See the ground the way lidar does — trees and buildings stripped away. Ancient mounds, hidden faults, old landslides and Civil War trenches across the U.S., in five lidar views with a satellite-vs-lidar peel.",
};

export default function HiddenEarthPage() {
  return <HiddenClient />;
}
