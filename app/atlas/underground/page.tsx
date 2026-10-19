import type { Metadata } from "next";
import UndergroundClient from "./UndergroundClient";

export const metadata: Metadata = {
  title: "Underground World | Caves, karst and a 3D dive beneath the surface",
  description:
    "13,600 caves on every continent over the world karst map, every cave you can visit, and 3D dives through Mammoth, Carlsbad, Škocjan, Son Doong, the Sarawak Chamber and more.",
};

export default function UndergroundPage() {
  return <UndergroundClient />;
}
