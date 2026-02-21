/**
 * types.ts — Shared TypeScript interfaces for the market data layer.
 *
/* ── Raw Finnhub quote response ─────────────────────────────────────── */
export interface QuoteData {
  c:  number; // current price
  d:  number; // change ($)
  dp: number; // change (%)
  h:  number; // high
  l:  number; // low
  o:  number; // open
  pc: number; // previous close
  t:  number; // timestamp (unix seconds)
  v?: number; // volume (optional)
}

/* ── Finnhub company profile ─────────────────────────────────────────── */
export interface ProfileData {
  name:     string;
  ticker:   string;
  logo:     string;
  weburl?:  string;
  website?: string;
  exchange?: string;
  industry?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  currency?: string;
  country?: string;
}

/* ── Combined ticker record held in the store ────────────────────────── */
export interface TickerData {
  symbol:   string;
  quote:    QuoteData;
  profile?: ProfileData;
  logo?:    string;        // resolved logo URL (finnhub or clearbit fallback)
}

/* ── Live trade tick from WebSocket ─────────────────────────────────── */
export interface TradeInfo {
  timestamp:     number;
  price:         number;
  prevClose?:    number;
  prevTick?:     number;
  percentChange: number;
  dir:           "up" | "down" | "flat";
  flashKey:      number;
}

/* ── Request priority (high loads first) ─────────────────────────────── */
export type DataPriority = "high" | "medium" | "low";

/* ── Market status from Finnhub /market-status ───────────────────────── */
export interface MarketStatus {
  isOpen:   boolean;
  t?:       number;   // unix timestamp
  session?: string;
}

/* ── Store subscriber callback ────────────────────────────────────────── */
export type StoreSubscriber = (symbol: string, data: TickerData) => void;
