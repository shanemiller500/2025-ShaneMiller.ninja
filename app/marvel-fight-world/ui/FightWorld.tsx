"use client";

/* ------------------------------------------------------------------ */
/*  Fight World root: screens, game modes, saves and audio lifecycle    */
/* ------------------------------------------------------------------ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InputManager } from "../engine/input";
import { simulateMatch } from "../engine/sim";
import type { FighterDef } from "../engine/types";
import { audioReady, playMusic, setVolumes, stinger, stopMusic, unlockAudio } from "../audio/audio";
import { ARENAS, type ArenaDef } from "../render/arenas";
import { loadRoster, type Roster } from "../data/roster";
import { loadSave, pushRecent, recordMatch, resetStats, writeSave, type Save, type Settings } from "../data/storage";
import ArenaSelect from "./ArenaSelect";
import Attract from "./Attract";
import Bracket, { opponentOf, type TournamentState } from "./Bracket";
import CharacterDetail from "./CharacterDetail";
import CharacterSelect from "./CharacterSelect";
import FightScreen, { type FightOutcome, type FightSetup } from "./FightScreen";
import Leaderboard from "./Leaderboard";
import SettingsPanel from "./SettingsPanel";
import WorldMode, { type WorldState } from "./WorldMode";
import { ArcadeButton, Portrait } from "./shared";
import css from "./fight-world.module.css";

type Mode = "quick" | "cpu" | "versus" | "random" | "survival" | "tournament" | "world" | "browse";
type Screen = "title" | "select" | "arena" | "fight" | "leaderboard" | "settings" | "world" | "bracket";

interface SurvivalState {
  fighter: FighterDef;
  wins: number;
  health: number;
  seen: number[];
}

const pickRandom = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function FightWorld() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [save, setSave] = useState<Save | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const [mode, setMode] = useState<Mode>("quick");
  const [picks, setPicks] = useState<[FighterDef | null, FighterDef | null]>([null, null]);
  const [cpu, setCpu] = useState<[boolean, boolean]>([false, true]);
  const [arena, setArena] = useState<ArenaDef>(ARENAS[0]);
  const [setup, setSetup] = useState<FightSetup | null>(null);
  const [matchKey, setMatchKey] = useState(1);
  const [outcome, setOutcome] = useState<FightOutcome | null>(null);
  const [detail, setDetail] = useState<{ f: FighterDef; compare?: FighterDef | null } | null>(null);
  const [survival, setSurvival] = useState<SurvivalState | null>(null);
  const [tourney, setTourney] = useState<TournamentState | null>(null);
  const [world, setWorld] = useState<WorldState & { player: FighterDef | null }>({ x: 400, seed: 1, player: null });

  const input = useMemo(() => new InputManager(), []);
  const saveRef = useRef<Save | null>(null);
  saveRef.current = save;

  /* ── Boot: roster + save ─────────────────────────────────────────── */
  useEffect(() => {
    loadRoster().then(setRoster);
    const s = loadSave();
    setSave(s);
    input.setBindings(s.settings.bindings);
    setWorld((w) => ({ ...w, seed: Math.floor(Math.random() * 1e6) }));
    input.attach();
    return () => {
      input.detach();
      stopMusic();
    };
  }, [input]);

  const updateSave = useCallback((fn: (s: Save) => Save) => {
    setSave((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      writeSave(next);
      return next;
    });
  }, []);

  const settings = save?.settings;
  useEffect(() => {
    if (!settings) return;
    input.setBindings(settings.bindings);
    setVolumes(settings.sfx, settings.music);
  }, [settings, input]);

  /* ── Audio: unlock on the first gesture, menu/world music ─────────── */
  useEffect(() => {
    const unlock = () => {
      const fresh = !audioReady();
      unlockAudio();
      const s = saveRef.current?.settings;
      if (s) setVolumes(s.sfx, s.music);
      if (fresh && screen !== "fight") playMusic(screen === "world" ? "world" : "menu", 118);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [screen]);

  useEffect(() => {
    if (!audioReady() || screen === "fight") return;
    playMusic(screen === "world" ? "world" : "menu", screen === "world" ? 112 : 118);
  }, [screen]);

  /* ── Flow helpers ────────────────────────────────────────────────── */
  const startFight = useCallback(
    (p1: FighterDef, p2: FighterDef, a: ArenaDef, cpuSides: [boolean, boolean], extra: Partial<FightSetup> = {}) => {
      const s = saveRef.current!.settings;
      setSetup({ p1, p2, cpu: cpuSides, arena: a, difficulty: s.difficulty, rounds: s.rounds, ...extra });
      setOutcome(null);
      setMatchKey((k) => k + 1);
      setScreen("fight");
      updateSave((sv) => {
        let n = sv;
        if (!cpuSides[0]) n = pushRecent(n, p1.id);
        if (!cpuSides[1]) n = pushRecent(n, p2.id);
        return n;
      });
    },
    [updateSave]
  );

  const beginMode = (m: Mode) => {
    if (!roster) return;
    setMode(m);
    setDetail(null);
    const fs = roster.fighters;
    switch (m) {
      case "quick":
        setCpu([false, true]);
        setScreen("select");
        break;
      case "cpu":
        setCpu([false, true]);
        setScreen("select");
        break;
      case "versus":
        setCpu([false, false]);
        setScreen("select");
        break;
      case "random": {
        const a = pickRandom(fs);
        let b = pickRandom(fs);
        if (b.id === a.id) b = fs[(fs.indexOf(a) + 1) % fs.length];
        setPicks([a, b]);
        setCpu([false, true]);
        const ar = pickRandom(ARENAS);
        setArena(ar);
        startFight(a, b, ar, [false, true]);
        break;
      }
      case "survival":
      case "tournament":
      case "world":
      case "browse":
        setCpu([false, true]);
        setScreen("select");
        break;
    }
  };

  /* Survival: next opponent with carried-over health */
  const nextSurvival = (sv: SurvivalState) => {
    const pool = roster!.fighters.filter((f) => f.id !== sv.fighter.id && !sv.seen.includes(f.id));
    const featured = pool.filter((f) => f.custom);
    const opp = sv.wins < 4 && featured.length ? pickRandom(featured) : pickRandom(pool.length ? pool : roster!.fighters);
    const ar = pickRandom(ARENAS);
    setArena(ar);
    setPicks([sv.fighter, opp]);
    setSurvival({ ...sv, seen: [...sv.seen, opp.id] });
    startFight(sv.fighter, opp, ar, [false, true], { rounds: 1, startHealth: [sv.health, 1], label: `SURVIVAL — FIGHT ${sv.wins + 1}` });
  };

  /* Tournament: simulate the CPU-only pairs of the current round */
  const advanceBracket = (t: TournamentState, playerWon: boolean | null): TournamentState => {
    const round = t.rounds[t.rounds.length - 1];
    const winners: FighterDef[] = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i];
      const b = round[i + 1];
      if (a.id === t.playerId || b.id === t.playerId) {
        const me = a.id === t.playerId ? a : b;
        const them = a.id === t.playerId ? b : a;
        winners.push(playerWon ? me : them);
      } else {
        winners.push(simulateMatch(a, b, (a.id * 31 + b.id) % 9973) === 0 ? a : b);
      }
    }
    let next: TournamentState = { ...t, rounds: [...t.rounds, winners], eliminated: t.eliminated || playerWon === false };
    // Once the player is out, play the rest of the bracket instantly
    while (next.eliminated && next.rounds[next.rounds.length - 1].length > 1) next = advanceBracket(next, null);
    return next;
  };

  const playTournamentMatch = () => {
    if (!tourney) return;
    const opp = opponentOf(tourney);
    const me = roster!.byId.get(tourney.playerId)!;
    if (!opp) return;
    const ar = pickRandom(ARENAS);
    setPicks([me, opp]);
    const labels = ["QUARTER-FINAL", "SEMI-FINAL", "FINAL"];
    startFight(me, opp, ar, [false, true], { rounds: 1, label: `TOURNAMENT ${labels[tourney.rounds.length - 1] ?? ""}` });
  };

  /* After select */
  const onSelected = (p1: FighterDef, p2: FighterDef | null) => {
    if (!roster) return;
    const fs = roster.fighters;
    setPicks([p1, p2]);
    switch (mode) {
      case "survival": {
        const sv = { fighter: p1, wins: 0, health: 1, seen: [] as number[] };
        setSurvival(sv);
        nextSurvival(sv);
        break;
      }
      case "tournament": {
        const others = fs.filter((f) => f.id !== p1.id);
        const featured = others.filter((f) => f.custom).sort(() => Math.random() - 0.5);
        const rest = others.filter((f) => !f.custom).sort(() => Math.random() - 0.5);
        const field = [p1, ...featured.slice(0, 4), ...rest].slice(0, 8).sort(() => Math.random() - 0.5);
        setTourney({ rounds: [field], playerId: p1.id, eliminated: false });
        setScreen("bracket");
        break;
      }
      case "world":
        setWorld((w) => ({ ...w, player: p1, x: 400 }));
        setScreen("world");
        break;
      case "browse":
        setDetail({ f: p1 });
        break;
      default:
        setScreen("arena");
    }
  };

  /* Match finished */
  const onEnd = (o: FightOutcome) => {
    setOutcome(o);
    if (setup) {
      updateSave((s) =>
        recordMatch(s, {
          ids: [setup.p1.id, setup.p2.id],
          names: [setup.p1.name, setup.p2.name],
          human: [!setup.cpu[0], !setup.cpu[1]],
          winner: o.winner,
          kos: o.kos,
          perfects: o.perfects,
          maxCombo: o.maxCombo,
          fastestKo: o.fastestKo,
        })
      );
    }
    if (mode === "survival" && survival && o.winner !== 0) {
      updateSave((s) => ({ ...s, stats: { ...s.stats, survivalBest: Math.max(s.stats.survivalBest, survival.wins) } }));
    }
    if (mode === "tournament" && tourney) {
      const next = advanceBracket(tourney, o.winner === 0);
      setTourney(next);
      const champ = next.rounds[next.rounds.length - 1];
      if (champ.length === 1 && champ[0].id === next.playerId) updateSave((s) => ({ ...s, stats: { ...s.stats, tournamentsWon: s.stats.tournamentsWon + 1 } }));
    }
  };

  const toTitle = () => {
    setScreen("title");
    setSetup(null);
    setOutcome(null);
    setSurvival(null);
  };

  /* Fight as / against from a profile */
  const fightAs = (f: FighterDef) => {
    setDetail(null);
    setMode("cpu");
    setCpu([false, true]);
    setPicks([f, null]);
    setScreen("select");
  };
  const fightAgainst = (f: FighterDef) => {
    setDetail(null);
    setMode("cpu");
    setCpu([false, true]);
    setPicks([null, f]);
    setScreen("select");
  };

  /* ── Render ──────────────────────────────────────────────────────── */
  if (!roster || !save || !settings) {
    return (
      <div className={css.root}>
        <div className={css.backdrop} />
        <div className="relative flex h-full flex-col items-center justify-center gap-3">
          <div className="mfw-title animate-pulse text-5xl">Fight World</div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">Loading the roster…</div>
        </div>
      </div>
    );
  }

  const selectTitle: Record<Mode, string> = {
    quick: "Quick fight",
    cpu: "VS computer",
    versus: "Local VS",
    random: "Random fight",
    survival: "Survival — pick your fighter",
    tournament: "Tournament — pick your fighter",
    world: "World — pick your hero",
    browse: "Fighter files",
  };

  const resultActions = (): { label: string; tone?: "primary" | "gold" | "ghost" | "danger"; onClick: () => void }[] => {
    if (!setup || !outcome) return [];
    const rematch = { label: "Rematch", tone: "gold" as const, onClick: () => startFight(setup.p1, setup.p2, setup.arena, setup.cpu, { label: setup.label, rounds: setup.rounds }) };
    switch (mode) {
      case "survival":
        if (outcome.winner === 0 && survival) {
          const next = { ...survival, wins: survival.wins + 1, health: Math.min(1, outcome.healthLeft[0] + 0.3) };
          return [
            { label: `Next opponent (${next.wins} wins)`, tone: "gold", onClick: () => nextSurvival(next) },
            { label: "Main menu", tone: "ghost", onClick: toTitle },
          ];
        }
        return [
          { label: "Try again", tone: "gold", onClick: () => beginMode("survival") },
          { label: "Main menu", tone: "ghost", onClick: toTitle },
        ];
      case "tournament":
        return [{ label: "Continue", tone: "gold", onClick: () => setScreen("bracket") }];
      case "world":
        return [
          rematch,
          { label: "Return to world", tone: "primary", onClick: () => setScreen("world") },
        ];
      case "random":
        return [rematch, { label: "New random fight", tone: "primary", onClick: () => beginMode("random") }, { label: "Main menu", tone: "ghost", onClick: toTitle }];
      default:
        return [
          rematch,
          { label: "Change fighter", tone: "primary", onClick: () => setScreen("select") },
          { label: "New arena", tone: "ghost", onClick: () => setScreen("arena") },
          { label: "Main menu", tone: "ghost", onClick: toTitle },
        ];
    }
  };

  return (
    <div className={css.root}>
      {screen !== "fight" && screen !== "world" && <div className={css.backdrop} />}

      {screen === "title" && <TitleScreen roster={roster} onMode={beginMode} onScreen={setScreen} save={save} />}

      {screen === "select" && (
        <div className="absolute inset-0">
          <CharacterSelect
            key={mode}
            fighters={roster.fighters}
            slots={mode === "survival" || mode === "tournament" || mode === "world" || mode === "browse" ? 1 : 2}
            cpu={cpu}
            title={selectTitle[mode]}
            initial={picks}
            favorites={save.favorites}
            recent={save.recent}
            difficulty={settings.difficulty}
            showDifficulty={mode !== "versus" && mode !== "browse"}
            allowCpuToggle={mode === "quick"}
            offline={roster.offline}
            onToggleFavorite={(id) => updateSave((s) => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] }))}
            onDifficulty={(d) => updateSave((s) => ({ ...s, settings: { ...s.settings, difficulty: d } }))}
            onCpuToggle={(c) => setCpu([false, c])}
            onDetails={(f) => setDetail({ f })}
            onConfirm={onSelected}
            onBack={toTitle}
          />
        </div>
      )}

      {screen === "arena" && picks[0] && picks[1] && (
        <ArenaSelect
          p1={picks[0]}
          p2={picks[1]}
          initial={arena}
          onBack={() => setScreen("select")}
          onPick={(a) => {
            setArena(a);
            startFight(picks[0]!, picks[1]!, a, cpu);
          }}
        />
      )}

      {screen === "fight" && setup && (
        <>
          <FightScreen
            setup={setup}
            input={input}
            settings={settings}
            matchKey={matchKey}
            overlay={!!outcome}
            onEnd={onEnd}
            onQuit={() => (mode === "world" ? setScreen("world") : mode === "tournament" ? setScreen("bracket") : toTitle())}
          />
          {outcome && <Results setup={setup} outcome={outcome} actions={resultActions()} survival={mode === "survival" ? survival : null} />}
        </>
      )}

      {screen === "world" && world.player && (
        <WorldMode
          player={world.player}
          fighters={roster.fighters}
          input={input}
          state={world}
          onExit={toTitle}
          onDetails={(f) => setDetail({ f })}
          onCompare={(f) => setDetail({ f, compare: world.player })}
          onFight={(opp, a, x) => {
            setWorld((w) => ({ ...w, x }));
            setArena(a);
            setPicks([world.player, opp]);
            startFight(world.player!, opp, a, [false, true]);
          }}
        />
      )}

      {screen === "bracket" && tourney && <Bracket t={tourney} onPlay={playTournamentMatch} onExit={toTitle} />}

      {screen === "leaderboard" && <Leaderboard stats={save.stats} fighters={roster.fighters} onBack={toTitle} />}

      {screen === "settings" && (
        <SettingsPanel
          settings={settings}
          input={input}
          onChange={(s: Settings) => updateSave((sv) => ({ ...sv, settings: s }))}
          onResetStats={() => updateSave(resetStats)}
          onBack={toTitle}
        />
      )}

      {detail && (
        <CharacterDetail
          fighter={detail.f}
          hero={roster.heroById.get(detail.f.id)}
          compareWith={detail.compare}
          onClose={() => setDetail(null)}
          onFightAs={fightAs}
          onFightAgainst={fightAgainst}
        />
      )}
    </div>
  );
}

