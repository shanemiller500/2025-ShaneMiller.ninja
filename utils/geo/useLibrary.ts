"use client";

import { useEffect, useState } from "react";
import { GEO_DOCS, libraryFileUrl, searchTerm, type GeoDoc } from "./library";

/* ------------------------------------------------------------------ */
/*  Read the shared atlas library from Firestore (public read).        */
/*  Firebase loads lazily so map pages don't pay for it up front.      */
/* ------------------------------------------------------------------ */

export interface LibraryDoc extends GeoDoc {
  id: string;
  /** our hosted copy, when the file is in the library */
  fileUrl: string | null;
}

type State = { docs: LibraryDoc[] | null; error: string | null; loading: boolean };

async function firestore() {
  const fb = await import("@/utils/firebase/client");
  if (!fb.firebaseConfigured) throw new Error("Firebase isn't configured");
  const fs = await import("firebase/firestore");
  return { fs, db: fb.firebase().db, friendly: fb.friendlyError };
}

const toDoc = (id: string, d: GeoDoc): LibraryDoc => ({
  ...d,
  id,
  fileUrl: d.storagePath ? libraryFileUrl(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "", d.storagePath) : null,
});

/**
 * Library documents, optionally for one project and/or matching one search word
 * (Firestore `array-contains` on the doc's `terms`). Pass `null` to not fetch yet.
 */
export function useLibrary(opts: { project?: string; term?: string } | null = {}) {
  const [state, setState] = useState<State>({ docs: null, error: null, loading: !!opts });
  const enabled = opts != null;
  const project = opts?.project;
  const word = opts?.term ? searchTerm(opts.term) : "";

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const { fs, db, friendly } = await firestore();
      try {
        // Firestore allows one array-contains per query: search by term, then filter by project here
        const base = fs.collection(db, GEO_DOCS);
        const q = word
          ? fs.query(base, fs.where("terms", "array-contains", word), fs.limit(100))
          : project
            ? fs.query(base, fs.where("projects", "array-contains", project), fs.limit(200))
            : fs.query(base, fs.orderBy("year", "desc"), fs.limit(200));
        const snap = await fs.getDocs(q);
        let docs = snap.docs.map((d) => toDoc(d.id, d.data() as GeoDoc));
        if (word && project) docs = docs.filter((d) => d.projects.includes(project));
        if (live) setState({ docs, error: null, loading: false });
      } catch (e) {
        if (live) setState({ docs: null, error: friendly(e), loading: false });
      }
    })().catch((e) => live && setState({ docs: null, error: (e as Error).message, loading: false }));
    return () => {
      live = false;
    };
  }, [enabled, project, word]);

  return state;
}

/** Strip query/hash/trailing slash so manifest URLs and story URLs compare equal. */
export const sameUrl = (a?: string | null, b?: string | null) => {
  const norm = (u?: string | null) => (u ?? "").replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^http:/, "https:").toLowerCase();
  return !!a && !!b && norm(a) === norm(b);
};
