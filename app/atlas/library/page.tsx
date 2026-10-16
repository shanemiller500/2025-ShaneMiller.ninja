import type { Metadata } from "next";
import LibraryClient from "./LibraryClient";

export const metadata: Metadata = {
  title: "Atlas library | USGS papers behind the maps",
  description: "Searchable public-domain USGS fact sheets and professional papers behind the Atlas map projects, hosted alongside the maps.",
};

export default function AtlasLibraryPage() {
  return <LibraryClient />;
}
