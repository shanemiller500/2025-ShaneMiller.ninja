/* ------------------------------------------------------------------ */
/*  Bake public/atlas/sinkings.json — ships lost in the two world      */
/*  wars, day by day, from Wikipedia's monthly "List of shipwrecks in  */
/*  <Month> <Year>" articles (CC BY-SA 4.0). Only entries that give a  */
/*  position ({{coord}}) are kept. For each: date (from the article's  */
/*  day heading), position, ship, flag, a cause read from the text,    */
/*  lives lost when the text states them, and a short description.    */
/*                                                                     */
/*  node scripts/atlas/build-sinkings.mjs                              */
/* ------------------------------------------------------------------ */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/sinkings.json");
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ERAS = [
  [1914, 1918],
  [1939, 1945],
];

/* ── wikitext helpers ────────────────────────────────────────────── */

/** Every {{shipwreck list item …}} block, with balanced braces. */
function items(text) {
  const out = [];
  const re = /\{\{\s*shipwreck list item/gi;
  let m;
  while ((m = re.exec(text))) {
    let depth = 0;
    let i = m.index;
    for (; i < text.length - 1; i++) {
      if (text[i] === "{" && text[i + 1] === "{") {
        depth++;
        i++;
      } else if (text[i] === "}" && text[i + 1] === "}") {
        depth--;
        i++;
        if (depth === 0) break;
      }
    }
    out.push({ at: m.index, body: text.slice(m.index + 2, i - 1) });
    re.lastIndex = i;
  }
  return out;
}

/** Split template params on top-level pipes (not inside {{…}} or [[…]]). */
function params(body) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      cur += two;
      i++;
      continue;
    }
    if (two === "}}" || two === "]]") {
      depth--;
      cur += two;
      i++;
      continue;
    }
    if (body[i] === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += body[i];
  }
  parts.push(cur);
  const named = {};
  for (const p of parts.slice(1)) {
    const k = p.indexOf("=");
    if (k > 0) named[p.slice(0, k).trim().toLowerCase()] = p.slice(k + 1).trim();
  }
  return named;
}

const stripRefs = (s) => s.replace(/<ref[^>]*\/>/g, "").replace(/<ref[\s\S]*?<\/ref>/g, "").replace(/<!--[\s\S]*?-->/g, "");

/** {{coord|…}} → [lng, lat] (DMS or decimal forms). */
function coordOf(s) {
  const m = s.match(/\{\{\s*coord\s*\|([^}]*)\}\}/i);
  if (!m) return null;
  const parts = m[1].split("|").map((x) => x.trim()).filter((x) => x && !x.includes("="));
  const ns = parts.findIndex((p) => p === "N" || p === "S");
  if (ns > 0) {
    const ew = parts.findIndex((p, i) => i > ns && (p === "E" || p === "W"));
    if (ew < 0) return null;
    const dms = (xs) => xs.reduce((a, v, i) => a + Number(v) / 60 ** i, 0);
    const lat = dms(parts.slice(0, ns)) * (parts[ns] === "S" ? -1 : 1);
    const lng = dms(parts.slice(ns + 1, ew)) * (parts[ew] === "W" ? -1 : 1);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [Math.round(lng * 1e3) / 1e3, Math.round(lat * 1e3) / 1e3] : null;
  }
  const [a, b] = parts.map(Number);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [Math.round(b * 1e3) / 1e3, Math.round(a * 1e3) / 1e3] : null;
}

/** Wikitext → plain text (ship templates become names, links become their labels). */
function plain(s) {
  let t = stripRefs(s);
  // image thumbnails inside the entry ("[[File:…|thumb|caption]]")
  for (let k = 0; k < 3; k++) t = t.replace(/\[\[(?:File|Image):(?:[^[\]]|\[\[[^\]]*\]\])*\]\]/gi, "");
  for (let k = 0; k < 4; k++) {
    t = t
      .replace(/\{\{\s*coord\s*\|[^}]*\}\}/gi, "")
      .replace(/\{\{\s*convert\s*\|([\d.,]+)\|([a-z]+)[^}]*\}\}/gi, "$1 $2")
      .replace(/\{\{\s*(?:flag|flagcountry|navy)\s*\|([^|}]+)[^}]*\}\}/gi, "$1")
      .replace(/\{\{\s*GS\s*\|([^|}]+)[^}]*\}\}/g, "$1")
      .replace(/\{\{\s*ship\s*\|([^|}]*)\|([^|}]+)[^}]*\}\}/gi, "$1 $2")
      .replace(/\{\{\s*([A-Z]{2,5})\s*\|([^|}]+)[^}]*\}\}/g, "$1 $2")
      .replace(/\{\{\s*(?:sfn|efn|cn|citation needed|clarify|when|which|dead link)[^{}]*\}\}/gi, "")
      .replace(/\{\{\s*[A-Za-z]{2,8}\s*\|([^|}]+)[^{}]*\}\}/g, "$1")
      .replace(/\{\{[^{}]*\}\}/g, "");
  }
  return t
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\(\s*[,;]?\s*\)/g, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .trim();
}

