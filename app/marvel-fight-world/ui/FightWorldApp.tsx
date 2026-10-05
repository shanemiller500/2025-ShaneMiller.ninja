"use client";

/* ------------------------------------------------------------------ */
/*  FightWorldApp: the screen state machine.                            */
/*  Owns settings / favorites / recent and wires every mode together.   */
/*  All per-frame work lives in GameSession / WorldScene, not here.     */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gamepad2, Loader2, RotateCcw } from "lucide-react";

import { trackEvent } from "@/utils/mixpanel";
import { audio } from "../audio/audio";
import type { Difficulty } from "../engine/ai";
import type { FighterDef } from "../engine/types";
import { useFightRoster, type Roster } from "../data/roster";
import {
  DEFAULT_SETTINGS,
  loadFavorites,
  loadRecent,
  loadSettings,
  pushRecent,
  recordMatch,
  recordSurvival,
  recordTournamentWin,
  saveFavorites,
  saveSettings,
  type Settings,
} from "../data/storage";
import type { Controller, MatchSummary } from "../game/session";
import { advance, newBracket, playerBout, type Bracket } from "../game/tournament";
import { ARENAS, type ArenaDef } from "../render/arenas";
import { ZONES } from "../world/zones";
import { ArenaScreen } from "./ArenaScreen";
import { CharacterSheet } from "./CharacterSheet";
import { FightScreen, type FightExit } from "./FightScreen";
import { startPadBridge } from "../input/gamepad";
import { ArcadeButton, ArcadeStyles, Backdrop, PadBtn, cn } from "./kit";
import { SelectScreen } from "./SelectScreen";
import { SettingsScreen } from "./SettingsScreen";
import { StatsScreen } from "./StatsScreen";
import { TitleScreen, type MenuChoice } from "./TitleScreen";
import { TournamentScreen } from "./TournamentScreen";
import { WorldScreen } from "./WorldScreen";

type Mode = "cpu" | "versus" | "random" | "survival" | "tournament" | "world";

interface FightSetup {
  mode: Mode;
  p1: FighterDef;
  p2: FighterDef;
  arena: ArenaDef;
  controllers: [Controller, Controller];
  difficulty: Difficulty;
  banner?: string;
  startHealth?: [number, number];
  /** Bumped to remount the fight (new opponent in survival etc.) */
  key: number;
}

type Screen =
  | { k: "title" }
  | { k: "select"; mode: Mode; initial?: [FighterDef | null, FighterDef | null] }
  | { k: "roster" }
  | { k: "arena"; mode: Mode; p1: FighterDef; p2: FighterDef }
  | { k: "fight"; fight: FightSetup }
  | { k: "tournament" }
  | { k: "world" }
  | { k: "stats" }
  | { k: "settings" };

const SURVIVAL_DIFFICULTY = (n: number): Difficulty => (n < 2 ? "easy" : n < 4 ? "normal" : n < 7 ? "hard" : "insane");
const pickRandom = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function Loading({ error, retry }: { error: string | null; retry: () => void }) {
  return (
    <div className="absolute inset-0 isolate grid place-items-center text-white">
      <Backdrop />
      <div className="text-center">
        <p className="fw-display fw-outline text-6xl font-[650] uppercase">Fight World</p>
        {error ? (
          <div className="mt-6 space-y-4">
            <p className="text-rose-300">{error}</p>
            <ArcadeButton onClick={retry}>
              <RotateCcw className="h-4 w-4" /> Try again
            </ArcadeButton>
          </div>
        ) : (
          <p className="mt-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading roster
          </p>
        )}
      </div>
    </div>
  );
}

