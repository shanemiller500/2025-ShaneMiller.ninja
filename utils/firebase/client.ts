/* ------------------------------------------------------------------ */
/*  Shared Firebase client for the site's games (browser-only; load    */
/*  it with a dynamic import). Sign-in is a passwordless email link,   */
/*  so every save is tied to a verified email — one sign-in works for  */
/*  every game on the site.                                            */
/* ------------------------------------------------------------------ */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as fbSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { safeSetItem } from "../storageJanitor";

const EMAIL_KEY = "shanemiller:emailForSignIn";
const INTENT_KEY = "shanemiller:cloudIntent";

/** Why the player asked for a link: to load an existing save, or to start saving this one. */
export type CloudIntent = "load" | "save";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** reCAPTCHA Enterprise site key: Firebase App Check proves requests come from the real site. */
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

/** Firestore database id — this project uses a named database, not "(default)". */
const DATABASE_ID = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";

export const firebaseConfigured = !!(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function firebase() {
  if (!firebaseConfigured) throw new Error("Firebase isn't configured (missing NEXT_PUBLIC_FIREBASE_* env vars).");
  if (!app) {
    const fresh = !getApps().length;
    app = fresh ? initializeApp(config) : getApp();
    if (fresh && RECAPTCHA_SITE_KEY) startAppCheck(app);
    // keep the sign-in in IndexedDB first: localStorage is shared by every project on
    // the site and can fill up (5 MB), which made Firebase fail with a quota error
    try {
      auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence] });
    } catch {
      auth = getAuth(app); // already initialised (hot reload)
    }
    db = DATABASE_ID === "(default)" ? getFirestore(app) : getFirestore(app, DATABASE_ID);
    // analytics is optional + browser-only; never let it break saving
    import("firebase/analytics")
      .then(async ({ getAnalytics, isSupported }) => {
        if (app && (await isSupported())) getAnalytics(app);
      })
      .catch(() => undefined);
  }
  return { auth: auth!, db: db! };
}

/**
 * App Check with reCAPTCHA Enterprise (invisible — no puzzles). Firebase verifies the
 * tokens itself, so bots using the copied web keys can't send sign-in emails or touch
 * Firestore once enforcement is switched on in the console.
 * On localhost, set NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN (from the App Check console) if
 * localhost isn't on the reCAPTCHA key's domain list.
 */
function startAppCheck(a: FirebaseApp) {
  const debug = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  if (debug && window.location.hostname === "localhost") {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = debug === "true" ? true : debug;
  }
  try {
    initializeAppCheck(a, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY!), isTokenAutoRefreshEnabled: true });
  } catch {
    /* already started (hot reload) */
  }
}

export const cleanEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail(e));

/** Email a magic sign-in link that brings the player back to the current page. */
export async function sendMagicLink(email: string, intent: CloudIntent) {
  const { auth } = firebase();
  const e = cleanEmail(email);
  const url = `${window.location.origin}${window.location.pathname}?cloud=1`;
  await sendSignInLinkToEmail(auth, e, { url, handleCodeInApp: true });
  // storage full / private mode: IndexedDB has its own (much bigger) allowance
  if (!safeSetItem(EMAIL_KEY, e)) await idb("put", e).catch(() => undefined);
  safeSetItem(INTENT_KEY, intent);
}

/** Read (and forget) why the last link was requested. */
export function takeIntent(): CloudIntent | null {
  try {
    const v = localStorage.getItem(INTENT_KEY);
    localStorage.removeItem(INTENT_KEY);
    return v === "load" || v === "save" ? v : null;
  } catch {
    return null;
  }
}

/** Drop the one-time sign-in bits from the address bar. */
export function clearLinkFromUrl() {
  const url = new URL(window.location.href);
  ["apiKey", "oobCode", "mode", "lang", "continueUrl", "cloud", "tenantId"].forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

/** Tiny IndexedDB key-value fallback for the sign-in email. */
function idb(op: "get" | "put" | "del", value?: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("shanemiller-auth", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("kv", op === "get" ? "readonly" : "readwrite");
      const store = tx.objectStore("kv");
      const req = op === "get" ? store.get(EMAIL_KEY) : op === "put" ? store.put(value, EMAIL_KEY) : store.delete(EMAIL_KEY);
      req.onsuccess = () => resolve(op === "get" ? ((req.result as string | undefined) ?? null) : null);
      req.onerror = () => reject(req.error);
    };
  });
}

export function isMagicLink() {
  if (!firebaseConfigured) return false;
  return isSignInWithEmailLink(firebase().auth, window.location.href);
}

export async function rememberedEmail(): Promise<string | null> {
  try {
    // older Dinosaur Land builds used their own key
    const v = localStorage.getItem(EMAIL_KEY) ?? localStorage.getItem("dinosors:emailForSignIn");
    if (v) return v;
  } catch {
    /* fall through */
  }
  return idb("get").catch(() => null);
}

/** Finish signing in from a magic link (email needed if opened on another device). */
export async function completeMagicLink(email: string) {
  const { auth } = firebase();
  const cred = await signInWithEmailLink(auth, cleanEmail(email), window.location.href);
  try {
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem("dinosors:emailForSignIn");
  } catch {
    /* ignore */
  }
  void idb("del").catch(() => undefined);
  // tidy the address bar so a refresh doesn't re-use the one-time link
  clearLinkFromUrl();
  return cred.user;
}

export function watchUser(cb: (u: User | null) => void) {
  return onAuthStateChanged(firebase().auth, cb);
}

export async function signOut() {
  await fbSignOut(firebase().auth);
}

export function deviceKind() {
  const ua = navigator.userAgent;
  return /iPad|Tablet/.test(ua) ? "tablet" : ua.includes("Mobile") ? "phone" : "computer";
}

/** Firebase error → something a player (or grown-up) can act on. */
/** The link itself is no good (expired / already used / mangled): send a fresh one. */
export function isDeadLink(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  return code.includes("invalid-action-code") || code.includes("expired-action-code") || code.includes("argument-error");
}

export function friendlyError(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-email")) return "That email doesn't look right.";
  if (code.includes("invalid-action-code") || code.includes("expired-action-code")) return "That link has expired or was already used. Send a new one!";
  if (code.includes("configuration-not-found")) return "Firebase Authentication isn't set up yet (Authentication → Get started).";
  if (code.includes("operation-not-allowed")) return "Email-link sign-in isn't switched on in Firebase yet.";
  if (code.includes("unauthorized-continue-uri") || code.includes("unauthorized-domain")) return "This website isn't on Firebase's list of allowed domains yet.";
  if (code.includes("appCheck") || code.includes("app-check")) return "Security check failed — refresh the page and try again.";
  if (code.includes("permission-denied")) return "The cloud said no (check the Firestore rules).";
  if (code.includes("quota-exceeded") || code.includes("too-many-requests")) return "Too many tries — wait a minute and try again.";
  if (code.includes("unavailable") || code.includes("network")) return "Can't reach the cloud right now. Check the internet.";
  if (/quota|exceeded the quota/i.test(String((e as Error)?.message))) return "This browser's storage for the site is full. Clear some site data and try again.";
  return (e as Error)?.message || "Something went wrong.";
}

export type { User };
