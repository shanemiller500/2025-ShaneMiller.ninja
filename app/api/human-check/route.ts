/* ------------------------------------------------------------------ */
/*  POST /api/human-check — verifies a reCAPTCHA v2 checkbox token      */
/*  with Google before the site sends a sign-in email, and rate-limits  */
/*  per IP and per email address so the form can't be used to spam.    */
/*                                                                      */
/*  Env: RECAPTCHA_CHECKBOX_SECRET (server only). Optional             */
/*  RECAPTCHA_ALLOWED_HOSTS=a.com,b.com for extra domains.              */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.RECAPTCHA_CHECKBOX_SECRET || "";

/* Best-effort in-memory rate limits (per server instance). Firebase's own
   App Check / reCAPTCHA enforcement is the hard backstop. */
const LIMITS = {
  ip: { max: 8, windowMs: 10 * 60_000 },
  email: { max: 3, windowMs: 30 * 60_000 },
};
const hits = new Map<string, number[]>();

function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return Math.ceil((windowMs - (now - list[0])) / 60_000);
  }
  list.push(now);
  hits.set(key, list);
  // keep the map from growing forever
  if (hits.size > 5000) for (const k of Array.from(hits.keys()).slice(0, 1000)) hits.delete(k);
  return 0;
}

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!SECRET) return fail("The security check isn't set up on this site yet.", 503);

  let body: { token?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Bad request.");
  }
  const token = typeof body.token === "string" ? body.token : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!token || token.length > 4000) return fail("Please tick “I'm not a robot” first.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return fail("That email doesn't look right.");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const ipWait = limited(`ip:${ip}`, LIMITS.ip.max, LIMITS.ip.windowMs);
  if (ipWait) return fail(`Too many sign-in emails from this connection. Try again in ${ipWait} min.`, 429);
  const mailWait = limited(`email:${email}`, LIMITS.email.max, LIMITS.email.windowMs);
  if (mailWait) return fail(`We've already sent a few links to that address — check your inbox (and spam). Try again in ${mailWait} min.`, 429);

  let data: { success?: boolean; hostname?: string; "error-codes"?: string[] };
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: SECRET, response: token, ...(ip !== "unknown" ? { remoteip: ip } : {}) }),
      cache: "no-store",
    });
    data = await res.json();
  } catch {
    return fail("We couldn't reach the security check. Please try again.", 502);
  }

  if (!data.success) {
    const expired = data["error-codes"]?.includes("timeout-or-duplicate");
    return fail(expired ? "The security check expired — please tick it again." : "We couldn't verify you're human. Please try again.", 403);
  }

  // The token must have been solved on this site
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0];
  const allowed = [host, "localhost", ...(process.env.RECAPTCHA_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim())].filter(Boolean);
  if (data.hostname && !allowed.includes(data.hostname)) return fail("That security check came from somewhere else.", 403);

  return NextResponse.json({ ok: true });
}
