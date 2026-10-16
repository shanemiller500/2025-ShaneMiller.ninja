/* ------------------------------------------------------------------ */
/*  Cloud Storage for the browser — kept out of client.ts so the games */
/*  that only need auth + Firestore don't download the Storage SDK.    */
/* ------------------------------------------------------------------ */
import { getApp } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebase } from "./client";

let storage: FirebaseStorage | null = null;

export function firebaseStorage() {
  if (!storage) {
    firebase(); // initialises the app (+ App Check) if it isn't yet
    storage = getStorage(getApp());
  }
  return storage;
}

export const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
