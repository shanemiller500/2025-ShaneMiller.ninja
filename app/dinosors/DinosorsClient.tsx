"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";
import { Modal } from "@/components/ui/modal";
import { DISCOVERY_BY_ID } from "./data/facts";
import { sp } from "./data/species";
import { Engine, type Snapshot, type UIEvent } from "./game/engine";
import { DEFAULT_SETTINGS, hasIdbWorld, loadIdbWorld, loadSettings, saveSettings, type Settings } from "./game/save";
import { DEFAULT_TOOL, type ToolState } from "./game/tools";
import AboutPanel from "./ui/AboutPanel";
import CampPanel from "./ui/CampPanel";
import DinoCard from "./ui/DinoCard";
import StickerBook from "./ui/StickerBook";
import Toasts, { type Toast } from "./ui/Toasts";
import Toolbar from "./ui/Toolbar";
import TopBar, { type TopPanel } from "./ui/TopBar";
import ViewControls from "./ui/ViewControls";
import RaidBanner from "./ui/RaidBanner";
import EvolutionPanel from "./ui/EvolutionPanel";
import CloudPanel from "./ui/CloudPanel";
import SelectionBar from "./ui/SelectionBar";
import InspectPanel from "./ui/InspectPanel";
import SavedGames from "./ui/SavedGames";
import CivPanel, { CivChoice } from "./ui/CivPanel";
import DeepHud from "./ui/DeepHud";
import { HintBubbles, TipCoach } from "./ui/Guide";
import HelpPanel from "./ui/HelpPanel";
import { AgeEnds, ExtinctionBanner, ExtinctionConfirm } from "./ui/Extinction";
import { newestSlot, putSlot } from "./game/slots";
import { hasDinoProgress, useCloud } from "./ui/useCloud";
import { useRouter } from "next/navigation";
import { tidyStorage } from "@/utils/storageJanitor";

