/* ------------------------------------------------------------------ */
/*  Shared pure helpers for the news section (no JSX here)            */
/* ------------------------------------------------------------------ */

export const getDomain = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const favicon = (domain: string): string =>
  domain
    ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`
    : "";

export const timeAgo = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const normalizeUrl = (s: string): string => {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};

export const badUrl = (s?: string | null | unknown): boolean => {
  if (!s) return true;
  if (typeof s !== "string") return true;
  const v = s.trim().toLowerCase();
  if (!v || v.length < 10) return true;
  if (
    [
      "none",
      "null",
      "n/a",
      "undefined",
      "no image",
      "noimage",
      "placeholder",
      "[object object]",
    ].includes(v)
  )
    return true;
  if (v.startsWith("data:image/gif")) return true;
  if (
    v.includes("spacer.gif") ||
    v.includes("pixel.gif") ||
    v.includes("blank.gif")
  )
    return true;
  if (
    !v.startsWith("http://") &&
    !v.startsWith("https://") &&
    !v.startsWith("//")
  )
    return true;
  return false;
};

export const uniqStrings = (arr: string[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const k = String(s || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
};

const IMG_PROXY = "https://u-mail.co/api/NewsAPI/img?url=";

export const withProxyFallback = (urls: string[], width?: number): string[] => {
  const norm = urls.map(normalizeUrl).filter(Boolean);
  const sizeParam = width ? `&width=${width}` : "";
  const result: string[] = [];
  for (const u of norm) {
    result.push(u);
    result.push(`${IMG_PROXY}${encodeURIComponent(u)}${sizeParam}`);
  }
  return uniqStrings(result);
};
