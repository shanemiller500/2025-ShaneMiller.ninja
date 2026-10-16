/* ------------------------------------------------------------------ */
/*  The atlas document library — shared by every atlas project.        */
/*                                                                     */
/*  Files (PDFs, scans, images, datasets) live in Firebase Storage at  */
/*  geo-library/{sha256}.{ext}; Firestore holds one searchable index   */
/*  record per file in `geoDocs/{sha256}` (so the same paper uploaded  */
/*  twice is one document, and one paper can serve many projects).    */
/*  Extracted text goes in `geoDocs/{id}/chunks` (Phase 3).            */
/*                                                                     */
/*  Writers: the /atlas/admin uploader (client SDK, admin-only rules)  */
/*  and scripts/atlas/seed.mjs (firebase-admin, from your machine).    */
/* ------------------------------------------------------------------ */

export const GEO_DOCS = "geoDocs";
export const LIBRARY_PREFIX = "geo-library";

export type GeoDocKind = "pdf" | "image" | "dataset" | "link";
export type TextStatus = "none" | "pending" | "done" | "failed";

export interface GeoDoc {
  title: string;
  kind: GeoDocKind;
  /** Publisher, e.g. "USGS" */
  source: string;
  /** Where the original lives (landing page or file URL) */
  sourceUrl: string | null;
  license: string;
  year: number | null;
  authors: string[];
  summary: string;
  /** Atlas project slugs this document belongs to */
  projects: string[];
  tags: string[];
  region: string | null;
  /** [west, south, east, north] when the document covers a known area */
  bbox: [number, number, number, number] | null;
  /** Storage path, or null for link-only entries */
  storagePath: string | null;
  sha256: string | null;
  bytes: number | null;
  contentType: string | null;
  textStatus: TextStatus;
  /** Page count, once the text has been extracted */
  pages: number | null;
  /**
   * Search vocabulary: distinctive lowercase words from the title, tags and full text.
   * Firestore can't do full-text search, but it can do `array-contains` on this.
   */
  terms: string[];
  addedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

/** One page of extracted text: `geoDocs/{id}/chunks/{page}`. */
export interface GeoDocChunk {
  page: number;
  text: string;
}

/** Fields the Firestore rules accept — keep in sync with utils/firebase/firestore.rules. */
export const GEO_DOC_FIELDS: (keyof GeoDoc)[] = [
  "title", "kind", "source", "sourceUrl", "license", "year", "authors", "summary", "projects", "tags",
  "region", "bbox", "storagePath", "sha256", "bytes", "contentType", "textStatus", "pages", "terms", "addedBy", "createdAt", "updatedAt",
];

/** Normalise a search word the same way terms are stored. */
export const searchTerm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const LICENSES = ["public domain", "CC BY 4.0", "CC BY-SA 4.0", "ODC-BY", "link only (copyrighted)"];
export const SOURCES = ["USGS", "NOAA", "Smithsonian", "NPS", "FEMA", "NASA", "State survey", "Other"];

export const extFor = (contentType: string, name = "") => {
  const fromName = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("image/")) return contentType.slice(6).replace("jpeg", "jpg").replace("svg+xml", "svg");
  return "bin";
};

export const kindFor = (contentType: string): GeoDocKind =>
  contentType === "application/pdf" ? "pdf" : contentType.startsWith("image/") ? "image" : "dataset";

/** Public file URL — Storage rules allow anyone to read geo-library/*. */
export const libraryFileUrl = (bucket: string, storagePath: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`;

export const splitList = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/* ── search vocabulary ───────────────────────────────────────────── */

const STOPWORDS = new Set(
  (
    "the and for are but not you all any can had her was one our out day get has him his how man new now old see two way who boy did its let put say she too use " +
    "that with have this will your from they know want been good much some time very when come here just like long make many more only over such take than them well were " +
    "what into also each which their there these those other about after again being below between both could does doing down during further most once same should then " +
    "through under until upper while would because before above against where whom why itself himself herself themselves ourselves yours theirs fig figure table page pages " +
    "et al usgs survey geological department interior report sheet fact professional paper http https www gov pubs isbn doi printed recycled within near may per however"
  ).split(" ")
);

/**
 * The `terms` array for a document: every word from its title, tags and region, plus the most
 * frequent distinctive words in its text. Shared by the admin uploader and the seed script.
 */
export function docTerms(meta: { title: string; tags?: string[]; region?: string | null; summary?: string }, text = "", max = 600): string[] {
  // split on anything but Latin letters (incl. accented) and digits; searchTerm folds the accents
  const words = (s: string) => s.split(/[^A-Za-z0-9À-ɏ]+/).map(searchTerm).filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d{1,2}$/.test(w));
  const head = new Set(words(meta.title).concat((meta.tags ?? []).flatMap(words), words(meta.region ?? ""), words(meta.summary ?? "")));
  const counts = new Map<string, number>();
  // words of 4+ letters, plus years (1906, 1964…)
  for (const w of words(text)) if ((w.length >= 4 && !/^\d+$/.test(w)) || /^(1[0-9]{3}|20[0-9]{2})$/.test(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const ranked = Array.from(counts.entries()).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([w]) => w);
  const out = Array.from(head);
  for (const w of ranked) {
    if (out.length >= max) break;
    if (!head.has(w)) out.push(w);
  }
  return out.slice(0, max);
}
