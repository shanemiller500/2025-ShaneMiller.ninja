"use client";

import React, { useState } from "react";

const API_KEY = "mud9spxbq6i1MTj1Q52GKEzdL3wPgyeAeNo20dzB";

const MarsRoverPhotos = () => {
  const [solDay, setSolDay] = useState("");
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchPhotos = async () => {
    if (!solDay || isNaN(solDay)) {
      alert("Please enter a valid sol day (numeric value).");
      return;
    }

    setLoading(true);
    setPhotos([]); // Clear previous photos

    const apiUrl = `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?sol=${solDay}&api_key=${API_KEY}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      const fetchedPhotos = data.photos;

      // Limit photos per camera to 10
      const photoCounts = {};
      const selectedPhotos = [];

      if (fetchedPhotos.length > 0) {
        fetchedPhotos.forEach((photo) => {
          const cameraName = photo.camera.full_name;
          if (!photoCounts[cameraName]) {
            photoCounts[cameraName] = 1;
            selectedPhotos.push(photo);
          } else if (photoCounts[cameraName] < 10) {
            photoCounts[cameraName]++;
            selectedPhotos.push(photo);
          }
        });
      } else {
        alert("No photos found for this sol day.");
      }

      // Simulate a 2‑second loading delay before displaying the photos
      setTimeout(() => {
        setPhotos(selectedPhotos);
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error("Error fetching Mars photos:", error);
      alert("Failed to fetch data from API.");
      setLoading(false);
    }
  };

  return (
    <div className="p-4 dark:bg-gray-900 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-4 text-center">Mars Rover Photos</h2>
      <div className="mb-4 flex flex-col sm:flex-row items-center gap-2">
        <input
          type="text"
          placeholder="Enter sol day (numeric)"
          value={solDay}
          onChange={(e) => setSolDay(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full sm:w-auto dark:bg-gray-800 dark:border-gray-700 focus:outline-none"
        />
        <button
          onClick={searchPhotos}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
        >
          Search
        </button>
      </div>

      {loading && (
        <div id="marsLoadingSpinner" className="my-4">
          <p className="text-center">Loading...</p>
        </div>
      )}

      {photos.length > 0 && (
        <div
          id="marsPhotoContainer"
          className="flex flex-wrap justify-center gap-4"
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="w-80 border border-gray-300 rounded p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <img
                src={photo.img_src}
                alt="Mars Photo"
                className="w-full rounded mb-2"
              />
              <p className="text-sm">
                <span className="font-semibold">Camera:</span> {photo.camera.full_name}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Earth Date:</span> {photo.earth_date}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarsRoverPhotos;
