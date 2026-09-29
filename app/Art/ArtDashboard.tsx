"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Frame, LayoutGrid } from "lucide-react";
import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { trackEvent } from "@/utils/mixpanel";
import ArtworksCarousel from "./ArtworksCarousel";
import ArtworksGallery from "./ArtworksGallery";
import ArtworkModal from "./ArtworkModal";
import type { Artwork } from "./lib";

type TabKey = "featured" | "collection";
const TABS: DashboardTab<TabKey>[] = [
  { key: "featured", label: "Featured rooms", hint: "Slideshow", icon: <Frame className="h-4 w-4" /> },
  { key: "collection", label: "The collection", hint: "Search 41k works", icon: <LayoutGrid className="h-4 w-4" /> },
];

export default function ArtDashboard() {
  const [open, setOpen] = useState<Artwork | null>(null);
  useEffect(() => { trackEvent("Art Page Viewed"); }, []);

  const openArtwork = (a: Artwork) => { setOpen(a); trackEvent("Artwork Opened", { id: a.id }); };
  const panels: Record<TabKey, () => ReactNode> = {
    featured: () => <ArtworksCarousel onOpen={openArtwork} />,
    collection: () => <ArtworksGallery onOpen={openArtwork} />,
  };

  return (
    <>
      <DashboardShell
        id="art"
        path="~/art"
        liveLabel="open access"
        title="Cleveland Museum of Art"
        description="Wander the Cleveland Museum of Art's open collection: Monet, Van Gogh, Degas, Hokusai and tens of thousands more. Every piece here is public domain (CC0); tap one for its story."
        tabs={TABS}
        renderPanel={(key) => panels[key]()}
        onTabChange={(key) => trackEvent("Art Tab Click", { tab: key })}
      />
      <ArtworkModal artwork={open} onClose={() => setOpen(null)} />
    </>
  );
}
