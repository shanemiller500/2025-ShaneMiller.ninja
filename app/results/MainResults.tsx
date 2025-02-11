"use client";

import React, { useState } from "react";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { SearchHistoryItem } from "./Results";

// Define types for image and link items (adjust if necessary)
interface ImageItem {
  imageURL: string;
  url: string;
  title?: string;
}

interface LinkItem {
  url: string;
  title: string;
}

// Define props for the MainResults component
interface MainResultsProps {
  result: SearchHistoryItem;
  renderSummaryWithBuzzwords: (summary: string, keywords: string[]) => string;
  handleFollowUpClick: (question: string) => Promise<void>;
  handleFollowUpSubmit: (
    e: React.FormEvent<HTMLFormElement>
  ) => Promise<void>;
  followUpInput: string;
  setFollowUpInput: React.Dispatch<React.SetStateAction<string>>;
}

export default function MainResults({
  result,
  renderSummaryWithBuzzwords,
  handleFollowUpClick,
  handleFollowUpSubmit,
  followUpInput,
  setFollowUpInput,
}: MainResultsProps) {
  // Example carousel settings (if using a carousel library)
  const [carouselSettings] = useState({
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  });

  return (
    <>
      {/* Related Images */}
      {result.images.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xl font-semibold mb-4">Related Images</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {result.images.map((image, imageIndex) => (
              <a
                key={imageIndex}
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={image.imageURL}
                  alt={image.title || "Related image"}
                  className="w-full h-48 object-cover rounded-md shadow-md"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className=" p-6 shadow-md rounded-md mb-5">
        <h2 className="text-xl font-semibold mb-4">Answer</h2>
        <div
          className="leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: renderSummaryWithBuzzwords(
              result.summary,
              result.keywords
            ),
          }}
        ></div>
      </div>

      {/* Wikipedia Information */}
      {result.wikipedia && (
        <div className=" p-6 shadow-md rounded-md mb-5 mt-5">
          <h2 className="text-2xl font-bold mb-4">
            {result.wikipedia.title} (From Wikipedia)
          </h2>
          <p className="mb-4">{result.wikipedia.extract}</p>
          <a
            href={result.wikipedia.content_urls.desktop.page}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Read more on Wikipedia
          </a>
        </div>
      )}

      {/* Supporting Links */}
      {result.links.length > 0 && (
        <div className=" p-6 mt-5 shadow-md rounded-md">
          <h2 className="text-xl font-semibold mb-4">Supporting Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.links.map((link, linkIndex) => (
              <a
                key={linkIndex}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4  rounded-md hover:shadow-lg"
              >
                <p className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  {link.title}
                </p>
                <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">
                  {link.url}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Follow-Up Suggestions */}
      {result.followUpQuestions.length > 0 && (
        <div className=" p-6 mt-5 shadow-md rounded-md">
          <h2 className="text-xl font-semibold mb-4">Follow-Up Questions</h2>
          <ul className="space-y-2">
            {result.followUpQuestions.map((question, questionIndex) => (
              <li key={questionIndex}>
                <button
                  onClick={() => handleFollowUpClick(question)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>

          {/* Custom Follow-Up Question Input */}
          <div className="mt-5">
            <form onSubmit={handleFollowUpSubmit}>
              <label
                htmlFor="followUpInput"
                className="block text-lg font-semibold mb-2"
              >
                Got your own follow-up question?
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="followUpInput"
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  className="flex-grow p-2 border border-gray-300 dark:border-gray-700 rounded-l-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 outline-none"
                  placeholder="Type your question here..."
                />
                <button
                  type="submit"
                  className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-r-md"
                >
                  Ask
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