/* ── Title ─────────────────────────────────────────────────────────── */
function TitleScreen({ roster, onMode, onScreen, save }: { roster: Roster; onMode: (m: Mode) => void; onScreen: (s: Screen) => void; save: Save }) {
  const modes: { m: Mode; label: string; sub: string }[] = [
    { m: "quick", label: "Quick fight", sub: "Pick two fighters and an arena" },
    { m: "cpu", label: "VS computer", sub: "You against the CPU" },
    { m: "versus", label: "Local VS", sub: "Two players, one keyboard" },
    { m: "random", label: "Random fight", sub: "Instant chaos" },
    { m: "survival", label: "Survival", sub: "How many can you beat?" },
    { m: "tournament", label: "Tournament", sub: "8-fighter bracket" },
    { m: "world", label: "World", sub: "Explore and pick fights" },
    { m: "browse", label: "Fighter files", sub: `${roster.fighters.length} profiles` },
  ];
  const showcase = roster.fighters.filter((f) => f.custom).slice(0, 12);
  return (
    <div className="absolute inset-0">
      <Attract fighters={roster.fighters} />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
      <div className="mfw-scroll relative flex h-full flex-col overflow-y-auto p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <Link href="/projects" className="text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white">
            ← Projects
          </Link>
          <div className="flex gap-2">
            <ArcadeButton tone="ghost" onClick={() => onScreen("leaderboard")}>
              🏆 Stats
            </ArcadeButton>
            <ArcadeButton tone="ghost" onClick={() => onScreen("settings")}>
              ⚙ Settings
            </ArcadeButton>
          </div>
        </div>
        <div className={`mt-6 sm:mt-10 ${css.slam}`}>
          <div className="text-xs font-black uppercase tracking-[0.4em] text-red-400">Marvel character brawler · fan-made</div>
          <h1 className="mfw-title mt-1 text-6xl sm:text-8xl lg:text-9xl">
            Fight
            <br />
            World
          </h1>
        </div>
        <div className="mt-6 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
          {modes.map(({ m, label, sub }, i) => (
            <button
              key={m}
              onClick={() => {
                stinger("confirm");
                onMode(m);
              }}
              onMouseEnter={() => stinger("hover")}
              className={`mfw-btn group flex items-center justify-between border-2 border-black px-4 py-2.5 text-left ${i === 0 ? "bg-red-600 hover:bg-red-500" : "bg-slate-900/80 hover:bg-slate-800"}`}
            >
              <span style={{ transform: "skewX(8deg)" }} className="inline-block">
                <span className="block text-lg font-black uppercase italic">{label}</span>
                <span className="block text-[11px] font-bold text-white/60">{sub}</span>
              </span>
              <span className="text-xl font-black text-yellow-300 opacity-0 transition-opacity group-hover:opacity-100">▶</span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-1">
          {showcase.map((f) => (
            <div key={f.id} className="h-14 w-11 overflow-hidden border-2 border-black" title={f.name} style={{ background: f.look.primary }}>
              <Portrait src={f.portrait.xs} alt={f.name} className="h-full w-full" color={f.look.primary} />
            </div>
          ))}
        </div>
        <div className="mt-auto pt-6 text-[11px] text-white/45">
          <p>
            <b className="text-white/70">P1:</b> A/D move · W jump · S crouch · J light · K heavy · L kick · U special · I block · O ultimate · Esc pause
          </p>
          <p>
            <b className="text-white/70">P2:</b> Arrows · , . / punches+kick · ; special · &apos; block · ] ultimate (or numpad 1–6) · gamepads supported
          </p>
          <p className="mt-2">
            {save.stats.matches > 0 && `${save.stats.matches} fights played · `}Fan-made experiment using open character data. Not affiliated with or endorsed by Marvel.
            {roster.offline && " · Character data CDN unreachable — playing with the built-in roster."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Results ───────────────────────────────────────────────────────── */
function Results({
  setup,
  outcome,
  actions,
  survival,
}: {
  setup: FightSetup;
  outcome: FightOutcome;
  actions: { label: string; tone?: "primary" | "gold" | "ghost" | "danger"; onClick: () => void }[];
  survival: SurvivalState | null;
}) {
  const w = outcome.winner;
  const winner = w === null ? null : w === 0 ? setup.p1 : setup.p2;
  const human = w !== null && !setup.cpu[w];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && actions[0]) actions[0].onClick();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4">
      <div className={`mfw-panel w-full max-w-2xl p-5 ${css.slam}`}>
        <div className="flex items-center gap-4">
          {winner && (
            <div className="h-32 w-24 shrink-0 overflow-hidden border-4 border-yellow-400 sm:h-40 sm:w-32" style={{ background: winner.look.primary }}>
              <Portrait src={winner.portrait.md} alt={winner.name} className="h-full w-full" color={winner.look.primary} eager />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-white/60">{winner ? (setup.cpu[w!] ? "CPU wins" : w === 0 ? "Player 1 wins" : "Player 2 wins") : "Draw"}</div>
            <div className="mfw-title text-4xl sm:text-6xl">{winner ? winner.name : "Draw!"}</div>
            {winner && <div className="mt-1 text-sm font-bold text-white/70">{human ? "Victory!" : "Defeat… try again!"}</div>}
            {survival && <div className="mt-1 text-sm font-black text-yellow-300">Survival streak: {survival.wins + (w === 0 ? 1 : 0)}</div>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/5 p-2">
            <div className="mfw-title text-2xl">{Math.max(...outcome.maxCombo)}</div>Best combo
          </div>
          <div className="bg-white/5 p-2">
            <div className="mfw-title text-2xl">{outcome.kos[0] + outcome.kos[1]}</div>K.O.s
          </div>
          <div className="bg-white/5 p-2">
            <div className="mfw-title text-2xl">{outcome.fastestKo !== null ? `${outcome.fastestKo.toFixed(1)}s` : "—"}</div>Fastest K.O.
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <ArcadeButton key={a.label} tone={a.tone} big={i === 0} onClick={a.onClick}>
              {a.label}
            </ArcadeButton>
          ))}
        </div>
      </div>
    </div>
  );
}
