"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [search, setSearch] = useState<string>("");
  const router = useRouter();

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (search.trim()) {
      // Redirect to the results page with the query in the URL
      router.push(`/results?query=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-100">
      <h1 className="text-6xl font-bold mb-10 text-indigo-500">Jaximus</h1>
      <form onSubmit={handleSearch} className="w-full max-w-lg px-4">
        <div className="flex items-center border border-gray-700 rounded-full px-5 py-3">
          <input
            type="text"
            className="flex-grow bg-transparent outline-none px-2 text-gray-100 placeholder-gray-500"
            placeholder="Search Jaximus"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full ml-2"
          >
            Search
          </button>
        </div>
      </form>
    </div>
  );
}
