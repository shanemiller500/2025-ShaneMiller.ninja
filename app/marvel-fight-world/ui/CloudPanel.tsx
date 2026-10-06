"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Cloud, KeyRound, LogOut, Mail, Play, Save, Trophy, UserRound, X } from "lucide-react";
import type { EmailCloud } from "@/utils/firebase/useEmailCloud";
import { HumanCheck, humanCheckOn } from "@/utils/firebase/HumanCheck";
import type { FightMeta } from "../data/cloud";
import { cleanName, validName } from "../data/storage";
import { ArcadeButton } from "./kit";

const ago = (d: Date | null) => {
  if (!d) return "a while ago";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return d.toLocaleDateString();
};

function Shell({ kicker, title, onClose, children }: { kicker: string; title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0 z-[55] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <motion.div
        role="dialog"
        data-pad-menu
        aria-modal="true"
        aria-labelledby="fw-cloud"
        initial={{ y: 30, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#0b0c14] p-6 text-white shadow-[0_30px_80px_-20px_rgba(34,211,238,0.35)] ring-1 ring-cyan-300/30"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-sky-500 to-indigo-500" />
        {onClose && (
          <button type="button" aria-label="Close" data-pad-back onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300">{kicker}</p>
        <h2 id="fw-cloud" className="fw-display mt-1 text-4xl font-[650] uppercase leading-none">
          {title}
        </h2>
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * All of Fight World's cloud-save popups, driven by `cloud.state.view`:
 * welcome · loadEmail · saveEmail · finish · offer · account · leave.
 */
export function CloudPanel({ cloud, hasLocal, name, onName }: { cloud: EmailCloud<FightMeta>; hasLocal: boolean; name: string; onName: (n: string) => void }) {
  const { state } = cloud;
  const view = state.view;
  const [email, setEmail] = useState(state.draftEmail || state.email || "");
  const [fighterName, setFighterName] = useState(name);
  const [nameError, setNameError] = useState<string | null>(null);
  // reCAPTCHA token (single-use: the widget remounts after every attempt)
  const [human, setHuman] = useState<string | null>(null);
  const [humanKey, setHumanKey] = useState(0);
  useEffect(() => setFighterName(name), [name]);
  useEffect(() => {
    if (state.draftEmail) setEmail(state.draftEmail);
  }, [state.draftEmail]);
  const locked = view === "offer" || view === "finish";
  const close = locked ? undefined : view === "welcome" ? cloud.skip : () => cloud.show(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && close) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const error = state.error && <p className="mt-4 rounded-lg bg-rose-500/15 p-2.5 text-[13px] font-semibold text-rose-200 ring-1 ring-rose-400/30">⚠ {state.error}</p>;
  const emailField = (autoFocus: boolean) => (
    <label className="mt-4 flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-cyan-300">
      <Mail className="h-4 w-4 text-white/50" />
      <input
        type="email"
        required
        autoFocus={autoFocus}
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-white/30"
      />
    </label>
  );
  const field = emailField(true);
  const nameField = (
    <>
      <label className="mt-4 flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-amber-300">
        <UserRound className="h-4 w-4 text-white/50" />
        <input
          type="text"
          required
          maxLength={20}
          autoComplete="nickname"
          autoFocus={!name}
          placeholder="Fighter name (shown on the leaderboard)"
          value={fighterName}
          onChange={(e) => {
            setFighterName(e.target.value);
            setNameError(null);
          }}
          className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-white/30"
        />
      </label>
      {nameError && <p className="mt-2 text-[12px] font-semibold text-rose-300">{nameError}</p>}
    </>
  );
  /** Validate + store the name; false when it isn't usable yet. */
  const commitName = () => {
    const n = cleanName(fighterName);
    if (!validName(n)) {
      setNameError("Pick a name: 2–20 letters, numbers or spaces.");
      return false;
    }
    onName(n);
    return true;
  };
  const emailForm = (intent: "load" | "save", cta: string) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (intent === "save" && !commitName()) return;
        void cloud.sendLink(email, intent, human).then((ok) => {
          if (!ok) {
            setHuman(null);
            setHumanKey((k) => k + 1);
          }
        });
      }}
    >
      {intent === "save" && nameField}
      {intent === "save" ? emailField(!!name) : field}
      {intent === "save" && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-white/45">
          <Trophy className="mt-px h-3.5 w-3.5 shrink-0 text-amber-300/70" /> Your name goes on the global leaderboard with your wins, streaks and main fighter. Your email is never shown.
        </p>
      )}
      <HumanCheck key={humanKey} onToken={setHuman} className="mt-4" />
      <ArcadeButton tone="cyan" className="mt-4 w-full" type="submit" disabled={state.saving || (humanCheckOn && !human)}>
        {state.saving ? "Sending…" : humanCheckOn && !human ? "Tick the box above to continue" : cta}
      </ArcadeButton>
    </form>
  );
  const textBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="mt-3 w-full py-1.5 text-center text-sm font-semibold text-white/55 hover:text-white">
      {label}
    </button>
  );

  switch (view) {
    case "welcome":
      return (
        <Shell kicker="Welcome, fighter" title="Played before?" onClose={close}>
          <p className="mt-3 text-sm text-white/70">Load your saved stats, records and favourites from your email — or jump straight in.</p>
          <div className="mt-5 flex flex-col gap-2">
            <ArcadeButton tone="cyan" onClick={() => cloud.show("loadEmail")}>
              <KeyRound className="h-4 w-4" /> Load my saved progress
            </ArcadeButton>
            <ArcadeButton tone="ghost" onClick={cloud.skip}>
              <Play className="h-4 w-4" /> {hasLocal ? "Keep playing here" : "Start fresh"}
            </ArcadeButton>
          </div>
        </Shell>
      );
    case "loadEmail":
      return (
        <Shell kicker="Cloud save" title="Load progress" onClose={close}>
          <p className="mt-3 text-sm text-white/70">Type the email you saved with. We&apos;ll send a one-time link — open it and your progress loads right here.</p>
          {state.error && <p className="mt-3 rounded-lg bg-amber-400/10 p-2.5 text-[13px] font-semibold text-amber-200 ring-1 ring-amber-300/25">{state.error}</p>}
          {emailForm("load", "Email me my link")}
          {textBtn("Never mind, just play", cloud.skip)}
        </Shell>
      );
    case "saveEmail":
      return (
        <Shell kicker="Save & join the leaderboard" title="Save progress?" onClose={close}>
          <p className="mt-3 text-sm text-white/70">Add your fighter name and email: your stats, records and settings save to the cloud automatically, and you join the global leaderboard. Play on any device. No password.</p>
          {error}
          {emailForm("save", "Save my progress")}
          {textBtn("Not now", cloud.skip)}
        </Shell>
      );
    case "finish":
      return (
        <Shell kicker="One more step" title="Confirm email">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void cloud.finishWithEmail(email);
            }}
          >
            <p className="mt-3 text-sm text-white/70">You opened your link on a different device or browser — type the same email to finish signing in.</p>
            {field}
            <ArcadeButton tone="cyan" className="mt-4 w-full" type="submit" disabled={state.status === "signingIn"}>
              {state.status === "signingIn" ? "Signing in…" : "Finish signing in"}
            </ArcadeButton>
          </form>
          {textBtn("Send a new link instead", () => cloud.show("loadEmail"))}
        </Shell>
      );
    case "offer":
      return state.offer ? (
        <Shell kicker="Welcome back" title="Load your save?">
          <p className="mt-3 text-sm text-white/70">
            Saved progress for <b className="text-white">{state.email}</b> · {ago(state.offer.savedAt)}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Matches", state.offer.meta.matches],
              ["Wins", state.offer.meta.wins],
              ["KOs", state.offer.meta.knockouts],
              ["Titles", state.offer.meta.tournamentWins],
              ["Survival", state.offer.meta.survivalBest],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/[0.05] py-2 ring-1 ring-white/10">
                <div className="fw-display text-2xl font-[650]">{v}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/50">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <ArcadeButton tone="cyan" onClick={cloud.acceptOffer}>
              <Cloud className="h-4 w-4" /> Yes, load it
            </ArcadeButton>
            <ArcadeButton tone="ghost" size="sm" onClick={cloud.declineOffer}>
              No, keep this browser&apos;s progress
            </ArcadeButton>
          </div>
          <p className="mt-2 text-[11px] text-white/45">Keeping this browser&apos;s progress makes it your new cloud save.</p>
        </Shell>
      ) : null;
    case "account":
      return (
        <Shell kicker="Cloud save" title="You're synced" onClose={close}>
          <p className="mt-3 text-sm text-white/70">
            Signed in as <b className="text-white">{state.email}</b>
          </p>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              commitName();
            }}
          >
            <div className="min-w-0 flex-1">{nameField}</div>
            <ArcadeButton tone={cleanName(fighterName) === name && name ? "ghost" : "gold"} size="sm" type="submit" className="mb-0.5">
              {name ? "Rename" : "Set name"}
            </ArcadeButton>
          </form>
          {!name && <p className="mt-2 text-[12px] font-semibold text-amber-200">Set a fighter name to appear on the global leaderboard.</p>}
          <div className="mt-3 rounded-lg bg-emerald-400/10 p-3 text-[13px] font-semibold text-emerald-200 ring-1 ring-emerald-300/25">
            {state.saving ? "Saving…" : `✔ Last saved ${state.lastSaved ? ago(state.lastSaved) : "— saving soon"}`}
            <span className="block text-[11px] font-medium text-emerald-200/70">Saves after every match, every minute and when you leave.</span>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <ArcadeButton
              tone="cyan"
              disabled={state.saving}
              onClick={() => {
                void cloud.saveNow();
                cloud.show(null);
              }}
            >
              <Save className="h-4 w-4" /> Save now
            </ArcadeButton>
            <ArcadeButton tone="ghost" size="sm" onClick={() => void cloud.signOut()}>
              <LogOut className="h-4 w-4" /> Sign out · switch player
            </ArcadeButton>
          </div>
          {error}
        </Shell>
      );
    case "leave":
      return (
        <Shell kicker="Before you go" title="Save progress?" onClose={close}>
          <p className="mt-3 text-sm text-white/70">Your stats and records are only in this browser. Add an email to keep them safe and play anywhere.</p>
          {error}
          {emailForm("save", "Save & leave")}
          <ArcadeButton tone="ghost" size="sm" className="mt-3 w-full" onClick={cloud.leaveAnyway}>
            Leave without saving
          </ArcadeButton>
          {textBtn("Keep playing", () => cloud.show(null))}
        </Shell>
      );
    default:
      return null;
  }
}

/** Small status chip for the title screen. */
export function CloudChip({ cloud }: { cloud: EmailCloud<FightMeta> }) {
  const s = cloud.state;
  if (s.status === "off") return null;
  const on = s.status === "signedIn";
  return (
    <button
      type="button"
      onClick={() => cloud.show(on ? "account" : "welcome")}
      className="absolute right-5 top-5 z-10 inline-flex max-w-[60vw] items-center gap-2 rounded-xl bg-black/45 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/10 hover:text-white"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" : s.status === "linkSent" ? "bg-amber-400" : "bg-white/40"}`} />
      <Cloud className="h-4 w-4 shrink-0" />
      <span className="truncate">{on ? s.email : s.status === "linkSent" ? "Check your email" : "Save progress"}</span>
    </button>
  );
}
