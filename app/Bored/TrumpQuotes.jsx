"use client";

import React, { useEffect, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

const Card = ({ children }) => (
  <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
    {children}
  </div>
);

const Btn = ({ children, ...props }) => (
  <button
    {...props}
    className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-2 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06]
               focus:outline-none focus:ring-2 focus:ring-indigo-500
               dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
  >
    {children}
  </button>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-10">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black/60 dark:border-white/20 dark:border-t-white/70" />
  </div>
);

export default function TrumpQuotes() {
  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRandomQuote = async () => {
    setLoading(true);
    trackEvent("Trump Quote Fetch Started");

    setTimeout(async () => {
      try {
        const res = await fetch("https://api.tronalddump.io/random/quote");
        const data = await res.json();
        setQuoteData(data);
        trackEvent("Trump Quote Fetch Success");
      } catch (err) {
        console.error(err);
        setQuoteData(null);
        trackEvent("Trump Quote Fetch Error", { error: String(err) });
      } finally {
        setLoading(false);
      }
    }, 900);
  };

  useEffect(() => {
    fetchRandomQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const author = quoteData?._embedded?.author?.[0]?.name;
  const source = quoteData?._embedded?.source?.[0];
  const created = source?.created_at ? String(source.created_at).split("T")[0] : null;
  const url = source?.url;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Trump Quotes
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Random pull from the API.
        </p>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : quoteData ? (
          <div className="space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-white/50">
              Quote
            </div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              “{quoteData.value}”
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.06]">
                <div className="text-xs font-extrabold text-gray-500 dark:text-white/50">
                  Author
                </div>
                <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                  {author || "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.06]">
                <div className="text-xs font-extrabold text-gray-500 dark:text-white/50">
                  Date
                </div>
                <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                  {created || "—"}
                </div>
              </div>
            </div>

            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-indigo-600 hover:underline dark:text-indigo-300"
              >
                Open source →
              </a>
            ) : null}

            {url ? (
              <div className="overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10">
                <iframe
                  title="Tweet"
                  src={`https://twitframe.com/show?url=${encodeURIComponent(url)}`}
                  className="h-64 w-full bg-white"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm font-bold text-gray-700 dark:text-white/70">
            No quote available.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Btn onClick={fetchRandomQuote}>Refresh</Btn>
        </div>
      </Card>
    </div>
  );
}
