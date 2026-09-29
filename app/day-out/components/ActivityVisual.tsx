"use client";

import { useState } from "react";
import type { Activity } from "../lib/types";
import styles from "../day-out.module.css";

const LABELS: Partial<Record<Activity["category"], string>> = { Ride: "Motorbike ride", War: "War history", Music: "Live music", Transit: "Tram & train", Home: "Stay home", Event: "What's on" };
export default function ActivityVisual({ activity, hero = false }: { activity: Activity; hero?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`${styles.visual} ${hero ? styles.heroVisual : ""}`}>
    {/* Provider image rights are retained alongside the activity's source. */}
    {activity.imageUrl && !failed && <img src={activity.imageUrl} alt={activity.title} onError={() => setFailed(true)} loading={hero ? "eager" : "lazy"} referrerPolicy="no-referrer" />}
    <span className={styles.tag}>{LABELS[activity.category] || activity.category}</span>
  </div>;
}
