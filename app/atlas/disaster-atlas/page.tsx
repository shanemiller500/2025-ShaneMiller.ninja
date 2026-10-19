import type { Metadata } from "next";
import DisasterClient from "./DisasterClient";

export const metadata: Metadata = {
  title: "Disaster Atlas | Live wildfires, hurricanes, tornado reports, floods and warnings",
  description:
    "A live map of hazards: tropical cyclones, satellite fire detections and GDACS disaster alerts worldwide, plus U.S. National Weather Service warnings, wildfire perimeters, storm reports and flooding rivers over FEMA's county risk index.",
};

export default function DisasterAtlasPage() {
  return <DisasterClient />;
}