export default function FightWorldApp() {
  const { roster, error, retry } = useFightRoster();
  const [padUsed, setPadUsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Controller → UI bridge (menus, overlays). Fights read the pad directly.
  useEffect(() => {
    let hide = 0;
    const show = (msg: string) => {
      setToast(msg);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setToast(null), 3800);
    };
    const stop = startPadBridge({
      onConnect: (name) => {
        setPadUsed(true);
        show(`${name} connected`);
      },
      onDisconnect: () => show("Controller disconnected"),
      onActive: () => setPadUsed(true),
    });
    // Mouse or keyboard use hides the controller focus rings again
    const off = () => setPadUsed(false);
    window.addEventListener("mousemove", off);
    return () => {
      stop();
      window.clearTimeout(hide);
      window.removeEventListener("mousemove", off);
    };
  }, []);

  return (
    <div className={cn("dark fixed inset-0 z-40 select-none overflow-hidden bg-[#05060a] font-sans text-white antialiased", padUsed && "fw-pad")}>
      <ArcadeStyles />
      {roster ? <Game roster={roster} /> : <Loading error={error} retry={retry} />}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="pointer-events-none absolute left-1/2 top-5 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#0b0c14]/90 px-4 py-2.5 shadow-2xl ring-1 ring-emerald-400/40 backdrop-blur"
          >
            <Gamepad2 className="h-5 w-5 text-emerald-300" />
            <span className="text-sm font-semibold">{toast}</span>
            <span className="hidden items-center gap-1.5 text-[12px] text-white/55 sm:flex">
              <PadBtn c="#22c55e">A</PadBtn> select <PadBtn c="#ef4444">B</PadBtn> back <PadBtn c="#94a3b8">☰</PadBtn> pause
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Game({ roster }: { roster: Roster }) {
  const [screen, setScreen] = useState<Screen>({ k: "title" });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [recent, setRecent] = useState<number[]>([]);
  const [sheet, setSheet] = useState<FighterDef | null>(null);
  const [survival, setSurvival] = useState({ streak: 0 });
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [worldPlayer, setWorldPlayer] = useState<FighterDef | null>(null);
  const [worldPos, setWorldPos] = useState<{ zone: string; x: number }>({ zone: ZONES[0].id, x: -900 });

  // Persistence is browser-only: load after mount (SSR-safe)
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    audio.setVolumes(s.sfxVolume, s.musicVolume);
    setFavorites(loadFavorites());
    setRecent(loadRecent());
  }, []);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    audio.setVolumes(s.sfxVolume, s.musicVolume);
  }, []);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f];
      saveFavorites(next);
      return next;
    });
  }, []);

  const home = useCallback(() => {
    audio.stopMusic();
    setScreen({ k: "title" });
  }, []);

  /* ── Starting fights ───────────────────────────────────────────── */
  const startFight = useCallback(
    (f: Omit<FightSetup, "key" | "difficulty" | "controllers"> & Partial<Pick<FightSetup, "difficulty" | "controllers">>) => {
      setScreen({
        k: "fight",
        fight: { controllers: f.mode === "versus" ? ["human", "human"] : ["human", "cpu"], difficulty: settings.difficulty, ...f, key: Date.now() },
      });
      trackEvent("Fight World Match", { mode: f.mode, p1: f.p1.name, p2: f.p2.name, arena: f.arena.name });
    },
    [settings.difficulty]
  );

  const others = useCallback((exclude: number) => roster.fighters.filter((d) => d.id !== exclude), [roster]);

  const startSurvivalBout = useCallback(
    (p1: FighterDef, streak: number, health: number) => {
      startFight({
        mode: "survival",
        p1,
        p2: pickRandom(others(p1.id)),
        arena: pickRandom(ARENAS),
        difficulty: SURVIVAL_DIFFICULTY(streak),
        banner: `Survival · Opponent ${streak + 1}`,
        startHealth: [health, 1],
      });
    },
    [startFight, others]
  );

  const startTournamentBout = useCallback(
    (br: Bracket) => {
      const bout = playerBout(br);
      if (!bout) return;
      const me = roster.byId.get(br.playerId)!;
      const opp = bout.a.id === br.playerId ? bout.b : bout.a;
      startFight({ mode: "tournament", p1: me, p2: opp, arena: pickRandom(ARENAS), difficulty: (["normal", "hard", "insane"] as Difficulty[])[br.current] ?? "hard", banner: ["Quarter-final", "Semi-final", "Grand final"][br.current] });
    },
    [roster, startFight]
  );

  /* ── Menu ──────────────────────────────────────────────────────── */
  const onChoose = useCallback(
    (c: MenuChoice) => {
      trackEvent("Fight World Menu", { choice: c });
      switch (c) {
        case "cpu":
        case "versus":
        case "survival":
        case "tournament":
          setScreen({ k: "select", mode: c });
          break;
        case "world":
          setScreen(worldPlayer ? { k: "world" } : { k: "select", mode: "world" });
          break;
        case "random": {
          const p1 = pickRandom(roster.fighters);
          startFight({ mode: "random", p1, p2: pickRandom(others(p1.id)), arena: pickRandom(ARENAS) });
          break;
        }
        case "roster":
          setScreen({ k: "roster" });
          break;
        case "stats":
          setScreen({ k: "stats" });
          break;
        case "settings":
          setScreen({ k: "settings" });
          break;
      }
    },
    [roster, worldPlayer, startFight, others]
  );

  /* ── Character select confirm ──────────────────────────────────── */
  const onSelect = useCallback(
    (mode: Mode, p1: FighterDef, p2: FighterDef | null) => {
      setRecent(pushRecent(p1.id));
      if (mode === "cpu" || mode === "versus") {
        setScreen({ k: "arena", mode, p1, p2: p2 ?? pickRandom(others(p1.id)) });
      } else if (mode === "survival") {
        setSurvival({ streak: 0 });
        startSurvivalBout(p1, 0, 1);
      } else if (mode === "tournament") {
        const br = newBracket(p1, roster.fighters);
        setBracket(br);
        setScreen({ k: "tournament" });
      } else if (mode === "world") {
        setWorldPlayer(p1);
        setScreen({ k: "world" });
      }
    },
    [others, roster, startSurvivalBout]
  );

  /* ── Match results ─────────────────────────────────────────────── */
  const onMatchOver = useCallback((f: FightSetup, s: MatchSummary) => {
    const me = s.fighters[0];
    const won = s.winner === null ? null : s.winner === 0;
    recordMatch({
      fighterId: f.p1.id,
      fighterName: f.p1.name,
      opponentId: f.p2.id,
      opponentName: f.p2.name,
      won,
      kos: me.kos,
      perfects: me.perfects,
      maxCombo: me.maxCombo,
      fastestKo: won ? s.fastestKo : null,
    });
    if (f.mode === "survival" && !won) {
      setSurvival((sv) => {
        recordSurvival(sv.streak);
        return sv;
      });
    }
  }, []);

  const resultActions = useCallback(
    (f: FightSetup) =>
      (s: MatchSummary): { label: string; action: FightExit; tone?: "primary" | "ghost" | "danger" }[] => {
        const won = s.winner === 0;
        switch (f.mode) {
          case "survival":
            return won
              ? [
                  { label: "Next opponent", action: "continue", tone: "primary" },
                  { label: "Main menu", action: "quit", tone: "ghost" },
                ]
              : [
                  { label: "Try again", action: "changeFighter", tone: "primary" },
                  { label: "Main menu", action: "quit", tone: "ghost" },
                ];
          case "tournament":
            return [{ label: won ? "Advance" : "See the bracket", action: "continue", tone: "primary" }];
          case "world":
            return [
              { label: "Back to the world", action: "continue", tone: "primary" },
              { label: "Rematch", action: "rematch" },
              { label: "Main menu", action: "quit", tone: "ghost" },
            ];
          case "random":
            return [
              { label: "Rematch", action: "rematch", tone: "primary" },
              { label: "Another random fight", action: "newArena" },
              { label: "Main menu", action: "quit", tone: "ghost" },
            ];
          default:
            return [
              { label: "Rematch", action: "rematch", tone: "primary" },
              { label: "Change fighter", action: "changeFighter" },
              { label: "New arena", action: "newArena" },
              { label: "Main menu", action: "quit", tone: "ghost" },
            ];
        }
      },
    []
  );

  const onFightExit = useCallback(
    (f: FightSetup, action: FightExit, s: MatchSummary | null) => {
      if (action === "quit") return home();
      const won = s?.winner === 0;
      switch (f.mode) {
        case "survival":
          if (action === "continue" && s) {
            const streak = survival.streak + 1;
            setSurvival({ streak });
            recordSurvival(streak);
            startSurvivalBout(f.p1, streak, Math.min(1, s.fighters[0].healthLeft + 0.3));
          } else setScreen({ k: "select", mode: "survival", initial: [f.p1, null] });
          return;
        case "tournament":
          if (bracket) {
            const next = advance(bracket, won);
            if (next.result === true) recordTournamentWin();
            setBracket(next);
          }
          setScreen({ k: "tournament" });
          return;
        case "world":
          if (action === "changeFighter") setScreen({ k: "select", mode: "world" });
          else setScreen({ k: "world" });
          return;
        case "random":
          if (action === "newArena") {
            const p1 = pickRandom(roster.fighters);
            startFight({ mode: "random", p1, p2: pickRandom(others(p1.id)), arena: pickRandom(ARENAS) });
          } else setScreen({ k: "select", mode: "cpu" });
          return;
        default:
          if (action === "newArena") setScreen({ k: "arena", mode: f.mode, p1: f.p1, p2: f.p2 });
          else setScreen({ k: "select", mode: f.mode, initial: [f.p1, f.p2] });
      }
    },
    [home, survival.streak, startSurvivalBout, bracket, roster, startFight, others]
  );

  /* ── Character sheet actions ───────────────────────────────────── */
  const fightAs = useCallback(
    (d: FighterDef) => {
      setSheet(null);
      if (screen.k === "world") setWorldPlayer(d);
      else setScreen({ k: "select", mode: "cpu", initial: [d, null] });
    },
    [screen.k]
  );
  const fightAgainst = useCallback(
    (d: FighterDef) => {
      setSheet(null);
      if (screen.k === "world" && worldPlayer) {
        const zone = ZONES.find((z) => z.id === worldPos.zone) ?? ZONES[0];
        startFight({ mode: "world", p1: worldPlayer, p2: d, arena: zone.arena });
      } else setScreen({ k: "select", mode: "cpu", initial: [null, d] });
    },
    [screen.k, worldPlayer, worldPos.zone, startFight]
  );

  const back = useCallback(() => setScreen({ k: "title" }), []);
  const selectCopy: Record<Mode, { title: string; picks: 1 | 2; p2: string; confirm?: string }> = {
    cpu: { title: "Quick Fight", picks: 2, p2: "CPU" },
    versus: { title: "Local Versus", picks: 2, p2: "Player 2" },
    random: { title: "Quick Fight", picks: 2, p2: "CPU" },
    survival: { title: "Survival", picks: 1, p2: "Gauntlet", confirm: "Start survival" },
    tournament: { title: "Tournament", picks: 1, p2: "Bracket", confirm: "Enter tournament" },
    world: { title: "Fight World", picks: 1, p2: "The city", confirm: "Explore" },
  };

  let body: React.ReactNode = null;
  switch (screen.k) {
    case "title":
      body = <TitleScreen roster={roster} settings={settings} onChoose={onChoose} />;
      break;
    case "select": {
      const c = selectCopy[screen.mode];
      const mode = screen.mode;
      body = (
        <SelectScreen
          key={`${mode}-${screen.initial?.map((d) => d?.id).join("-")}`}
          roster={roster}
          title={c.title}
          picks={c.picks}
          p2Label={c.p2}
          confirmLabel={c.confirm}
          favorites={favorites}
          recent={recent}
          initial={screen.initial}
          onToggleFavorite={toggleFavorite}
          onView={setSheet}
          onBack={back}
          onConfirm={(p1, p2) => onSelect(mode, p1, p2)}
        />
      );
      break;
    }
    case "roster":
      body = (
        <SelectScreen
          roster={roster}
          title="Character Files"
          picks={1}
          p2Label="Files"
          confirmLabel="Fight as"
          favorites={favorites}
          recent={recent}
          onToggleFavorite={toggleFavorite}
          onView={setSheet}
          onBack={back}
          onConfirm={(p1) => setScreen({ k: "select", mode: "cpu", initial: [p1, null] })}
        />
      );
      break;
    case "arena":
      body = (
        <ArenaScreen
          p1={screen.p1}
          p2={screen.p2}
          onBack={() => setScreen({ k: "select", mode: screen.mode, initial: [screen.p1, screen.p2] })}
          onPick={(arena) => startFight({ mode: screen.mode, p1: screen.p1, p2: screen.p2, arena })}
        />
      );
      break;
    case "fight": {
      const f = screen.fight;
      body = (
        <FightScreen
          key={f.key}
          p1={f.p1}
          p2={f.p2}
          arena={f.arena}
          controllers={f.controllers}
          difficulty={f.difficulty}
          settings={settings}
          startHealth={f.startHealth}
          banner={f.banner}
          onMatchOver={(s) => onMatchOver(f, s)}
          resultActions={resultActions(f)}
          onExit={(a, s) => onFightExit(f, a, s)}
        />
      );
      break;
    }
    case "tournament":
      body = bracket && (
        <TournamentScreen
          bracket={bracket}
          onFight={() => startTournamentBout(bracket)}
          onBack={back}
          onNew={() => setScreen({ k: "select", mode: "tournament", initial: [roster.byId.get(bracket.playerId) ?? null, null] })}
        />
      );
      break;
    case "world":
      body = worldPlayer && (
        <WorldScreen
          roster={roster}
          settings={settings}
          player={worldPlayer}
          zoneId={worldPos.zone}
          x={worldPos.x}
          onMove={(zone, x) => setWorldPos({ zone, x })}
          onFight={(opp, arena) => startFight({ mode: "world", p1: worldPlayer, p2: opp, arena })}
          onView={setSheet}
          onChangeFighter={() => setScreen({ k: "select", mode: "world", initial: [worldPlayer, null] })}
          onBack={home}
          frozen={!!sheet}
        />
      );
      break;
    case "stats":
      body = <StatsScreen roster={roster} onBack={back} />;
      break;
    case "settings":
      body = <SettingsScreen settings={settings} onChange={updateSettings} onBack={back} />;
      break;
  }

  const screenKey = screen.k === "fight" ? `fight-${screen.fight.key}` : screen.k === "select" ? `select-${screen.mode}` : screen.k;

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={screenKey} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {body}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {sheet && (
          <CharacterSheet
            key={sheet.id}
            def={sheet}
            hero={roster.heroes.get(sheet.id)}
            onClose={() => setSheet(null)}
            onFightAs={screen.k === "fight" ? undefined : fightAs}
            onFightAgainst={screen.k === "fight" || (screen.k === "world" && !worldPlayer) ? undefined : fightAgainst}
          />
        )}
      </AnimatePresence>
    </>
  );
}
