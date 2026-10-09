/**
 * bio.ts — a character's full file from the Marvel Database wiki.
 *
 * Every character article is one big "{{Marvel Database: Character Template | Field = value | …}}".
 * We fetch the page's wikitext, split that template into fields (respecting nested
 * templates/links), and turn wiki markup into plain text: overview, quote, facts,
 * history chapters, powers/abilities as named items, family and trivia.
 */

import type { Hero } from "./roster";
import { api, resolveWikiPage, wikiUrl } from "./wiki";

export interface BioFact {
  label: string;
  value: string;
}

export interface BioItem {
  /** Lead-in name, e.g. "Spider-Sense" (empty for plain paragraphs) */
  name: string;
  text: string;
}

export interface BioSection {
  title: string;
  /** Plain paragraphs before the bulleted items */
  intro: string;
  items: BioItem[];
}

export interface BioChapter {
  title: string;
  text: string;
}

export interface Bio {
  page: string;
  pageUrl: string;
  realName: string;
  currentAlias: string;
  overview: string;
  quote: { text: string; speaker: string } | null;
  facts: BioFact[];
  history: BioChapter[];
  personality: string;
  powers: BioSection[];
  family: { label: string; items: string[] }[];
  codenames: string[];
  trivia: string[];
}

/* ------------------------------------------------------------------ */
/*  Wikitext helpers                                                   */
/* ------------------------------------------------------------------ */

