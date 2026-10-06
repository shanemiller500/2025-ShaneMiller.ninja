"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { EmailCloud } from "@/utils/firebase/useEmailCloud";
import { HumanCheck, humanCheckOn } from "@/utils/firebase/HumanCheck";
import type { DinoMeta } from "../cloud/cloud";

const ago = (d: Date | null) => {
  if (!d) return "a while ago";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return d.toLocaleDateString();
};

/**
 * Every cloud-save popup for Dinosaur Land, driven by `cloud.state.view`:
 * welcome · loadEmail · saveEmail · finish · offer · account · leave.
 */
export default function CloudPanel({ cloud, fontClass, hasLocal }: { cloud: EmailCloud<DinoMeta>; fontClass: string; hasLocal: boolean }) {
  const { state } = cloud;
  const view = state.view;
  const [email, setEmail] = useState(state.draftEmail || state.email || "");
  // reCAPTCHA token (single-use: the widget remounts after every attempt)
  const [human, setHuman] = useState<string | null>(null);
  const [humanKey, setHumanKey] = useState(0);
  useEffect(() => {
    if (state.draftEmail) setEmail(state.draftEmail);
  }, [state.draftEmail]);

  const btn = "w-full rounded-2xl px-4 py-3 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-50";
  const primary = `${btn} bg-sky-500 text-white hover:bg-sky-600`;
  const quiet = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15`;
  // these must be answered (no closing by clicking outside)
  const locked = view === "offer" || view === "finish";

  const emailForm = (intent: "load" | "save", cta: string) => (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void cloud.sendLink(email, intent, human).then((ok) => {
          if (!ok) {
            setHuman(null);
            setHumanKey((k) => k + 1);
          }
        });
      }}
    >
      <input
        type="email"
        required
        autoFocus
        inputMode="email"
        autoComplete="email"
        placeholder="grown-up's email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-sky-400 dark:border-white/10 dark:bg-white/5"
      />
      <HumanCheck key={humanKey} onToken={setHuman} theme="light" className="mt-3" />
      <button type="submit" disabled={state.saving || (humanCheckOn && !human)} className={`${primary} mt-3`}>
        {state.saving ? "Sending…" : humanCheckOn && !human ? "Tick the box above first" : cta}
      </button>
    </form>
  );

  return (
    <Modal open={!!view} onClose={() => (locked ? undefined : cloud.show(null))} hideClose={locked} size="sm" accent="#38bdf8" labelledBy="dl-cloud">
      <div className={`p-6 text-slate-800 dark:text-slate-100 ${fontClass}`}>
        {view === "welcome" && (
          <>
            <div className="text-4xl">🦕</div>
            <h2 id="dl-cloud" className="mt-2 text-xl font-bold">
              Welcome to Dinosaur Land!
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Have you played before and saved your world to an email?</p>
            <button type="button" onClick={() => cloud.show("loadEmail")} className={`${primary} mt-4`}>
              🔑 Yes — load my saved game
            </button>
            <button type="button" onClick={() => cloud.show("saveEmail")} className={`${quiet} mt-2`}>
              {hasLocal ? "▶️ No — keep playing here" : "🆕 No — start a new game"}
            </button>
          </>
        )}

        {view === "loadEmail" && (
          <>
            <div className="text-4xl">🔑</div>
            <h2 id="dl-cloud" className="mt-2 text-xl font-bold">
              Load your saved game
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Type the email you saved with. We&apos;ll send a magic link — tap it and your world loads right here.</p>
            {state.error && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-[13px] font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{state.error}</p>}
            {emailForm("load", "✉️ Email me my link")}
            <button type="button" onClick={cloud.skip} className="mt-2 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">
              Never mind, just play
            </button>
          </>
        )}

        {view === "saveEmail" && (
          <>
            <div className="text-4xl">☁️</div>
            <h2 id="dl-cloud" className="mt-2 text-xl font-bold">
              Save your progress? <span className="text-sm font-semibold text-slate-400">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add an email and your world saves to the cloud by itself — come back on any device. No password.</p>
            {state.error && <p className="mt-3 rounded-xl bg-rose-50 p-2.5 text-[13px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">⚠️ {state.error}</p>}
            {emailForm("save", "✉️ Save my progress")}
            <button type="button" onClick={cloud.skip} className="mt-2 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">
              Not now
            </button>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">Kids: ask a grown-up to use their email. We only use it to keep your world safe.</p>
          </>
        )}

        {view === "finish" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void cloud.finishWithEmail(email);
            }}
          >
            <div className="text-4xl">✅</div>
            <h2 id="dl-cloud" className="mt-2 text-xl font-bold">
              One more step
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">You opened your link on a different device or browser — type the same email to finish signing in.</p>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-sky-400 dark:border-white/10 dark:bg-white/5"
            />
            <button type="submit" disabled={state.status === "signingIn"} className={`${primary} mt-3`}>
              {state.status === "signingIn" ? "Signing in…" : "Finish signing in"}
            </button>
            <button type="button" onClick={() => cloud.show("loadEmail")} className="mt-2 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">
              Send a new link instead
            </button>
          </form>
        )}

        {view === "offer" && state.offer && (
          <>
            <div className="text-4xl">🎉</div>
            <h2 id="dl-cloud" className="mt-2 text-xl font-bold">
              Welcome back!
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Load your saved game for <b>{state.email}</b>?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-sky-50 p-3 text-[13px] font-semibold dark:bg-sky-400/10">
              <span>📅 Day {state.offer.meta.day}</span>
              <span>🕐 {ago(state.offer.savedAt)}</span>
              <span>🦖 {state.offer.meta.dinos} dinos</span>
              <span>🧔 {state.offer.meta.people} people</span>
              <span>🏕️ {state.offer.meta.level}</span>
              <span>🏆 {state.offer.meta.stickers} stickers</span>
            </div>
            <button type="button" onClick={cloud.acceptOffer} className={`${primary} mt-4`}>
              🦕 Yes, load my saved game
            </button>
            <button type="button" onClick={cloud.declineOffer} className={`${quiet} mt-2`}>
              No, keep this world
            </button>
            <p className="mt-2 text-[11px] text-slate-400">Keeping this world makes it your new cloud save.</p>
          </>
        )}

        {view === "account" && (
          <>
            <div className="text-4xl">☁️</div>
            <h2 id="dl-cloud" className="mt-2 text-xl font-bold">
              Cloud save is on
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Signed in as <b>{state.email}</b>
            </p>
            <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
              {state.saving ? "⏳ Saving…" : `✅ Last saved ${state.lastSaved ? ago(state.lastSaved) : "— saving soon"}`}
              <span className="block text-[11px] font-medium opacity-75">Saves by itself every minute and whenever you leave.</span>
            </div>
            <button
              type="button"
              disabled={state.saving}
              onClick={() => {
                void cloud.saveNow();
                cloud.show(null);
              }}
              className={`${primary} mt-3`}
            >
              ☁️ Save now
            </button>
            <button type="button" onClick={() => void cloud.signOut()} className={`${quiet} mt-2`}>
              👋 Sign out (switch player)
            </button>
            {state.error && <p className="mt-3 rounded-xl bg-rose-50 p-2.5 text-[13px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">⚠️ {state.error}</p>}
          </>
        )}

        {view === "leave" && (
          <>
            <div className="text-4xl">🦖</div>
            <h2 id="dl-cloud" className="mt-2 text-xl font-bold">
              Save your world before you go?
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">It&apos;s only saved in this browser right now. Add an email to keep it safe and play it anywhere.</p>
            {state.error && <p className="mt-3 rounded-xl bg-rose-50 p-2.5 text-[13px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">⚠️ {state.error}</p>}
            {emailForm("save", "✉️ Save & leave")}
            <button type="button" onClick={cloud.leaveAnyway} className={`${quiet} mt-2`}>
              Leave without saving
            </button>
            <button type="button" onClick={() => cloud.show(null)} className="mt-2 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">
              Keep playing
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
