"use client";

import React, { useState, useEffect } from "react";
import { searchMarvelEvents } from "./marvelAPI";

const Spinner = () => (
  <div className="flex justify-center items-center my-4">
    <svg
      className="animate-spin h-8 w-8 text-green-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  </div>
);

const MarvelEventsPage: React.FC = () => {
  const [eventQuery, setEventQuery] = useState("");
  const [eventResults, setEventResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (eventQuery) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventQuery]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    const data = await searchMarvelEvents(eventQuery);
    if (data?.data?.results) {
      setEventResults(data.data.results);
    } else {
      setEventResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-4 text-center">
        Marvel Events
      </h2>
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
        <input
          type="text"
          value={eventQuery}
          onChange={(e) => setEventQuery(e.target.value)}
          placeholder="Search for an event..."
          className="p-3 border rounded w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-brand-900"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition">
          Search
        </button>
      </form>
      {loading ? (
        <Spinner />
      ) : eventResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {eventResults.map((event) => (
            <div
              key={event.id}
              className="border rounded-lg p-4 shadow hover:shadow-lg transition">
              {event.thumbnail && (
                <img
                  src={`${event.thumbnail.path}.${event.thumbnail.extension}`}
                  alt={event.title}
                  className="w-full h-48 object-cover rounded"
                />
              )}
              <h3 className="text-xl font-semibold mt-3">
                {event.title}
              </h3>
              <p className="text-sm text-gray-600">
                {event.description || "No description available."}
              </p>
              <p className="text-sm mt-2">
                Start:{" "}
                {event.start
                  ? new Date(event.start).toLocaleDateString()
                  : "N/A"}
              </p>
              <p className="text-sm">
                End:{" "}
                {event.end
                  ? new Date(event.end).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">
          No events found. Try a different search.
        </p>
      )}
    </div>
  );
};

export default MarvelEventsPage;
