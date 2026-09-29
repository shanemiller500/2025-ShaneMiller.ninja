"use client";

import { Bookmark, MapPin, TramFront } from "lucide-react";
import type { Recommendation } from "../lib/types";
import ActivityVisual from "./ActivityVisual";
import styles from "../day-out.module.css";

export default function ActivityCard({ item, saved, onOpen, onSave }: { item: Recommendation; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const { activity } = item;
  return <article className={styles.card}>
    <button className={styles.cardOpen} onClick={onOpen} aria-label={`Details for ${activity.title}`}>
      <ActivityVisual activity={activity} />
      <div className={styles.cardBody}>
        <h3>{activity.title}</h3>
        <p className={styles.where}><MapPin size={16} aria-hidden />{activity.suburb || activity.region}{item.distanceKm !== undefined && ` · ~${Math.round(item.distanceKm)} km*`}</p>
        {activity.startDate && <p className={styles.when}>{new Date(activity.startDate).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", weekday: "short", hour: "numeric", minute: "2-digit" })}</p>}
        {activity.travel === "transit" && <p className={styles.where}><TramFront size={16} aria-hidden />Leave the car at home</p>}
        <p className={styles.reason}>{item.reason}</p>
      </div>
    </button>
    <button className={styles.save} onClick={onSave} aria-pressed={saved} aria-label={`${saved ? "Unsave" : "Save"} ${activity.title}`}><Bookmark size={18} fill={saved ? "currentColor" : "none"} aria-hidden />{saved ? "Saved" : "Save"}</button>
  </article>;
}