/** Split the top-level character template into { Field: rawValue }, respecting {{…}} and [[…]] nesting. */
function templateFields(w: string): Record<string, string> {
  // Spelling varies between pages: "Marvel Database:Character Template" / "Marvel Database: Character Template"
  const start = w.search(/\{\{\s*Marvel Database\s*:\s*Character Template/i);
  if (start < 0) return {};
  const fields: Record<string, string> = {};
  let depth = 0;
  let links = 0;
  let key: string | null = null;
  let buf = "";
  for (let i = start; i < w.length; i++) {
    const two = w.slice(i, i + 2);
    if (two === "{{") {
      depth++;
      i++;
      if (depth > 1) buf += two;
      continue;
    }
    if (two === "}}") {
      depth--;
      i++;
      if (depth === 0) break;
      buf += two;
      continue;
    }
    if (two === "[[" || two === "]]") {
      links += two === "[[" ? 1 : -1;
      i++;
      buf += two;
      continue;
    }
    const ch = w[i];
    if (ch === "|" && depth === 1 && links === 0) {
      if (key) fields[key] = buf.trim();
      const eq = w.indexOf("=", i);
      const candidate = eq > i ? w.slice(i + 1, eq) : "";
      if (!candidate || /[\n{[|]/.test(candidate)) {
        key = null;
        buf = "";
        continue;
      }
      key = candidate.trim();
      buf = "";
      i = eq;
      continue;
    }
    if (depth >= 1) buf += ch;
  }
  if (key) fields[key] = buf.trim();
  return fields;
}

/** Wiki markup → readable plain text (keeps line breaks, bullets and === headings). */
export function wikiToText(t: string | undefined): string {
  if (!t) return "";
  let s = t;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<gallery[\s\S]*?<\/gallery>/gi, "");
  // Inline "link-ish" templates keep their visible label; everything else is dropped
  for (let k = 0; k < 4; k++) {
    s = s.replace(/\{\{(?:cl|cid|apn|g|c|w|wp|dc|m|el|sl|tl|link|sic|power|ability|weakness|categorylink|plink|alink)\|([^{}|]*)(?:\|([^{}]*))?\}\}/gi, (_, a: string, b?: string) =>
      (b ? b.split("|").pop()! : a).replace(/ Vol \d+ (\d+)/, " #$1")
    );
    s = s.replace(/\{\{[^{}]*\}\}/g, "");
  }
  s = s.replace(/\{\|[\s\S]*?\|\}/g, ""); // tables
  s = s.replace(/\[\[(?:File|Image|Category|Media):[^\]]*\]\]/gi, "");
  s = s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2").replace(/\[\[([^\]]*)\]\]/g, "$1");
  s = s.replace(/\[https?:\/\/\S+ ([^\]]+)\]/g, "$1").replace(/\[https?:\/\/\S+\]/g, "");
  s = s.replace(/'''''|'''|''/g, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/^[:;]+\s*/gm, "");
  s = s.replace(/[ \t]+/g, " ").replace(/ +\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

const oneLine = (s: string) => s.replace(/\s*\n+\s*/g, " ").trim();

/** "* Name: text" bullets → items; anything before the first bullet → intro. */
function toSection(title: string, raw: string | undefined): BioSection | null {
  const text = wikiToText(raw);
  if (!text) return null;
  const lines = text.split("\n");
  const intro: string[] = [];
  const items: BioItem[] = [];
  for (const line of lines) {
    const m = line.match(/^\*+\s*(.*)$/);
    if (!m) {
      if (items.length) items[items.length - 1].text += line.trim() ? `\n${line.trim()}` : "";
      else if (line.trim() && !/^=+.*=+$/.test(line.trim())) intro.push(line.trim());
      continue;
    }
    const body = m[1].trim();
    if (!body) continue;
    const colon = body.indexOf(":");
    if (colon > 0 && colon < 60) items.push({ name: body.slice(0, colon).trim(), text: body.slice(colon + 1).trim() });
    else items.push({ name: "", text: body });
  }
  if (!intro.length && !items.length) return null;
  return { title, intro: intro.join("\n\n"), items: items.slice(0, 40) };
}

/** "* Richard Parker (father, deceased)" → ["Richard Parker (father, deceased)"] */
const toList = (raw: string | undefined, max = 12) =>
  wikiToText(raw)
    .split(/\n|;\s*/)
    .map((l) => l.replace(/^\*+\s*/, "").trim())
    .filter((l) => l && l.length < 160 && !/^=+/.test(l))
    .slice(0, max);

/** Split History into "=== Chapter ===" sections. */
function toChapters(raw: string | undefined): BioChapter[] {
  const text = wikiToText(raw)
    .replace(/^This is an abridged version[^\n]*\n*/i, "")
    .replace(/^For a complete history[^\n]*\n*/i, "");
  if (!text) return [];
  const parts = text.split(/^={2,5}\s*(.+?)\s*={2,5}\s*$/m);
  const chapters: BioChapter[] = [];
  if (parts[0].trim()) chapters.push({ title: "Beginnings", text: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) {
    const body = (parts[i + 1] ?? "").trim();
    if (body) chapters.push({ title: parts[i].trim(), text: body });
  }
  return chapters.slice(0, 40);
}

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */
const FACTS: [string, string][] = [
  ["Name", "Real name"],
  ["CurrentAlias", "Current alias"],
  ["Identity", "Identity"],
  ["Citizenship", "Citizenship"],
  ["MaritalStatus", "Marital status"],
  ["Education", "Education"],
  ["Origin", "Origin"],
  ["Reality", "Universe"],
  ["Gender", "Gender"],
  ["Eyes", "Eyes"],
  ["Hair", "Hair"],
  ["UnusualFeatures", "Unusual features"],
  ["Creators", "Created by"],
  ["First", "First appearance"],
];

const FAMILY: [string, string][] = [
  ["Parents", "Parents"],
  ["Siblings", "Siblings"],
  ["Spouses", "Spouses"],
  ["Children", "Children"],
  ["Grandparents", "Grandparents"],
  ["Relatives", "Relatives"],
  ["Affiliation", "Affiliation"],
  ["Pets", "Pets"],
];

const POWER_FIELDS: [string, string][] = [
  ["Powers", "Powers"],
  ["Abilities", "Abilities"],
  ["Weaknesses", "Weaknesses"],
  ["Equipment", "Equipment"],
  ["Weapons", "Weapons"],
  ["Transportation", "Transportation"],
];

const cache = new Map<number, Promise<Bio | null>>();
const pageCache = new Map<string, Promise<Bio | null>>();

/** Load a known character page, including characters absent from the game roster. */
export function loadBioForPage(page: string): Promise<Bio | null> {
  if (!pageCache.has(page)) {
    const request = (async (): Promise<Bio | null> => {
      const j = await api({ action: "query", titles: page, prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1" });
      const pg: any = Object.values(j.query?.pages ?? {})[0];
      const wikitext: string = pg?.revisions?.[0]?.slots?.main?.["*"] ?? "";
      const f = templateFields(wikitext);
      if (!Object.keys(f).length) return null;

      const facts = FACTS.map(([k, label]) => ({ label, value: oneLine(wikiToText(f[k])) }))
        .filter((x) => x.value && x.value.length < 220)
        .map((x) =>
          x.label === "Created by"
            ? { ...x, value: x.value.replace(/\s*;\s*/g, ", ") }
            : x.label === "First appearance"
              ? { ...x, value: x.value.replace(/ Vol (\d+) (\S+)$/, (_, vol, iss) => (vol === "1" ? ` #${iss}` : ` Vol ${vol} #${iss}`)) }
              : x
        );

      const quoteText = oneLine(wikiToText(f.Quotation));
      return {
        page,
        pageUrl: wikiUrl(page),
        realName: oneLine(wikiToText(f.Name)),
        currentAlias: oneLine(wikiToText(f.CurrentAlias)),
        overview: wikiToText(f.Overview),
        quote: quoteText ? { text: quoteText, speaker: oneLine(wikiToText(f.Speaker)) } : null,
        facts,
        history: toChapters(f.History),
        personality: wikiToText(f.Personality),
        powers: POWER_FIELDS.map(([k, t]) => toSection(t, f[k])).filter((x): x is BioSection => !!x),
        family: FAMILY.map(([k, label]) => ({ label, items: toList(f[k]) })).filter((x) => x.items.length),
        codenames: toList([f.Codenames, f.Aliases].filter(Boolean).join("\n"), 24),
        trivia: wikiToText(f.Trivia)
          .split(/\n(?=\*)/)
          .map((l) => oneLine(l.replace(/^\*+\s*/, "")))
          .filter((t) => t.length > 20 && t.length < 600)
          .slice(0, 8),
      };
    })().catch((e) => { pageCache.delete(page); throw e; });
    pageCache.set(page, request);
  }
  return pageCache.get(page)!;
}

export function loadBio(h: Hero): Promise<Bio | null> {
  if (!cache.has(h.id)) {
    const p = (async (): Promise<Bio | null> => {
      const page = await resolveWikiPage(h);
      if (!page) return null;
      return loadBioForPage(page);
    })().catch((e) => {
      cache.delete(h.id);
      throw e;
    });
    cache.set(h.id, p);
  }
  return cache.get(h.id)!;
}
