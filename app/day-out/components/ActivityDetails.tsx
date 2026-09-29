"use client";

import dynamic from "next/dynamic";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowLeft, Bookmark, ExternalLink, Navigation, Shuffle, TramFront } from "lucide-react";
import type { DayData, Recommendation } from "../lib/types";
import { directionsUrl } from "../lib/recommendations";
import ActivityVisual from "./ActivityVisual";
import styles from "../day-out.module.css";

const DayMap = dynamic(() => import("./DayMap"), { ssr: false, loading: () => <p className={styles.small}>Loading map…</p> });
export function stamp(value: string) { return new Date(value).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
export default function ActivityDetails({ item, onClose, saved, onSave, data, surprise, onAnother }: { item: Recommendation | null; onClose: () => void; saved: boolean; onSave: () => void; data: DayData | null; surprise: boolean; onAnother: () => void }) {
  const activity = item?.activity;
  const weather = data?.weather.data;
  return <Dialog open={!!item} onClose={onClose} className={styles.dialog}>
    <div className={styles.backdrop} aria-hidden="true" />
    <div className={styles.dialogPosition}><DialogPanel className={`${styles.root} ${styles.panel}`}>
      {activity && item && <>
        <button className={styles.back} onClick={onClose} autoFocus><ArrowLeft size={22} aria-hidden />Back</button>
        <ActivityVisual activity={activity} hero />
        <div className={styles.panelBody}>
          <DialogTitle className={styles.panelTitle}>{activity.title}</DialogTitle>
          <p className={styles.where}>{activity.suburb} · {activity.region}</p>
          <p>{activity.description}</p>
          <p className={styles.why}>{item.reason}</p>

          <div className={styles.actions}>
            {activity.kind === "home" ? <a className={styles.go} href={activity.source.url} target={activity.source.url.startsWith("tel:") ? undefined : "_blank"} rel="noreferrer">{activity.cta}</a> : <a className={styles.go} href={directionsUrl(activity)} target="_blank" rel="noreferrer">{activity.travel === "transit" ? <TramFront size={22} aria-hidden /> : <Navigation size={22} aria-hidden />}{activity.travel === "transit" ? "Tram & train times" : "Directions"}</a>}
            <button onClick={onSave} aria-pressed={saved}><Bookmark size={20} fill={saved ? "currentColor" : "none"} aria-hidden />{saved ? "Saved" : "Save"}</button>
            {surprise && <button onClick={onAnother}><Shuffle size={20} aria-hidden />Another one</button>}
            {activity.kind !== "home" && <a href={activity.source.url} target="_blank" rel="noreferrer"><ExternalLink size={18} aria-hidden />Website</a>}
          </div>

          {activity.startDate && <p><strong>When:</strong> {stamp(activity.startDate)}{activity.endDate ? ` – ${stamp(activity.endDate)}` : ""}</p>}
          {item.distanceKm !== undefined && <p><strong>How far:</strong> about {Math.round(item.distanceKm)} km in a straight line from central Gold Coast. The road trip is longer; {activity.travel === "transit" ? "the tram & train button" : "Directions"} gives the real travel time.</p>}
          {activity.kind === "ride" && activity.stops && <>
            <h3>Stop overview</h3>
            <ol className={styles.stops}>{activity.stops.map(stop => <li key={stop.name}>{stop.name}</li>)}</ol>
            <p className={styles.small}>The map shows the stops, not the road route. Directions picks the roads, distance and time. Check fuel along the way.</p>
          </>}
          {(activity.latitude !== undefined || activity.stops?.length) && <DayMap activities={[activity]} />}

          <h3>Before you go</h3>
          <p>{weather ? `Gold Coast: ${Math.round(weather.temperature)}°C, wind ${Math.round(weather.wind)} km/h, ${weather.rainNextHours}% chance of rain in the next 4 hours. It can differ up in the hills.` : "No weather right now. Check the forecast before heading off."}</p>
          {item.notices.map(notice => <a className={styles.notice} key={notice.id} href={notice.source.url} target="_blank" rel="noreferrer"><strong>{notice.title}</strong><span>{notice.description}</span><small>{notice.source.name} · {stamp(notice.source.updatedAt || notice.source.fetchedAt)} ↗</small></a>)}
          {activity.kind !== "home" && <p className={styles.links}><a href="https://qldtraffic.qld.gov.au/" target="_blank" rel="noreferrer">Road conditions ↗</a><a href="https://parks.qld.gov.au/park-alerts" target="_blank" rel="noreferrer">Park alerts ↗</a><a href="https://www.bom.gov.au/qld/warnings/" target="_blank" rel="noreferrer">Weather warnings ↗</a></p>}
          <p className={styles.small}>{activity.curated ? "Hand-picked idea; opening hours aren't checked live." : `Listing fetched ${stamp(activity.source.fetchedAt)}.`}{activity.imageAttribution && <> {activity.imageAttribution}{activity.imageSourceUrl && <> (<a href={activity.imageSourceUrl} target="_blank" rel="noreferrer">author & licence</a>)</>}.</>}</p>
        </div>
      </>}
    </DialogPanel></div>
  </Dialog>;
}
