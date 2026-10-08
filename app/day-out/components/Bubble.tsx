import { type CSSProperties, useEffect, useRef, useState } from "react";

// A speech bubble that gives people time to read it. However fast a character's script moves on,
// each line stays up for at least its reading time (longer lines get longer); lines that come in
// quicker than that queue up behind it (only the last few, so it never falls far behind), and the
// bubble only disappears once the last one's been read.
export const readMs = (text: string) => Math.max(3800, 1400 + text.length * 85);

export default function Bubble({ text, className, style }: { text: string | null | undefined; className: string; style?: CSSProperties }) {
  const [shown, setShown] = useState<string | null>(text || null);
  const shownRef = useRef<string | null>(text || null), since = useRef(Date.now()), queue = useRef<(string | null)[]>([]), timer = useRef(0);
  useEffect(() => {
    const show = (next: string | null) => { shownRef.current = next; since.current = Date.now(); setShown(next); };
    const pump = () => {
      window.clearTimeout(timer.current);
      if (!queue.current.length) return;
      const current = shownRef.current, left = current ? readMs(current) - (Date.now() - since.current) : 0;
      if (left > 0) { timer.current = window.setTimeout(pump, left); return; }
      show(queue.current.shift() ?? null);
      if (queue.current.length) pump();
    };
    const next = text || null, last = queue.current.length ? queue.current[queue.current.length - 1] : shownRef.current;
    if (next !== last) {
      queue.current = [...queue.current, next].slice(-3);
      pump();
    }
  }, [text]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return shown ? <span key={shown} className={className} style={style}>{shown}</span> : null;
}
