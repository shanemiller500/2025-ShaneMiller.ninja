"use client";

import React, { useState, useEffect } from "react";

const ChuckNorrisQuotes = () => {
  const [joke, setJoke] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchJoke = async () => {
    setLoading(true);
    // Simulate a 2-second delay before fetching the joke
    setTimeout(async () => {
      try {
        const response = await fetch("https://api.chucknorris.io/jokes/random");
        const data = await response.json();
        setJoke(data.value);
      } catch (error) {
        console.error("Error fetching joke:", error);
      } finally {
        setLoading(false);
      }
    }, 2000);
  };

  useEffect(() => {
    fetchJoke();
  }, []);

  return (
    <div className="p-4  rounded shadow">
      <h2 className="text-xl font-bold mb-4">Chuck Norris Quote</h2>
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div id="jokeContainer" className="mb-4">
          <p className="text-lg">
            <b>Quote:</b> <em>"{joke}"</em>
          </p>
        </div>
      )}
      <button
        id="getJokeButton"
        onClick={fetchJoke}
        className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 focus:outline-none"
      >
        Get New Joke
      </button>
    </div>
  );
};

export default ChuckNorrisQuotes;