/* ── cause + lives lost, read from the description ───────────────── */

export const CAUSES = ["submarine", "mine", "aircraft", "warship", "scuttled", "weather", "grounding", "collision", "fire", "other"];
function causeOf(t) {
  const s = t.toLowerCase();
  if (/\bmine\b|\bmined\b|minefield/.test(s)) return "mine";
  // attack phrasing only — "the destroyer …" or "the Type VII submarine …" names the ship, not the cause
  if (/torpedo|\bby\b[^.]{0,40}\b(?:u[bc]?-\d|i-\d|ro-\d|submarine)/.test(s)) return "submarine";
  if (/\bby\b[^.]{0,40}\b(?:aircraft|planes?|bombers?|luftwaffe)\b|\bbombed\b|kamikaze|dive.bomb/.test(s)) return "aircraft";
  if (/scuttl/.test(s)) return "scuttled";
  if (/\bstorm|\bgale\b|hurricane|typhoon|cyclone|heavy seas/.test(s) && !/shelled|gunfire|depth.charg/.test(s)) return "weather";
  if (/shelled|gunfire|depth.charg|rammed|\braider\b|captured and sunk|sunk by|naval action|battle of|in action/.test(s)) return "warship";
  if (/collid|collision/.test(s)) return "collision";
  if (/iceberg|\bice\b|weather|foundered/.test(s)) return "weather";
  if (/aground|wrecked|stranded|struck rocks|struck a reef/.test(s)) return "grounding";
  if (/fire|explo|burn/.test(s)) return "fire";
  return "other";
}
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const NUM = `(\\d[\\d,]*|${Object.keys(WORDS).join("|")})`;
const WHO = "(?:crew(?:men|man)?|people|person|m[ae]n|li(?:fe|ves)|passengers?|aboard|personnel|gunners?|soldiers?|troops|officers?|hands|ratings?|sailors?|others|civilians?|prisoners?|on board)";
const toN = (x) => WORDS[x.toLowerCase()] ?? Number(x.replace(/,/g, ""));
/** Lives lost as the entry states them; sums "nine gunners and 41 crew". */
function livesLost(t) {
  // stop before "… of the 73 people on board" so the total aboard isn't counted as lost
  const seg = t.match(/with the loss of ([^.;]{1,120})/i)?.[1].split(/\bof (?:the|her|his|its) [\d,]+|\bout of\b|\bwhen\b/i)[0];
  let n = null;
  if (seg) {
    const re = new RegExp(`\\b${NUM}\\s+(?:of (?:her|the|his|its) [\\d,]+ )?(?:[a-z-]+ )?${WHO}\\b`, "gi");
    let sum = 0;
    for (const m of seg.matchAll(re)) sum += toN(m[1]);
    // "one passenger and 25 [of her 38 crew]" — the last count lost its noun to the split
    const tail = sum ? seg.match(new RegExp(`\\band ${NUM}\\s*$`, "i")) : null;
    if (tail) sum += toN(tail[1]);
    if (!sum) {
      const m = seg.match(new RegExp(`^(?:all |her |at least |about |some )*${NUM}\\b`, "i"));
      if (m) sum = toN(m[1]);
    }
    n = sum || null;
  } else {
    const m = t.match(new RegExp(`${NUM} (?:of (?:her|the|his) [\\d,]+ )?${WHO}[^.]{0,30}?(?:were )?(?:killed|lost)`, "i"));
    if (m) n = toN(m[1]);
  }
  return Number.isFinite(n) && n > 0 && n < 10000 ? n : null;
}

/* ── fetch + parse every month ───────────────────────────────────── */

