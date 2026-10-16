"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileUp, Link2, LogOut, Mail, Trash2 } from "lucide-react";
import { ATLAS_PROJECTS } from "@/utils/geo/projects";
import {
  GEO_DOCS,
  LIBRARY_PREFIX,
  LICENSES,
  SOURCES,
  extFor,
  kindFor,
  libraryFileUrl,
  splitList,
  docTerms,
  type GeoDoc,
} from "@/utils/geo/library";
import type { User } from "@/utils/firebase/client";

/* ------------------------------------------------------------------ */
/*  /atlas/admin — add files (or link-only entries) to the shared      */
/*  atlas library. Sign-in is the site's email magic link; the         */
/*  Firestore + Storage rules only accept writes from the admin email, */
/*  so this page is harmless for anyone else.                          */
/*                                                                     */
/*  Files go straight from the browser to Storage (Vercel API routes   */
/*  cap request bodies at ~4.5 MB), named by their SHA-256 so the same */
/*  file is never stored twice.                                        */
/* ------------------------------------------------------------------ */

type Fb = typeof import("@/utils/firebase/client");
type Fs = typeof import("firebase/firestore");
type St = typeof import("firebase/storage");

interface Row extends GeoDoc {
  id: string;
}

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100";

async function sha256Hex(buf: ArrayBuffer | Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminClient() {
  const [mods, setMods] = useState<{ fb: Fb; fs: Fs; st: St; storage: import("firebase/storage").FirebaseStorage; bucket: string } | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  /* ── load Firebase lazily (browser only) ── */
  useEffect(() => {
    let off: (() => void) | undefined;
    (async () => {
      const fb = await import("@/utils/firebase/client");
      if (!fb.firebaseConfigured) {
        setMsg({ tone: "err", text: "Firebase isn't configured (NEXT_PUBLIC_FIREBASE_* env vars)." });
        setUser(null);
        return;
      }
      const [fs, st, stor] = await Promise.all([import("firebase/firestore"), import("firebase/storage"), import("@/utils/firebase/storage")]);
      setMods({ fb, fs, st, storage: stor.firebaseStorage(), bucket: stor.storageBucket });
      off = fb.watchUser(setUser);
      if (fb.isMagicLink()) {
        const remembered = await fb.rememberedEmail();
        const e = remembered ?? window.prompt("Confirm the email you signed in with") ?? "";
        try {
          await fb.completeMagicLink(e);
          setMsg({ tone: "ok", text: "Signed in." });
        } catch (err) {
          setMsg({ tone: "err", text: fb.friendlyError(err) });
        }
      }
    })();
    return () => off?.();
  }, []);

  const loadRows = useCallback(async () => {
    if (!mods) return;
    const { fs, fb } = mods;
    const { db } = fb.firebase();
    const snap = await fs.getDocs(fs.query(fs.collection(db, GEO_DOCS), fs.orderBy("createdAt", "desc"), fs.limit(100)));
    setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as GeoDoc) })));
  }, [mods]);

  useEffect(() => {
    if (user) loadRows().catch((e) => setMsg({ tone: "err", text: mods?.fb.friendlyError(e) ?? String(e) }));
  }, [user, loadRows, mods]);

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!mods) return;
    try {
      await mods.fb.sendMagicLink(email, "load");
      setMsg({ tone: "ok", text: `Sign-in link sent to ${email}. Open it on this device.` });
    } catch (err) {
      setMsg({ tone: "err", text: mods.fb.friendlyError(err) });
    }
  };

  const remove = async (row: Row) => {
    if (!mods || !window.confirm(`Delete "${row.title}"? This removes the file and its index entry.`)) return;
    const { fs, st, fb, storage } = mods;
    try {
      if (row.storagePath) await st.deleteObject(st.ref(storage, row.storagePath)).catch((e) => (e?.code === "storage/object-not-found" ? null : Promise.reject(e)));
      await fs.deleteDoc(fs.doc(fb.firebase().db, GEO_DOCS, row.id));
      setRows((r) => r.filter((x) => x.id !== row.id));
      setMsg({ tone: "ok", text: `Deleted "${row.title}".` });
    } catch (err) {
      setMsg({ tone: "err", text: fb.friendlyError(err) });
    }
  };

  return (
    <div className="space-y-8 pb-16 pt-8 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-indigo-500 dark:text-indigo-300">~/atlas/admin</p>
          <h1 className="mt-3 font-aspekta text-3xl font-[650] tracking-tight text-slate-900 dark:text-white">Library uploader</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Add PDFs, scans and datasets to the shared atlas library. Files are public once uploaded — only add material you&apos;re allowed to share
            (U.S. government works are public domain; copyrighted papers should be link-only).
          </p>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => mods?.fb.signOut()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> {user.email}
          </button>
        )}
      </header>

      {msg && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
          {msg.text}
        </p>
      )}

      {user === undefined && <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Checking sign-in…</p>}

      {user === null && mods && (
        <form onSubmit={sendLink} className="max-w-md space-y-3 rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100" htmlFor="admin-email">
            Admin email
          </label>
          <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="you@example.com" />
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600">
            <Mail className="h-4 w-4" /> Email me a sign-in link
          </button>
        </form>
      )}

      {user && mods && <UploadForm mods={mods} user={user} onDone={(t) => { setMsg({ tone: "ok", text: t }); void loadRows(); }} onError={(t) => setMsg({ tone: "err", text: t })} />}

      {user && (
        <section className="space-y-2">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Library · {rows.length}</h2>
          <ul className="divide-y divide-slate-200/70 rounded-2xl border border-slate-200/70 bg-white dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-white/[0.03]">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {r.storagePath && mods ? (
                      <a href={libraryFileUrl(mods.bucket, r.storagePath)} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500">
                        {r.title}
                      </a>
                    ) : r.sourceUrl ? (
                      <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500">
                        {r.title}
                      </a>
                    ) : (
                      r.title
                    )}
                  </p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    {[r.kind, r.source, r.year, r.projects.join(", "), r.bytes ? `${(r.bytes / 1048576).toFixed(1)} MB` : null, `text: ${r.textStatus}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button type="button" onClick={() => remove(r)} aria-label={`Delete ${r.title}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {!rows.length && <li className="px-4 py-8 text-center text-sm text-slate-400">Nothing in the library yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ── the upload form ─────────────────────────────────────────────── */

function UploadForm({
  mods,
  user,
  onDone,
  onError,
}: {
  mods: { fb: Fb; fs: Fs; st: St; storage: import("firebase/storage").FirebaseStorage };
  user: User;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [f, setF] = useState({
    title: "",
    source: "USGS",
    sourceUrl: "",
    license: "public domain",
    year: "",
    authors: "",
    summary: "",
    tags: "",
    region: "",
    projects: ["earth-alive"] as string[],
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { fb, fs, st, storage } = mods;
    const { db } = fb.firebase();
    try {
      let id: string;
      let file_: Partial<GeoDoc> = { storagePath: null, sha256: null, bytes: null, contentType: null, kind: "link" };
      if (mode === "file") {
        if (!file) return onError("Pick a file first.");
        setProgress(0);
        const buf = await file.arrayBuffer();
        const sha = await sha256Hex(buf);
        id = sha;
        if ((await fs.getDoc(fs.doc(db, GEO_DOCS, id))).exists()) {
          setProgress(null);
          return onError("That exact file is already in the library.");
        }
        const contentType = file.type || "application/octet-stream";
        const path = `${LIBRARY_PREFIX}/${sha}.${extFor(contentType, file.name)}`;
        const task = st.uploadBytesResumable(st.ref(storage, path), buf, {
          contentType,
          cacheControl: "public, max-age=31536000, immutable",
          customMetadata: { originalName: file.name.slice(0, 200) },
        });
        await new Promise<void>((resolve, reject) =>
          task.on("state_changed", (s) => setProgress(s.bytesTransferred / s.totalBytes), reject, () => resolve())
        );
        file_ = { storagePath: path, sha256: sha, bytes: file.size, contentType, kind: kindFor(contentType) };
      } else {
        if (!f.sourceUrl) return onError("A link-only entry needs its URL.");
        id = `link-${(await sha256Hex(new TextEncoder().encode(f.sourceUrl))).slice(0, 40)}`;
      }

      const doc: Omit<GeoDoc, "createdAt" | "updatedAt"> & { createdAt: unknown; updatedAt: unknown } = {
        title: f.title.trim(),
        kind: file_.kind!,
        source: f.source,
        sourceUrl: f.sourceUrl.trim() || null,
        license: f.license,
        year: f.year ? Number(f.year) : null,
        authors: splitList(f.authors),
        summary: f.summary.trim(),
        projects: f.projects,
        tags: splitList(f.tags).map((t) => t.toLowerCase()),
        region: f.region.trim() || null,
        bbox: null,
        storagePath: file_.storagePath ?? null,
        sha256: file_.sha256 ?? null,
        bytes: file_.bytes ?? null,
        contentType: file_.contentType ?? null,
        textStatus: file_.kind === "pdf" ? "pending" : "none",
        pages: null,
        terms: docTerms({ title: f.title, tags: splitList(f.tags), region: f.region, summary: f.summary }),
        addedBy: user.email ?? "admin",
        createdAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
      };
      await fs.setDoc(fs.doc(db, GEO_DOCS, id), doc);
      setProgress(null);
      setFile(null);
      setF((s) => ({ ...s, title: "", sourceUrl: "", year: "", authors: "", summary: "", tags: "", region: "" }));
      onDone(`Added "${doc.title}".`);
    } catch (err) {
      setProgress(null);
      onError(mods.fb.friendlyError(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="flex gap-2">
        {(["file", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
              mode === m ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {m === "file" ? <FileUp className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {m === "file" ? "Upload a file" : "Link only"}
          </button>
        ))}
      </div>

      {mode === "file" && (
        <input
          type="file"
          accept="application/pdf,image/*,.json,.geojson,.csv,.zip,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setFile(file);
            if (file && !f.title) setF((s) => ({ ...s, title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") }));
          }}
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-600"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" full>
          <input required value={f.title} onChange={set("title")} className={input} />
        </Field>
        <Field label="Publisher">
          <select value={f.source} onChange={set("source")} className={input}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="License">
          <select value={f.license} onChange={set("license")} className={input}>
            {LICENSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label={mode === "link" ? "URL" : "Original URL (optional)"} full>
          <input type="url" required={mode === "link"} value={f.sourceUrl} onChange={set("sourceUrl")} className={input} placeholder="https://pubs.usgs.gov/…" />
        </Field>
        <Field label="Year">
          <input type="number" min={1500} max={2100} value={f.year} onChange={set("year")} className={input} />
        </Field>
        <Field label="Authors (comma separated)">
          <input value={f.authors} onChange={set("authors")} className={input} />
        </Field>
        <Field label="Tags (comma separated)">
          <input value={f.tags} onChange={set("tags")} className={input} placeholder="1906, san andreas, shakemap" />
        </Field>
        <Field label="Region">
          <input value={f.region} onChange={set("region")} className={input} placeholder="California" />
        </Field>
        <Field label="Summary" full>
          <textarea value={f.summary} onChange={set("summary")} rows={3} maxLength={5000} className={input} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">Projects</legend>
        <div className="flex flex-wrap gap-1.5">
          {ATLAS_PROJECTS.map((p) => {
            const on = f.projects.includes(p.slug);
            return (
              <button
                key={p.slug}
                type="button"
                aria-pressed={on}
                onClick={() => setF((s) => ({ ...s, projects: on ? s.projects.filter((x) => x !== p.slug) : [...s.projects, p.slug] }))}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                  on ? "bg-indigo-500 text-white ring-indigo-500" : "text-slate-500 ring-slate-200 hover:text-slate-900 dark:text-slate-400 dark:ring-white/10 dark:hover:text-white"
                }`}
              >
                {p.title}
              </button>
            );
          })}
        </div>
      </fieldset>

      {progress != null && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      <button
        type="submit"
        disabled={progress != null}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
      >
        {progress != null ? `Uploading ${Math.round(progress * 100)}%` : "Add to library"}
      </button>
    </form>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}
