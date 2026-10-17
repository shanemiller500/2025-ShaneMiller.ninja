import type { Metadata } from "next";
import FossilClient from "./FossilClient";

export const metadata: Metadata = {
  title: "Prehistoric USA | 62,000 fossil sites, dinosaur country and fossil parks",
  description:
    "Every U.S. fossil site in the Paleobiology Database, coloured by geologic period — the dinosaur sites marked, what was found at each one, and the stories of Dinosaur National Monument, White Sands, Petrified Forest and more.",
};

export default function FossilAtlasPage() {
  return <FossilClient />;
}
