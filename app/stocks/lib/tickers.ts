/**
 * tickers.ts — Single source of truth for all Finnhub ticker lists.
 *
 * Previously each component had its own hardcoded arrays, causing overlapping
 * fetches (e.g. AAPL fetched 3× simultaneously). Centralising here lets
 * marketStore deduplicate and prioritise requests correctly.
 */

/* ── Blue-chip US stocks shown in the Market Widgets sidebar ─────────── */
export const TOP_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
  "BRK.B", "JPM", "V", "UNH", "LLY", "XOM", "WMT", "MA",
  "JNJ", "PG", "AVGO", "HD", "CVX", "MRK", "ABBV", "COST", "PEP",
] as const;

/* ── Potential market movers scanned for gainers/losers ─────────────── */
export const MOVER_POOL = [
  "AMD", "NFLX", "INTC", "CSCO", "QCOM", "ADBE", "CRM", "ORCL",
  "PYPL", "UBER", "LYFT", "SHOP", "SPOT", "SNAP",
  "ZM", "DOCU", "CRWD", "NET", "DDOG", "SNOW", "PLTR", "RBLX",
  "COIN", "HOOD", "SOFI", "AFRM", "RIVN", "LCID", "NIO", "XPEV", "ROKU",
] as const;

/* ── Full symbol set for the Exchange Heatmap section ───────────────── */
export const HEATMAP_SYMBOLS = [
  "AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "META", "NVDA",
  "PYPL", "ASML", "ADBE", "CMCSA", "CSCO", "PEP", "NFLX", "AVGO",
  "INTU", "AMD", "IBM", "TXN", "QCOM", "COST", "ABBV", "CRM", "ACN",
  "T", "NKE", "NEE", "DHR", "ORCL", "UNH", "FIS", "BMY", "LLY",
  "CVX", "LIN", "HD", "AMGN", "MDT", "HON", "MO", "NVO",
  "MMM", "VRTX", "REGN", "LMT", "NOW", "ZM", "MA", "CME",
  "UPS", "TMUS", "SNOW",
] as const;

/* ── Compact 12-symbol set for the homepage Ticker Widget ───────────── */
export const TICKER_SYMBOLS = [
  "AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "META",
  "NVDA", "JPM", "V", "NFLX", "AMD", "IBM",
] as const;

/* ── Convenience union (all unique tickers across every component) ───── */
export const ALL_SYMBOLS: readonly string[] = Array.from(
  new Set([
    ...TOP_TICKERS,
    ...MOVER_POOL,
    ...HEATMAP_SYMBOLS,
    ...TICKER_SYMBOLS,
  ])
);

export type TopTicker      = (typeof TOP_TICKERS)[number];
export type HeatmapSymbol  = (typeof HEATMAP_SYMBOLS)[number];
export type TickerSymbol   = (typeof TICKER_SYMBOLS)[number];
