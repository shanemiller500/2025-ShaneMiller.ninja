/* ------------------------------------------------------------------ */
/*  Marvel Database (Fandom) enrichment                                 */
/*                                                                      */
/*  Only requested when a player opens a character. Uses the public      */
/*  MediaWiki API (CORS via origin=*), resolves the page cautiously and  */
/*  caches the result for the session. Any failure returns null and the  */
/*  game keeps using the base dataset.                                   */
/* ------------------------------------------------------------------ */

const API = "https://marvel.fandom.com/api.php";
const SESSION_PREFIX = "mfw:wiki:v1:";

export interface WikiProfile {
  title: string;
  url: string;
  image?: string;
  quote?: string;
  overview?: string;
  personality?: string;
  powers?: string;
  abilities?: string;
  weaknesses?: string;
  equipment?: string;
  weapons?: string;
  transportation?: string;
  origin?: string;
  citizenship?: string;
  education?: string;
  identity?: string;
  creators?: string;
  first?: string;
  gallery: string[];
}

interface HeroIdentity {
  name: string;
  biography: { fullName: string; aliases?: string[] };
}

/* ── Matching ─────────────────────────────────────────────────────── */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const hasPhrase = (text: string, phrase: string) => {
  const p = norm(phrase);
  return p.length > 1 && ` ${norm(text)} `.includes(` ${p} `);
};

const REJECT = /\b(film|movie|tv|television|series|video game|game|comic|vol|issue|episode|novel|toy|lego|disambiguation|gallery|quotes)\b/i;

/**
 * Is this wiki page really the character? Accepts a page only when it is
 * the main (Earth-616) reality and either its name matches exactly or the
 * opening text names both the hero and their real identity.
 */
export function matchesCharacter(hero: HeroIdentity, title: string, intro: string): boolean {
  const realities = [...title.matchAll(/\(Earth-([^)]+)\)/gi)].map((m) => m[1]);
  if (realities.length && !realities.includes("616")) return false;
  const base = title.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (REJECT.test(title.replace(/\(Earth-[^)]+\)/gi, ""))) return false;
  const extraParen = title.replace(/\(Earth-[^)]+\)/gi, "").match(/\(([^)]*)\)/);
  if (extraParen) return false;

  const real = hero.biography.fullName && hero.biography.fullName !== "-" ? hero.biography.fullName : "";
  const names = [real, hero.name, ...(hero.biography.aliases ?? [])].filter((n) => n && n !== "-");
  if (names.some((n) => norm(n) === norm(base))) {
    // Exact title match; also make sure the text isn't about somebody else entirely
    return !intro || names.some((n) => hasPhrase(intro, n)) || hasPhrase(intro, base);
  }
  // Title is a different spelling of the real name (e.g. "James Howlett" for Logan):
  // require the intro to mention the hero name AND a piece of the real identity.
  const realBits = norm(real).split(" ").filter((w) => w.length > 2);
  return hasPhrase(intro, hero.name) && (realBits.length === 0 || realBits.some((w) => hasPhrase(intro, w))) && !!realities.length;
}