/** SINKINGS_CACHE=<dir> keeps each page's wikitext so re-runs don't refetch. */
const CACHE = process.env.SINKINGS_CACHE;
async function wikitext(title) {
  const file = CACHE && path.join(CACHE, title.replace(/\W+/g, "_") + ".txt");
  if (file) {
    const hit = await readFile(file, "utf8").catch(() => null);
    if (hit != null) return hit || null;
  }
  const text = await fetchWikitext(title);
  if (file) {
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, text ?? "");
  }
  return text;
}
async function fetchWikitext(title) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`, { headers: UA });
    if (res.ok) {
      const j = await res.json();
      return j.parse?.wikitext ?? null;
    }
    await sleep(1500 * attempt);
  }
  return null;
}

if (process.argv.includes("--test")) {
  console.log(
    livesLost("torpedoed and sunk by U-37 with the loss of nine gunners and 41 crew."),
    livesLost("with the loss of all 47 crew."),
    livesLost("with the loss of 12 of her 40 crew."),
    livesLost("with the loss of nine gunners and 41 crew of the 73 people on board when I-37 machine gunned the lifeboats."),
    causeOf("The tanker ran into a strong gale and broke in two. The crew were rescued by the cruiser."),
    causeOf("The Type VIIC submarine was depth charged and sunk by HMS Hasty."),
    causeOf("The cruiser ran into a gale and foundered."),
    causeOf("The Type XXIII submarine was shelled and sunk by ORP Błyskawica."),
    causeOf("The cargo ship was torpedoed and sunk by I-37."),
  );
  process.exit(0);
}

const rows = [];
/** "1917-04": [entries listed, entries mapped] — the lists give positions far more often some months than others */
const months = {};
let pages = 0;
for (const [y0, y1] of ERAS) {
  for (let y = y0; y <= y1; y++) {
    for (let mi = 0; mi < 12; mi++) {
      const title = `List of shipwrecks in ${MONTHS[mi]} ${y}`;
      const text = await wikitext(title);
      await sleep(250);
      if (!text) continue;
      pages++;
      // day headings: "==3 March==", "== 3 March 1942 ==", "==Unknown date=="
      const heads = [...text.matchAll(/^={2,3}\s*([^=\n]+?)\s*={2,3}\s*$/gm)].map((h) => ({ at: h.index, label: h[1] }));
      let kept = 0;
      const all = items(text);
      months[`${y}-${String(mi + 1).padStart(2, "0")}`] = [all.length, 0];
      for (const it of all) {
        const head = [...heads].reverse().find((h) => h.at < it.at);
        const day = head?.label.match(/^(\d{1,2})\s+[A-Z][a-z]+/);
        if (!day) continue; // "Unknown date" entries can't go on a timeline
        const p = params(it.body);
        const desc = p.desc ?? "";
        const at = coordOf(desc) ?? coordOf(it.body);
        if (!at) continue;
        const text2 = plain(desc);
        rows.push({
          t: Date.UTC(y, mi, Number(day[1])),
          at,
          ship: plain(p.ship ?? "").replace(/\s*\(\d{4}\)$/, "") || "Unnamed vessel",
          flag: plain(p.flag ?? "") || null,
          cause: causeOf(text2),
          lost: livesLost(text2),
          desc: text2.replace(/^World War (?:I|II):\s*/, "").slice(0, 260),
          page: title,
        });
        kept++;
      }
      months[`${y}-${String(mi + 1).padStart(2, "0")}`][1] = kept;
      process.stdout.write(`\r${title.padEnd(44)} ${kept} kept · ${rows.length} total`);
    }
  }
}
console.log(`\npages: ${pages}, sinkings with a date + position: ${rows.length}`);
rows.sort((a, b) => a.t - b.t);
const pageIds = [...new Set(rows.map((r) => r.page))];
const by = {};
for (const r of rows) by[r.cause] = (by[r.cause] ?? 0) + 1;
console.log("causes", by, "with lives lost", rows.filter((r) => r.lost != null).length);
const body = JSON.stringify({
  generated: new Date().toISOString(),
  source: "Wikipedia — monthly 'List of shipwrecks' articles, 1914–1918 and 1939–1945 (CC BY-SA 4.0)",
  license: "CC BY-SA 4.0",
  causes: CAUSES,
  pages: pageIds,
  months,
  // columns: day (days since 1900-01-01), lng, lat, cause index, lives lost, ship, flag, description, page index
  cols: {
    day: rows.map((r) => Math.round((r.t - Date.UTC(1900, 0, 1)) / 86_400_000)),
    lng: rows.map((r) => r.at[0]),
    lat: rows.map((r) => r.at[1]),
    cause: rows.map((r) => CAUSES.indexOf(r.cause)),
    lost: rows.map((r) => r.lost),
    ship: rows.map((r) => r.ship),
    flag: rows.map((r) => r.flag),
    desc: rows.map((r) => r.desc),
    page: rows.map((r) => pageIds.indexOf(r.page)),
  },
});
await writeFile(OUT, body);
console.log(`sinkings.json: ${(body.length / 1024).toFixed(0)} KB`);
