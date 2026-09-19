// Browser requests stay on this origin; only the API routes authenticate with CoinCap.
export async function fetchCoinCap(path: string, init?: RequestInit) {
  const response = await fetch(`/api/coincap/${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Crypto data is temporarily unavailable.");
  }
  return response;
}

export function subscribeCoinCap(
  assets: string[],
  onPrices: (prices: Record<string, string>) => void,
  onStatus?: (status: "connecting" | "live" | "error") => void,
) {
  let source: EventSource | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let failures = 0;
  const connect = () => {
    if (stopped) return;
    onStatus?.("connecting");
    source = new EventSource(`/api/coincap/stream?assets=${encodeURIComponent(assets.join(","))}`);
    source.addEventListener("ready", () => { failures = 0; onStatus?.("live"); });
    source.onmessage = (event) => {
      try { onPrices(JSON.parse(event.data)); } catch { /* Ignore malformed updates. */ }
    };
    source.addEventListener("provider-error", () => {
      source?.close();
      onStatus?.("error");
    });
    source.addEventListener("reconnect", () => {
      source?.close();
      retry = setTimeout(connect, 1_000);
    });
    source.onerror = () => {
      source?.close();
      if (++failures <= 5) {
        onStatus?.("connecting");
        retry = setTimeout(connect, failures * 1_000);
      } else onStatus?.("error");
    };
  };
  connect();
  return () => { stopped = true; clearTimeout(retry); source?.close(); };
}
