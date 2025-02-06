"use client";

import React from "react";
import NasaPhotoOfTheDay from "./nasaPhotoOfTheDay"; // Adjust path if needed
import MarsRoverPhotos from "./marsRover"; // Adjust path if needed

const NasaMediaPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100 p-4">
      <h1 className="text-4xl font-bold text-center mb-8">NASA Media</h1>
      <section className="mb-12">
        <NasaPhotoOfTheDay />
      </section>
      <section>
        <MarsRoverPhotos />
      </section>
    </div>
  );
};

export default NasaMediaPage;
