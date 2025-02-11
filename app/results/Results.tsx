"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import MainResults from "./MainResults";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Define a type for a single search result item
export interface SearchHistoryItem {
  query: string;
  summary: string;
  links: Array<{ url: string; title: string }>;
  images: Array<{ imageURL: string; url: string; title?: string }>;
  followUpQuestions: string[];
  placesPerKeyword: any[]; // Adjust the type as needed
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
}

export default function Results() {
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState<string>("");
  const [followUpInput, setFollowUpInput] = useState<string>("");
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("main");

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
        const res = await  fetch('https://u-mail.co/api/search', {
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

        // Update search history with new results
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
            isOpen: true,
          },
          ...prevHistory.map((item) => ({ ...item, isOpen: false })),
        ]);

        // Reset active tab to main when new search is made
        setActiveTab("main");
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
        `<span class="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer" onclick="document.getElementById('places-tab').click();">${keyword}</span>`
      );
    });

    return modifiedSummary;
  };

  return (
    <div>
      {/* Header */}
      <header className="w-full  shadow-md p-4">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <a href="/">
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              Jaximus
            </h1>
          </a>
          <form
            onSubmit={(e) => handleSearch(e)}
            className="flex items-center border border-gray-300 dark:border-gray-700 rounded-full px-5 py-2 "
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
        </div>
      </header>

      <main className="relative flex-grow w-full max-w-6xl mx-auto mt-5 px-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center  bg-opacity-75 z-50">
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 dark:border-gray-700 h-12 w-12"></div>
          </div>
        )}

        {searchHistory.length === 0 && !isLoading && (
          <p className="text-lg mb-5">Enter a query to start searching.</p>
        )}

        {searchHistory.map((result, index) => (
          <div key={index} className="mb-5">
            {index === 0 ? (
              <div className="border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden">
                <div className=" p-4">
                  <p className="text-lg mb-5">
                    Showing results for: <strong>{result.query}</strong>
                  </p>

                  <div className="mb-5 flex border-b border-gray-200 dark:border-gray-700">
                    <button
                      id="main-tab"
                      className={`px-4 py-2 ${
                        activeTab === "main"
                          ? "border-b-2 border-indigo-600 dark:border-indigo-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                      onClick={() => setActiveTab("main")}
                    >
                      Main Results
                    </button>
                  </div>

                  {activeTab === "main" && (
                    <MainResults
                      result={result}
                      renderSummaryWithBuzzwords={renderSummaryWithBuzzwords}
                      handleFollowUpClick={handleFollowUpClick}
                      handleFollowUpSubmit={handleFollowUpSubmit}
                      followUpInput={followUpInput}
                      setFollowUpInput={setFollowUpInput}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div>{/* Older results can be rendered here in an accordion */}</div>
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
