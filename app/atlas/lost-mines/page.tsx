import type { Metadata } from "next";
import MinesClient from "./MinesClient";

export const metadata: Metadata = {
  title: "Lost Mines | 304,000 mines worldwide, old shafts and adits, and the gold rushes",
  description:
    "Every mine in the USGS Mineral Resources Data System — 304,000 in 165 countries — and MSHA's register, the shafts and adits USGS drew on its old topo maps, and the stories of Reed Gold Mine, Dahlonega, Sutter's Mill, Empire, Homestake, Keane Wonder, Kennecott and the Klondike.",
};

export default function LostMinesPage() {
  return <MinesClient />;
}
