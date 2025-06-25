// app/artworks/page.tsx
import ArtworksCarousel from "./ArtworksCarousel";
import ArtworksGallery from "./ArtworksGallery";

export default function ArtworksPage() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-neutral-900 transition-colors pb-20">
      <section className="pt-12 max-w-7xl mx-auto px-4">
        <img
            src="/images/aic.png"
            alt="Art Institute of Chicago logo"
            className="mx-auto w-40 mb-12"
          />

        <ArtworksCarousel />
      </section>

      {/* Older works grid */}
      <section className="mt-20 max-w-7xl mx-auto px-4">

        <h2 className="font-semibold mb-6 text-neutral-900 dark:text-neutral-100">
         <em>Older Works in the Collection</em> 
        </h2>
        <ArtworksGallery />
      </section>
    </main>
  );
}
