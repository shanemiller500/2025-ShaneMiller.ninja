import type { Metadata } from "next";
import ShipwrecksClient from "./ShipwrecksClient";

export const metadata: Metadata = {
  title: "Shipwrecks | 79,000 charted wrecks worldwide, Australia's historic wrecks and 30,000 named ships",
  description:
    "79,000 wrecks on NOAA and UK Hydrographic Office charts, 7,400 historic wrecks and sunken aircraft around Australia and New Zealand, 30,000 named shipwrecks, and the stories of the Titanic, Vasa, Mary Rose, Batavia, USS Arizona and more.",
};

export default function ShipwrecksPage() {
  return <ShipwrecksClient />;
}
