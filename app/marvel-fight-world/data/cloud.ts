/* ------------------------------------------------------------------ */
/*  Fight World cloud saves (Firestore). Sign-in is the shared site    */
/*  email link (utils/firebase), so one account covers every game.     */
/*                                                                     */
/*   fightWorldPlayers/{uid}                 profile + headline stats  */
/*   fightWorldPlayers/{uid}/saves/current   settings, favourites,     */
/*                                           recent, stats, world spot */
/*   fightWorldPlayers/{uid}/sessions/{id}   one doc per play session  */
/*   fightWorldLeaderboard/{uid}             PUBLIC: name + scores only */
/*                                           (never the email)         */
/*                                                                     */
/*  Browser-only: loaded with a dynamic import.                        */
/* ------------------------------------------------------------------ */
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";
import { deviceKind, firebase, friendlyError } from "@/utils/firebase/client";
import type { GameCloudApi } from "@/utils/firebase/useEmailCloud";
import { EMPTY_STATS, cleanName, mainFighter, validName, type ProgressBundle } from "./storage";

export interface FightMeta {
  matches: number;
  wins: number;
  knockouts: number;
  tournamentWins: number;
  survivalBest: number;
}

const playerRef = (uid: string) => doc(firebase().db, "fightWorldPlayers", uid);
const saveRef = (uid: string) => doc(firebase().db, "fightWorldPlayers", uid, "saves", "current");
const sessionRef = (uid: string, id: string) => doc(firebase().db, "fightWorldPlayers", uid, "sessions", id);
const boardRef = (uid: string) => doc(firebase().db, "fightWorldLeaderboard", uid);
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
const int = (v: unknown) => Math.max(0, Math.floor(num(v)));
const LIFETIME_TOTALS = ["score", "wins", "matches", "kos", "perfects", "bestStreak", "bestCombo", "titles", "survivalBest"] as const;
const pendingWrites = new Map<string, Promise<unknown>>();
function queueWrite<T>(uid: string, work: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(uid);
  const task = (previous ?? Promise.resolve()).catch(() => undefined).then(work);
  const queued = task.finally(() => {
    if (pendingWrites.get(uid) === queued) pendingWrites.delete(uid);
  });
  pendingWrites.set(uid, queued);
  return queued;
}

/* ── Public leaderboard ────────────────────────────────────────────── */
export interface LeaderRow {
  uid: string;
  name: string;
  score: number;
  wins: number;
  matches: number;
  kos: number;
  perfects: number;
  bestStreak: number;
  streak: number;
  bestCombo: number;
  titles: number;
  survivalBest: number;
  mainFighter: { id: number; name: string } | null;
  streakFighter: { id: number; name: string } | null;
  updatedAt: Date | null;
}

export type LeaderSort = "score" | "bestStreak" | "wins" | "kos";

/** Publish this player's public row from their save bundle (needs a name). */
async function publishLeaderboard(uid: string, bundleJson: string) {
  let b: Partial<ProgressBundle>;
  try {
    b = JSON.parse(bundleJson);
  } catch {
    return false;
  }
  const name = cleanName(b.profile?.name ?? "");
  if (!validName(name)) return false;
  const st = { ...EMPTY_STATS, ...(b.stats ?? {}) };
  const main = mainFighter(st);
  const row = {
    name,
    score: int(st.score),
    wins: int(st.wins),
    matches: int(st.matches),
    kos: int(st.knockouts),
    perfects: int(st.perfects),
    bestStreak: int(st.bestStreak),
    streak: int(st.streak),
    bestCombo: int(st.biggestCombo),
    titles: int(st.tournamentWins),
    survivalBest: int(st.survivalBest),
    mainFighter: main ? { id: int(main.id), name: main.name.slice(0, 40) } : null,
    streakFighter: st.bestStreakById != null && st.bestStreak > 0 ? { id: int(st.bestStreakById), name: (st.bestStreakBy || "").slice(0, 40) } : null,
    updatedAt: serverTimestamp(),
  };
  await runTransaction(firebase().db, async (transaction) => {
    const ref = boardRef(uid);
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      const previous = toRow(uid, existing.data());
      for (const field of LIFETIME_TOTALS) row[field] = Math.max(row[field], previous[field]);
      if (previous.bestStreak > int(st.bestStreak)) row.streakFighter = previous.streakFighter;
      if (!row.mainFighter) row.mainFighter = previous.mainFighter;
    }
    transaction.set(ref, row);
  });
  return true;
}

