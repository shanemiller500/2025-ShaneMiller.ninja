/* ------------------------------------------------------------------ */
/*  Atlas library seeder — runs on your machine with firebase-admin.   */
/*                                                                     */
/*  Needs in .env.local:                                               */
/*    GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json   */
/*    NEXT_PUBLIC_FIREBASE_PROJECT_ID / _STORAGE_BUCKET / _DATABASE_ID */
/*                                                                     */
/*  npm run atlas:seed -- check            read-only connection test   */
/*  npm run atlas:seed -- list             what's in the library       */
/*  npm run atlas:seed -- add <manifest.json> [--dry-run] [--force]    */
/*  npm run atlas:seed -- index [--force]  extract text for PDFs that  */
/*                                         are still "pending" (e.g.   */
/*                                         added via /atlas/admin)     */
/*                                                                     */
/*  A manifest is a JSON array of entries:                             */
/*    { "url" | "file", "title", "source", "sourceUrl", "license",     */
/*      "year", "authors": [], "summary", "projects": [], "tags": [],  */
/*      "region", "bbox": [w,s,e,n] }                                  */
/*  Files are content-addressed (geo-library/{sha256}.ext), so         */
/*  re-running a manifest skips anything already uploaded.             */
/*                                                                     */
/*  PDF text is stored one page per doc in geoDocs/{id}/chunks, and a  */
/*  `terms` vocabulary on the doc makes it searchable with Firestore's */
/*  array-contains (see docTerms in utils/geo/library.ts).             */
/* ------------------------------------------------------------------ */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { extractText, getDocumentProxy } from "unpdf";
// Node 24 strips the types, so the seeder shares the site's schema + term logic
import { GEO_DOCS, LIBRARY_PREFIX, docTerms, extFor, kindFor } from "../../utils/geo/library.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });

