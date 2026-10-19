import type { Metadata } from "next";
import FossilClient from "./FossilClient";

export const metadata: Metadata = {
  title: "Prehistoric Earth | 278,000 fossil sites worldwide, dinosaur country and a time machine",
  description:
    "Every fossil site in the Paleobiology Database — 278,000 in 240+ countries and territories — by geologic period, with the dinosaur sites marked, what was found at each one, and a time machine back 540 million years to the seas and continents they lived in.",
};

export default function FossilAtlasPage() {
  return <FossilClient />;
}
