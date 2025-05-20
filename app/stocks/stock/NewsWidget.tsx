"use client";

import React, { useState, useEffect } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatDate } from "@/utils/formatters";

const NewsWidget: React.FC = () => {
  const [newsList, setNewsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`https://finnhub.io/api/v1/news?category=general&token=${API_TOKEN}`)
      .then((res) => res.json())
      .then((data) => {
        setNewsList(data.slice(0, 3)); // show only the latest 3  articles
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <section className="p-4 rounded shadow ">
      <h2 className="text-2xl font-bold mb-4">Latest Finance News</h2>
      {loading && <p className="text-center">Loading news...</p>}
      <div className="space-y-4 dark:bg-brand-950 bg-white">
        {newsList && newsList.length > 0 ? (
          newsList.map((news, index) => (
            <div
              key={index}
              className="border border-gray-300 dark:border-gray-700 rounded overflow-hidden"
            >
              {news.image && news.image !== "" && (
                <img
                  src={news.image}
                  alt="News"
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <h5 className="text-lg font-bold">{news.headline}</h5>
                <p className="text-sm">Released: {formatDate(news.datetime)}</p>
                <p className="text-sm">Source: {news.source}</p>
                <p className="text-sm line-clamp-2">{news.summary}</p>
                <a
                  className="text-indigo-500 hover:underline"
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read More
                </a>
              </div>
              
            </div>
          ))
        ) : (
          <p className="text-center">No news found.</p>
        )}
      </div>
    </section>
  );
};

export default NewsWidget;
