"use client";

import React, { useState, useEffect } from "react";
import CryptoJS from "crypto-js";

// Marvel API keys and endpoints
const CUSTOM_PUBLIC_KEY = "6290afb298c151e1dd65994d6b75475d";
const CUSTOM_PRIVATE_KEY = "30b26f71fe92998a8479ec02dd44a180ab67bb0d";
const CUSTOM_API_URL = "https://gateway.marvel.com/v1/public/characters";
const CUSTOM_API_URL1 = "https://gateway.marvel.com/v1/public/comics";

/**
 * Returns the current timestamp.
 * @returns {number}
 */
const getTimestamp = () => new Date().getTime();

/**
 * Returns the MD5 hash string needed for Marvel API authentication.
 * @param {number} timestamp
 * @returns {string}
 */
const getHash = (timestamp) =>
  CryptoJS.MD5(timestamp + CUSTOM_PRIVATE_KEY + CUSTOM_PUBLIC_KEY).toString();

/**
 * Fetch Marvel character data that starts with the provided name.
 * @param {string} nameStartsWith
 * @returns {Promise<Object|null>}
 */
export async function searchMarvelCharacters(nameStartsWith = "") {
  const ts = getTimestamp();
  const hash = getHash(ts);
  const url = `${CUSTOM_API_URL}?ts=${ts}&apikey=${CUSTOM_PUBLIC_KEY}&hash=${hash}&nameStartsWith=${encodeURIComponent(
    nameStartsWith
  )}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching character data:", error);
    return null;
  }
}

/**
 * Fetch Marvel comic data that starts with the provided title.
 * @param {string} titleStartsWith
 * @returns {Promise<Object|null>}
 */
export async function searchComics(titleStartsWith = "") {
  const ts = getTimestamp();
  const hash = getHash(ts);
  const url = `${CUSTOM_API_URL1}?apikey=${CUSTOM_PUBLIC_KEY}&ts=${ts}&hash=${hash}&titleStartsWith=${encodeURIComponent(
    titleStartsWith
  )}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching comics:", error);
    return null;
  }
}

/**
 * MarvelAPIPage Component
 *
 * Provides two search forms—one for Marvel characters and one for comics—
 * and displays the search results.
 */
const MarvelAPIPage = () => {
  const [characterQuery, setCharacterQuery] = useState("");
  const [characterResults, setCharacterResults] = useState([]);
  const [comicQuery, setComicQuery] = useState("");
  const [comicResults, setComicResults] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [loadingComics, setLoadingComics] = useState(false);

  const handleCharacterSearch = async (e) => {
    e.preventDefault();
    setLoadingCharacters(true);
    const data = await searchMarvelCharacters(characterQuery);
    if (data && data.data && data.data.results) {
      setCharacterResults(data.data.results);
    } else {
      setCharacterResults([]);
    }
    setLoadingCharacters(false);
  };

  const handleComicSearch = async (e) => {
    e.preventDefault();
    setLoadingComics(true);
    const data = await searchComics(comicQuery);
    if (data && data.data && data.data.results) {
      setComicResults(data.data.results);
    } else {
      setComicResults([]);
    }
    setLoadingComics(false);
  };

  return (
    <div className="p-4 dark:text-gray-100">


      {/* Marvel Comics Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Marvel Comics</h2>
        <form
          onSubmit={handleComicSearch}
          className="flex flex-col sm:flex-row gap-2 mb-4"
        >
          <input
            type="text"
            value={comicQuery}
            onChange={(e) => setComicQuery(e.target.value)}
            placeholder="Enter comic title..."
            className="p-2 border border-gray-300 rounded w-full md:w-1/3 dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 focus:outline-none"
          >
            Search Comics
          </button>
        </form>
        {loadingComics ? (
          <p className="text-center">Loading comics...</p>
        ) : comicResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comicResults.map((comic) => (
              <div
                key={comic.id}
                className="border border-gray-300 rounded p-4 dark:border-gray-700"
              >
                <img
                  src={`${comic.thumbnail.path}.${comic.thumbnail.extension}`}
                  alt={comic.title}
                  className="max-w-[150px] mx-auto"
                />
                <h3 className="text-xl font-semibold mt-2">{comic.title}</h3>
                <p className="text-sm">
                  {comic.description || "No description available."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center">No comics found.</p>
        )}
      </section>
    </div>
  );
};

export default MarvelAPIPage;
