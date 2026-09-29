"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { Recommendation } from "../lib/types";
import ActivityVisual from "./ActivityVisual";
import styles from "../day-out.module.css";

// The pick and pitch are chosen server-side (OpenAI when configured, top-ranked otherwise).
type Pick = { recommendation: Recommendation | null; assisted: boolean; pitch?: string; tips?: string[] };
const CHOICES = ["Anything good", "A motorbike ride", "War history", "Live music", "Camping trip"];

export default function AiPick({ onOpen }: { onOpen: (item: Recommendation) => void }) {
  const [choice, setChoice] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(preference: string) {
    setChoice(preference); setBusy(true); setError("");
    try {
      const response = await fetch("/api/day-out/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preference }), signal: AbortSignal.timeout(26000) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "unavailable");
      setPick(body);
    } catch (reason) { setError(reason instanceof Error && reason.message !== "unavailable" ? reason.message : "Shazz is having a smoko. Try again shortly."); }
    finally { setBusy(false); }
  }

  const item = pick?.recommendation;
  return <section className={styles.aiPanel} aria-labelledby="pick-title">
    <h2 id="pick-title" className={styles.aiHead}>Can't decide? Let Shazz pick</h2>
    <div className={styles.aiChoices}>
      {CHOICES.map(value => <button key={value} disabled={busy} aria-pressed={choice === value} onClick={() => ask(value)}>{value}</button>)}
    </div>
    {busy && <p className={styles.small} role="status">Checking today's weather and notices…</p>}
    {error && <p className={styles.small} role="status">{error}</p>}
    {pick && !busy && (item ? <div className={styles.aiResult}>
      <button className={styles.aiCard} onClick={() => onOpen(item)}>
        <ActivityVisual activity={item.activity} />
        <span><strong>{item.activity.title}</strong>{item.activity.suburb} · {item.activity.region}<em>Open it <ArrowRight size={16} aria-hidden /></em></span>
      </button>
      <div>
        <p className={styles.aiPitch}>{pick.assisted && pick.pitch ? `“${pick.pitch}”` : item.reason}</p>
        {!!pick.tips?.length && <ul className={styles.aiTips}>{pick.tips.map(tip => <li key={tip}><Check size={16} aria-hidden />{tip}</li>)}</ul>}
      </div>
    </div> : <p className={styles.small}>Nothing strong for “{choice}” right now. Try another.</p>)}
  </section>;
}
