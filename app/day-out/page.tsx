import type { Metadata } from "next";
import DayOutClient from "./DayOutClient";
import { PLACES } from "./lib/providers/places";

export const metadata: Metadata = { title: "Day Out | A little adventure, close to home", description: "Find your next day out around the Gold Coast and South East Queensland." };
export default function DayOutPage() {
  return <DayOutClient places={PLACES} />;
}
