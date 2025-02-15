'use client';

import React, { useState, useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";

const API_KEY = process.env.NEXT_PUBLIC_ISS_KEY;

/**
 * Custom carousel component for each camera group.
 * This component now includes an interactive modal/lightbox view.
 */
const PhotoCarousel = ({ cameraName, photos }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // Move to the next slide in the carousel view.
  const nextSlide = () => {
    const nextIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(nextIndex);
    trackEvent("Camera Slide Next Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: nextIndex,
      photoId: photos[nextIndex].id,
    });
  };

  // Move to the previous slide in the carousel view.
  const prevSlide = () => {
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setCurrentIndex(prevIndex);
    trackEvent("Camera Slide Prev Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: prevIndex,
      photoId: photos[prevIndex].id,
    });
  };

  // Opens the modal and tracks the event.
  const openModal = () => {
    setModalOpen(true);
    trackEvent("Camera Modal Opened", {
      cameraName,
      currentIndex,
      photoId: photos[currentIndex].id,
    });
  };

  // Closes the modal and tracks the event.
  const closeModal = () => {
    setModalOpen(false);
    trackEvent("Camera Modal Closed", {
      cameraName,
      currentIndex,
      photoId: photos[currentIndex].id,
    });
  };

  // Next slide inside the modal view.
  const modalNext = () => {
    const nextIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(nextIndex);
    trackEvent("Camera Modal Next Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: nextIndex,
      photoId: photos[nextIndex].id,
    });
  };

  // Previous slide inside the modal view.
  const modalPrev = () => {
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setCurrentIndex(prevIndex);
    trackEvent("Camera Modal Prev Clicked", {
      cameraName,
      fromIndex: currentIndex,
      toIndex: prevIndex,
      photoId: photos[prevIndex].id,
    });
  };

  return (
    <div className="mb-8">
      <h3 className="text-2xl font-bold mb-2">{cameraName}</h3>
      <div className="relative">
        {/* The image is clickable now and will open the modal. */}
        <img
          src={photos[currentIndex].img_src}
          alt={photos[currentIndex].title}
          onClick={openModal}
          className="w-full h-64 object-cover rounded cursor-pointer transform hover:scale-105 transition duration-300"
        />
        {/* Navigation buttons for the carousel view */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-gray-700 bg-opacity-50 text-white p-2 rounded-full"
            >
              &lt;
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-700 bg-opacity-50 text-white p-2 rounded-full"
            >
              &gt;
            </button>
          </>
        )}
      </div>
      <div className="mt-2 text-center text-sm text-gray-500">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Modal view for the image */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Dark overlay to close the modal when clicked */}
          <div
            className="absolute inset-0 bg-black bg-opacity-75 transition-opacity duration-300"
            onClick={closeModal}
          ></div>
          <div className="relative z-10 max-w-4xl mx-auto p-4">
            <div className="relative">
              <img
                src={photos[currentIndex].img_src}
                alt={photos[currentIndex].title}
                className="max-w-full max-h-screen object-contain rounded shadow-lg"
              />
              {/* Close button in the top right of the modal */}
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 bg-gray-800 bg-opacity-75 text-white p-2 rounded-full hover:bg-opacity-100 transition"
              >
                &#10005;
              </button>
              {/* Modal navigation buttons */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={modalPrev}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-100 transition"
                  >
                    &lt;
                  </button>
                  <button
                    onClick={modalNext}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-100 transition"
                  >
                    &gt;
                  </button>
                </>
              )}
            </div>
            {/* Photo details in the modal */}
            <div className="mt-4 text-center text-white">
              <h4 className="text-xl font-bold">{photos[currentIndex].title}</h4>
              <p className="text-sm">{photos[currentIndex].earth_date}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MarsRoverPhotos = () => {
  const [solDay, setSolDay] = useState("");
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Calculate and display the current Earth day and current Sol day.
  // For Curiosity, we assume Sol Day 1 was on Earth day August 6, 2012.
  const landingDate = new Date("2012-08-06T00:00:00Z");
  const now = new Date();
  const msDifference = now.getTime() - landingDate.getTime();
  // Approximate length of a sol in milliseconds: 24 hours + 39 minutes + 35 seconds
  const solDurationMs = (24 * 3600 + 39 * 60 + 35) * 1000;
  const currentSol = Math.floor(msDifference / solDurationMs) + 1;
  const currentEarthDay = now.toLocaleDateString();

  // Tracking page view (I like to keep a close eye on our analytics!)
  useEffect(() => {
    trackEvent("Mars Rover Photos Page Viewed", { page: "Mars Rover Photos" });
  }, []);

  const searchPhotos = async () => {
    if (!solDay || isNaN(Number(solDay))) {
      alert("Please enter a valid sol day (numeric value).");
      trackEvent("Mars Rover Photos Search Failed", { reason: "Invalid input", solDay });
      return;
    }

    trackEvent("Mars Rover Photos Search Initiated", { solDay });
    setLoading(true);
    setPhotos([]); // Clearing out previous photos because we're starting fresh.

    const apiUrl = `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?sol=${solDay}&api_key=${API_KEY}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      const fetchedPhotos = data.photos;

      if (!fetchedPhotos || fetchedPhotos.length === 0) {
        alert("No photos found for this sol day.");
        trackEvent("Mars Rover Photos Search No Results", { solDay });
      } else {
        trackEvent("Mars Rover Photos Search Success", { solDay, photoCount: fetchedPhotos.length });
        setPhotos(fetchedPhotos);
      }
    } catch (error) {
      console.error("Error fetching Mars photos:", error);
      alert("Failed to fetch data from API.");
      trackEvent("Mars Rover Photos Search Error", { solDay, error: error.toString() });
    } finally {
      setLoading(false);
    }
  };

  // Group photos by their camera full name to create separate carousels for each camera.
  const groupedPhotos = photos.reduce((groups, photo) => {
    const cameraName = photo.camera.full_name;
    if (!groups[cameraName]) {
      groups[cameraName] = [];
    }
    groups[cameraName].push(photo);
    return groups;
  }, {});

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-3xl font-bold text-center mb-6">Mars Rover Photos</h2>

      {/* Reference Information */}
      <div className="mb-4 text-center">
        <p className="text-sm text-gray-500">
          Current Earth Day: <strong>{currentEarthDay}</strong> | Current Sol Day: <strong>{currentSol}</strong>
        </p>
        <p className="text-sm text-gray-500">
          Note: Sol Day 1 was on Earth day August 6, 2012.
        </p>
      </div>

      {/* Search section */}
      <div className="flex flex-col sm:flex-row gap-2 justify-center mb-6">
        <input
          type="text"
          placeholder="Enter sol day (numeric)"
          value={solDay}
          onChange={(e) => setSolDay(e.target.value)}
          className="border border-gray-300 rounded p-2 w-full sm:w-64 focus:outline-none dark:bg-gray-800 dark:border-gray-700"
        />
        <button
          onClick={searchPhotos}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded px-4 py-2 hover:bg-gradient-to-r from-indigo-600 to-purple-600 transition"
        >
          Search
        </button>
      </div>

      {loading && <p className="text-center">Loading...</p>}

      {/* Render a carousel for each camera group */}
      {!loading && photos.length > 0 && (
        <div>
          {Object.keys(groupedPhotos).map((cameraName) => (
            <PhotoCarousel
              key={cameraName}
              cameraName={cameraName}
              photos={groupedPhotos[cameraName]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MarsRoverPhotos;
