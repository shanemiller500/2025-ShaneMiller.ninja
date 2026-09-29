"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, CloudRain, Flag, Mountain, Music, RefreshCw, Shield, Shuffle, Sofa, Star, Sun, TramFront, Tent, type LucideIcon } from "lucide-react";
import type { Activity, Category, DayData, Recommendation } from "./lib/types";
import { fresh, recommend, surpriseCandidates } from "./lib/recommendations";
import { brisbaneDay } from "./lib/normalize";
import MotorbikeIcon from "./components/MotorbikeIcon";
import SmartArse from "./components/SmartArse";
import AiPick from "./components/AiPick";
import BikerShazz from "./components/BikerShazz";
import ScrollRow from "./components/ScrollRow";
import { HOME } from "./lib/providers/places";
import ActivityCard from "./components/ActivityCard";
import ActivityDetails from "./components/ActivityDetails";
import styles from "./day-out.module.css";

type Group = { name: string; icon: LucideIcon | typeof MotorbikeIcon; match?: (activity: Activity) => boolean };
const GROUPS: Group[] = [
  { name: "Best today", icon: Star },
  { name: "Motorbike rides", icon: MotorbikeIcon, match: a => a.kind === "ride" },
  { name: "War history", icon: Shield, match: a => a.category === "War" },
  { name: "Live music", icon: Music, match: a => a.category === "Music" },
  { name: "Hinterland", icon: Mountain, match: a => a.category === "Hinterland" },
  { name: "Camping", icon: Tent, match: a => a.category === "Camping" },
  { name: "Tram & train", icon: TramFront, match: a => a.travel === "transit" },
  { name: "Motorsport", icon: Flag, match: a => a.category === "Motorsport" },
  { name: "Stay home", icon: Sofa, match: a => a.kind === "home" },
  { name: "Saved", icon: Bookmark },
];
// Council events are only shown when they fit: gigs, war history, motorsport.
const EVENT_CATEGORIES: Category[] = ["Music", "War", "Motorsport"];
const homeIdea = (activity: Activity): Recommendation => ({ activity, score: 0, reason: "A solid plan B. Zero travel required.", notices: [] });
// Two stay-home ideas slot into Best today, changing each day (Netflix first if it's wet).
function withHomeIdeas(list: Recommendation[], day: number, wet: boolean): Recommendation[] {
  const first = wet ? HOME[0] : HOME[day % HOME.length];
  const second = HOME.find((idea, index) => idea !== first && index === (day + 3) % HOME.length) || HOME.find(idea => idea !== first)!;
  const result = [...list];
  result.splice(Math.min(2, result.length), 0, homeIdea(first));
  result.splice(Math.min(6, result.length), 0, homeIdea(second));
  return result;
}
// What's-on results are kept on this device for the day, then thrown away.
// Bump the key when the search changes so devices drop a copy made the old way.
const WHATS_ON_KEY = "day-out-whats-on-seq";
const WHATS_ON_RETRY_MS = 30 * 60_000;
type WhatsOnStore = { day: string; events?: Activity[]; fetchedAt?: string; failedAt?: number };
// One request per page load at most, shared by re-mounts (React dev mode mounts twice) and
// allowed to finish even if you leave the page, so the day's result always gets saved.
let whatsOnRequest: Promise<WhatsOnStore> | null = null;
function loadWhatsOn(today: string): Promise<WhatsOnStore> {
  whatsOnRequest ??= fetch("/api/day-out/whats-on", { cache: "no-store" })
    .then(response => response.json())
    .then((result: { ok?: boolean; day?: string; events?: Activity[]; fetchedAt?: string }): WhatsOnStore =>
      result.ok && Array.isArray(result.events)
        ? { day: result.day || today, events: result.events, fetchedAt: result.fetchedAt }
        : { day: today, failedAt: Date.now() })
    .catch((): WhatsOnStore => ({ day: today, failedAt: Date.now() }))
    .then(store => {
      try { localStorage.setItem(WHATS_ON_KEY, JSON.stringify(store)); } catch { /* ignore */ }
      return store;
    });
  return whatsOnRequest;
}
const fallback = (places: Activity[]): DayData => {
  const source = { name: "Not loaded", url: "https://open-meteo.com/", fetchedAt: "" };
  return { generatedAt: "", activities: places, weather: { status: "unavailable", data: null, source }, surf: { status: "unavailable", data: null, source }, events: { status: "unavailable", data: [], source }, traffic: { status: "unavailable", data: [], source }, news: { status: "unavailable", data: [], source } };
};

