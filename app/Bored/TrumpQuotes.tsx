"use client";

import { useEffect, useState, useCallback } from "react";
import { trackEvent } from "@/utils/mixpanel";

interface QuoteData {
  value: string;
  _embedded?: {
    author?: Array<{ name: string }>;
    source?: Array<{ created_at: string; url: string }>;
  };
}

const FETCH_DELAY_MS = 900;

export default function TrumpQuotes() {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRandomQuote = useCallback(async () => {
    setIsLoading(true);
    trackEvent("Trump Quote Fetch Started");

    setTimeout(async () => {
      try {
        const response = await fetch("https://api.tronalddump.io/random/quote");
        const data = await response.json();
        setQuoteData(data);
        trackEvent("Trump Quote Fetch Success");
      } catch (error) {
        console.error(error);
        setQuoteData(null);
        trackEvent("Trump Quote Fetch Error", { error: String(error) });
      } finally {
        setIsLoading(false);
      }
    }, FETCH_DELAY_MS);
  }, []);

  useEffect(() => {
    fetchRandomQuote();
  }, [fetchRandomQuote]);

  const author = quoteData?._embedded?.author?.[0]?.name;
  const source = quoteData?._embedded?.source?.[0];
  const createdDate = source?.created_at ? source.created_at.split("T")[0] : null;
  const sourceUrl = source?.url;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          Trump Quotes
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          Random pull from the API.
        </p>
      </header>

      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : quoteData ? (
          <div className="space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-white/50">
              Quote
            </div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              "{quoteData.value}"
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="Author" value={author || "—"} />
              <InfoCard label="Date" value={createdDate || "—"} />
            </div>

            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-indigo-600 hover:underline dark:text-indigo-300"
              >
                Open source →
              </a>
            )}

            {sourceUrl && (
              <div className="overflow-hidden rounded-3xl ring-1 ring-black/10 dark:ring-white/10">
                <iframe
                  title="Tweet"
                  src={`https://twitframe.com/show?url=${encodeURIComponent(sourceUrl)}`}
                  className="h-64 w-full bg-white"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm font-bold text-gray-700 dark:text-white/70">
            No quote available.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <ActionButton onClick={fetchRandomQuote}>Refresh</ActionButton>
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.06]">
      <div className="text-xs font-extrabold text-gray-500 dark:text-white/50">
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-2 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
    >
      {children}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black/60 dark:border-white/20 dark:border-t-white/70" />
    </div>
  );
}
