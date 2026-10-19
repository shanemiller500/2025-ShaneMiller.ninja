import type { Metadata } from "next";
import MinesClient from "./MinesClient";

export const metadata: Metadata = {
  title: "Lost Mines | 304,000 mines worldwide, old shafts and adits, and the gold rushes",
  description:
    "Every mine in the USGS Mineral Resources Data System — 304,000 in 165 countries — with MSHA's U.S. register and the shafts and adits on the old USGS topo maps, and the stories of Potosí, Falun, Wieliczka, Cornwall, Sewell, Sutter's Mill, Homestake and the Klondike.",
};

export default function LostMinesPage() {
  return <MinesClient />;
}
