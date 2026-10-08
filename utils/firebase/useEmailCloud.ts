"use client";

import { humanCheckOn, verifyHuman } from "./HumanCheck";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CloudIntent, User } from "./client";
import { safeSetItem } from "../storageJanitor";

/* ------------------------------------------------------------------ */
/*  Email-linked cloud saves for any game on the site.                 */
/*                                                                     */
/*  A game provides:                                                   */
/*   - `api`: lazily-loaded Firestore functions for its collection     */
/*   - `local`: export / import its progress + "is there progress?"    */
/*                                                                     */
/*  The whole player journey lives here so every loop closes:          */
/*   start  → signed in?  "Welcome back — load your saved game?"       */
/*            not yet?    "Load a saved game?" → email → auto-load     */
/*                        "New game" → optional "save with email"      */
/*   play   → autosave every minute + when the tab hides               */
/*   leave  → signed in: save now; not signed in: offer to save        */
/*   errors → dead links fall back to "send a new link"                */
/*  Every popup closes itself after its action and confirms by toast.  */
/* ------------------------------------------------------------------ */

export interface CloudOffer<M> {
  data: string;
  meta: M;
  savedAt: Date | null;
}

export interface GameCloudApi<M> {
  load(user: User): Promise<CloudOffer<M> | null>;
  write(user: User, data: string, meta: M): Promise<{ warning?: string; publicUpdated?: boolean } | void>;
  publishPublic?(user: User, data: string): Promise<boolean>;
  startSession(user: User, meta: M): Promise<string>;
  touchSession(user: User, id: string, seconds: number, meta: M): Promise<void>;
}

export interface LocalProgress<M> {
  /** null while the game isn't ready yet */
  exportSave(): { data: string; meta: M } | null;
  importSave(data: string): boolean;
  /** has the player done anything worth saving? */
  hasProgress(): boolean;
}

export type CloudStatus = "off" | "loading" | "signedOut" | "linkSent" | "signingIn" | "signedIn";

/** Which popup is showing. */
export type CloudView =
  | "welcome" // start of a visit: load a saved game?
  | "loadEmail" // email to find your saved game
  | "saveEmail" // optional: email to save this game
  | "finish" // link opened on another device: confirm email
  | "offer" // signed in + a cloud save exists: load it?
  | "account" // signed in: status, save now, sign out
  | "leave"; // about to leave without saving

export interface CloudState<M> {
  status: CloudStatus;
  email: string | null;
  lastSaved: Date | null;
  publicUpdatedAt: Date | null;
  saving: boolean;
  error: string | null;
  offer: CloudOffer<M> | null;
  view: CloudView | null;
  /** email typed last (prefills the boxes) */
  draftEmail: string;
}

type Client = typeof import("./client");

const AUTOSAVE_MS = 60_000;

