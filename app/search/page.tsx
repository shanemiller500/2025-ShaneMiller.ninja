"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/utils/mixpanel";

export default function Home() {
  const [search, setSearch] = useState<string>("");
  const router = useRouter();

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (search.trim()) {
      trackEvent("Home AI Search Initiated", { query: search.trim() });
      // Redirect to the results page with the query in the URL
      router.push(`/results?query=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-100 px-4">
      <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-10 text-indigo-500 text-center">
        AI Search Engine
      </h1>
      <form onSubmit={handleSearch} className="w-full max-w-lg">
        <div className="flex flex-col sm:flex-row items-center px-5 py-3">
          <input
            type="text"
            className="flex-grow  border border-gray-700 rounded-full px-2 text-brand-900 dark:text-gray-100 placeholder-gray-500 w-full dark:bg-brand-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Search Anything"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full mt-3 sm:mt-0 sm:ml-2"
          >
            Search
          </button>
        </div>
      </form>
    </div>
  );
}