/* ------------------------------------------------------------------ */
/*  DinosorsClient: mounts the canvas game engine and the floating     */
/*  toy-box UI. The engine runs its own rAF loop; React only polls a   */
/*  snapshot a few times a second and listens for discrete events.     */
/* ------------------------------------------------------------------ */
export default function DinosorsClient({ fontClass }: { fontClass: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tool, setToolState] = useState<ToolState>(DEFAULT_TOOL);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panel, setPanel] = useState<TopPanel>(null);
  const [campOpen, setCampOpen] = useState(false);
  const [evoOpen, setEvoOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);
  const [civOpen, setCivOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [extOpen, setExtOpen] = useState(false);
  const [help, setHelp] = useState<{ open: boolean; section?: string }>({ open: false });
  const [extCause, setExtCause] = useState<"asteroid" | "supervolcano">("asteroid");
  const [confirm, setConfirm] = useState<null | "new" | "reset">(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sticker, setSticker] = useState<string | null>(null);
  const toastId = useRef(1);
  const router = useRouter();

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = toastId.current++;
    // only the newest evolution update is worth keeping on screen
    setToasts((list) => [...list.filter((x) => x.text !== t.text && !(t.icon === "🧬" && x.icon === "🧬")).slice(-2), { ...t, id }]);
  }, []);

  useEffect(() => {
    trackEvent("Dinosors Page Viewed", { page: "Dinosors" });
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    // the site's shared storage can fill up with other pages' caches: make room first
    tidyStorage();
    const s = loadSettings();
    setSettings(s);
    const engine = new Engine(canvas);
    engineRef.current = engine;
    // handy for poking at the world from devtools while developing
    if (process.env.NODE_ENV !== "production") (window as unknown as { __dinosors?: Engine }).__dinosors = engine;
    engine.audio.setMuted(s.muted);
    engine.audio.setVolume(s.volume);

    const fit = () => engine.resize(wrap.clientWidth, wrap.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const off = engine.on((e: UIEvent) => {
      switch (e.type) {
        case "toast":
          pushToast({ icon: e.icon, text: e.text, fact: e.fact, x: e.x, y: e.y });
          break;
        case "discover":
          setSticker(e.id);
          window.setTimeout(() => setSticker((cur) => (cur === e.id ? null : cur)), 3600);
          trackEvent("Dinosors Discovery", { id: e.id });
          break;
        case "unlock":
          pushToast({ icon: "🔓", text: `New in the toy box: ${sp(e.species).nick}!` });
          break;
        case "openCamp":
          setCampOpen(true);
          break;
        case "openCiv":
          setCivOpen(true);
          break;
        case "confirmEnd":
          setExtCause(e.cause);
          setExtOpen(true);
          break;
        case "view":
          // panels from the other world would sit on top of the HUD
          setCampOpen(false);
          setEvoOpen(false);
          setCivOpen(false);
          setSnap(engine.snapshot());
          break;
        case "saved":
          pushToast({ icon: "💾", text: "World saved!" });
          break;
        case "select":
        case "inspect":
          setSnap(engine.snapshot());
          break;
      }
    });
    engine.start();
    setSnap(engine.snapshot());
    // the last world didn't fit in localStorage: it's waiting in IndexedDB
    if (hasIdbWorld()) {
      void loadIdbWorld().then((json) => {
        if (json && engineRef.current === engine) engine.importSave(json);
      });
    }
    // pick up where you left off: whichever save is newest wins (this browser's save or a saved-games slot)
    void newestSlot().then((slot) => {
      if (!slot || engineRef.current !== engine) return;
      if (engine.startedFresh || slot.savedAt > engine.world.savedAt + 3000) {
        if (engine.importSave(slot.data)) pushToast({ icon: "▶️", text: `Welcome back! Picked up where you left off — Day ${slot.day}.` });
      }
    });
    // the "latest" save stays fresh; a snapshot every 5 minutes lets you go back in time
    const keepLatest = () => {
      if (engineRef.current === engine) void putSlot(engine.makeSlot("latest"));
    };
    const latestTimer = window.setInterval(keepLatest, 30_000);
    const autoTimer = window.setInterval(() => {
      if (document.visibilityState === "visible" && engineRef.current === engine) void putSlot(engine.makeSlot("auto"));
    }, 5 * 60_000);
    const poll = window.setInterval(() => setSnap(engine.snapshot()), 250);

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        engine.save(true);
        keepLatest();
        engine.audio.suspend();
        engine.stop();
      } else {
        engine.audio.resume();
        engine.start();
      }
    };
    const onPageHide = () => {
      engine.save(true);
      keepLatest();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    if (!s.welcomed) {
      window.setTimeout(() => pushToast({ icon: "🦕", text: "Welcome to Dinosaur Land! Drag to explore, tap anything to see what happens." }), 600);
      saveSettings({ ...s, welcomed: true });
    }

    return () => {
      engine.save(true);
      keepLatest();
      window.clearInterval(latestTimer);
      window.clearInterval(autoTimer);
      off();
      ro.disconnect();
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      engine.destroy();
      engineRef.current = null;
    };
  }, [pushToast]);

  const setTool = useCallback((t: Partial<ToolState>) => {
    const e = engineRef.current;
    if (!e) return;
    e.audio.unlock();
    e.setTool(t);
    setToolState({ ...e.tool });
  }, []);

  const updateSettings = (s: Partial<Settings>) => {
    const next = { ...settings, ...s };
    setSettings(next);
    saveSettings(next);
    const e = engineRef.current;
    if (e) {
      e.audio.setMuted(next.muted);
      e.audio.setVolume(next.volume);
    }
  };

  const engine = engineRef.current;
  const cloud = useCloud(engine, (icon, text) => pushToast({ icon, text }));
  // the chamber was just opened: offer the big choice (once per discovery)
  const pending = !!snap?.civ.pending;
  const offered = useRef(false);
  useEffect(() => {
    if (pending && !offered.current) {
      offered.current = true;
      setChoiceOpen(true);
    }
    if (!pending) offered.current = false;
  }, [pending]);
  const disc = sticker ? DISCOVERY_BY_ID[sticker] : null;

  return (
    <div className={`fixed inset-0 z-40 select-none overflow-hidden bg-[#1f5f8a] text-white ${fontClass}`} style={{ touchAction: "none" }}>
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full cursor-grab active:cursor-grabbing" aria-label="Dinosaur Land world. Drag to explore, tap to interact." />
      </div>

      {engine && snap && (
        <>
          <TopBar
            snap={snap}
            engine={engine}
            panel={panel}
            setPanel={setPanel}
            muted={settings.muted}
            onMute={() => {
              engine.audio.unlock();
              updateSettings({ muted: !settings.muted });
            }}
            onStickers={() => setStickersOpen(true)}
            onSaves={() => setSavesOpen(true)}
            onAbout={() => setAboutOpen(true)}
            onSave={() => {
              engine.save();
              if (cloud.state.status === "signedIn") void cloud.saveNow();
            }}
            cloudStatus={cloud.state.status}
            onCloud={() => cloud.show(cloud.state.view ? null : cloud.state.status === "signedIn" ? "account" : "welcome")}
            onLeave={() => cloud.leave(() => router.push("/projects"))}
            onNew={() => setConfirm("new")}
            onReset={() => setConfirm("reset")}
            onCamp={() => setCampOpen((o) => !o)}
            onEvolution={() => setEvoOpen((o) => !o)}
            onCiv={() => setCivOpen((o) => !o)}
            onDeep={() => (engine.view === "deep" ? engine.leaveDeep() : engine.enterDeep())}
            onHelp={() => setHelp({ open: true })}
            onTips={() => updateSettings({ tips: !settings.tips })}
            tipsOn={settings.tips}
            onExtinction={() => {
              setExtCause("asteroid");
              setExtOpen(true);
            }}
            civOpen={civOpen}
            campOpen={campOpen}
            evoOpen={evoOpen}
          />
          <Toasts
            toasts={toasts}
            onDismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))}
            onGo={(x, y) => engine.flyTo(x, y, Math.max(engine.cam.zoom, 0.8))}
          />
          {snap.view === "deep" ? (
            <DeepHud snap={snap} engine={engine} />
          ) : (
            <>
              <ViewControls engine={engine} followId={snap.followId} cardOpen={!!snap.selected} />
              <Toolbar tool={tool} setTool={setTool} unlocked={snap.unlocked} learned={snap.camp.learned} stock={snap.camp.stock} civDone={snap.civ.done} civPath={snap.civ.path} />
              <SelectionBar snap={snap} engine={engine} toolOn={tool.id !== "hand"} />
              {snap.inspect && !snap.selected && <InspectPanel info={snap.inspect} snap={snap} engine={engine} />}
            </>
          )}
          {snap.view === "surface" && snap.selected && (
            <DinoCard
              info={snap.selected}
              engine={engine}
              onCamp={() => setCampOpen(true)}
              onClose={() => {
                if (snap.selected?.kind === "human") engine.clearSelection();
                else engine.select(0);
                setSnap(engine.snapshot());
              }}
            />
          )}
          {campOpen && <CampPanel snap={snap} engine={engine} onClose={() => setCampOpen(false)} />}
          <RaidBanner snap={snap} engine={engine} />
          {evoOpen && <EvolutionPanel snap={snap} engine={engine} onClose={() => setEvoOpen(false)} />}
          {civOpen && <CivPanel snap={snap} engine={engine} onClose={() => setCivOpen(false)} onChoose={() => setChoiceOpen(true)} onExtinction={() => setExtOpen(true)} />}
          <CivChoice open={choiceOpen} onClose={() => setChoiceOpen(false)} engine={engine} fontClass={fontClass} />
          <ExtinctionConfirm open={extOpen} cause={extCause} onClose={() => setExtOpen(false)} snap={snap} engine={engine} fontClass={fontClass} onToast={(icon, text) => pushToast({ icon, text })} />
          <ExtinctionBanner snap={snap} />
          {(() => {
            // tips + bubbles stay out of the way while anything else is open
            const busy = campOpen || civOpen || evoOpen || savesOpen || stickersOpen || aboutOpen || help.open || extOpen || choiceOpen || !!confirm || !!snap.selected || snap.extinction.phase !== "idle" && snap.extinction.phase !== "ruins";
            return (
              <>
                <TipCoach snap={snap} enabled={settings.tips} busy={busy} onOff={() => updateSettings({ tips: false })} onHelp={(section) => setHelp({ open: true, section })} />
                <HintBubbles engine={engine} enabled={settings.tips} busy={busy || tool.id !== "hand"} view={snap.view} />
              </>
            );
          })()}
          <HelpPanel open={help.open} section={help.section} onClose={() => setHelp({ open: false })} fontClass={fontClass} tipsOn={settings.tips} onTips={() => updateSettings({ tips: !settings.tips })} />
          <AgeEnds
            snap={snap}
            engine={engine}
            fontClass={fontClass}
            onLoad={() => {
              engine.observeRuins();
              setSavesOpen(true);
            }}
            onNew={() => {
              void putSlot(engine.makeSlot("auto", `The age that ended · Day ${engine.world.day}`, "Ages"));
              engine.newWorld();
              pushToast({ icon: "🌋", text: "A fresh Dinosaur Land!" });
            }}
          />
          {snap.orderFor > 0 && (
            <div className="dl-glass pointer-events-auto absolute left-1/2 top-24 z-30 flex -translate-x-1/2 items-center gap-3 rounded-3xl px-4 py-2.5 shadow-2xl sm:top-24">
              <span className="text-2xl">🎯</span>
              <span className="text-[15px] font-semibold">Tap a dino to hunt it — or tap the ground to guard that spot</span>
              <button type="button" onClick={() => { engine.orderFor = 0; setSnap(engine.snapshot()); }} className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold hover:bg-white/25">
                Cancel
              </button>
            </div>
          )}
          {disc && (
            <button
              type="button"
              onClick={() => {
                setSticker(null);
                setStickersOpen(true);
              }}
              className={`dl-pop pointer-events-auto absolute left-1/2 top-24 z-30 sm:top-auto ${snap.tribe.raid ? "sm:bottom-[190px]" : "sm:bottom-36"} flex -translate-x-1/2 items-center gap-3 rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-3 text-left shadow-2xl shadow-orange-900/40`}
            >
              <span className="text-4xl drop-shadow">{disc.icon}</span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wider text-amber-50/90">New sticker!</span>
                <span className="block text-lg font-bold leading-tight">{disc.name}</span>
              </span>
            </button>
          )}
          <StickerBook open={stickersOpen} onClose={() => setStickersOpen(false)} found={snap.discoveries} seen={snap.seen} />
          <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} />
          <SavedGames open={savesOpen} onClose={() => setSavesOpen(false)} engine={engine} fontClass={fontClass} onToast={(icon, text) => pushToast({ icon, text })} />
          <CloudPanel cloud={cloud} fontClass={fontClass} hasLocal={hasDinoProgress(engine)} />
          <Modal open={!!confirm} onClose={() => setConfirm(null)} size="sm" accent="#f59e0b" labelledBy="dl-confirm">
            <div className={`p-6 text-slate-800 dark:text-slate-100 ${fontClass}`}>
              <div className="text-4xl">{confirm === "reset" ? "🧨" : "🌍"}</div>
              <h2 id="dl-confirm" className="mt-2 text-xl font-bold">
                {confirm === "reset" ? "Reset everything?" : "Make a brand new world?"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {confirm === "reset" ? "This world, your stickers and unlocked dinos will all be wiped." : "This world will be replaced (a copy stays in 📂 Saved games). Your stickers and unlocked dinos stay."}
              </p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setConfirm(null)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                  Keep playing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // the world you're leaving stays in Saved games
                    void putSlot(engine.makeSlot("auto", `Before ${confirm === "reset" ? "reset" : "new world"} · Day ${engine.world.day}`));
                    if (confirm === "reset") engine.resetEverything();
                    else engine.newWorld();
                    setConfirm(null);
                    setCampOpen(false);
                    pushToast({ icon: "🌋", text: "A fresh Dinosaur Land!" });
                  }}
                  className="flex-1 rounded-2xl bg-amber-500 px-4 py-3 font-bold text-white hover:bg-amber-600"
                >
                  {confirm === "reset" ? "Reset" : "New world"}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
      <style>{`
        @keyframes dl-pop { 0% { transform: translate(-50%, 30px) scale(.6); opacity: 0 } 60% { transform: translate(-50%, -6px) scale(1.06); opacity: 1 } 100% { transform: translate(-50%, 0) scale(1) } }
        .dl-pop { animation: dl-pop .55s cubic-bezier(.2,1.4,.4,1) both }
        .dl-glass { background: rgba(15, 23, 42, 0.62); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12) }
        .dl-scroll::-webkit-scrollbar { display: none }
        .dl-scroll { scrollbar-width: none }
      `}</style>
    </div>
  );
}
