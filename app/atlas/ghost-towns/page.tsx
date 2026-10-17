import type { Metadata } from "next";
import GhostClient from "./GhostClient";

export const metadata: Metadata = {
  title: "Ghost Towns | 10,000 vanished U.S. places, ghost towns worldwide and drowned towns",
  description:
    "Every populated place the USGS lists as vanished, 3,000+ ghost towns worldwide, the towns drowned under American reservoirs — and the stories of Bodie, Rhyolite, Kennecott, Bannack, Garnet and the lost towns of the Quabbin.",
};

export default function GhostTownsPage() {
  return <GhostClient />;
}
