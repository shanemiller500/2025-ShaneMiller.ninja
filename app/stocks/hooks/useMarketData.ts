"use client";
/**
 * useMarketData.ts — React hook that wraps the marketStore singleton.
 *
 * Usage:
 *   const { tickerMap, loadingSet, wsConnected } = useMarketData(SYMBOLS, 'high');
 *
 * - tickerMap  : Record<symbol, TickerData> updated reactively as data arrives
 * - loadingSet : Set<symbol> of symbols not yet loaded (use for skeleton UI)
 * - wsConnected: boolean — true when the shared WS stream is live
 *
 * The hook also:
 *   1. Enqueues quote + profile requests at the given priority
 *   2. Registers with the shared WebSocket for live price updates
 *   3. Cleans everything up on unmount
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { marketStore } from "../lib/marketStore";
import type { DataPriority, TickerData } from "../lib/types";
import { API_TOKEN } from "@/utils/config";

export function useMarketData(
  symbols: readonly string[],
  priority: DataPriority = "medium"
) {
  const [tickerMap, setTickerMap] = useState<Record<string, TickerData>>({});
  const [wsConnected, setWsConnected] = useState(false);

  // Stable array reference for effect deps
  const symsKey = symbols.join(",");
  const symsRef = useRef<readonly string[]>(symbols);
  symsRef.current = symbols;

  // Initialise WS on first use (idempotent — safe to call multiple times)
  useEffect(() => {
    if (API_TOKEN) marketStore.wsInit(API_TOKEN as string);
  }, []);

  // Prefetch + subscribe
  useEffect(() => {
    const syms = symsRef.current;

    // 1. Enqueue REST fetches for all symbols at the requested priority
    marketStore.prefetch(Array.from(syms), priority);

    // 2. Subscribe to data updates → update React state reactively
    const unsub = marketStore.subscribe(Array.from(syms), (sym, data) => {
      setTickerMap((prev) => ({ ...prev, [sym]: data }));
    });

    // 3. Register for WS updates (ref-counted inside store)
    marketStore.wsSubscribe(Array.from(syms));

    // 4. Subscribe to WS connection state
    const unsubWs = marketStore.onWsState(setWsConnected);

    return () => {
      unsub();
      marketStore.wsUnsubscribe(Array.from(syms));
      unsubWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symsKey, priority]);

  // loadingSet: symbols we haven't received data for yet
  const loadingSet = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const sym of symbols) {
      if (!tickerMap[sym]) s.add(sym);
    }
    return s;
  }, [symbols, tickerMap]);

  return { tickerMap, loadingSet, wsConnected };
}

/**
 * Lightweight hook for a single symbol — convenience wrapper.
 */
export function useTicker(symbol: string, priority: DataPriority = "medium") {
  const { tickerMap, loadingSet, wsConnected } = useMarketData([symbol], priority);
  return {
    data: tickerMap[symbol] ?? null,
    loading: loadingSet.has(symbol),
    wsConnected,
  };
}