export default function DayOutClient({ places }: { places: Activity[] }) {
  const [group, setGroup] = useState("Best today");
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [surprise, setSurprise] = useState(false);
  const [summon, setSummon] = useState(0);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [whatsOn, setWhatsOn] = useState<Activity[]>([]);
  const [whatsOnState, setWhatsOnState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [whatsOnAt, setWhatsOnAt] = useState<string | null>(null);

  // Events for today and tomorrow: use today's saved copy if there is one; otherwise ask the
  // server once (it caches per day too) and save the result. Yesterday's copy is cleared.
  useEffect(() => {
    const today = brisbaneDay(new Date());
    let alive = true;
    const show = (store: WhatsOnStore) => {
      if (!alive) return;
      if (store.events) { setWhatsOn(store.events); setWhatsOnAt(store.fetchedAt || null); setWhatsOnState("ready"); }
      else setWhatsOnState("unavailable");
    };
    try {
      const stored = JSON.parse(localStorage.getItem(WHATS_ON_KEY) || "null") as WhatsOnStore | null;
      if (stored?.day === today) {
        // Today's list: use it all day. A failed check waits 30 minutes before trying again.
        if (stored.events) { show(stored); return () => { alive = false; }; }
        if (stored.failedAt && Date.now() - stored.failedAt < WHATS_ON_RETRY_MS) { show(stored); return () => { alive = false; }; }
      }
      localStorage.removeItem(WHATS_ON_KEY); // yesterday's (or a stale failure)
    } catch { /* storage unavailable: just fetch */ }
    void loadWhatsOn(today).then(show);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setNow(new Date());
    try {
      const values: unknown = JSON.parse(localStorage.getItem("day-out-saved-v2") || "[]");
      if (Array.isArray(values)) setSaved(values.filter((v): v is string => typeof v === "string").slice(0, 100));
    } catch { /* Saving is a convenience; the page works without it. */ }
  }, []);
  const toggleSave = (activity: Activity) => setSaved(previous => {
    const next = previous.includes(activity.id) ? previous.filter(id => id !== activity.id) : [...previous, activity.id];
    try { localStorage.setItem("day-out-saved-v2", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/day-out", { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const result: DayData = await response.json();
      if (!Array.isArray(result.activities) || !result.weather) throw new Error("invalid");
      setData(result); setNow(new Date());
    }).catch(() => { if (!controller.signal.aborted) setMessage("Live updates didn't load. The ideas below still work."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const dataset = useMemo(() => {
    const base = data || fallback(places);
    const known = new Set(base.activities.map(a => a.id));
    const activities = [...base.activities, ...whatsOn.filter(a => !known.has(a.id))];
    return { ...base, activities: activities.filter(a => a.kind !== "event" || EVENT_CATEGORIES.includes(a.category)) };
  }, [data, places, whatsOn]);
  const ranked = useMemo(() => recommend(dataset, { freeOnly: false, interests: [] }, now || new Date("2026-09-28T00:00:00Z")), [dataset, now]);
  const stale = !!data && !fresh(data.generatedAt, 30, new Date());
  const weather = !stale && data?.weather.status === "available" ? data.weather.data : null;
  const current = GROUPS.find(item => item.name === group)!;

  // Ended events drop out; place ideas stay even when they aren't today's best pick.
  const all: Recommendation[] = dataset.activities.flatMap(activity => {
    const match = ranked.find(item => item.activity.id === activity.id);
    if (match) return [match];
    return activity.kind === "event" ? [] : [{ activity, score: 0, reason: "One for another day. Check hours and conditions.", notices: [] }];
  }).concat(HOME.map(homeIdea));
  const day = Math.floor((now || new Date("2026-09-28T00:00:00Z")).getTime() / 86_400_000);
  const wet = !!weather && (weather.rain > 0.2 || weather.rainNextHours >= 60);
  const visible = group === "Best today" ? withHomeIdeas(ranked.filter(item => item.score >= 0).slice(0, 8), day, wet)
    : group === "Saved" ? all.filter(item => saved.includes(item.activity.id))
    : all.filter(item => current.match!(item.activity));

  function chooseSurprise() {
    const pool = surpriseCandidates(ranked.filter(item => !current.match || current.match(item.activity))).filter(item => item.activity.id !== selected?.activity.id);
    // Now and then the surprise is to stay home.
    if (group === "Best today" && Math.random() < 0.15) { setSelected(homeIdea(HOME[Math.floor(Math.random() * HOME.length)])); setSurprise(true); setMessage(""); return; }
    if (group === "Stay home") { setSelected(homeIdea(HOME[Math.floor(Math.random() * HOME.length)])); setSurprise(true); setMessage(""); return; }
    if (!pool.length) { setMessage("Nothing strong for that right now. Try another button."); return; }
    setSelected(pool[Math.floor(Math.random() * pool.length)]); setSurprise(true); setMessage("");
  }
  // Web-found events (today's ones are also ranked into the cards above).
  const whatsOnCards: Recommendation[] = whatsOn.map(activity => ranked.find(item => item.activity.id === activity.id)
    || { activity, score: 0, reason: "Listed online. Check the event page before heading off.", notices: [] })
    .filter(item => !item.activity.endDate || item.activity.endDate > (now || new Date()).toISOString());
  const notices = data && !stale ? [...data.traffic.data, ...data.news.data].slice(0, 3) : [];

  return <div className={styles.root}>
    <header className={styles.header}>
      <Link href="/projects" className={styles.backLink}><ArrowLeft size={18} aria-hidden />Portfolio</Link>
      <Link href="/day-out" className={styles.brand}>DAY OUT</Link>
      <span className={styles.weather}>
        {weather ? <>{weather.rainNextHours >= 60 ? <CloudRain size={20} aria-hidden /> : <Sun size={20} aria-hidden />}{Math.round(weather.temperature)}° Gold Coast · {weather.rainNextHours}% rain</> : loading ? "Checking weather…" : "Weather unavailable"}
      </span>
      <button className={styles.callShazz} onClick={() => setSummon(value => value + 1)}><span aria-hidden><BikerShazz /></span>Call Shazz</button>
      <button className={styles.iconButton} onClick={() => setRefresh(value => value + 1)} disabled={loading} aria-label="Refresh"><RefreshCw size={20} aria-hidden /></button>
    </header>

    <main className={styles.container}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Where to today?</h1>
        <button className={styles.surprise} onClick={chooseSurprise}><Shuffle size={20} aria-hidden />Surprise me</button>
      </div>
      <p className={styles.intro}>
        <strong>Built by Shane for Dad.</strong> You&apos;ve clocked off for good, so every day&apos;s a Saturday now. Find a ride, a gig,
        a bit of war history, somewhere to park the van, or a feed at the pub. Or tell Shazz to rack off and have a nap.
        Get out there and live it up, old man! 🏍️🍺
      </p>
      <ScrollRow label="Kind of day out" active={group}>
        {GROUPS.map(({ name, icon: Icon }) => <button key={name} aria-pressed={group === name} onClick={() => { setGroup(name); setMessage(""); }}><Icon size={19} aria-hidden />{name}</button>)}
      </ScrollRow>
      {group === "Best today" && <section className={styles.whatsOn}>
        <h2>What's on around South East Queensland</h2>
        <p className={styles.small}>{whatsOnAt ? `Checked today at ${new Date(whatsOnAt).toLocaleTimeString("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", minute: "2-digit" })} · refreshes tomorrow. ` : ""}Gigs, bike events, car shows and war history from Noosa to the Tweed and out to Toowoomba, for today and tomorrow. Checked once a day; always confirm on the event page.</p>
        {whatsOnState === "loading" && <p className={styles.small} role="status">Checking what's on…</p>}
        {whatsOnState === "unavailable" && <p className={styles.small}>Couldn't check events right now. Try again later.</p>}
        {whatsOnState === "ready" && !whatsOnCards.length && <p className={styles.small}>Nothing listed for today or tomorrow that fits. Quiet one.</p>}
        {!!whatsOnCards.length && <div className={styles.grid}>
          {whatsOnCards.map(item => <ActivityCard key={item.activity.id} item={item} saved={saved.includes(item.activity.id)} onOpen={() => { setSelected(item); setSurprise(false); }} onSave={() => toggleSave(item.activity)} />)}
        </div>}
      </section>}
      {group === "Best today" && <AiPick onOpen={item => { setSelected(item); setSurprise(true); }} />}
      <p className={styles.message} role="status" aria-live="polite">{message}</p>

      <div className={styles.grid}>
        {visible.map(item => <ActivityCard key={item.activity.id} item={item} saved={saved.includes(item.activity.id)} onOpen={() => { setSelected(item); setSurprise(false); }} onSave={() => toggleSave(item.activity)} />)}
      </div>
      {!visible.length && <p className={styles.empty}>{group === "Saved" ? "Nothing saved yet. Tap Save on anything you like." : "Nothing here right now."}</p>}
      <p className={styles.small}>* Distances are straight-line estimates from Ormeau. Directions gives the real road distance and travel time.</p>

      {notices.length > 0 && <section className={styles.headsUp}>
        <h2>Heads up</h2>
        {notices.map(notice => <a key={notice.id} href={notice.source.url} target="_blank" rel="noreferrer"><strong>{notice.title}</strong><span>{notice.source.name} ↗</span></a>)}
      </section>}

      {data && <details className={styles.sources}><summary>Where this comes from</summary>
        {[data.weather, data.surf, data.events, data.traffic, data.news].map(provider => <p key={provider.source.name}><a href={provider.source.url} target="_blank" rel="noreferrer">{provider.source.name}</a>: {provider.status === "available" ? provider.note || provider.source.attribution || "OK" : "unavailable right now"}</p>)}
        <p>Place ideas are hand-picked; opening hours aren't checked live. Photos are from Wikimedia Commons; each one links to its author and licence.</p>
      </details>}
      <footer className={styles.footer}><Link href="/projects">Back to the portfolio</Link></footer>
    </main>

    <SmartArse topic={selected?.activity.title || group} summon={summon} />
    <ActivityDetails item={selected} onClose={() => setSelected(null)} saved={!!selected && saved.includes(selected.activity.id)} onSave={() => selected && toggleSave(selected.activity)} data={stale ? null : data} surprise={surprise} onAnother={chooseSurprise} />
  </div>;
}
