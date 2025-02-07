"use client";

import React, { useState, useEffect } from "react";

const TrumpQuotes = () => {
  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRandomQuote = async () => {
    setLoading(true);
    // Simulate a 2-second delay before fetching
    setTimeout(async () => {
      try {
        const response = await fetch("https://api.tronalddump.io/random/quote");
        const data = await response.json();
        setQuoteData(data);
      } catch (error) {
        console.error("Error fetching quote:", error);
      } finally {
        setLoading(false);
      }
    }, 2000);
  };

  useEffect(() => {
    fetchRandomQuote();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Trump Quote</h2>
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : quoteData ? (
        <div id="quote-container" className="space-y-2">
          <p className="text-lg italic font-semibold">"{quoteData.value}"</p>
          <p>
            Wordsmith: The {quoteData._embedded.author[0].name}
          </p>
          <p>
            Created: <em>{quoteData._embedded.source[0].created_at.split("T")[0]}</em>
          </p>
          <p>
            Source:{" "}
            <a
              href={quoteData._embedded.source[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:underline"
            >
              Link
            </a>
          </p>
          <iframe
            id="tweet-frame"
            src={`https://twitframe.com/show?url=${quoteData._embedded.source[0].url}`}
            title="Tweet"
            className="w-full h-48 mt-4 rounded shadow"
          ></iframe>
        </div>
      ) : (
        <p>No quote available.</p>
      )}
      <button
        onClick={fetchRandomQuote}
        className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 focus:outline-none"
      >
        Refresh Quote
      </button>
    </div>
  );
};

export default TrumpQuotes;
