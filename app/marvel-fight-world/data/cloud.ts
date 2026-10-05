/* ------------------------------------------------------------------ */
/*  Fight World cloud saves (Firestore). Sign-in is the shared site    */
/*  email link (utils/firebase), so one account covers every game.     */
/*                                                                     */
/*   fightWorldPlayers/{uid}                 profile + headline stats  */
/*   fightWorldPlayers/{uid}/saves/current   settings, favourites,     */
/*                                           recent, stats, world spot */
/*   fightWorldPlayers/{uid}/sessions/{id}   one doc per play session  */
/*                                                                     */
/*  Browser-only: loaded with a dynamic import.                        */
/* ------------------------------------------------------------------ */
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { deviceKind, firebase } from "@/utils/firebase/client";
import type { GameCloudApi } from "@/utils/firebase/useEmailCloud";

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
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

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

  async write(user, data, m) {
    if (data.length > 900_000) throw new Error("This save is too big for the cloud.");
    await setDoc(saveRef(user.uid), { data, version: 1, size: data.length, savedAt: serverTimestamp(), ...m });
    await setDoc(
      playerRef(user.uid),
      { email: user.email ?? "", lastSavedAt: serverTimestamp(), lastPlayedAt: serverTimestamp(), matches: m.matches, wins: m.wins, tournamentWins: m.tournamentWins },
      { merge: true },
    );
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
