"use client";

import React, { useEffect, useState } from "react";

const ArtworksCarousel = () => {
  const [artworks, setArtworks] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch artworks from the Art Institute API on mount
  useEffect(() => {
    const fetchArtworks = async () => {
      try {
        const response = await fetch("https://api.artic.edu/api/v1/artworks");
        const data = await response.json();
        // Set the artworks array from the API response
        setArtworks(data.data || []);
      } catch (error) {
        console.error("Error fetching artworks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtworks();
  }, []);

  // Handlers to go to the next or previous slide
  const nextSlide = () => {
    setActiveIndex((prevIndex) =>
      prevIndex === artworks.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setActiveIndex((prevIndex) =>
      prevIndex === 0 ? artworks.length - 1 : prevIndex - 1
    );
  };

  if (loading) {
    return <div className="text-center py-10">Loading artworks...</div>;
  }

  if (!artworks.length) {
    return <div className="text-center py-10">No artworks available</div>;
  }

  // Get the current artwork and build its image URL
  const currentArtwork = artworks[activeIndex];
  const imageUrl = currentArtwork.image_id
    ? `https://www.artic.edu/iiif/2/${currentArtwork.image_id}/full/800,/0/default.jpg`
    : null;

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Slide Container */}
      <div className="overflow-hidden relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={currentArtwork.title}
            className="w-full object-cover"
          />
        ) : (
          <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
            <p>No Image Available</p>
          </div>
        )}
        {/* Overlay Caption */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 text-white">
          <h3 className="text-xl font-bold">{currentArtwork.title}</h3>
          <p>{currentArtwork.artist_display}</p>
          <p>Place of Origin: {currentArtwork.place_of_origin}</p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={prevSlide}
        className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full focus:outline-none"
      >
        Prev
      </button>
      <button
        onClick={nextSlide}
        className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full focus:outline-none"
      >
        Next
      </button>

      {/* Slide Indicators */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
        {artworks.map((_, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-full ${
              index === activeIndex ? "bg-white" : "bg-gray-500"
            }`}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default ArtworksCarousel;