/** Seconds before another sign-in email may go to this address (per browser). */
const RESEND_SECONDS = 60;
const SENT_KEY = "shanemiller:linkSentAt";
function linkCooldown(email: string) {
  try {
    const map = JSON.parse(localStorage.getItem(SENT_KEY) || "{}") as Record<string, number>;
    const at = map[email] ?? 0;
    return Math.max(0, Math.ceil(RESEND_SECONDS - (Date.now() - at) / 1000));
  } catch {
    return 0;
  }
}
function markLinkSent(email: string) {
  try {
    const map = JSON.parse(localStorage.getItem(SENT_KEY) || "{}") as Record<string, number>;
    const now = Date.now();
    for (const k of Object.keys(map)) if (now - map[k] > RESEND_SECONDS * 1000) delete map[k];
    map[email] = now;
    localStorage.setItem(SENT_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable: server-side limits still apply */
  }
}

export function useEmailCloud<M>(
  gameId: string,
  api: () => Promise<GameCloudApi<M>>,
  local: LocalProgress<M>,
  onToast: (icon: string, text: string) => void,
) {
  const [state, setState] = useState<CloudState<M>>({
    status: "loading",
    email: null,
    lastSaved: null,
    publicUpdatedAt: null,
    saving: false,
    error: null,
    offer: null,
    view: null,
    draftEmail: "",
  });
  const client = useRef<Client | null>(null);
  const game = useRef<GameCloudApi<M> | null>(null);
  const user = useRef<User | null>(null);
  const session = useRef<{ id: string; started: number } | null>(null);
  const lastWarning = useRef<string | null>(null);
  // only sync once the player has decided what to do with an existing cloud save
  const ready = useRef(false);
  const leaveTo = useRef<(() => void) | null>(null);
  const localRef = useRef(local);
  localRef.current = local;
  const toast = useRef(onToast);
  toast.current = onToast;
  const apiRef = useRef(api);
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  const patch = (p: Partial<CloudState<M>>) => setState((s) => ({ ...s, ...p }));
  const welcomedKey = `cloud:welcomed:${gameId}`;
  /** when this device last saved/loaded the cloud copy, per player */
  const syncKey = (uid: string) => `cloud:synced:${gameId}:${uid}`;
  const markSynced = (at: number) => {
    if (user.current) safeSetItem(syncKey(user.current.uid), String(at));
  };
  const lastSynced = (uid: string) => {
    try {
      return Number(localStorage.getItem(syncKey(uid))) || 0;
    } catch {
      return 0;
    }
  };
  const noLeaveKey = `cloud:noLeavePrompt:${gameId}`;
  const session_ = (k: string, v?: string) => {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
    return null;
  };

  /* ------------------------------ saving ------------------------------ */

  const saveNow = useCallback(async (quiet = false) => {
    const c = client.current;
    const g = game.current;
    const u = user.current;
    const snap = localRef.current.exportSave();
    if (!c || !g || !u || !snap || !ready.current) return false;
    patch({ saving: true });
    try {
      const result = await g.write(u, snap.data, snap.meta);
      if (session.current) await g.touchSession(u, session.current.id, (Date.now() - session.current.started) / 1000, snap.meta);
      const warning = result?.warning ?? null;
      patch({ saving: false, lastSaved: new Date(), error: warning, ...(result?.publicUpdated ? { publicUpdatedAt: new Date() } : {}) });
      markSynced(Date.now());
      if (warning) {
        if (warning !== lastWarning.current) toast.current("⚠️", warning);
      } else if (!quiet) toast.current("☁️", "Saved to the cloud!");
      lastWarning.current = warning;
      return true;
    } catch (err) {
      patch({ saving: false, error: c.friendlyError(err) });
      if (!quiet) toast.current("⚠️", c.friendlyError(err));
      return false;
    }
  }, []);

  /* ------------------------------ sign-in ------------------------------ */

  const publishReady = useCallback(async (u: User, data: string) => {
    const g = game.current;
    const c = client.current;
    if (!g?.publishPublic || !c) return;
    try {
      if (await g.publishPublic(u, data)) patch({ publicUpdatedAt: new Date(), error: null });
    } catch (err) {
      const warning = `Progress saved, but leaderboard publishing failed: ${c.friendlyError(err)}`;
      patch({ error: warning });
      if (warning !== lastWarning.current) toast.current("⚠️", warning);
      lastWarning.current = warning;
    }
  }, []);

  const begin = useCallback(
    async (u: User) => {
      const c = client.current!;
      const g = game.current!;
      ready.current = false;
      patch({ status: "signedIn", email: u.email, error: null });
      const intent = c.takeIntent();
      try {
        const save = await g.load(u);
        let readySave: string | null = null;
        // this device made (or already loaded) the newest cloud save: just keep playing
        const known = !!save && !!save.savedAt && lastSynced(u.uid) >= save.savedAt.getTime() - 5000;
        if (save && intent !== "load" && known) {
          ready.current = true;
          patch({ view: null, offer: null, lastSaved: save.savedAt });
          readySave = save.data;
        } else if (save && intent === "load") {
          // they asked to load it: no second question
          const ok = localRef.current.importSave(save.data);
          if (ok) markSynced(save.savedAt?.getTime() ?? Date.now());
          if (ok) readySave = save.data;
          ready.current = true;
          patch({ view: null, offer: null });
          toast.current(ok ? "🎉" : "⚠️", ok ? "Welcome back! Your saved game is loaded." : "Couldn't read that save — keeping this one.");
        } else if (save) {
          patch({ offer: save, view: "offer" });
        } else {
          ready.current = true;
          setState((s) => ({ ...s, offer: null, view: s.view === "welcome" || s.view === "loadEmail" || s.view === "saveEmail" ? null : s.view }));
          if (intent === "load") toast.current("🔎", `No saved game for ${u.email} yet — we'll save this one from now on.`);
          else if (intent === "save") toast.current("✅", `Signed in! Your progress now saves to ${u.email}.`);
        }
        if (readySave) await publishReady(u, readySave);
        const meta = localRef.current.exportSave()?.meta;
        if (meta) session.current = { id: await g.startSession(u, meta), started: Date.now() };
        if (!save) await saveNow(true);
        // fresh sign-in on this device: keep the welcome from popping up again this visit
        session_(welcomedKey, "1");
      } catch (err) {
        patch({ error: c.friendlyError(err) });
      }
    },
    [publishReady, saveNow],
  );

  // boot: load firebase, finish a magic-link sign-in, follow the signed-in user
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    Promise.all([import("./client"), apiRef.current()])
      .then(async ([c, g]) => {
        if (dead) return;
        if (!c.firebaseConfigured) {
          patch({ status: "off" });
          return;
        }
        client.current = c;
        game.current = g;
        let linkPending = false;
        if (c.isMagicLink()) {
          const email = await c.rememberedEmail();
          if (email) {
            patch({ status: "signingIn", draftEmail: email });
            try {
              await c.completeMagicLink(email);
            } catch (err) {
              c.clearLinkFromUrl();
              patch({ status: "signedOut", error: c.isDeadLink(err) ? "That sign-in link has expired or was already used. Send yourself a new one:" : c.friendlyError(err), view: "loadEmail" });
            }
          } else {
            // opened on another device/browser: confirm the email once
            linkPending = true;
            patch({ status: "signedOut", view: "finish" });
          }
        }
        let first = true;
        off = c.watchUser((u) => {
          const was = user.current?.uid;
          user.current = u;
          if (u && u.uid !== was) void begin(u);
          if (!u) {
            session.current = null;
            ready.current = false;
            // first visit this session → ask about saved games (decided before marking it seen)
            const welcome = first && !linkPending && !session_(welcomedKey);
            if (first) session_(welcomedKey, "1");
            setState((s) => ({ ...s, status: s.status === "linkSent" ? s.status : "signedOut", email: null, offer: null, view: welcome && !s.view ? "welcome" : s.view }));
          }
          first = false;
        });
      })
      .catch(() => patch({ status: "off" }));
    return () => {
      dead = true;
      off?.();
    };
  }, [begin, welcomedKey]);

  // autosave + save when the tab hides / closes; offer to save before closing
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && statusRef.current === "signedIn") void saveNow(true);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current === "signedIn") {
        void saveNow(true);
        return;
      }
      // not saved anywhere but this browser: let the browser ask "leave site?"
      if (statusRef.current === "signedOut" && localRef.current.hasProgress() && !session_(noLeaveKey)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const id = window.setInterval(() => {
      if (statusRef.current === "signedIn" && document.visibilityState === "visible") void saveNow(true);
    }, AUTOSAVE_MS);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [saveNow, noLeaveKey]);

  /* ------------------------------ actions ------------------------------ */

  /** Email a sign-in link. Closes the popup on success. */
  const sendLink = useCallback(async (email: string, intent: CloudIntent, humanToken?: string | null) => {
    const c = client.current;
    if (!c) return false;
    patch({ draftEmail: email });
    if (!c.validEmail(email)) {
      patch({ error: "That email doesn't look right." });
      return false;
    }
    // Bot check: the reCAPTCHA token is verified (and rate-limited) on our server first
    if (humanCheckOn && !humanToken) {
      patch({ error: "Please tick “I'm not a robot” first." });
      return false;
    }
    // Don't fire repeat emails at the same address
    const wait = linkCooldown(c.cleanEmail(email));
    if (wait > 0) {
      patch({ error: `We just sent a link to that address — check your inbox (and spam). You can send another in ${wait}s.` });
      return false;
    }
    patch({ error: null, saving: true });
    try {
      if (humanCheckOn && humanToken) {
        const problem = await verifyHuman(humanToken, c.cleanEmail(email));
        if (problem) {
          patch({ error: problem, saving: false });
          return false;
        }
      }
      await c.sendMagicLink(email, intent);
      markLinkSent(c.cleanEmail(email));
      patch({ status: "linkSent", email: c.cleanEmail(email), view: null, saving: false });
      toast.current("📬", `Check ${c.cleanEmail(email)} — tap the link in the email to ${intent === "load" ? "load your game" : "start saving"}.`);
      // a pending "leave" can carry on now
      const go = leaveTo.current;
      leaveTo.current = null;
      if (go) window.setTimeout(go, 600);
      return true;
    } catch (err) {
      patch({ error: c.friendlyError(err), saving: false });
      return false;
    }
  }, []);

  /** Finish a link opened on another device. */
  const finishWithEmail = useCallback(async (email: string) => {
    const c = client.current;
    if (!c) return;
    patch({ status: "signingIn", error: null, draftEmail: email });
    try {
      await c.completeMagicLink(email);
      patch({ view: null });
    } catch (err) {
      c.clearLinkFromUrl();
      patch({ status: "signedOut", view: "loadEmail", error: c.isDeadLink(err) ? "That sign-in link has expired or was already used. Send yourself a new one:" : c.friendlyError(err) });
    }
  }, []);

  const acceptOffer = useCallback(() => {
    const o = state.offer;
    if (!o) return;
    const ok = localRef.current.importSave(o.data);
    if (ok) markSynced(o.savedAt?.getTime() ?? Date.now());
    ready.current = true;
    patch({ offer: null, view: null });
    toast.current(ok ? "🎉" : "⚠️", ok ? "Welcome back! Your saved game is loaded." : "Couldn't read that save — keeping this one.");
    if (ok && user.current) void publishReady(user.current, o.data);
  }, [publishReady, state.offer]);

  const declineOffer = useCallback(() => {
    // keep what's on screen; it becomes the cloud save from now on
    ready.current = true;
    patch({ offer: null, view: null });
    void saveNow(true).then((ok) => ok && toast.current("☁️", "Keeping this game — it's now your cloud save."));
  }, [saveNow]);

  const signOut = useCallback(async () => {
    const c = client.current;
    if (!c) return;
    await saveNow(true);
    await c.signOut();
    patch({ view: null });
    toast.current("👋", "Signed out. Your progress stays on this device too.");
  }, [saveNow]);

  /** Open a popup (or close it with null). */
  const show = useCallback((view: CloudView | null) => {
    if (view === null && leaveTo.current) leaveTo.current = null; // "Stay" cancels leaving
    setState((s) => ({ ...s, view, error: null, status: s.status === "linkSent" && view ? "signedOut" : s.status }));
  }, []);

  /** "Not now" from the welcome/save popups. */
  const skip = useCallback(() => {
    patch({ view: null, error: null });
  }, []);

  /**
   * Leaving the game via an in-game button. Signed in → save then go.
   * Unsaved progress → ask first. Otherwise just go.
   */
  const leave = useCallback(
    (go: () => void) => {
      if (statusRef.current === "signedIn") {
        void saveNow(true).finally(go);
        return;
      }
      if (statusRef.current !== "off" && localRef.current.hasProgress() && !session_(noLeaveKey)) {
        leaveTo.current = go;
        patch({ view: "leave", error: null });
        return;
      }
      go();
    },
    [saveNow, noLeaveKey],
  );

  /** "Leave without saving". */
  const leaveAnyway = useCallback(() => {
    session_(noLeaveKey, "1");
    const go = leaveTo.current;
    leaveTo.current = null;
    patch({ view: null });
    go?.();
  }, [noLeaveKey]);

  return { state, sendLink, finishWithEmail, acceptOffer, declineOffer, saveNow, signOut, show, skip, leave, leaveAnyway };
}

export type EmailCloud<M> = ReturnType<typeof useEmailCloud<M>>;