const toRow = (id: string, d: Record<string, unknown>): LeaderRow => {
  const fighter = (v: unknown) => {
    const f = v as { id?: unknown; name?: unknown } | null;
    return f && typeof f.name === "string" ? { id: int(f.id), name: f.name } : null;
  };
  return {
    uid: id,
    name: typeof d.name === "string" ? d.name : "Fighter",
    score: int(d.score),
    wins: int(d.wins),
    matches: int(d.matches),
    kos: int(d.kos),
    perfects: int(d.perfects),
    bestStreak: int(d.bestStreak),
    streak: int(d.streak),
    bestCombo: int(d.bestCombo),
    titles: int(d.titles),
    survivalBest: int(d.survivalBest),
    mainFighter: fighter(d.mainFighter),
    streakFighter: fighter(d.streakFighter),
    updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : null,
  };
};

/** Top players by a stat (public read). */
export async function loadLeaderboard(sort: LeaderSort, max = 50): Promise<LeaderRow[]> {
  const q = query(collection(firebase().db, "fightWorldLeaderboard"), orderBy(sort, "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toRow(d.id, d.data()));
}

/** The signed-in player's own row + rank for a stat (null when signed out / not listed). */
export async function myLeaderboardRank(sort: LeaderSort): Promise<{ row: LeaderRow; rank: number } | null> {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(boardRef(uid));
  if (!snap.exists()) return null;
  const row = toRow(uid, snap.data());
  const ahead = await getCountFromServer(query(collection(firebase().db, "fightWorldLeaderboard"), where(sort, ">", row[sort])));
  return { row, rank: ahead.data().count + 1 };
}

export function currentUid(): string | null {
  try {
    return firebase().auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

export const fightCloud: GameCloudApi<FightMeta> = {
  async load(user) {
    const snap = await getDoc(saveRef(user.uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      data: d.data as string,
      savedAt: d.savedAt instanceof Timestamp ? d.savedAt.toDate() : null,
      meta: { matches: num(d.matches), wins: num(d.wins), knockouts: num(d.knockouts), tournamentWins: num(d.tournamentWins), survivalBest: num(d.survivalBest) },
    };
  },

  write(user, data, m) {
    // Autosave, name changes and match results can overlap. Keep their Firestore
    // writes in invocation order so an older score cannot replace a newer one.
    return queueWrite(user.uid, async () => {
      if (data.length > 900_000) throw new Error("This save is too big for the cloud.");
      await setDoc(saveRef(user.uid), { data, version: 1, size: data.length, savedAt: serverTimestamp(), ...m });
      await setDoc(
        playerRef(user.uid),
        { email: user.email ?? "", lastSavedAt: serverTimestamp(), lastPlayedAt: serverTimestamp(), matches: m.matches, wins: m.wins, tournamentWins: m.tournamentWins },
        { merge: true },
      );
      try {
        return { publicUpdated: await publishLeaderboard(user.uid, data) };
      } catch (error) {
        return { warning: `Progress saved, but leaderboard publishing failed: ${friendlyError(error)}` };
      }
    });
  },

  publishPublic(user, data) {
    return queueWrite(user.uid, () => publishLeaderboard(user.uid, data));
  },

  async startSession(user, m) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const first = !(await getDoc(playerRef(user.uid))).exists();
    await setDoc(playerRef(user.uid), { email: user.email ?? "", lastPlayedAt: serverTimestamp(), ...(first ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
    await setDoc(sessionRef(user.uid, id), {
      startedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      seconds: 0,
      device: deviceKind(),
      startMatches: m.matches,
      endMatches: m.matches,
      startWins: m.wins,
      endWins: m.wins,
    });
    return id;
  },

  async touchSession(user, id, seconds, m) {
    await setDoc(sessionRef(user.uid, id), { lastSeenAt: serverTimestamp(), seconds: Math.round(seconds), endMatches: m.matches, endWins: m.wins }, { merge: true });
  },
};
