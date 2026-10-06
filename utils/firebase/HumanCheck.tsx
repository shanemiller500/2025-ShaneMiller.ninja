"use client";

/* ------------------------------------------------------------------ */
/*  "I'm not a robot" check before any sign-in email is sent.           */
/*                                                                      */
/*  Google reCAPTCHA v2 checkbox, rendered explicitly. The token it     */
/*  hands back is single-use and is verified on our server              */
/*  (/api/human-check, with the secret key + rate limits) before the    */
/*  magic link goes out.                                                */
/*                                                                      */
/*  Keys: NEXT_PUBLIC_RECAPTCHA_CHECKBOX_SITE_KEY (browser) and         */
/*  RECAPTCHA_CHECKBOX_SECRET (server), from a reCAPTCHA v2 "I'm not a  */
/*  robot" checkbox key (list localhost + the live domain on the key).  */
/*  Without keys the check is skipped and a console warning says so.    */
/* ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

export const HUMAN_CHECK_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_CHECKBOX_SITE_KEY || "";

/** Is the bot check switched on for this build? */
export const humanCheckOn = !!HUMAN_CHECK_SITE_KEY;

if (typeof window !== "undefined" && !humanCheckOn) {
  console.warn("[human-check] NEXT_PUBLIC_RECAPTCHA_CHECKBOX_SITE_KEY is not set — sign-in emails are sent without a reCAPTCHA check.");
}

let frameSeq = 0;

/**
 * The checkbox. `onToken` receives a fresh token when ticked and `null`
 * when it expires or errors. Remount it (change `key`) to reset after a
 * failed send — tokens are single-use.
 *
 * Rendered inside /human-check.html (same origin) so Google's classic
 * checkbox never collides with the reCAPTCHA Enterprise script that
 * Firebase App Check loads into this page.
 */
export function HumanCheck({ onToken, theme = "dark", className = "" }: { onToken: (token: string | null) => void; theme?: "dark" | "light"; className?: string }) {
  const [id] = useState(() => `hc${++frameSeq}${Date.now().toString(36)}`);
  const cb = useRef(onToken);
  cb.current = onToken;
  const [size, setSize] = useState({ w: 304, h: 78 });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!humanCheckOn) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; id?: string; type?: string; token?: string | null; w?: number; h?: number };
      if (!d || d.source !== "human-check" || d.id !== id) return;
      if (d.type === "ready") setReady(true);
      else if (d.type === "token") {
        setDone(!!d.token);
        setError(null);
        cb.current(d.token ?? null);
      } else if (d.type === "error") {
        setDone(false);
        cb.current(null);
        setError("The security check had a hiccup — please tick it again.");
      } else if (d.type === "size" && d.w && d.h) setSize({ w: d.w, h: d.h });
    };
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      cb.current(null);
    };
  }, [id]);

  if (!humanCheckOn) return null;
  const src = `/human-check.html?k=${encodeURIComponent(HUMAN_CHECK_SITE_KEY)}&theme=${theme}&id=${id}`;
  return (
    <div className={className}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${done ? "text-emerald-400" : theme === "dark" ? "text-white/50" : "text-slate-500"}`}>
        <ShieldCheck className="h-3.5 w-3.5" /> {done ? "Verified — you're human" : "Quick security check"}
      </div>
      <div className="relative mt-2" style={{ width: size.w, height: size.h, maxWidth: "100%" }}>
        {!ready && <div className={`absolute inset-0 animate-pulse rounded ${theme === "dark" ? "bg-white/[0.06]" : "bg-slate-100"}`} />}
        <iframe title="Security check (reCAPTCHA)" src={src} width={size.w} height={size.h} className="relative block max-w-full border-0" style={{ colorScheme: "normal" }} />
      </div>
      {error && <p className="mt-1.5 text-[12px] font-semibold text-rose-400">{error}</p>}
    </div>
  );
}

/** Ask our server to verify the token (and apply rate limits). Returns an error message, or null when OK. */
export async function verifyHuman(token: string, email: string): Promise<string | null> {
  try {
    const res = await fetch("/api/human-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, email }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return null;
    return data.error || "We couldn't verify you're human. Please try again.";
  } catch {
    return "We couldn't reach the security check. Check your connection and try again.";
  }
}