const MAX_BYTES = 300 * 1024 * 1024;
/** Firestore docs cap at 1 MiB; a page of text is far below, but clamp anyway. */
const MAX_PAGE_CHARS = 200_000;

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env.local`);
  return v;
};

function connect() {
  env("GOOGLE_APPLICATION_CREDENTIALS");
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  });
  const dbId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";
  return { db: dbId === "(default)" ? getFirestore(app) : getFirestore(app, dbId), bucket: getStorage(app).bucket(), dbId };
}

const guessType = (name) =>
  ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", json: "application/json", geojson: "application/geo+json", csv: "text/csv", zip: "application/zip", txt: "text/plain" })[
    name.split(".").pop().toLowerCase()
  ] ?? "application/octet-stream";

async function fetchEntry(entry, manifestDir) {
  if (entry.file) {
    const p = path.resolve(manifestDir, entry.file);
    return { buf: await readFile(p), contentType: entry.contentType ?? guessType(p), name: path.basename(p) };
  }
  const res = await fetch(entry.url, { headers: { "User-Agent": "shanemiller.ninja atlas seeder (public-domain library)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${entry.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim() || guessType(entry.url);
  return { buf, contentType, name: new URL(entry.url).pathname.split("/").pop() ?? "file" };
}

/** Text per page, or null if the PDF can't be read (scans without OCR come back mostly empty). */
async function pdfPages(buf) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf), { verbosity: 0 });
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((t) => t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_PAGE_CHARS));
  } catch (e) {
    console.warn(`   (text extraction failed: ${e.message})`);
    return null;
  }
}

/** Replace a doc's chunks with one doc per page; returns the index fields to merge. */
async function writeText(db, ref, meta, pages) {
  const old = await ref.collection("chunks").listDocuments();
  const writer = db.bulkWriter();
  for (const d of old) writer.delete(d);
  pages.forEach((text, i) => {
    if (text) writer.set(ref.collection("chunks").doc(String(i + 1).padStart(4, "0")), { page: i + 1, text });
  });
  await writer.close();
  const chars = pages.reduce((n, t) => n + t.length, 0);
  return { pages: pages.length, terms: docTerms(meta, pages.join("\n")), textStatus: chars > 200 ? "done" : "failed" };
}

async function add(manifestPath, { dryRun, force }) {
  const manifestDir = path.dirname(path.resolve(manifestPath));
  const entries = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(entries)) throw new Error("Manifest must be a JSON array");
  const { db, bucket } = connect();
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    const label = entry.title ?? entry.url ?? entry.file;
    try {
      if (!entry.title) throw new Error("entry needs a title");
      process.stdout.write(`· ${label} … `);
      const { buf, contentType, name } = await fetchEntry(entry, manifestDir);
      if (buf.length > MAX_BYTES) throw new Error(`too big (${(buf.length / 1048576).toFixed(0)} MB)`);
      if (contentType === "text/html") throw new Error("got an HTML page, not a file — check the URL");
      const sha = createHash("sha256").update(buf).digest("hex");
      const ref = db.collection(GEO_DOCS).doc(sha);
      if (!force && (await ref.get()).exists) {
        console.log("already in library, skipped");
        skipped++;
        continue;
      }
      const storagePath = `${LIBRARY_PREFIX}/${sha}.${extFor(contentType, name)}`;
      const kind = kindFor(contentType);
      const doc = {
        title: entry.title,
        kind,
        source: entry.source ?? "USGS",
        sourceUrl: entry.sourceUrl ?? entry.url ?? null,
        license: entry.license ?? "public domain",
        year: entry.year ?? null,
        authors: entry.authors ?? [],
        summary: entry.summary ?? "",
        projects: entry.projects ?? [],
        tags: (entry.tags ?? []).map((t) => String(t).toLowerCase()),
        region: entry.region ?? null,
        bbox: entry.bbox ?? null,
        storagePath,
        sha256: sha,
        bytes: buf.length,
        contentType,
        textStatus: kind === "pdf" ? "pending" : "none",
        pages: null,
        terms: docTerms({ title: entry.title, tags: entry.tags, region: entry.region, summary: entry.summary }),
        addedBy: "seed-script",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (dryRun) {
        console.log(`would add → ${storagePath} (${(buf.length / 1048576).toFixed(2)} MB, ${contentType})`);
        continue;
      }
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        await file.save(buf, {
          contentType,
          resumable: buf.length > 5 * 1024 * 1024,
          metadata: { cacheControl: "public, max-age=31536000, immutable", metadata: { originalName: name, sourceUrl: doc.sourceUrl ?? "" } },
        });
      }
      await ref.set(doc, { merge: force });
      let note = "";
      if (kind === "pdf") {
        const pages = await pdfPages(buf);
        const idx = pages ? await writeText(db, ref, doc, pages) : { textStatus: "failed" };
        await ref.update({ ...idx, updatedAt: FieldValue.serverTimestamp() });
        note = pages ? `, ${idx.pages} pages, ${idx.terms.length} terms` : ", text: failed";
      }
      console.log(`added (${(buf.length / 1048576).toFixed(1)} MB${note})`);
      added++;
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${dryRun ? "dry run: " : ""}${added} added, ${skipped} skipped, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

/** Extract text for PDFs added elsewhere (admin page) — or everything with --force. */
async function index({ force }) {
  const { db, bucket } = connect();
  const snap = await db.collection(GEO_DOCS).get();
  let n = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (x.kind !== "pdf" || !x.storagePath || (!force && x.textStatus === "done")) {
      // link-only / non-PDF entries still get title + tag terms
      if (!x.terms?.length) await d.ref.update({ terms: docTerms(x), updatedAt: FieldValue.serverTimestamp() });
      continue;
    }
    process.stdout.write(`· ${x.title} … `);
    const [buf] = await bucket.file(x.storagePath).download();
    const pages = await pdfPages(buf);
    const idx = pages ? await writeText(db, d.ref, x, pages) : { textStatus: "failed" };
    await d.ref.update({ ...idx, updatedAt: FieldValue.serverTimestamp() });
    console.log(pages ? `${idx.pages} pages, ${idx.terms.length} terms` : "failed");
    n++;
  }
  console.log(`\nindexed ${n} document(s)`);
}

async function check() {
  const { db, bucket, dbId } = connect();
  const cols = await db.listCollections();
  console.log(`Firestore (${dbId}) OK — collections: ${cols.map((c) => c.id).join(", ") || "(none)"}`);
  const [exists] = await bucket.exists();
  console.log(`Storage bucket ${bucket.name}: ${exists ? "OK" : "MISSING"}`);
  const n = (await db.collection(GEO_DOCS).count().get()).data().count;
  console.log(`Library: ${n} document(s)`);
}

async function list() {
  const { db } = connect();
  const snap = await db.collection(GEO_DOCS).orderBy("createdAt", "desc").get();
  for (const d of snap.docs) {
    const x = d.data();
    console.log(`${d.id.slice(0, 12)}  ${x.kind.padEnd(7)} ${String(x.year ?? "").padEnd(5)} ${String(x.pages ?? "-").padStart(4)}p  ${x.textStatus.padEnd(7)} ${x.title}  [${x.projects.join(", ")}]`);
  }
  console.log(`\n${snap.size} document(s)`);
}

const [cmd, arg] = process.argv.slice(2);
const flags = { dryRun: process.argv.includes("--dry-run"), force: process.argv.includes("--force") };

try {
  if (cmd === "check") await check();
  else if (cmd === "list") await list();
  else if (cmd === "index") await index(flags);
  else if (cmd === "add" && arg) await add(arg, flags);
  else {
    console.log("usage: npm run atlas:seed -- check | list | index [--force] | add <manifest.json> [--dry-run] [--force]");
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
