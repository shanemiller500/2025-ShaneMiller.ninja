// Cleveland Museum of Art open access API (CC0 images, no key). The Art Institute of
// Chicago's image server now blocks embedding on other sites, so this page uses Cleveland.
export interface Artwork {
  id: number;
  title: string;
  /** Full credit, e.g. "Claude Monet (French, 1840–1926)" */
  artist: string;
  /** Just the name, e.g. "Claude Monet" */
  artistShort: string;
  date?: string | null;
  origin?: string | null;
  medium?: string | null;
  dimensions?: string | null;
  description?: string | null;
  didYouKnow?: string | null;
  credit?: string | null;
  type?: string | null;
  isPublicDomain: boolean;
  /** ~900px web image */
  image: string;
  /** Print-quality image when available */
  imageLarge: string;
  /** The artwork's page on clevelandart.org */
  page: string;
}

export type ArtQuery = { q?: string; type?: string; highlight?: boolean };
const API = "https://openaccess-api.clevelandart.org/api/artworks/";

export const stripHtml = (html?: string | null) =>
  (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, " ").trim();

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
function normalize(a: Raw): Artwork | null {
  const image = a?.images?.web?.url;
  if (!image) return null;
  const artist = a.creators?.[0]?.description || a.culture?.[0] || "Unknown artist";
  return {
    id: a.id,
    title: a.title || "Untitled",
    artist,
    artistShort: String(artist).split(" (")[0],
    date: a.creation_date,
    origin: Array.isArray(a.culture) ? a.culture[0] : null,
    medium: a.technique,
    dimensions: a.measurements,
    description: stripHtml(a.description || a.wall_description) || null,
    didYouKnow: stripHtml(a.did_you_know) || null,
    credit: a.credit_line || null,
    type: a.type,
    isPublicDomain: a.share_license_status === "CC0",
    image,
    imageLarge: a.images?.print?.url || a.images?.full?.url || image,
    page: a.url || `https://www.clevelandart.org/art/${a.accession_number}`,
  };
}

// Search the collection: CC0 works with images only, so everything can be shown.
export async function searchArtworks(query: ArtQuery, page = 1, limit = 24, signal?: AbortSignal) {
  const params = new URLSearchParams({ has_image: "1", cc0: "1", limit: String(limit), skip: String((page - 1) * limit) });
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.highlight) params.set("highlight", "1");
  const res = await fetch(`${API}?${params}`, { signal });
  if (!res.ok) throw new Error(`Cleveland Museum API ${res.status}`);
  const json = await res.json();
  const data = ((json.data || []) as Raw[]).map(normalize).filter((a): a is Artwork => !!a);
  const total = Number(json.info?.total) || data.length;
  return { data, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
