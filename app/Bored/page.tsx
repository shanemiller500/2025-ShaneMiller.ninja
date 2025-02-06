"use client";

import React from "react";
import TrumpQuotes from "./TrumpQuotes"; // Adjust the path if needed
import RandomActivity from "./RandomActivity";
import ChuckNorrisQuotes from "./ChuckNorrisQuotes";
import RandomAdvice from "./RandomAdvice";

const QuotesDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100 p-4 space-y-8">
      <h1 className="text-4xl font-bold text-center">Quotes Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <TrumpQuotes />
        <ChuckNorrisQuotes />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <RandomActivity />
        <RandomAdvice />
      </div>
    </div>
  );
};

export default QuotesDashboard;
