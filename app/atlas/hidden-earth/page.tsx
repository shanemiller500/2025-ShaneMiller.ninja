import type { Metadata } from "next";
import HiddenClient from "./HiddenClient";

export const metadata: Metadata = {
  title: "Hidden Earth | Lidar reveals earthworks, faults and landslides under the trees",
  description:
    "See the ground the way lidar does — trees and buildings stripped away. Ancient mounds, hidden faults, old landslides and Civil War trenches, with 1 m lidar across the U.S., England, the Netherlands, France, Switzerland and Norway.",
};

export default function HiddenEarthPage() {
  return <HiddenClient />;
}
