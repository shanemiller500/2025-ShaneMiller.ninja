"use client";

import React, { useState, useEffect } from "react";
import { searchMarvelComics } from "./marvelAPI";

const Spinner = () => (
  <div className="flex justify-center items-center my-4">
    <svg
      className="animate-spin h-8 w-8 text-purple-500"
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

const MarvelComicsPage = () => {
  const [comicQuery, setComicQuery] = useState("");
  const [comicResults, setComicResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (comicQuery) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comicQuery]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    const data = await searchMarvelComics(comicQuery);
    if (data?.data?.results) {
      setComicResults(data.data.results);
    } else {
      setComicResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-4 text-center">Marvel Comics</h2>
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
        <input
          type="text"
          value={comicQuery}
          onChange={(e) => setComicQuery(e.target.value)}
          placeholder="Search for a comic..."
          className="p-3 border rounded w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 transition">
          Search
        </button>
      </form>
      {loading ? (
        <Spinner />
      ) : comicResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comicResults.map((comic) => (
            <div
              key={comic.id}
              className="border rounded-lg p-4 shadow hover:shadow-lg transition">
              {comic.thumbnail && (
                <img
                  src={`${comic.thumbnail.path}.${comic.thumbnail.extension}`}
                  alt={comic.title}
                  className="w-full h-48 object-cover rounded"
                />
              )}
              <h3 className="text-xl font-semibold mt-3">{comic.title}</h3>
              <p className="text-sm text-gray-600">
                {comic.description || "No description available."}
              </p>
              <p className="text-sm mt-2">
                Page Count: {comic.pageCount || "N/A"}
              </p>
              <div className="mt-2">
                <h4 className="font-bold">Dates:</h4>
                {comic.dates?.slice(0, 2).map((dateObj, idx) => (
                  <p key={idx} className="text-sm">
                    {dateObj.type}:{" "}
                    {new Date(dateObj.date).toLocaleDateString()}
                  </p>
                ))}
              </div>
              <div className="mt-2">
                <h4 className="font-bold">Prices:</h4>
                {comic.prices?.map((priceObj, idx) => (
                  <p key={idx} className="text-sm">
                    {priceObj.type}: ${priceObj.price}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">
          No comics found. Try a different search.
        </p>
      )}
    </div>
  );
};

export default MarvelComicsPage;
