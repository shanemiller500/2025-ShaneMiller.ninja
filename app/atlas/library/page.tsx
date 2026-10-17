import type { Metadata } from "next";
import LibraryClient from "./LibraryClient";

export const metadata: Metadata = {
  title: "Atlas library | Research behind the maps",
  description: "Explore the research and reports behind the Atlas maps.",
};

export default function AtlasLibraryPage() {
  return <LibraryClient />;
}
