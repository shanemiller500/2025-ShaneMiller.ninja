import React from "react";
import ArtworksCarousel from "./ArtworksCarousel"; 

const ArtworksPage = () => {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-6">
        Art Institute of Chicago Artworks
      </h1>
      <ArtworksCarousel />
    </div>
  );
};

export default ArtworksPage;
