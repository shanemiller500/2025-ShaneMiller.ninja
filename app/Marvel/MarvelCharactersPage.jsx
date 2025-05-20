"use client";

import React, { useState, useEffect } from "react";
import { searchMarvelCharacters } from "./marvelAPI";

const preSearchSuggestions = [
  "Spider-Man",
  "Iron Man",
  "Captain America",
  "Hulk",
  "Thor",
  "Black Panther",
];

const Spinner = () => (
  <div className="flex justify-center items-center my-4">
    <svg
      className="animate-spin h-8 w-8 text-indigo-500"
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

const MarvelCharactersPage = () => {
  const [characterQuery, setCharacterQuery] = useState("");
  const [characterResults, setCharacterResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (characterQuery) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterQuery]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    const data = await searchMarvelCharacters(characterQuery);
    if (data?.data?.results) {
      setCharacterResults(data.data.results);
    } else {
      setCharacterResults([]);
    }
    setLoading(false);
  };

  const handlePreSearch = (query) => {
    setCharacterQuery(query);
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-4 text-center">Marvel Characters</h2>
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
        <input
          type="text"
          list="characterSuggestions"
          value={characterQuery}
          onChange={(e) => setCharacterQuery(e.target.value)}
          placeholder="Search for a character..."
          className="p-3 border rounded w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-brand-950"
        />
        <datalist id="characterSuggestions">
          {preSearchSuggestions.map((suggestion, idx) => (
            <option key={idx} value={suggestion} />
          ))}
        </datalist>
        <button
          type="submit"
          className="px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
          Search
        </button>
      </form>
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {preSearchSuggestions.map((suggestion, idx) => (
          <button
            key={idx}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            onClick={() => handlePreSearch(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      {loading ? (
        <Spinner />
      ) : characterResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 dark:bg-brand-950 bg-white">
          {characterResults.map((character) => (
            <div
              key={character.id}
              className="border rounded-lg p-4 shadow hover:shadow-lg transition">
              {character.thumbnail && (
                <img
                  src={`${character.thumbnail.path}.${character.thumbnail.extension}`}
                  alt={character.name}
                  className="w-full h-48 object-cover rounded"
                />
              )}
              <h3 className="text-xl font-semibold mt-3">{character.name}</h3>
              <p className="text-sm text-gray-600">
                {character.description || "No description available."}
              </p>
              <div className="mt-3">
                <h4 className="font-bold">Comics:</h4>
                <ul className="list-disc list-inside text-sm">
                  {character.comics?.items.slice(0, 3).map((comic, idx) => (
                    <li key={idx}>{comic.name}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <h4 className="font-bold">Series:</h4>
                <ul className="list-disc list-inside text-sm">
                  {character.series?.items.slice(0, 3).map((serie, idx) => (
                    <li key={idx}>{serie.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">
          No characters found. Try a different search.
        </p>
      )}
    </div>
  );
};

export default MarvelCharactersPage;
