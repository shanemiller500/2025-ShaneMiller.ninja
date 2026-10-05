"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";
import { Modal } from "@/components/ui/modal";
import { DISCOVERY_BY_ID } from "./data/facts";
import { sp } from "./data/species";
import { Engine, type Snapshot, type UIEvent } from "./game/engine";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "./game/save";
import { DEFAULT_TOOL, type ToolState } from "./game/tools";
import AboutPanel from "./ui/AboutPanel";
import CampPanel from "./ui/CampPanel";
import DinoCard from "./ui/DinoCard";
import StickerBook from "./ui/StickerBook";
import Toasts, { type Toast } from "./ui/Toasts";
import Toolbar from "./ui/Toolbar";
import TopBar, { type TopPanel } from "./ui/TopBar";
import ViewControls from "./ui/ViewControls";

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
  const [stickersOpen, setStickersOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "new" | "reset">(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sticker, setSticker] = useState<string | null>(null);
  const toastId = useRef(1);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = toastId.current++;
    setToasts((list) => [...list.filter((x) => x.text !== t.text).slice(-2), { ...t, id }]);
  }, []);

  useEffect(() => {
    trackEvent("Dinosors Page Viewed", { page: "Dinosors" });
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
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
        case "saved":
          pushToast({ icon: "💾", text: "World saved!" });
          break;
        case "select":
          setSnap(engine.snapshot());
          break;
      }
    });
    engine.start();
    setSnap(engine.snapshot());
    const poll = window.setInterval(() => setSnap(engine.snapshot()), 250);

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        engine.save(true);
        engine.audio.suspend();
        engine.stop();
      } else {
        engine.audio.resume();
        engine.start();
      }
    };
    const onPageHide = () => engine.save(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    if (!s.welcomed) {
      window.setTimeout(() => pushToast({ icon: "🦕", text: "Welcome to Dinosaur Land! Drag to explore, tap anything to see what happens." }), 600);
      saveSettings({ ...s, welcomed: true });
    }

    return () => {
      engine.save(true);
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
            onAbout={() => setAboutOpen(true)}
            onSave={() => engine.save()}
            onNew={() => setConfirm("new")}
            onReset={() => setConfirm("reset")}
            onCamp={() => setCampOpen(true)}
          />
          <Toasts
            toasts={toasts}
            onDismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))}
            onGo={(x, y) => engine.flyTo(x, y, Math.max(engine.cam.zoom, 0.8))}
          />
          <ViewControls engine={engine} followId={snap.followId} cardOpen={!!snap.selected} />
          <Toolbar tool={tool} setTool={setTool} unlocked={snap.unlocked} />
          {snap.selected && <DinoCard info={snap.selected} engine={engine} onCamp={() => setCampOpen(true)} onClose={() => { engine.select(0); setSnap(engine.snapshot()); }} />}
          {campOpen && <CampPanel snap={snap} engine={engine} onClose={() => setCampOpen(false)} />}
          {disc && (
            <button
              type="button"
              onClick={() => {
                setSticker(null);
                setStickersOpen(true);
              }}
              className="dl-pop pointer-events-auto absolute left-1/2 top-24 z-30 sm:top-auto sm:bottom-36 flex -translate-x-1/2 items-center gap-3 rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-3 text-left shadow-2xl shadow-orange-900/40"
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
          <Modal open={!!confirm} onClose={() => setConfirm(null)} size="sm" accent="#f59e0b" labelledBy="dl-confirm">
            <div className={`p-6 text-slate-800 dark:text-slate-100 ${fontClass}`}>
              <div className="text-4xl">{confirm === "reset" ? "🧨" : "🌍"}</div>
              <h2 id="dl-confirm" className="mt-2 text-xl font-bold">
                {confirm === "reset" ? "Reset everything?" : "Make a brand new world?"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {confirm === "reset" ? "This world, your stickers and unlocked dinos will all be wiped." : "This world will be replaced. Your stickers and unlocked dinos stay."}
              </p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setConfirm(null)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                  Keep playing
                </button>
                <button
                  type="button"
                  onClick={() => {
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
