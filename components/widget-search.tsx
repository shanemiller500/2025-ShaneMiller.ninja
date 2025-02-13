"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function widgetSearch() {
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
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out pb-2">

<div className="flex flex-col items-center justify-center  text-gray-100">
      <h1 className="font-bold text-indigo-500">AI Search </h1>
      <form onSubmit={handleSearch} className="w-full  px-4">
          <input
            type="text"
            className="flex-grow bg-transparent rounded-lg border border-slate-200 dark:border-slate-800 text-gray-100 placeholder-gray-500"
            placeholder="Search Anything"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full mt-2 text-center"
          >
            Search
          </button>
       
      </form>
    </div>
    </div>
  );
}
