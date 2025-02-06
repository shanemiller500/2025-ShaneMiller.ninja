"use client";

import React, { useState, useEffect } from "react";

const RandomAdvice = () => {
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAdvice = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://api.adviceslip.com/advice");
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setAdvice(data.slip.advice);
    } catch (error) {
      console.error("Error fetching advice:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
  }, []);

  const refreshAdvice = () => {
    // Simulate a 2-second delay before refreshing
    setTimeout(() => {
      fetchAdvice();
    }, 2000);
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Random Advice</h2>
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div id="adviceContainer" className="mb-4">
          <p className="text-lg italic">
            <q>{advice}</q>
          </p>
        </div>
      )}
      <button
        id="getAdviceButton"
        onClick={refreshAdvice}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
      >
        Get New Advice
      </button>
    </div>
  );
};

export default RandomAdvice;
