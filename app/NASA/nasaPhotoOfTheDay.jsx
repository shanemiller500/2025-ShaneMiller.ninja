"use client";

import React, { useState, useEffect } from "react";

const API_KEY = "mud9spxbq6i1MTj1Q52GKEzdL3wPgyeAeNo20dzB";

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
 * - Fetches today’s APOD data and displays it.
 * - Also fetches a gallery of the last 7 days (excluding today)
 *   and displays them in a card grid.
 */
const NasaPhotoOfTheDay = () => {
  const [todayData, setTodayData] = useState(null);
  const [galleryData, setGalleryData] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingGallery, setLoadingGallery] = useState(true);

  // Fetch today's APOD data
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

  // Fetch gallery data for the previous 7 days (excluding today)
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
        // Reverse the array so that the newest gallery photo is first.
        setGalleryData(data.reverse());
      } catch (error) {
        console.error("Error fetching gallery NASA data:", error);
      } finally {
        setLoadingGallery(false);
      }
    };

    fetchGalleryData();
  }, []);

  return (
    <div className="p-4 dark:bg-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-center">NASA Photo of the Day</h1>

      {/* Today’s Photo */}
      {loadingToday ? (
        <p className="text-center">Loading today's photo...</p>
      ) : todayData ? (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-center">{todayData.title}</h2>
          <img
            src={todayData.hdurl || todayData.url}
            alt={todayData.title}
            className="w-full max-w-3xl mx-auto rounded shadow-md mb-4"
          />
          <p className="max-w-3xl mx-auto text-justify">{todayData.explanation}</p>
        </div>
      ) : (
        <p className="text-center">Unable to load today's photo.</p>
      )}

      {/* Gallery: Last 7 Days */}
      <h2 className="text-2xl font-semibold mb-4 text-center">Gallery: Last 7 Days</h2>
      {loadingGallery ? (
        <p className="text-center">Loading gallery...</p>
      ) : galleryData && galleryData.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-4">
          {galleryData.map((item) => (
            <div
              key={item.date}
              className="w-72 border border-gray-300 rounded overflow-hidden dark:border-gray-700 dark:bg-gray-800"
            >
              <img
                src={item.hdurl || item.url}
                alt={item.title}
                className="w-full"
              />
              <div className="p-4">
                <h5 className="text-lg font-medium mb-2">{item.title}</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">{item.date}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center">No gallery photos available.</p>
      )}
    </div>
  );
};

export default NasaPhotoOfTheDay;
