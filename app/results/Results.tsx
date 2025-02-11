// /components/Results.tsx
"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import MainResults from "./MainResults";
import FlightSearch from "./FlightSearch";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Define a type for a single search result item
export interface SearchHistoryItem {
  query: string;
  summary: string;
  links: Array<{ url: string; title: string }>;
  images: Array<{ imageURL: string; url: string; title?: string }>;
  followUpQuestions: string[];
  placesPerKeyword: any[]; // Adjust as needed
  wikipedia:
    | {
        title: string;
        extract: string;
        content_urls: {
          desktop: {
            page: string;
          };
        };
      }
    | null;
  keywords: string[];
  financeData: any;
  isFinanceRelated: boolean;
  isOpen: boolean;
  activeTab: "main" | "flights";
}

const LOCAL_STORAGE_KEY = "searchHistory";
const LOCAL_STORAGE_TIMESTAMP_KEY = "searchHistoryTimestamp";
const AUTO_CLEAR_INTERVAL = 30 * 60 * 1000; // 30 minutes

export default function Results() {
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState<string>("");
  const [followUpInput, setFollowUpInput] = useState<string>("");
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load search history from localStorage on mount
  useEffect(() => {
    const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
    const storedTimestamp = localStorage.getItem(LOCAL_STORAGE_TIMESTAMP_KEY);
    if (storedHistory && storedTimestamp) {
      const timestamp = parseInt(storedTimestamp, 10);
      if (Date.now() - timestamp < AUTO_CLEAR_INTERVAL) {
        setSearchHistory(JSON.parse(storedHistory));
      } else {
        // Clear storage if older than 30 minutes
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(LOCAL_STORAGE_TIMESTAMP_KEY);
      }
    }
  }, []);

  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(searchHistory));
      localStorage.setItem(LOCAL_STORAGE_TIMESTAMP_KEY, Date.now().toString());
    }
  }, [searchHistory]);

  // Set an interval to auto-clear the search history every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setSearchHistory([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TIMESTAMP_KEY);
    }, AUTO_CLEAR_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // The fetch now points to the external API using https
  const handleSearch = async (
    e?: FormEvent<HTMLFormElement> | null,
    query?: string
  ): Promise<void> => {
    if (e) e.preventDefault();
    const searchQuery = query || searchInput.trim();

    if (searchQuery) {
      setIsLoading(true);
      try {
        const res = await fetch("https://u-mail.co/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (!res.ok) {
          console.error("API call failed", res.statusText);
          setIsLoading(false);
          return;
        }

        const data = await res.json();

        // Determine if flight tab should be available
        const hasFlights = searchQuery.toLowerCase().includes("flight");

        // Update search history with new results as an accordion item
        setSearchHistory((prevHistory) => [
          {
            query: searchQuery,
            summary: data.summary || "",
            links: data.links || [],
            images: data.images || [],
            followUpQuestions: data.followUpQuestions || [],
            placesPerKeyword: data.placesPerKeyword || [],
            wikipedia: data.wikipedia || null,
            keywords: data.keywords || [],
            financeData: data.financeData || null,
            isFinanceRelated: data.isFinanceRelated || false,
            isOpen: true, // new search is open by default
            activeTab: "main",
          },
          // Close older items
          ...prevHistory.map((item) => ({ ...item, isOpen: false })),
        ]);
      } catch (error) {
        console.error("Error fetching search results:", error);
      } finally {
        setSearchInput("");
        setIsLoading(false);
      }
    }
  };

  const handleFollowUpClick = async (question: string): Promise<void> => {
    await handleSearch(null, question);
  };

  const handleFollowUpSubmit = async (
    e: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (followUpInput.trim()) {
      await handleSearch(null, followUpInput.trim());
      setFollowUpInput("");
    }
  };

  // Toggle accordion open/close for a specific search history item
  const toggleAccordion = (index: number) => {
    setSearchHistory((prevHistory) =>
      prevHistory.map((item, i) =>
        i === index ? { ...item, isOpen: !item.isOpen } : item
      )
    );
  };

  // Change active tab for a specific accordion item
  const setActiveTabForItem = (index: number, tab: "main" | "flights") => {
    setSearchHistory((prevHistory) =>
      prevHistory.map((item, i) =>
        i === index ? { ...item, activeTab: tab } : item
      )
    );
  };

  // Clear search history manually
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TIMESTAMP_KEY);
  };

  // On initial load, if a query parameter is present, perform the search.
  useEffect(() => {
    const initialQuery = searchParams.get("query");
    if (initialQuery) {
      setSearchInput(initialQuery);
      handleSearch(null, initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A helper function to make buzzwords clickable in the summary.
  const renderSummaryWithBuzzwords = (
    summary: string,
    keywords: string[]
  ): string => {
    if (!keywords || keywords.length === 0) return summary;

    let modifiedSummary = summary;
    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      modifiedSummary = modifiedSummary.replace(
        regex,
        `<span class="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">${keyword}</span>`
      );
    });

    return modifiedSummary;
  };

  return (
    <div>
      {/* Header */}
      <header className="w-full shadow-md p-4 flex justify-between items-center">
        <div className="max-w-6xl mx-auto flex items-center justify-between w-full">
          <a href="/">
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              Search results
            </h1>
          </a>
          <div className="flex space-x-4">
            <form
              onSubmit={(e) => handleSearch(e)}
              className="flex items-center border border-gray-300 dark:border-gray-700 rounded-full px-5 py-2"
            >
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-grow outline-none px-2 bg-transparent text-gray-800 dark:text-gray-100"
                placeholder="Search"
              />
              <button
                type="submit"
                className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-1 rounded-full ml-2"
                disabled={isLoading}
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </form>
            <button
              onClick={clearHistory}
              className="bg-red-600 dark:bg-red-500 text-white px-4 py-1 rounded-full"
            >
              Clear History
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-grow w-full max-w-6xl mx-auto mt-5 px-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-opacity-75 z-50">
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 dark:border-gray-700 h-12 w-12"></div>
          </div>
        )}

        {searchHistory.length === 0 && !isLoading && (
          <p className="text-lg mb-5">Enter a query to start searching.</p>
        )}

        {/* Render each search history item as an accordion */}
        {searchHistory.map((result, index) => (
          <div
            key={index}
            className="mb-5 border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden"
          >
            <div
              className="cursor-pointer bg-gray-100 dark:bg-gray-800 p-4 flex justify-between items-center"
              onClick={() => toggleAccordion(index)}
            >
              <span className="font-semibold">{result.query}</span>
              <span>{result.isOpen ? "-" : "+"}</span>
            </div>
            {result.isOpen && (
              <div className="p-4">
                {/* Tabs for Main Results and Flight Search if applicable */}
                <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    className={`px-4 py-2 ${
                      result.activeTab === "main"
                        ? "border-b-2 border-indigo-600 dark:border-indigo-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                    onClick={() => setActiveTabForItem(index, "main")}
                  >
                    Main Results
                  </button>
                  {result.query.toLowerCase().includes("flight") && (
                    <button
                      className={`px-4 py-2 ${
                        result.activeTab === "flights"
                          ? "border-b-2 border-indigo-600 dark:border-indigo-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                      onClick={() => setActiveTabForItem(index, "flights")}
                    >
                      Flight Search
                    </button>
                  )}
                </div>

                {result.activeTab === "main" ? (
                  <MainResults
                    result={result}
                    renderSummaryWithBuzzwords={renderSummaryWithBuzzwords}
                    handleFollowUpClick={handleFollowUpClick}
                    handleFollowUpSubmit={handleFollowUpSubmit}
                    followUpInput={followUpInput}
                    setFollowUpInput={setFollowUpInput}
                  />
                ) : (
                  <FlightSearch />
                )}
              </div>
            )}
          </div>
        ))}
      </main>

      <style jsx>{`
        .loader {
          border-top-color: transparent;
          animation: spinner 0.6s linear infinite;
        }
        @keyframes spinner {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
