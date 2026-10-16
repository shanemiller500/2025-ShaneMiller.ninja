import type { Metadata } from "next";
import StrangeClient from "./StrangeClient";

export const metadata: Metadata = {
  title: "Strange Earth | Impact craters, geological oddities and the rock under your feet",
  description:
    "Every confirmed impact crater on Earth drawn at true size, 850+ U.S. arches, hoodoos, lava fields and salt flats, the bedrock under any spot you click, and orbiting 3D flyovers of ten real geological mysteries.",
};

export default function StrangeEarthPage() {
  return <StrangeClient />;
}
