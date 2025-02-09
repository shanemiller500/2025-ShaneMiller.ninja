'use client';

import React, { useState, useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";

const API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY;

/**
 * Helper function to format a Date object as YYYY-MM-DD.
 * @param {Date} date 
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  let month = date.getMonth() + 1;
  month = month < 10 ? "0" + month : month;
  let day = date.getDate();
  day = day < 10 ? "0" + day : day;
  return `${year}-${month}-${day}`;
}

/**
 * NasaPhotoOfTheDay Component
 *
 * - Fetches and displays today's APOD.
 * - Shows a gallery for the last 7 days (excluding today) in a card grid.
 * - Each gallery image is clickable to open an interactive modal carousel.
 * - A "Load More Images" button is provided below the gallery.
 * - Both the "Image of the Day" and gallery modals include close functionality
 *   with Mixpanel tracking on all interactive buttons.
 */
const NasaPhotoOfTheDay = () => {
  // State for today's APOD
  const [todayData, setTodayData] = useState(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [todayModalOpen, setTodayModalOpen] = useState(false);

  // State for gallery images
  const [galleryData, setGalleryData] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Track the oldest date currently loaded in the gallery.
  const [galleryOldestDate, setGalleryOldestDate] = useState(null);

  // State for gallery modal carousel
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  // modalIndex refers to the index of galleryData that is currently displayed.
  const [modalIndex, setModalIndex] = useState(0);

  // -----------------------
  // Fetch Today's APOD Data
  // -----------------------
  useEffect(() => {
    const fetchTodayData = async () => {
      try {
        const response = await fetch(
          `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}`
        );
        const data = await response.json();
        setTodayData(data);
      } catch (error) {
        console.error("Error fetching today's NASA data:", error);
      } finally {
        setLoadingToday(false);
      }
    };

    fetchTodayData();
  }, []);

  // ---------------------------
  // Fetch Initial Gallery Data
  // ---------------------------
  useEffect(() => {
    const fetchGalleryData = async () => {
      try {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() - 1);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        const response = await fetch(
          `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&start_date=${startDateStr}&end_date=${endDateStr}`
        );
        const data = await response.json();
        // Reverse so that the newest gallery photo is first.
        setGalleryData(data.reverse());
        // Save the oldest date we fetched.
        setGalleryOldestDate(new Date(startDate));
      } catch (error) {
        console.error("Error fetching gallery NASA data:", error);
      } finally {
        setLoadingGallery(false);
      }
    };

    fetchGalleryData();
  }, []);

  // ---------------------------------
  // Load More Gallery Images Function
  // ---------------------------------
  const handleLoadMore = async () => {
    if (!galleryOldestDate) return;

    setLoadingMore(true);
    trackEvent("Load More Images Button Clicked", {
      galleryOldestDate: galleryOldestDate.toISOString(),
    });

    try {
      // Calculate the new date range:
      // From (galleryOldestDate - 7 days) to (galleryOldestDate - 1 day)
      const newEndDate = new Date(galleryOldestDate);
      newEndDate.setDate(newEndDate.getDate() - 1);
      const newStartDate = new Date(galleryOldestDate);
      newStartDate.setDate(newStartDate.getDate() - 7);

      const startDateStr = formatDate(newStartDate);
      const endDateStr = formatDate(newEndDate);

      const response = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&start_date=${startDateStr}&end_date=${endDateStr}`
      );
      const data = await response.json();
      // Reverse so that the newest photo in this batch comes first.
      const newPhotos = data.reverse();
      // Append the new photos to the existing gallery.
      setGalleryData((prev) => [...prev, ...newPhotos]);
      // Update the galleryOldestDate for future loads.
      setGalleryOldestDate(new Date(newStartDate));
      trackEvent("Load More Images Success", {
        newImagesCount: newPhotos.length,
      });
    } catch (error) {
      console.error("Error fetching more gallery data:", error);
      trackEvent("Load More Images Failed", { error: error.toString() });
    } finally {
      setLoadingMore(false);
    }
  };

  // --------------------------
  // Today Modal Handlers
  // --------------------------
  const openTodayModal = () => {
    setTodayModalOpen(true);
    trackEvent("Today Modal Opened", {
      imageTitle: todayData?.title,
    });
  };

  const closeTodayModal = () => {
    setTodayModalOpen(false);
    trackEvent("Today Modal Closed", { imageTitle: todayData?.title });
  };

  // -----------------------------
  // Gallery Modal Handlers
  // -----------------------------
  const openGalleryModal = (index) => {
    setGalleryModalOpen(true);
    setModalIndex(index);
    trackEvent("Gallery Modal Opened", {
      modalIndex: index,
      imageTitle: galleryData[index]?.title,
    });
  };

  const closeGalleryModal = () => {
    setGalleryModalOpen(false);
    trackEvent("Gallery Modal Closed", { modalIndex });
  };

  const nextModalSlide = () => {
    const totalSlides = galleryData.length;
    const nextIndex = (modalIndex + 1) % totalSlides;
    trackEvent("Gallery Modal Next Clicked", {
      fromIndex: modalIndex,
      toIndex: nextIndex,
      imageTitle: galleryData[nextIndex]?.title,
    });
    setModalIndex(nextIndex);
  };

  const prevModalSlide = () => {
    const totalSlides = galleryData.length;
    const prevIndex = (modalIndex - 1 + totalSlides) % totalSlides;
    trackEvent("Gallery Modal Prev Clicked", {
      fromIndex: modalIndex,
      toIndex: prevIndex,
      imageTitle: galleryData[prevIndex]?.title,
    });
    setModalIndex(prevIndex);
  };

  return (
    <div className="p-4 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-center">
        NASA Photo of the Day
      </h1>

      {/* Today's Photo */}
      {loadingToday ? (
        <p className="text-center">Loading today's photo...</p>
      ) : todayData ? (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-center">
            {todayData.title}
          </h2>
          <img
            src={todayData.hdurl || todayData.url}
            alt={todayData.title}
            onClick={openTodayModal}
            className="w-full max-w-3xl mx-auto rounded shadow-md mb-4 transform hover:scale-105 transition duration-300 cursor-pointer"
          />
          <p className="max-w-3xl mx-auto text-justify">
            {todayData.explanation}
          </p>
        </div>
      ) : (
        <p className="text-center">Unable to load today's photo.</p>
      )}

      {/* Gallery Grid */}
      <h2 className="text-2xl font-semibold mb-4 text-center">
        Gallery: Last 7 Days
      </h2>
      {loadingGallery ? (
        <p className="text-center">Loading gallery...</p>
      ) : galleryData && galleryData.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-4">
          {galleryData.map((item, index) => (
            <div
              key={item.date}
              className="w-72 border border-gray-300 rounded overflow-hidden dark:border-gray-700 shadow hover:shadow-lg transform hover:-translate-y-1 transition duration-300 cursor-pointer"
              onClick={() => openGalleryModal(index)}
            >
              <img
                src={item.hdurl || item.url}
                alt={item.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h5 className="text-lg font-medium mb-2">{item.title}</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {item.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center">No gallery photos available.</p>
      )}

      {/* Load More Button on the Page */}
      {galleryData.length > 0 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="bg-indigo-500 text-white px-6 py-2 rounded shadow hover:bg-indigo-600 transition disabled:opacity-50"
          >
            {loadingMore ? "Loading More..." : "Load More Images"}
          </button>
        </div>
      )}

      {/* ---------------------------- */}
      {/* Modal for Today's Photo */}
      {/* ---------------------------- */}
      {todayModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={closeTodayModal}
        >
          <div
            className="relative w-full max-w-4xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeTodayModal}
              className="absolute top-4 right-4 text-white text-3xl z-50"
            >
              &times;
            </button>
            <img
              src={todayData.hdurl || todayData.url}
              alt={todayData.title}
              className="w-full max-h-[80vh] object-contain mx-auto rounded shadow-lg"
            />
            <div className="mt-4 text-center text-white">
              <h3 className="text-xl font-bold">{todayData.title}</h3>
              <p className="text-sm">{todayData.date}</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------- */}
      {/* Modal Carousel for Gallery */}
      {/* ---------------------------- */}
      {galleryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={closeGalleryModal}
        >
          <div
            className="relative w-full max-w-4xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeGalleryModal}
              className="absolute top-4 right-4 text-white text-3xl z-50"
            >
              &times;
            </button>
            <div className="relative">
              <img
                src={galleryData[modalIndex].hdurl || galleryData[modalIndex].url}
                alt={galleryData[modalIndex].title}
                className="w-full max-h-[80vh] object-contain mx-auto rounded shadow-lg"
              />
              {/* Navigation Arrows */}
              <button
                onClick={prevModalSlide}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-3xl"
              >
                &lt;
              </button>
              <button
                onClick={nextModalSlide}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-3xl"
              >
                &gt;
              </button>
            </div>
            <div className="mt-4 text-center text-white">
              <h3 className="text-xl font-bold">
                {galleryData[modalIndex].title}
              </h3>
              <p className="text-sm">{galleryData[modalIndex].date}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NasaPhotoOfTheDay;
