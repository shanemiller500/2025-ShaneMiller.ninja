import type { Metadata } from "next";
import localFont from "next/font/local";
import DinosorsClient from "./DinosorsClient";

// a clean, modern UI face (the same Inter the rest of the site uses)
const inter = localFont({ src: "../../public/fonts/Inter-latin.woff2", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "Dinosaur Land | A prehistoric sandbox for kids",
  description: "Explore a living dinosaur world: feed dinos, hatch eggs, make it rain, erupt the volcano and help the cave people discover fire.",
};

export default function DinosorsPage() {
  return <DinosorsClient fontClass={inter.className} />;
}
