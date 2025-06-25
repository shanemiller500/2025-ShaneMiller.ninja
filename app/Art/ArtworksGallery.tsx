/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from "react";
import { X as Close } from "lucide-react";

interface Artwork {
  id: number;
  title: string;
  image_id: string | null;
  description: string;
}

const FIELDS = "id,title,image_id,description";
const PAGE   = 2;      // “older” than the first 20
const LIMIT  = 30;     // 30 thumbnails

const iiif = (id: string | null, w = 300) =>
  id ? `https://www.artic.edu/iiif/2/${id}/full/${w},/0/default.jpg` : "";

export default function ArtworksGallery() {
  const [arts,   setArts]   = useState<Artwork[]>([]);
  const [active, setActive] = useState<Artwork | null>(null);

  /* fetch once */
  useEffect(() => {
    (async () => {
      const res  = await fetch(
        `https://api.artic.edu/api/v1/artworks?page=${PAGE}&limit=${LIMIT}&fields=${FIELDS}`
      );
      const json = await res.json();
      setArts(json.data as Artwork[]);
    })().catch(console.error);
  }, []);

  /* ------------- grid ------------- */
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {arts.map(a => (
          <button
            key={a.id}
            onClick={() => setActive(a)}
            className="group overflow-hidden rounded-lg border border-stone-200 dark:border-neutral-700 shadow-sm flex flex-col"
          >
            <img
              src={iiif(a.image_id, 500) || "/placeholder.svg"}
              alt={a.title}
              className="w-full h-[220px] object-cover duration-300 group-hover:scale-105"
            />
           
          </button>
        ))}
      </div>

      {/* ----------- lightbox ---------- */}
      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex flex-col items-center justify-center p-6"
          onClick={() => setActive(null)}
        >
          {/* close */}
          <button
            aria-label="Close"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <Close className="h-6 w-6" />
          </button>

          {/* full image */}
          <img
            src={iiif(active.image_id, 1600)}
            alt={active.title}
            className="max-h-[80vh] max-w-full object-contain cursor-zoom-out"
            onClick={e => e.stopPropagation()}
          />

          {/* title */}
          <h3 className="mt-4 text-center text-sm sm:text-base text-neutral-200 max-w-2xl">
            {active.title}
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-neutral-300">{active.description}</p>

        </div>
      )}
    </>
  );
}
