"use client";
/**
 * useQuoteModal — one place that fetches a symbol's quote/profile/metric/news
 * and drives StockQuoteModal. Replaces three copy-pasted implementations.
 *
 * The modal opens immediately with a skeleton; data fills in when it lands.
 * A request counter drops stale responses if the user opens another symbol.
 */

import { useCallback, useRef, useState } from "react";

import StockQuoteModal, { type StockData } from "../StockQuoteModal";

const PROXY_BASE = "https://u-mail.co/api/finnhubProxy";

const getJson = (path: string, fallback: unknown = null): Promise<any> =>
  fetch(`${PROXY_BASE}/${path}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : fallback))
    .catch(() => fallback);

interface QuoteState {
  open: boolean;
  symbol: string | null;
  data: StockData | null;
  news: any[];
  loading: boolean;
  error: string | null;
}

const EMPTY: QuoteState = { open: false, symbol: null, data: null, news: [], loading: false, error: null };

export function useQuoteModal() {
  const [state, setState] = useState<QuoteState>(EMPTY);
  const reqRef = useRef(0);

  const openQuote = useCallback(async (raw: string) => {
    const symbol = String(raw || "").trim().toUpperCase();
    if (!symbol) return false;
    const req = ++reqRef.current;
    setState({ open: true, symbol, data: null, news: [], loading: true, error: null });

    const enc = encodeURIComponent(symbol);
    const [quote, profile, metric, news] = await Promise.all([
      getJson(`quote/${enc}`),
      getJson(`profile/${enc}`),
      getJson(`metric/${enc}`),
      getJson(`news/${enc}`, []),
    ]);
    if (req !== reqRef.current) return false;

    if (!quote || typeof quote.c !== "number" || quote.c <= 0) {
      setState({ open: true, symbol, data: null, news: [], loading: false, error: `No quote data found for “${symbol}”. Try another symbol.` });
      return false;
    }

    const p = profile && profile.name ? profile : { ...(profile || {}), name: symbol, ticker: symbol };
    setState({
      open: true,
      symbol,
      data: { profile: { ...p, ticker: p.ticker || symbol }, quote, metric },
      news: Array.isArray(news) ? news : [],
      loading: false,
      error: null,
    });
    return true;
  }, []);

  const closeQuote = useCallback(() => {
    reqRef.current++;
    setState((s) => ({ ...s, open: false, loading: false }));
  }, []);

  const quoteModal = (
    <StockQuoteModal
      open={state.open}
      symbol={state.symbol}
      stockData={state.data}
      newsData={state.news}
      loading={state.loading}
      error={state.error}
      onClose={closeQuote}
    />
  );

  return { openQuote, closeQuote, quoteModal, quoteLoading: state.loading };
}
