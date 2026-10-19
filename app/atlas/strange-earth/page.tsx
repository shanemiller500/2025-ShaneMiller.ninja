import type { Metadata } from "next";
import StrangeClient from "./StrangeClient";

export const metadata: Metadata = {
  title: "Strange Earth | Impact craters, geological oddities and the rock under your feet",
  description:
    "Every confirmed impact crater on Earth drawn at true size, 4,000+ strange places in 120 countries, the bedrock under any spot you click, and orbiting 3D flyovers of real geological mysteries — from Vredefort and the Richat to Uluru and Cappadocia.",
};

export default function StrangeEarthPage() {
  return <StrangeClient />;
}
