import type { Metadata } from "next";
import DisasterClient from "./DisasterClient";

export const metadata: Metadata = {
  title: "Disaster Atlas | Live wildfires, hurricanes, tornado reports, floods and warnings",
  description:
    "A live map of U.S. hazards: National Weather Service warnings, active wildfire perimeters and satellite fire detections, hurricanes with their forecast cones, today's storm reports and flooding rivers — over FEMA's county risk index.",
};

export default function DisasterAtlasPage() {
  return <DisasterClient />;
}
