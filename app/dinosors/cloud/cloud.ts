/* ------------------------------------------------------------------ */
/*  Dinosaur Land cloud saves (Firestore). Sign-in lives in the shared */
/*  site client (utils/firebase). Layout:                              */
/*                                                                     */
/*   dinosorsPlayers/{uid}                 profile + latest stats      */
/*   dinosorsPlayers/{uid}/saves/current   the world (JSON string)     */
/*   dinosorsPlayers/{uid}/sessions/{id}   one doc per play session    */
/*                                                                     */
/*  Browser-only: loaded with a dynamic import.                        */
/* ------------------------------------------------------------------ */
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { deviceKind, firebase, type User } from "@/utils/firebase/client";
import type { GameCloudApi } from "@/utils/firebase/useEmailCloud";

export interface DinoMeta {
  day: number;
  dinos: number;
  people: number;
  level: string;
  stickers: number;
  raidsWon: number;
}

const playerRef = (uid: string) => doc(firebase().db, "dinosorsPlayers", uid);
const saveRef = (uid: string) => doc(firebase().db, "dinosorsPlayers", uid, "saves", "current");
const sessionRef = (uid: string, id: string) => doc(firebase().db, "dinosorsPlayers", uid, "sessions", id);

export const dinoCloud: GameCloudApi<DinoMeta> = {
  async load(user) {
    const snap = await getDoc(saveRef(user.uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      data: d.data as string,
      savedAt: d.savedAt instanceof Timestamp ? d.savedAt.toDate() : null,
      meta: { day: d.day ?? 1, dinos: d.dinos ?? 0, people: d.people ?? 0, level: d.level ?? "", stickers: d.stickers ?? 0, raidsWon: 0 },
    };
  },

  async write(user, data, m) {
    if (data.length > 900_000) throw new Error("This world is too big to save to the cloud.");
    await setDoc(saveRef(user.uid), { data, version: 1, size: data.length, savedAt: serverTimestamp(), day: m.day, dinos: m.dinos, people: m.people, level: m.level, stickers: m.stickers });
    await setDoc(
      playerRef(user.uid),
      { email: user.email ?? "", lastSavedAt: serverTimestamp(), lastPlayedAt: serverTimestamp(), day: m.day, level: m.level, stickers: m.stickers },
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
      startDay: m.day,
      endDay: m.day,
      startStickers: m.stickers,
      endStickers: m.stickers,
      startRaidsWon: m.raidsWon,
      endRaidsWon: m.raidsWon,
    });
    return id;
  },

  async touchSession(user, id, seconds, m) {
    await setDoc(sessionRef(user.uid, id), { lastSeenAt: serverTimestamp(), seconds: Math.round(seconds), endDay: m.day, endStickers: m.stickers, endRaidsWon: m.raidsWon }, { merge: true });
  },
};
