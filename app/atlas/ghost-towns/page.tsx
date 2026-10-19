import type { Metadata } from "next";
import GhostClient from "./GhostClient";

export const metadata: Metadata = {
  title: "Ghost Towns | 8,500 ghost towns and abandoned villages worldwide, vanished U.S. places and drowned towns",
  description:
    "8,500 ghost towns and abandoned villages in 99 countries, 10,700 places the USGS lists as vanished, towns drowned under American reservoirs — and the stories of Bodie, Humberstone, Wharram Percy, Kennecott and the lost towns of the Quabbin.",
};

export default function GhostTownsPage() {
  return <GhostClient />;
}
