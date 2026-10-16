"use client";

import { useEffect, useState } from "react";

/** Wikipedia's lead photo for an article (the REST summary allows cross-origin reads). */
export function useWikiPhoto(title: string | null) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    setPhoto(null);
    if (!title) return;
    const ctl = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      // the original when it's a sensible size, else the (small) thumbnail
      .then((j) => setPhoto(j?.originalimage?.width && j.originalimage.width <= 1600 ? j.originalimage.source : j?.thumbnail?.source ?? null))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [title]);
  return photo;
}
