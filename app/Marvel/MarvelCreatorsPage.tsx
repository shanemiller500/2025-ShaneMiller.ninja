"use client";

import { useState, useEffect, type FormEvent } from "react";

import { searchMarvelCreators } from "./marvelAPI";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const DEBOUNCE_DELAY_MS = 500;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface MarvelThumbnail {
  path: string;
  extension: string;
}

interface MarvelCreator {
  id: number;
  fullName: string;
  thumbnail: MarvelThumbnail;
}

/* ------------------------------------------------------------------ */
/*  Spinner Component                                                  */
/* ------------------------------------------------------------------ */
const Spinner = () => (
  <div className="flex justify-center items-center my-4">
    <svg
      className="animate-spin h-8 w-8 text-red-500"
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

/* ------------------------------------------------------------------ */
/*  MarvelCreatorsPage Component                                       */
/* ------------------------------------------------------------------ */
const MarvelCreatorsPage = () => {
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorResults, setCreatorResults] = useState<MarvelCreator[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    const data = await searchMarvelCreators(creatorQuery);
    if (data?.data?.results) {
      setCreatorResults(data.data.results);
    } else {
      setCreatorResults([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (creatorQuery) {
        handleSearch();
      }
    }, DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorQuery]);

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-4 text-center">
        Marvel Creators
      </h2>
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
        <input
          type="text"
          value={creatorQuery}
          onChange={(e) => setCreatorQuery(e.target.value)}
          placeholder="Search for a creator..."
          className="p-3 border rounded w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-brand-900"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 transition">
          Search
        </button>
      </form>
      {loading ? (
        <Spinner />
      ) : creatorResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creatorResults.map((creator) => (
            <div
              key={creator.id}
              className="border rounded-lg p-4 shadow hover:shadow-lg transition flex flex-col items-center">
              {creator.thumbnail && (
                <img
                  src={`${creator.thumbnail.path}.${creator.thumbnail.extension}`}
                  alt={creator.fullName}
                  className="w-32 h-32 object-cover rounded-full mb-3"
                />
              )}
              <h3 className="text-xl font-semibold">
                {creator.fullName}
              </h3>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">
          No creators found. Try a different search.
        </p>
      )}
    </div>
  );
};

export default MarvelCreatorsPage;
