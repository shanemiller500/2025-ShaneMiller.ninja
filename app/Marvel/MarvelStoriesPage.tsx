"use client";

import React, { useState, useEffect } from "react";
import { searchMarvelStories } from "./marvelAPI";

const Spinner = () => (
  <div className="flex justify-center items-center my-4">
    <svg
      className="animate-spin h-8 w-8 text-teal-500"
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

const MarvelStoriesPage: React.FC = () => {
  const [storyQuery, setStoryQuery] = useState("");
  const [storyResults, setStoryResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (storyQuery) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyQuery]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    const data = await searchMarvelStories(storyQuery);
    if (data?.data?.results) {
      setStoryResults(data.data.results);
    } else {
      setStoryResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-4 text-center">
        Marvel Stories
      </h2>
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
        <input
          type="text"
          value={storyQuery}
          onChange={(e) => setStoryQuery(e.target.value)}
          placeholder="Search for a story..."
          className="p-3 border rounded w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-brand-900"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-teal-600 text-white rounded hover:bg-teal-700 transition">
          Search
        </button>
      </form>
      {loading ? (
        <Spinner />
      ) : storyResults.length > 0 ? (
        <div className="space-y-4">
          {storyResults.map((story) => (
            <div
              key={story.id}
              className="border rounded-lg p-4 shadow hover:shadow-lg transition">
              <h3 className="text-xl font-semibold">
                {story.title || "Untitled"}
              </h3>
              <p className="text-sm text-gray-600">
                {story.description || "No description available."}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">
          No stories found. Try a different search.
        </p>
      )}
    </div>
  );
};

export default MarvelStoriesPage;
