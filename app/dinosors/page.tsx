import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import DinosorsClient from "./DinosorsClient";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "Dinosaur Land | A prehistoric sandbox for kids",
  description: "Explore a living dinosaur world: feed dinos, hatch eggs, make it rain, erupt the volcano and help the cave people discover fire.",
};

export default function DinosorsPage() {
  return <DinosorsClient fontClass={fredoka.className} />;
}
