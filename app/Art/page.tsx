// app/artworks/page.tsx
import ArtworksCarousel from "./ArtworksCarousel";
import ArtworksGallery from "./ArtworksGallery";

export default function ArtworksPage() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-brand-900 transition-colors pb-20">
      <section className="pt-10 sm:pt-12 max-w-7xl mx-auto px-4">
        <div className="mb-10 sm:mb-12 flex flex-col items-center text-center gap-3">
          <img
            src="/images/aic.png"
            alt="Art Institute of Chicago logo"
            className="w-28 sm:w-36 md:w-40"
          />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
            Art Institute of Chicago
          </h1>
    
        </div>

        <ArtworksCarousel />
      </section>

      {/* Older works grid */}
      <section className="mt-14 sm:mt-20 max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-5 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 dark:text-neutral-100">
            <em>Older Works in the Collection</em>
          </h2>
          <span className="hidden sm:inline-flex text-xs font-bold text-neutral-500 dark:text-neutral-400">
            Tap an image to open
          </span>
        </div>

        <ArtworksGallery />
      </section>
    </main>
  );
}
