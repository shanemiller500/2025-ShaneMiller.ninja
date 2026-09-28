"use client";

import Image from "next/image";

import Portrait from "@/public/images/charles/charles-portrait.jpg";
import Deck from "@/public/images/charles/charles-deck.jpg";
import Couch from "@/public/images/charles/charles-couch.jpg";
import River from "@/public/images/charles/charles-river.jpg";
import Grin from "@/public/images/charles/charles-grin.jpg";
import DeckPatrol from "@/public/images/charles/charles-deck-patrol.jpg";
import Trail from "@/public/images/charles/charles-trail.jpg";

const PHOTOS = [
  { src: Portrait, caption: "Official portrait. Snaggle tooth on purpose." },
  { src: Deck, caption: "Tail up. Threat level: wind." },
  { src: Couch, caption: "Not allowed on the couch. Clearly." },
  { src: River, caption: "River days. Still not fetching." },
  { src: Grin, caption: "Heard a chip bag open two rooms away." },
  { src: DeckPatrol, caption: "Cabin deck patrol. Checking on you, not the snacks." },
  { src: Trail, caption: "Wildflowers. Did not stop to smell them. Smelled everything else." },
];

/** The real Charles, in a masonry grid that keeps each photo's shape. */
export default function RealPhotos() {
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
      {PHOTOS.map((p, i) => (
        <figure
          key={p.caption}
          className={[
            "group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg transition duration-300 hover:rotate-0",
            i % 2 ? "rotate-1" : "-rotate-1",
          ].join(" ")}
        >
          <div className="overflow-hidden">
            <Image
              src={p.src}
              alt={`Charles the dog: ${p.caption}`}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="h-auto w-full transition duration-500 group-hover:scale-105"
              placeholder="blur"
            />
          </div>
          <figcaption className="px-3 py-2 text-xs font-semibold text-white/65">{p.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}