/* ── Wikitext helpers ─────────────────────────────────────────────── */
export function stripWiki(src: string): string {
  let s = src
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n");
  // Drop templates, innermost first
  for (let i = 0; i < 8 && /\{\{[^{}]*\}\}/.test(s); i++) s = s.replace(/\{\{[^{}]*\}\}/g, "");
  s = s
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:[^\s\]]+\s?([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^[*#:;]+\s*/gm, "• ")
    .replace(/^=+\s*(.*?)\s*=+$/gm, "$1:")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

const clip = (s: string | undefined, n: number) => {
  if (!s) return undefined;
  const t = s.trim();
  if (!t || /^[-–—\s]*$/.test(t)) return undefined;
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
};

/** Pull `| Key = value` fields out of the character infobox template. */
export function infoboxFields(wikitext: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^\|\s*([A-Za-z0-9 _]+?)\s*=\s*([\s\S]*?)(?=^\||^\}\}\s*$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) out[m[1].trim().toLowerCase()] = m[2].trim();
  return out;
}

/* ── Fetching ─────────────────────────────────────────────────────── */
async function api(params: Record<string, string>, signal?: AbortSignal) {
  const q = new URLSearchParams({ format: "json", origin: "*", ...params });
  const r = await fetch(`${API}?${q}`, { signal });
  if (!r.ok) throw new Error(`wiki ${r.status}`);
  return r.json();
}

async function searchTitles(query: string, signal?: AbortSignal): Promise<{ title: string; snippet: string }[]> {
  const j = await api({ action: "query", list: "search", srsearch: query, srnamespace: "0", srlimit: "8" }, signal);
  return (j?.query?.search ?? []).map((s: any) => ({ title: String(s.title), snippet: stripWiki(String(s.snippet ?? "").replace(/<[^>]+>/g, "")) }));
}

async function resolvePage(hero: HeroIdentity, signal?: AbortSignal): Promise<{ title: string; wikitext: string } | null> {
  const real = hero.biography.fullName && hero.biography.fullName !== "-" ? hero.biography.fullName : "";
  const queries = [real && `${real} Earth-616`, `${hero.name} Earth-616`].filter(Boolean) as string[];
  const tried = new Set<string>();
  for (const q of queries) {
    const results = await searchTitles(q, signal);
    for (const r of results) {
      if (tried.has(r.title)) continue;
      tried.add(r.title);
      // Cheap pre-filter on the title, then confirm against the page text
      if (!/\(Earth-616\)/i.test(r.title)) continue;
      const page = await api({ action: "parse", page: r.title, prop: "wikitext", redirects: "1" }, signal).catch(() => null);
      const wikitext: string = page?.parse?.wikitext?.["*"] ?? "";
      if (!wikitext) continue;
      const f = infoboxFields(wikitext);
      const intro = stripWiki([f["overview"], f["history"], f["currentalias"], f["aliases"], f["realname"], f["name"]].filter(Boolean).join(" ")).slice(0, 2500);
      if (matchesCharacter(hero, String(page.parse.title ?? r.title), intro)) return { title: String(page.parse.title ?? r.title), wikitext };
    }
  }
  return null;
}

async function pageImages(title: string, signal?: AbortSignal): Promise<{ image?: string; gallery: string[] }> {
  try {
    const main = await api({ action: "query", titles: title, prop: "pageimages", piprop: "original" }, signal);
    const pg: any = Object.values(main?.query?.pages ?? {})[0];
    const image: string | undefined = pg?.original?.source;
    const gal = await api(
      { action: "query", generator: "images", titles: title, gimlimit: "30", prop: "imageinfo", iiprop: "url|size", iiurlwidth: "360" },
      signal
    );
    const gallery = Object.values(gal?.query?.pages ?? {})
      .map((p: any) => p?.imageinfo?.[0])
      .filter((ii: any) => ii && ii.width >= 200 && ii.height >= 200 && /\.(jpe?g|png)$/i.test(ii.url))
      .map((ii: any) => ii.thumburl as string)
      .filter((u: string | undefined): u is string => !!u)
      .slice(0, 8);
    return { image, gallery };
  } catch {
    return { gallery: [] };
  }
}

const memory = new Map<number, Promise<WikiProfile | null>>();

/** Session-cached enrichment for one character. Never throws. */
export function loadWikiProfile(id: number, hero: HeroIdentity): Promise<WikiProfile | null> {
  const hit = memory.get(id);
  if (hit) return hit;
  const p = (async () => {
    try {
      const cached = sessionStorage.getItem(SESSION_PREFIX + id);
      if (cached) return JSON.parse(cached) as WikiProfile | null;
    } catch {
      /* ignore */
    }
    try {
      const page = await resolvePage(hero);
      let profile: WikiProfile | null = null;
      if (page) {
        const f = infoboxFields(page.wikitext);
        const get = (k: string, n = 700) => clip(stripWiki(f[k] ?? ""), n);
        const imgs = await pageImages(page.title);
        profile = {
          title: page.title,
          url: `https://marvel.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
          image: imgs.image,
          quote: get("quotation", 260),
          overview: get("overview", 900) ?? get("history", 900),
          personality: get("personality"),
          powers: get("powers", 900),
          abilities: get("abilities"),
          weaknesses: get("weaknesses"),
          equipment: get("equipment", 400),
          weapons: get("weapons", 400),
          transportation: get("transportation", 300),
          origin: get("origin", 300),
          citizenship: get("citizenship", 160),
          education: get("education", 200),
          identity: get("identity", 160),
          creators: get("creators", 200),
          first: get("first", 160),
          gallery: imgs.gallery,
        };
      }
      try {
        sessionStorage.setItem(SESSION_PREFIX + id, JSON.stringify(profile));
      } catch {
        /* ignore */
      }
      return profile;
    } catch {
      memory.delete(id); // network error: allow a retry next time
      return null;
    }
  })();
  memory.set(id, p);
  return p;
}
