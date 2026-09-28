"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bell,
  Bone,
  BookOpen,
  Brush,
  Camera,
  Car,
  Dog,
  Trees,
  CircleSlash,
  CloudSun,
  Flame,
  Footprints,
  Frown,
  Hand,
  Home,
  Keyboard,
  MapPin,
  Meh,
  MessageCircle,
  Moon,
  Mountain,
  MousePointerClick,
  RotateCw,
  Skull,
  Smile,
  Snowflake,
  Sparkles,
  Sun,
  Utensils,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from "lucide-react";

import CharlesDog, { type DogRefs, type Mood, type Pose } from "./CharlesDog";
import * as sfx from "./audio";
import * as L from "./lines";
import { SCENES, defaultSeason, sceneCrop, sceneToStage, threatsFor, type Season, type SceneId, type SceneThreat, type Spot } from "./scenes";
import CabinScene from "./scenes/CabinScene";
import HomeScene from "./scenes/HomeScene";
import { SCENE_CSS } from "./scenes/parts";
import { Herd, PassingCar, RoomSweep, VisitorDog, WILDLIFE_CSS, type Breed, type CarPass, type Critter, type Passer } from "./scenes/wildlife";
import { BarkWaves, PoopArt, PropArt, StinkCloud, type PropKind } from "./props";
import RealPhotos from "./RealPhotos";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types + helpers                                                    */
/* ------------------------------------------------------------------ */
type ParticleKind =
  | "woof"
  | "cloud"
  | "bomb"
  | "blast"
  | "heart"
  | "zzz"
  | "crumb"
  | "treat"
  | "ball"
  | "leaf"
  | "bell"
  | "paw"
  | "caption";

interface Particle {
  id: number;
  kind: ParticleKind;
  /** px from stage left */
  x: number;
  /** px from stage bottom */
  y: number;
  dx?: number;
  dy?: number;
  text?: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

interface Bubble {
  segments: string[];
  active: number;
}

interface Snack {
  id: number;
  kind: PropKind;
  name: string;
  /** stage % */
  x: number;
  stolen: boolean;
}

type AiAction = Pose | "wag" | "spin" | "zoomies" | "none";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Await an animation, but never hang if something else interrupts it. */
const settle = (ctl: AnimationPlaybackControls, seconds: number) =>
  Promise.race([ctl.finished.then(() => undefined, () => undefined), sleep(seconds * 1000 + 120)]);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Strip anything that shouldn't be read aloud. */
function speakable(text: string) {
  return text
    .replace(/\*[^*]*\*/g, "")
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[☀-➿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitBarks(reply: string) {
  return reply.split(/\s*\[BARK\]\s*/i).map((s) => s.trim());
}

let uid = 1;
const nextId = () => uid++;

/** Mood score to label. Happy dogs say nice things; snarky ones don't. */
function moodInfo(score: number) {
  if (score >= 68) return { label: "Happy", Icon: Smile, cls: "bg-emerald-400/90 text-emerald-950" };
  if (score >= 45) return { label: "Sassy", Icon: Meh, cls: "bg-amber-300/90 text-amber-950" };
  return { label: "Snarky", Icon: Frown, cls: "bg-rose-400/90 text-rose-950" };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CharlesPlayground() {
  /* ---------- stage geometry (the whole screen) ---------- */
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 1200, h: 800 });
  const [sceneId, setSceneId] = useState<SceneId>("cabin");
  const [season, setSeason] = useState<Season>("summer");
  const scene = SCENES[sceneId];
  const dogW = clamp(Math.min(stage.h * scene.dogScale, stage.w * 0.6), 170, 520);
  const dogH = (dogW * 290) / 360;
  // The walkable floor: front edge (closest, full size) to back edge (far away, smaller).
  const floorFront = Math.max(6, stage.h - sceneToStage(scene, 0, scene.floorBand[1], stage.w, stage.h).y);
  const floorBack = Math.max(floorFront + 10, stage.h - sceneToStage(scene, 0, scene.floorBand[0], stage.w, stage.h).y);
  const dogBottom = floorFront;
  // The meadow beyond the railing (cabin only): near edge just behind the deck, far edge at the trees.
  const meadow = scene.meadow;
  const mNear = meadow ? stage.h - sceneToStage(scene, 0, meadow.band[1], stage.w, stage.h).y : floorBack;
  const mFar = meadow ? stage.h - sceneToStage(scene, 0, meadow.band[0], stage.w, stage.h).y : floorBack;
  const maxDepth = meadow ? 2 : 1;
  const minX = ((dogW / 2 + 8) / stage.w) * 100;
  const maxX = 100 - minX;

  /* ---------- dog state ---------- */
  const [pose, setPose] = useState<Pose>("sleep");
  const [mood, setMood] = useState<Mood>("sassy");
  const [moodScore, setMoodScore] = useState(62);
  const [walking, setWalking] = useState(false);
  const [running, setRunning] = useState(false);
  const [wag, setWag] = useState<"none" | "slow" | "fast">("none");
  const [facing, setFacing] = useState<1 | -1>(1);
  const [thinking, setThinking] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);

  const xMv = useMotionValue(50);
  const yMv = useMotionValue(0);
  const rotMv = useMotionValue(0);
  const spinMv = useMotionValue(0);
  const leftCss = useTransform(xMv, (v) => `${v}%`);
  const bubbleLeft = useMotionValue(400);
  /** 0 = front of the floor (closest), 1 = back (far away). */
  const depthMv = useMotionValue(0.25);
  const bottomMv = useMotionValue(0);
  const scaleMv = useMotionValue(1);
  const bubbleBottom = useMotionValue(300);
  const [dogDepth, setDogDepth] = useState(0.25);
  const [inMeadow, setInMeadow] = useState(false);
  const inMeadowRef = useRef(false);
  const routeRef = useRef(0);
  /* paw tracks in the snow */
  const [tracks, setTracks] = useState<{ id: number; x: number; b: number; k: number; rot: number; meadow: boolean }[]>([]);
  /* the visiting dog */
  const visitorX = useMotionValue(-20);
  const visitorLeft = useTransform(visitorX, (v) => `${v}%`);
  const [visitor, setVisitor] = useState<{ id: number; breed: Breed; dir: 1 | -1; depth: number; walking: boolean; startled: boolean } | null>(null);
  const moveCtl = useRef<AnimationPlaybackControls | null>(null);
  const depthCtl = useRef<AnimationPlaybackControls | null>(null);

  /* ---------- world state ---------- */
  const [started, setStarted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [poops, setPoops] = useState<{ id: number; x: number; bottom: number; scale: number; depth: number }[]>([]);
  const [threat, setThreat] = useState<{ id: number; t: SceneThreat } | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);
  const [kidYell, setKidYell] = useState(false);
  const [badMode, setBadMode] = useState(false);
  const [stink, setStink] = useState(0);
  const [sleeping, setSleeping] = useState(true);
  const [stats, setStats] = useState({ goodBoy: 92, snacks: 0, threats: 0, treats: 0 });
  const [guideOpen, setGuideOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [passer, setPasser] = useState<Passer | null>(null);
  const [car, setCar] = useState<CarPass | null>(null);
  const [bellPressed, setBellPressed] = useState(false);

  /* ---------- audio / AI ---------- */
  const [muted, setMutedState] = useState(false);
  const [aiVoice, setAiVoice] = useState(true);
  const [online, setOnline] = useState<boolean | null>(null);

  /* ---------- refs for the animation loop / sequencing ---------- */
  const partsRef = useRef<DogRefs>({ jaw: null, pupils: null });
  const svgRef = useRef<SVGSVGElement>(null);
  const mouseRef = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const mouthMode = useRef<"pant" | "closed" | "voice" | "browser" | "bark" | "open">("closed");
  const speakAbort = useRef<AbortController | null>(null);
  const busy = useRef(0);
  const speaking = useRef(false);
  const lastInteract = useRef(Date.now());
  const petDist = useRef({ d: 0, t: 0, cooldown: 0 });
  const history = useRef<Turn[]>([]);
  const stateRef = useRef({
    facing,
    sleeping,
    badMode,
    pose,
    online,
    aiVoice,
    muted,
    stage,
    dogW,
    dogH,
    dogBottom,
    floorFront,
    floorBack,
    mNear,
    mFar,
    maxDepth,
    walking,
    running,
    passerId: passer?.id ?? 0,
    minX,
    maxX,
    scene,
    season,
    moodScore,
    started,
  });
  stateRef.current = {
    facing,
    sleeping,
    badMode,
    pose,
    online,
    aiVoice,
    muted,
    stage,
    dogW,
    dogH,
    dogBottom,
    floorFront,
    floorBack,
    mNear,
    mFar,
    maxDepth,
    walking,
    running,
    passerId: passer?.id ?? 0,
    minX,
    maxX,
    scene,
    season,
    moodScore,
    started,
  };
  const thinkingRef = useRef(false);
  thinkingRef.current = thinking;

  const nudgeMood = (delta: number) => setMoodScore((m) => clamp(m + delta, 0, 100));
  const isHappy = () => stateRef.current.moodScore >= 55;

  /* ---------- full-screen: no page scroll while Charles is on stage ---------- */
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev[0];
      document.body.style.overflow = prev[1];
    };
  }, []);

  /* ---------- measure stage ---------- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* restore last scene + season (or pick the season from the calendar) */
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const sc = q.get("scene") ?? localStorage.getItem("charles-scene");
      if (sc === "home" || sc === "cabin") setSceneId(sc);
      const se = q.get("season") ?? localStorage.getItem("charles-season");
      setSeason(se === "winter" || se === "summer" ? se : defaultSeason());
    } catch {
      setSeason(defaultSeason());
    }
  }, []);

  /* keep the dog inside the stage when it resizes */
  useEffect(() => {
    const v = xMv.get();
    if (v < minX || v > maxX) xMv.set(clamp(v, minX, maxX));
  }, [minX, maxX, xMv]);

  /**
   * Depth -> paw height (px from the bottom) and size.
   * 0..1 is the floor/deck (front to back), 1..2 is the meadow beyond the railing (cabin only).
   */
  const placeAt = (d: number) => {
    const { floorFront: ff, floorBack: fb, mNear: mn, mFar: mf, scene: sc } = stateRef.current;
    if (d <= 1 || !sc.meadow) {
      const dd = clamp(d, 0, 1);
      return { b: ff + dd * (fb - ff), k: 1 - dd * (1 - sc.backScale) };
    }
    const t = clamp(d - 1, 0, 1);
    return { b: mn + t * (mf - mn), k: sc.backScale - t * (sc.backScale - sc.meadow.farScale) };
  };

  /* perspective: depth -> paw height + size; the speech bubble follows the head */
  useEffect(() => {
    const sync = () => {
      const { stage: s, dogW: w, dogH: h, facing: f } = stateRef.current;
      const d = depthMv.get();
      const { b, k } = placeAt(d);
      if (d > 1 !== inMeadowRef.current) {
        inMeadowRef.current = d > 1;
        setInMeadow(d > 1);
      }
      bottomMv.set(b);
      scaleMv.set(k);
      const headX = (xMv.get() / 100) * s.w + f * 0.2 * w * k;
      bubbleLeft.set(clamp(headX, Math.min(170, s.w / 2), Math.max(s.w - 170, s.w / 2)));
      bubbleBottom.set(b + h * k * 0.98 + 14);
    };
    sync();
    const a = xMv.on("change", sync);
    const c = depthMv.on("change", sync);
    return () => {
      a();
      c();
    };
  }, [xMv, depthMv, bottomMv, scaleMv, bubbleLeft, bubbleBottom, facing, stage.w, stage.h, dogW, dogH, floorFront, floorBack, sceneId]);

  /* paw tracks: every stride leaves a print in the snow, which slowly fills back in */
  useEffect(() => {
    let lastX = xMv.get();
    let lastB = bottomMv.get();
    let acc = 0;
    let side = 1;
    let lastAt = 0;
    const onMove = () => {
      const st = stateRef.current;
      const x = (xMv.get() / 100) * st.stage.w;
      const { b, k } = { b: bottomMv.get(), k: scaleMv.get() };
      const dx = x - lastX;
      const dy = b - lastB;
      lastX = x;
      lastB = b;
      if (!(st.walking || st.running) || st.season !== "winter" || st.scene.id !== "cabin") return;
      acc += Math.hypot(dx, dy);
      const now = performance.now();
      if (acc < 34 * k || now - lastAt < 90) return;
      acc = 0;
      lastAt = now;
      side = -side;
      const rot = (Math.atan2(-dy, dx) * 180) / Math.PI + 90;
      const id = nextId();
      const t = { id, x: x + side * 10 * k, b: b + 3 * k + side * 5 * k, k, rot, meadow: depthMv.get() > 1 };
      setTracks((list) => [...list.slice(-180), t]);
      setTimeout(() => setTracks((list) => list.filter((q) => q.id !== id)), 30000);
    };
    const a = xMv.on("change", onMove);
    const c = bottomMv.on("change", onMove);
    return () => {
      a();
      c();
    };
  }, [xMv, bottomMv, scaleMv, depthMv]);

  useEffect(() => setTracks([]), [sceneId, season]);

  /* mood drifts back toward "sassy" over time, like all of us */
  useEffect(() => {
    const id = setInterval(() => setMoodScore((m) => (m > 62 ? m - 1 : m < 58 ? m + 1 : m)), 6000);
    return () => clearInterval(id);
  }, []);

  /* ---------- geometry helpers (stage px, from bottom) ---------- */
  const dogCenterX = () => (xMv.get() / 100) * stateRef.current.stage.w;
  /** Current paw height (px from bottom) and perspective scale. */
  const place = () => ({ b: bottomMv.get(), k: scaleMv.get() });
  const mouthPos = () => {
    const { facing: f, dogW: w, dogH: h } = stateRef.current;
    const { b, k } = place();
    return { x: dogCenterX() + f * 0.4 * w * k, y: b + (0.6 * h - yMv.get()) * k };
  };
  const rearPos = () => {
    const { facing: f, dogW: w, dogH: h, pose: p } = stateRef.current;
    const { b, k } = place();
    const sitting = p === "sit" || p === "squat";
    return { x: dogCenterX() - f * 0.26 * w * k, y: b + (sitting ? 0.22 : 0.42) * h * k };
  };
  const headPos = () => {
    const { facing: f, dogW: w, dogH: h } = stateRef.current;
    const { b, k } = place();
    return { x: dogCenterX() + f * 0.24 * w * k, y: b + 0.85 * h * k };
  };
  const stagePctFromView = (vx: number) => {
    const { scene: sc, stage: s } = stateRef.current;
    return (sceneToStage(sc, vx, 0, s.w, s.h).x / s.w) * 100;
  };
  /** Screen y (from the top) -> depth. Above the deck at the cabin = out in the meadow (1..2). */
  const depthFromTopY = (topY: number) => {
    const { stage: s, floorFront: ff, floorBack: fb, mNear: mn, mFar: mf, scene: sc } = stateRef.current;
    const b = s.h - topY;
    if (b <= fb || !sc.meadow) return clamp((b - ff) / Math.max(1, fb - ff), 0, 1);
    return 1 + clamp((b - mn) / Math.max(1, mf - mn), 0.03, 1);
  };
  const depthFromViewY = (vy: number) => {
    const { scene: sc, stage: s } = stateRef.current;
    return depthFromTopY(sceneToStage(sc, 0, vy, s.w, s.h).y);
  };

  /* ---------- particles ---------- */
  const spawn = useCallback((p: Omit<Particle, "id">, life = 1600) => {
    const id = nextId();
    setParticles((list) => [...list.slice(-50), { ...p, id }]);
    setTimeout(() => setParticles((list) => list.filter((q) => q.id !== id)), life);
    return id;
  }, []);

  /* ---------- the per-frame loop: lip sync + eyes that follow you ---------- */
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const { jaw, pupils } = partsRef.current;
      if (jaw) {
        let deg = 0;
        switch (mouthMode.current) {
          case "voice":
            deg = 3 + sfx.voiceLevel() * 26;
            break;
          case "browser":
            deg = 4 + Math.abs(Math.sin(t / 70)) * 14 + Math.abs(Math.sin(t / 23)) * 5;
            break;
          case "bark":
            deg = 12 + sfx.voiceLevel() * 22;
            break;
          case "open":
            deg = 22;
            break;
          case "pant":
            deg = 7 + Math.sin(t / 110) * 3;
            break;
          default:
            deg = 0;
        }
        jaw.style.transform = `rotate(${deg.toFixed(1)}deg)`;
      }
      if (pupils && svgRef.current) {
        const r = svgRef.current.getBoundingClientRect();
        const f = stateRef.current.facing;
        const eyeX = r.left + r.width * (f === 1 ? 282 / 360 : 1 - 282 / 360);
        const eyeY = r.top + r.height * (83 / 290);
        const m = mouseRef.current;
        let ux = 0;
        let uy = 0;
        if (thinkingRef.current) {
          uy = -1;
          ux = 0.3;
        } else if (t - m.t < 4000 && m.t > 0) {
          const dx = m.x - eyeX;
          const dy = m.y - eyeY;
          const d = Math.hypot(dx, dy) || 1;
          ux = (dx / d) * Math.min(1, d / 120) * f;
          uy = (dy / d) * Math.min(1, d / 120);
        }
        pupils.setAttribute("transform", `translate(${(ux * 2).toFixed(2)} ${(uy * 1.5).toFixed(2)})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  /* ---------- movement ---------- */
  const faceToward = (targetPct: number) => {
    const cur = xMv.get();
    if (Math.abs(targetPct - cur) > 0.5) setFacing(targetPct > cur ? 1 : -1);
  };

  /**
   * Walk (or run) to a stage % across and a floor depth (0 front .. 1 back).
   * `free` lets him leave the screen for scene travel.
   */
  const walkTo = useCallback(
    async (targetPct: number, run = false, free = false, depth?: number) => {
      const { stage: s, dogW: w, maxDepth: md } = stateRef.current;
      const toDepth = depth === undefined ? depthMv.get() : clamp(depth, 0, md);
      const from = placeAt(depthMv.get());
      const to = placeAt(toDepth);
      const lo = (((w * to.k) / 2 + 8) / s.w) * 100;
      const target = free ? targetPct : clamp(targetPct, lo, 100 - lo);
      const dx = (Math.abs(target - xMv.get()) / 100) * s.w;
      const dy = Math.abs(to.b - from.b) * 1.6;
      const distPx = Math.hypot(dx, dy);
      const kAvg = (from.k + to.k) / 2;
      if (distPx < 6) return;
      if (dx > 4) faceToward(target);
      setPose("stand");
      setWalking(!run);
      setRunning(run);
      moveCtl.current?.stop();
      depthCtl.current?.stop();
      const duration = distPx / ((run ? 560 : 170) * kAvg);
      const ctl = animate(xMv, target, { duration, ease: "linear" });
      const dctl = animate(depthMv, toDepth, { duration, ease: "linear" });
      moveCtl.current = ctl;
      depthCtl.current = dctl;
      await Promise.all([settle(ctl, duration), settle(dctl, duration)]);
      if (moveCtl.current === ctl) {
        setWalking(false);
        setRunning(false);
        setDogDepth(depthMv.get());
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [xMv]
  );

  const stopMoving = () => {
    routeRef.current++;
    moveCtl.current?.stop();
    moveCtl.current = null;
    depthCtl.current?.stop();
    depthCtl.current = null;
    setDogDepth(depthMv.get());
    setWalking(false);
    setRunning(false);
  };

  /** Walk anywhere. At the cabin, crossing between the deck and the meadow goes via the steps. */
  const goTo = async (pct: number, depth: number, run = false) => {
    const id = ++routeRef.current;
    const m = stateRef.current.scene.meadow;
    const cur = depthMv.get();
    if (m && cur > 1 !== depth > 1) {
      const stepsPct = stagePctFromView(m.steps[0]);
      const stepsD = depthFromViewY(m.steps[1]);
      const groundPct = stagePctFromView(m.ground[0]);
      const legs: [number, number][] = depth > 1 ? [[stepsPct, stepsD], [groundPct, 1.04]] : [[groundPct, 1.04], [stepsPct, stepsD]];
      for (const [x, d] of legs) {
        await walkTo(x, run, true, d);
        if (routeRef.current !== id) return;
      }
    }
    await walkTo(pct, run, false, depth);
  };

  const hop = async (height = 110, duration = 0.7) => {
    sfx.whoosh(true);
    await settle(animate(yMv, [0, -height, 0], { duration, ease: ["easeOut", "easeIn"], times: [0, 0.45, 1] }), duration);
  };

  /* ---------- barking (the real recording) ---------- */
  const woofBurst = useCallback(
    async (times = 1 + Math.round(Math.random())) => {
      const prevMode = mouthMode.current;
      mouthMode.current = "bark";
      const ms = sfx.bark(times);
      const per = ms / times;
      for (let i = 0; i < times; i++) {
        setTimeout(() => {
          const m = mouthPos();
          spawn({ kind: "woof", x: m.x + stateRef.current.facing * 26, y: m.y + 6, dx: stateRef.current.facing }, 700);
        }, i * per);
      }
      setWag("fast");
      await sleep(ms + 80);
      mouthMode.current = prevMode === "bark" ? "pant" : prevMode;
      setWag("slow");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spawn]
  );

  /* ---------- AI action -> body language ---------- */
  const perform = useCallback(
    async (action: AiAction | undefined) => {
      switch (action) {
        case "sit":
        case "lie":
        case "sniff":
        case "headtilt":
        case "beg":
          stopMoving();
          setPose(action);
          break;
        case "jump":
          stopMoving();
          setPose("jump");
          await hop();
          setPose("stand");
          break;
        case "spin":
          stopMoving();
          await settle(animate(spinMv, spinMv.get() + 720, { duration: 1, ease: "easeInOut" }), 1);
          break;
        case "zoomies": {
          const { minX: lo, maxX: hi } = stateRef.current;
          await walkTo(xMv.get() > 50 ? lo : hi, true);
          await walkTo(rand(35, 65), true);
          break;
        }
        case "wag":
          setWag("fast");
          setTimeout(() => setWag("slow"), 2500);
          break;
        default:
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walkTo]
  );

  /* ---------- speech: voice clips with real barks spliced in ---------- */
  const say = useCallback(
    async (reply: string, opts: { mood?: Mood; action?: AiAction; voice?: boolean } = {}) => {
      speakAbort.current?.abort();
      const ctrl = new AbortController();
      speakAbort.current = ctrl;
      speaking.current = true;
      busy.current++;
      if (opts.mood) setMood(opts.mood);

      const segments = splitBarks(reply);
      const { aiVoice: useAi, online: isOnline, muted: isMuted } = stateRef.current;
      const wantVoice = opts.voice !== false && !isMuted;

      const clips: Promise<AudioBuffer | null>[] = segments.map((seg) =>
        wantVoice && useAi && isOnline !== false && speakable(seg) ? sfx.fetchVoice(speakable(seg), ctrl.signal) : Promise.resolve(null)
      );

      void perform(opts.action);
      try {
        for (let i = 0; i < segments.length; i++) {
          if (ctrl.signal.aborted) return;
          setBubble({ segments, active: i });
          const text = speakable(segments[i]);
          if (text) {
            if (wantVoice) {
              const clip = await clips[i];
              if (ctrl.signal.aborted) return;
              if (clip) {
                mouthMode.current = "voice";
                await sfx.playBuffer(clip, ctrl.signal);
              } else {
                mouthMode.current = "browser";
                await sfx.speakWithBrowser(text, ctrl.signal);
              }
            } else {
              mouthMode.current = "browser";
              await sleep(clamp(text.length * 55, 700, 3500));
            }
          }
          if (i < segments.length - 1 && !ctrl.signal.aborted) {
            // The tic: snap toward "something", bark, carry on like nothing happened.
            const prevPose = stateRef.current.pose;
            setPose("alert");
            await woofBurst();
            setPose(prevPose === "alert" ? "stand" : prevPose);
            await sleep(120);
          }
        }
        mouthMode.current = "pant";
        await sleep(clamp(reply.length * 25, 1400, 3200));
        if (!ctrl.signal.aborted) setBubble(null);
      } finally {
        if (speakAbort.current === ctrl) {
          mouthMode.current = "pant";
          speaking.current = false;
        }
        busy.current = Math.max(0, busy.current - 1);
      }
    },
    [perform, woofBurst]
  );

  const remember = (role: Turn["role"], content: string) => {
    history.current = [...history.current.slice(-9), { role, content }];
  };

  /** His own thoughts, from the AI when available, canned wit otherwise. */
  const ask = useCallback(
    async (prompt: string, fallback: L.Line) => {
      lastInteract.current = Date.now();
      setThinking(true);
      let line: L.Line = fallback;
      try {
        if (stateRef.current.online === false) throw new Error("offline");
        const res = await fetch("/api/charles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prompt, history: history.current }),
        });
        if (res.status === 503) setOnline(false);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { reply: string; action: AiAction; mood: Mood };
        setOnline(true);
        line = { text: data.reply, action: data.action, mood: data.mood };
        remember("user", prompt);
        remember("assistant", data.reply);
      } catch {
        /* canned wit it is */
      } finally {
        setThinking(false);
      }
      await say(line.text, { mood: line.mood, action: line.action });
    },
    [say]
  );

  /* ---------- sleep / wake ---------- */
  const wake = (talk = true) => {
    setSleeping(false);
    setPose("stand");
    setMood("offended");
    setWag("slow");
    mouthMode.current = "pant";
    lastInteract.current = Date.now();
    nudgeMood(-10);
    if (talk) void say(L.pickOne(L.WAKE_LINES), { mood: "offended", action: "headtilt" });
  };

  /* ---------- user commands ---------- */
  const command = async (fn: () => Promise<void>) => {
    sfx.unlockAudio();
    if (!stateRef.current.started) return;
    lastInteract.current = Date.now();
    if (stateRef.current.sleeping) {
      wake(false);
      await sleep(250);
    }
    busy.current++;
    try {
      await fn();
    } finally {
      busy.current = Math.max(0, busy.current - 1);
      lastInteract.current = Date.now();
    }
  };

  const start = () => {
    sfx.unlockAudio();
    setStarted(true);
    trackEvent("Charles Woken Up", { scene: sceneId, season });
    setTimeout(() => {
      setSleeping(false);
      setPose("stand");
      setWag("slow");
      mouthMode.current = "pant";
      lastInteract.current = Date.now();
      void (async () => {
        await woofBurst(2);
        await say(
          L.pickOne([
            "Oh. It's you. [BARK] Sorry. Reflex. Hello. Do you have snacks?",
            "I'm up. I'm up. [BARK] I was not asleep. I was monitoring.",
            "Welcome to my territory. [BARK] Wipe your feet. Or don't. I'll lick them.",
          ]),
          { mood: "sassy", action: "headtilt" }
        );
      })();
    }, 350);
  };

  const talk = () =>
    command(async () => {
      stopMoving();
      setWag("fast");
      const { season: se, scene: sc } = stateRef.current;
      const where = `${sc.name}, ${se}. Your mood is ${moodInfo(stateRef.current.moodScore).label.toLowerCase()}.`;
      void ask(`${L.pickOne(L.POKE_TOPICS)} (You are at the ${where})`, L.pickOne(L.OFFLINE_REPLIES));
    });

  const doSit = () =>
    command(async () => {
      stopMoving();
      setPose("sit");
      nudgeMood(-3);
      await say(L.pickOne(L.SIT_LINES), { mood: "sassy" });
    });

  const doLie = () =>
    command(async () => {
      stopMoving();
      setPose("lie");
      nudgeMood(-2);
      await say(L.pickOne(L.LIE_LINES), { mood: "smug" });
    });

  const doJump = () =>
    command(async () => {
      stopMoving();
      setPose("jump");
      setWag("fast");
      nudgeMood(-2);
      await hop(130);
      setPose("stand");
      await hop(60, 0.45);
      setWag("slow");
      await say(L.pickOne(L.JUMP_LINES), { mood: "happy" });
    });

  const doRoll = () =>
    command(async () => {
      stopMoving();
      nudgeMood(-4);
      if (Math.random() < 0.45 || !isHappy()) {
        setPose("sit");
        await say(L.pickOne(L.ROLL_REFUSE_LINES), { mood: "offended" });
        return;
      }
      setPose("lie");
      await sleep(300);
      sfx.whoosh(false);
      await Promise.all([
        settle(animate(rotMv, rotMv.get() + 360, { duration: 0.9, ease: "easeInOut" }), 0.9),
        settle(animate(yMv, [0, -40, 0], { duration: 0.9 }), 0.9),
      ]);
      setPose("stand");
      await say(L.pickOne(L.ROLL_LINES), { mood: "smug" });
    });

  const doSpin = () =>
    command(async () => {
      stopMoving();
      setWag("fast");
      nudgeMood(-2);
      await settle(animate(spinMv, spinMv.get() + 1080, { duration: 1.3, ease: "easeInOut" }), 1.3);
      setWag("slow");
      await say(L.pickOne(L.SPIN_LINES), { mood: "happy" });
    });

  const doTreat = () =>
    command(async () => {
      stopMoving();
      setPose("stand");
      setMood("hungry");
      const { stage: s, facing: f } = stateRef.current;
      const m = mouthPos();
      const startX = f === 1 ? s.w - 20 : 20;
      spawn({ kind: "treat", x: m.x, y: m.y + 60, dx: startX - m.x, dy: -(s.h * 0.75 - m.y - 60) }, 900);
      sfx.whoosh(true);
      await sleep(520);
      setPose("chomp");
      mouthMode.current = "open";
      await hop(70, 0.5);
      mouthMode.current = "closed";
      sfx.crunch();
      const mm = mouthPos();
      for (let i = 0; i < 6; i++) spawn({ kind: "crumb", x: mm.x, y: mm.y, dx: rand(-40, 40), dy: rand(10, 50) }, 700);
      setPose("stand");
      setWag("fast");
      nudgeMood(12);
      setStats((st) => ({ ...st, treats: st.treats + 1, goodBoy: clamp(st.goodBoy + 4, 0, 100) }));
      for (let i = 0; i < 3; i++) spawn({ kind: "heart", x: headPos().x + rand(-30, 30), y: headPos().y, dx: rand(-20, 20) }, 1500);
      await sleep(500);
      mouthMode.current = "pant";
      await say(L.pickOne(L.TREAT_LINES), { mood: "happy" });
      setWag("slow");
    });

  const doPet = () =>
    command(async () => {
      stopMoving();
      setWag("fast");
      setPose("headtilt");
      nudgeMood(8);
      const h = headPos();
      for (let i = 0; i < 6; i++) setTimeout(() => spawn({ kind: "heart", x: h.x + rand(-40, 40), y: h.y, dx: rand(-30, 30) }, 1500), i * 120);
      setStats((st) => ({ ...st, goodBoy: clamp(st.goodBoy + 3, 0, 100) }));
      await say(L.pickOne(L.PET_LINES), { mood: "happy" });
      setWag("slow");
      setPose("stand");
    });

  const doFetch = () =>
    command(async () => {
      stopMoving();
      const { stage: s } = stateRef.current;
      const { b } = place();
      setFacing(1);
      spawn({ kind: "ball", x: s.w - 30, y: b + 20, dx: s.w }, 1700);
      sfx.whoosh(true);
      setPose("headtilt");
      await sleep(500);
      setFacing(-1);
      await sleep(700);
      setFacing(1);
      setPose("sit");
      setWag("none");
      nudgeMood(-8);
      await say(L.pickOne(L.FETCH_LINES), { mood: "offended" });
      setWag("slow");
    });

  /** A kid's hand appears with food. Charles does not wait for permission. */
  const doDinner = () =>
    command(async () => {
      stopMoving();
      const food = L.pickOne(L.FOODS);
      const { minX: lo, maxX: hi, dogW: w, stage: s } = stateRef.current;
      const cur = xMv.get();
      let standPct = rand(lo, hi);
      if (Math.abs(standPct - cur) < 12) standPct = cur > 50 ? rand(lo, Math.max(lo, cur - 15)) : rand(Math.min(hi, cur + 15), hi);
      const dir = standPct >= cur ? 1 : -1;
      const handPct = standPct + dir * ((0.4 * w) / s.w) * 100;
      const s0: Snack = { id: nextId(), kind: food.kind, name: food.name, x: handPct, stolen: false };
      setSnack(s0);
      setKidYell(false);
      await sleep(700);
      await goTo(standPct, 0);
      setFacing(handPct > xMv.get() ? 1 : -1);
      setPose("beg");
      setMood("hungry");
      setWag("fast");
      await sleep(1300);
      setPose("chomp");
      mouthMode.current = "open";
      void hop(90, 0.45);
      await sleep(200);
      setSnack((sn) => (sn ? { ...sn, stolen: true } : sn));
      mouthMode.current = "closed";
      sfx.crunch();
      const m = mouthPos();
      for (let i = 0; i < 7; i++) spawn({ kind: "crumb", x: m.x, y: m.y, dx: rand(-50, 50), dy: rand(10, 60) }, 700);
      await sleep(260);
      setKidYell(true);
      setPose("stand");
      setMood("smug");
      nudgeMood(10);
      setStats((st) => ({ ...st, snacks: st.snacks + 1 }));
      trackEvent("Charles Stole Food", { food: food.name });
      setTimeout(() => setSnack((sn) => (sn?.id === s0.id ? null : sn)), 1600);
      await sleep(350);
      mouthMode.current = "pant";
      void ask(`You just snatched a ${food.name} right out of one of the kids' hands. Brag about it.`, {
        text: L.pickOne(L.STEAL_LINES),
        mood: "smug",
        action: "headtilt",
      });
    });

  /* ---------- bad dog mode ---------- */
  const doPoop = useCallback(async () => {
    stopMoving();
    setPose("squat");
    setMood("smug");
    await sleep(1100);
    const r = rearPos();
    const id = nextId();
    sfx.splat();
    const { b, k } = place();
    setPoops((list) => [...list.slice(-7), { id, x: r.x - stateRef.current.facing * 6 * k, bottom: b, scale: k, depth: depthMv.get() }]);
    setStink((v) => clamp(v + 0.12, 0, 1));
    setStats((st) => ({ ...st, goodBoy: clamp(st.goodBoy - 7, 0, 100) }));
    await sleep(500);
    setPose("stand");
    if (Math.random() < 0.6) await say(L.pickOne(L.POOP_LINES), { mood: "smug" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say]);

  const doFart = useCallback(
    async (bomb = Math.random() < 0.45) => {
      stopMoving();
      setPose("fart");
      await sleep(250);
      sfx.fart(bomb);
      const r = rearPos();
      const f = stateRef.current.facing;
      for (let i = 0; i < 5; i++) {
        setTimeout(() => spawn({ kind: "cloud", x: r.x, y: r.y + rand(-10, 10), dx: -f * rand(20, 90), dy: rand(-30, -90), text: String(i) }, 2600), i * 110);
      }
      if (bomb) {
        const { stage: s } = stateRef.current;
        const land = clamp(r.x - f * rand(120, 260), 60, s.w - 60);
        const ground = place().b + 30;
        spawn({ kind: "bomb", x: r.x, y: r.y, dx: land - r.x, dy: r.y - ground }, 950);
        setTimeout(() => {
          sfx.splat();
          spawn({ kind: "blast", x: land, y: ground + 40 }, 3200);
          setStink((v) => clamp(v + 0.25, 0, 1));
        }, 900);
      }
      setStink((v) => clamp(v + 0.14, 0, 1));
      setStats((st) => ({ ...st, goodBoy: clamp(st.goodBoy - (bomb ? 9 : 5), 0, 100) }));
      await sleep(900);
      setPose("stand");
      if (Math.random() < 0.55) await say(L.pickOne(L.BAD_DOG_LINES), { mood: "smug" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say, spawn]
  );

  const toggleBad = () => {
    const next = !badMode;
    setBadMode(next);
    trackEvent("Charles Bad Dog Mode", { on: next });
    void command(async () => {
      if (next) {
        nudgeMood(6);
        setMood("smug");
        await say("Bad dog mode. Finally. [BARK] I've been waiting all day for this.", { mood: "smug", action: "headtilt" });
        await doFart(true);
      } else {
        setMood("happy");
        await say("Good boy mode. I have no memory of any of that.", { mood: "happy", action: "sit" });
      }
    });
  };

  const cleanUp = () =>
    command(async () => {
      setPoops([]);
      setStink(0);
      nudgeMood(-4);
      setStats((st) => ({ ...st, goodBoy: clamp(st.goodBoy + 10, 0, 100) }));
      await say(L.pickOne(L.CLEAN_LINES), { mood: "sassy" });
    });

  /* ---------- places: walk to a spot, comment based on mood ---------- */
  const goToSpot = (spot: Spot) =>
    command(async () => {
      stopMoving();
      const happy = isHappy();
      const target = stagePctFromView(spot.at[0]);
      await goTo(target, depthFromViewY(spot.at[1]), Math.abs(target - xMv.get()) > 45);
      setPose(spot.pose);
      if (spot.pose === "alert") void woofBurst(1);
      nudgeMood(2);
      trackEvent("Charles Went Somewhere", { spot: spot.id });
      const { season: se } = stateRef.current;
      const lines = se === "winter" && spot.winter ? spot.winter : spot;
      await say(L.pickOne(happy ? lines.happy : lines.snark), { mood: happy ? "happy" : "sassy" });
    });

  /** Run off one side of the screen, swap scenes, run in from the other. */
  const travelTo = (id: SceneId) => {
    if (id === sceneId) return;
    try {
      localStorage.setItem("charles-scene", id);
    } catch {
      /* storage blocked: fine */
    }
    trackEvent("Charles Scene Changed", { scene: id });
    void command(async () => {
      stopMoving();
      setBubble(null);
      await walkTo(112, true, true);
      setPoops([]);
      setSnack(null);
      setThreat(null);
      setSceneId(id);
      await sleep(650);
      xMv.set(-14);
      depthMv.set(0.3);
      setTracks([]);
      setFacing(1);
      await walkTo(48, true, true, 0.3);
      setPose("sniff");
      nudgeMood(4);
      await sleep(600);
      setPose("stand");
      const a = SCENES[id].arrive;
      await say(L.pickOne(isHappy() ? a.happy : a.snark), { mood: isHappy() ? "happy" : "sassy" });
    });
  };

  const changeSeason = (next: Season) => {
    if (next === season) return;
    setSeason(next);
    try {
      localStorage.setItem("charles-season", next);
    } catch {
      /* storage blocked: fine */
    }
    trackEvent("Charles Season Changed", { season: next });
    void command(async () => {
      stopMoving();
      setPose("alert");
      nudgeMood(next === "winter" ? 6 : -3);
      await sleep(500);
      setPose("stand");
      await say(
        next === "winter"
          ? "Snow! [BARK] Snow on everything! I have personally barked at every single flake."
          : "Summer. Butterflies, bees, and zero respect for my nap schedule.",
        { mood: next === "winter" ? "happy" : "sassy" }
      );
    });
  };

  /* ---------- click anywhere: he walks there ---------- */
  const onFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!started) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    spawn({ kind: "paw", x: px, y: rect.height - py }, 900);
    const pct = (px / rect.width) * 100;
    const depth = depthFromTopY(py);
    void command(async () => {
      stopMoving();
      nudgeMood(-1);
      const far = Math.abs(pct - xMv.get()) > 40 || Math.abs(depth - depthMv.get()) > 0.7;
      const chatty = Math.random() < 0.3 && !speaking.current;
      if (chatty) void say(L.pickOne(isHappy() ? L.WALK_LINES.happy : L.WALK_LINES.snark), { mood: isHappy() ? "happy" : "sassy" });
      await goTo(pct, depth, far);
      if (Math.random() < 0.35) setPose("sniff");
    });
  };

  /* ---------- petting: scribble over him ---------- */
  const onDogPointerMove = (e: React.PointerEvent) => {
    const now = performance.now();
    const pd = petDist.current;
    if (now - pd.t > 350) pd.d = 0;
    pd.d += Math.abs(e.movementX) + Math.abs(e.movementY);
    pd.t = now;
    if (pd.d > 900 && now > pd.cooldown && !speaking.current && started) {
      pd.d = 0;
      pd.cooldown = now + 8000;
      void doPet();
    }
  };

  /* ---------- threats: barking at the wind, the door, the truck ---------- */
  const blowLeaves = useCallback(
    (count: number) => {
      const { stage: st, season: se } = stateRef.current;
      for (let i = 0; i < count; i++) {
        setTimeout(
          () =>
            spawn(
              {
                kind: "leaf",
                x: -20,
                y: rand(st.h * 0.15, st.h * 0.85),
                dx: st.w + 60,
                dy: rand(-80, 120),
                text: se === "winter" ? "snow" : String(Math.floor(rand(0, 3))),
              },
              3600
            ),
          i * rand(60, 160)
        );
      }
    },
    [spawn]
  );

  const runThreat = useCallback(
    async (t: SceneThreat, line?: string) => {
      const st = stateRef.current;
      const pos = sceneToStage(st.scene, t.at[0], t.at[1], st.stage.w, st.stage.h);
      setThreat({ id: nextId(), t });
      busy.current++;
      try {
        stopMoving();
        if (t.fx === "wind") {
          sfx.windGust();
          blowLeaves(16);
        }
        if (t.fx === "doorbell") {
          sfx.dingDong();
          spawn({ kind: "bell", x: pos.x, y: st.stage.h - pos.y }, 1800);
          const doorPct = clamp((pos.x / st.stage.w) * 100 + 8, st.minX, st.maxX);
          setMood("alert");
          nudgeMood(-6);
          await walkTo(doorPct, true);
        }
        setFacing(pos.x > dogCenterX() ? 1 : -1);
        setPose("alert");
        setMood("alert");
        await sleep(350);
        await woofBurst(t.fx === "doorbell" ? 3 : 2);
        await sleep(150);
        await woofBurst(t.fx === "doorbell" ? 2 : 1);
        setStats((s) => ({ ...s, threats: s.threats + 1 }));
        setPose("stand");
        await say(line ?? t.line, { mood: "sassy", voice: line ? undefined : false });
      } finally {
        busy.current = Math.max(0, busy.current - 1);
        setThreat(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say, spawn, walkTo, woofBurst, blowLeaves]
  );

  /* ---------- visitors: herds at the cabin, cars at home ---------- */
  /** Gets up from a nap (or the floor) without the usual complaining. */
  const rouse = () => {
    if (stateRef.current.sleeping) {
      setSleeping(false);
      setWag("slow");
      mouthMode.current = "pant";
    }
    setPose("stand");
    lastInteract.current = Date.now();
  };

  const wildlife = useCallback(
    async (forced?: Critter, react?: boolean) => {
      const st = stateRef.current;
      if (st.scene.id !== "cabin") return;
      const kind: Critter = forced ?? L.pickOne<Critter>(["deer", "deer", "elk", "elk", "moose", "bear", "bear", "lion"]);
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const count =
        kind === "deer" ? 3 + Math.floor(Math.random() * 3) : kind === "elk" ? 2 + Math.floor(Math.random() * 3) : kind === "moose" || kind === "bear" ? 1 + Math.floor(Math.random() * 2) : 1;
      const members = Array.from({ length: count }, (_, i) => ({
        offset: i * (kind === "moose" ? 240 : kind === "elk" ? 215 : kind === "bear" ? 170 : 160) + rand(-20, 20),
        dy: rand(-30, 40),
        // moose and bears sometimes bring a little one
        scale: 1.3 * (i === 1 && (kind === "moose" || kind === "bear") ? 0.62 : 1) * rand(0.9, 1.06),
        male: kind === "lion" ? false : kind === "bear" ? i === 0 && Math.random() < 0.4 : i === 0 ? Math.random() < 0.8 : Math.random() < 0.15,
      }));
      const duration = { deer: 17, elk: 20, moose: 24, lion: 22, bear: 25 }[kind] + rand(-2, 3);
      const p: Passer = { id: nextId(), kind, dir, ground: { deer: 660, elk: 655, moose: 670, lion: 700, bear: 690 }[kind], duration, members };
      setPasser(p);
      setTimeout(() => setPasser((cur) => (cur?.id === p.id ? null : cur)), duration * 1000 + 400);
      if (kind === "elk" && members[0].male) setTimeout(() => sfx.elkBugle(), duration * 280);
      if (kind === "moose") setTimeout(() => sfx.mooseGrunt(), duration * 400);
      if (kind === "bear") setTimeout(() => sfx.bearGrowl(), duration * 380);

      // He notices once they're in view. Sometimes he just watches; sometimes he goes and says something.
      await sleep(duration * rand(220, 300));
      if (stateRef.current.scene.id !== "cabin") return;
      const predator = kind === "bear" || kind === "lion";
      const willReact = react ?? (!busy.current && !speaking.current && Math.random() < (predator ? 0.8 : 0.45));
      if (!willReact) return;
      busy.current++;
      try {
        rouse();
        stopMoving();
        const view = stateRef.current.scene.view.w;
        const travel = view + 1280;
        const at = (t: number) => (dir === 1 ? -380 + travel * t : view + 380 - travel * t);
        const headX = clamp(at(0.5), 200, view - 200);
        const s2 = stateRef.current;
        const targetPct = (sceneToStage(s2.scene, headX, 0, s2.stage.w, s2.stage.h).x / s2.stage.w) * 100 - dir * 12;
        setMood("alert");
        // Deer and elk: he might trot right out into the meadow after them. Predators: railing only.
        const outThere = !predator && (depthMv.get() > 1 || Math.random() < 0.5);
        await goTo(targetPct, outThere ? rand(1.15, 1.45) : 1, true);
        setFacing(dir === 1 ? 1 : -1);
        setPose("alert");
        const bursts = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bursts; i++) {
          await woofBurst(1 + Math.floor(Math.random() * 3));
          await sleep(rand(350, 1300));
          if (Math.random() < 0.35) setFacing((f) => (f === 1 ? -1 : 1));
          setFacing(dir === 1 ? 1 : -1);
        }
        setStats((x) => ({ ...x, threats: x.threats + 1 }));
        if (predator) {
          nudgeMood(-6);
          await goTo(rand(20, 40), 0.1, true);
        }
        setPose("stand");
        await say(L.pickOne(L.WILDLIFE_LINES[kind]), { mood: predator ? "offended" : "sassy" });
      } finally {
        busy.current = Math.max(0, busy.current - 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say, walkTo, woofBurst]
  );

  const carBy = useCallback(async () => {
    const st = stateRef.current;
    if (st.scene.id !== "home") return;
    const c: CarPass = {
      id: nextId(),
      dir: Math.random() < 0.5 ? 1 : -1,
      color: L.pickOne(["#d9433b", "#2f6fd1", "#c8ccd2", "#f2c233", "#2f9e6b", "#1f2937"]),
      duration: rand(1.8, 2.8),
    };
    setCar(c);
    sfx.carPass(c.duration + 0.6);
    setTimeout(() => setCar((cur) => (cur?.id === c.id ? null : cur)), (c.duration + 1.2) * 1000);
    await sleep(500);
    busy.current++;
    try {
      rouse();
      stopMoving();
      const win = stateRef.current.scene.spots.find((x) => x.id === "window");
      const s2 = stateRef.current;
      const pct = win ? (sceneToStage(s2.scene, win.at[0], 0, s2.stage.w, s2.stage.h).x / s2.stage.w) * 100 : 55;
      setMood("alert");
      await walkTo(pct, true, false, 0.9);
      setFacing(c.dir === 1 ? 1 : -1);
      setPose("alert");
      await woofBurst(2);
      await sleep(rand(250, 700));
      await woofBurst(1 + Math.floor(Math.random() * 2));
      setStats((x) => ({ ...x, threats: x.threats + 1 }));
      setPose("stand");
      await say(L.pickOne(L.CAR_LINES), { mood: "sassy" });
    } finally {
      busy.current = Math.max(0, busy.current - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say, walkTo, woofBurst]);

  /** A neighborhood dog wanders through. Charles says hello. Too enthusiastically. */
  const dogVisit = useCallback(async () => {
    const st = stateRef.current;
    const breed = L.pickOne<Breed>(["golden", "dalmatian", "husky"]);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const depth = st.scene.meadow ? 0.22 : 0.35;
    const start = dir === 1 ? -14 : 114;
    const stopPct = rand(38, 62);
    const id = nextId();
    visitorX.set(start);
    setVisitor({ id, breed, dir, depth, walking: true, startled: false });
    const walkSecs = (Math.abs(stopPct - start) / 100) * (st.stage.w / 150);
    const arrive = animate(visitorX, stopPct, { duration: walkSecs, ease: "linear" });

    busy.current++;
    try {
      await sleep(900);
      rouse();
      stopMoving();
      setMood("happy");
      setWag("fast");
      const { k } = placeAt(depth);
      const behind = stopPct - dir * (((stateRef.current.dogW * k) * 0.55) / stateRef.current.stage.w) * 100;
      await settle(arrive, walkSecs);
      setVisitor((v) => (v && v.id === id ? { ...v, walking: false } : v));
      await goTo(behind, depth, true);
      setFacing(dir);
      setPose("sniff");
      await sleep(700);
      // The "hello". Very brief. Very cartoon.
      setPose("hump");
      mouthMode.current = "open";
      const x0 = xMv.get();
      const wiggle = 0.35 * dir;
      await settle(animate(xMv, [x0, x0 + wiggle, x0, x0 + wiggle, x0, x0 + wiggle, x0, x0 + wiggle, x0], { duration: 1.1, ease: "easeInOut" }), 1.1);
      mouthMode.current = "pant";
      // Both bolt, opposite directions.
      setVisitor((v) => (v && v.id === id ? { ...v, walking: true, startled: true } : v));
      spawn({ kind: "caption", x: (visitorX.get() / 100) * stateRef.current.stage.w, y: placeAt(depth).b + stateRef.current.dogH * k * 0.9, text: "!?" }, 1200);
      const flee = animate(visitorX, dir === 1 ? 125 : -25, { duration: 1.6, ease: "easeIn" });
      setPose("stand");
      setFacing(dir === 1 ? -1 : 1);
      nudgeMood(8);
      await goTo(dir === 1 ? 12 : 88, depth, true);
      await settle(flee, 1.6);
      setVisitor((v) => (v && v.id === id ? null : v));
      setWag("slow");
      trackEvent("Charles Dog Visit", { breed });
      await say(L.pickOne(L.HUMP_LINES), { mood: "smug" });
    } finally {
      busy.current = Math.max(0, busy.current - 1);
      setVisitor((v) => (v && v.id === id ? null : v));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say, spawn]);

  /** The on-screen doorbell button. */
  const ringDoorbell = () => {
    const t = SCENES.home.threats.find((x) => x.fx === "doorbell");
    if (!t || !started) return;
    setBellPressed(true);
    setTimeout(() => setBellPressed(false), 350);
    trackEvent("Charles Doorbell Rung", {});
    void command(() => runThreat(t, L.pickOne(L.DOORBELL_LINES)));
  };

  const chaosThreat = () => {
    const sc = SCENES[sceneId];
    const t = sc.threats.find((x) => x.fx === (sceneId === "home" ? "doorbell" : "wind"));
    if (t) void command(() => runThreat(t));
  };

  /* ---------- idle life: wander, sniff, nap ---------- */
  useEffect(() => {
    let alive = true;
    const idle = async () => {
      while (alive) {
        await sleep(rand(3500, 7500));
        if (!alive) return;
        const st = stateRef.current;
        if (!st.started || busy.current || speaking.current || st.sleeping) continue;
        if (Date.now() - lastInteract.current < 3500) continue;

        if (Date.now() - lastInteract.current > 75_000 && !st.badMode) {
          setPose("lie");
          await sleep(1200);
          if (busy.current) continue;
          setPose("sleep");
          setSleeping(true);
          setWag("none");
          continue;
        }

        if (st.badMode && Math.random() < 0.55) {
          busy.current++;
          try {
            await (Math.random() < 0.4 ? doPoop() : doFart());
          } finally {
            busy.current--;
          }
          continue;
        }

        const roll = Math.random();
        if (roll < 0.55) {
          const d = st.scene.meadow && Math.random() < 0.35 ? rand(1.1, 1.9) : Math.random();
          await goTo(rand(st.minX, st.maxX), d);
          if (!busy.current) setPose(Math.random() < 0.3 ? "sniff" : "stand");
        } else if (roll < 0.7) {
          setPose("headtilt");
        } else if (roll < 0.82) {
          setPose("sit");
        } else {
          setPose("stand");
          setWag(Math.random() < 0.5 ? "fast" : "slow");
        }
      }
    };
    void idle();
    return () => {
      alive = false;
    };
  }, [walkTo, doPoop, doFart]);

  /* the wind is always up to something */
  useEffect(() => {
    let alive = true;
    const loop = async () => {
      await sleep(9000);
      while (alive) {
        const st = stateRef.current;
        if (st.started && !busy.current && !speaking.current && !st.sleeping) await runThreat(L.pickOne(threatsFor(st.scene, st.season)));
        await sleep(rand(26000, 46000));
      }
    };
    void loop();
    return () => {
      alive = false;
    };
  }, [runThreat]);

  /* the wildlife never stops: as soon as one group leaves, the next one is on its way */
  useEffect(() => {
    let alive = true;
    const loop = async () => {
      await sleep(rand(4000, 8000));
      while (alive) {
        const st = stateRef.current;
        if (st.started && st.scene.id === "cabin" && !st.passerId) void wildlife();
        await sleep(rand(8000, 18000));
      }
    };
    void loop();
    return () => {
      alive = false;
    };
  }, [wildlife]);

  /* cars drive past the house now and then */
  useEffect(() => {
    let alive = true;
    const loop = async () => {
      await sleep(rand(16000, 24000));
      while (alive) {
        const st = stateRef.current;
        if (st.started && st.scene.id === "home" && !busy.current && !speaking.current) await carBy();
        await sleep(rand(35000, 70000));
      }
    };
    void loop();
    return () => {
      alive = false;
    };
  }, [carBy]);

  /* a neighborhood dog wanders through every couple of minutes */
  useEffect(() => {
    let alive = true;
    const loop = async () => {
      await sleep(rand(45000, 70000));
      while (alive) {
        const st = stateRef.current;
        if (st.started && !busy.current && !speaking.current && !st.badMode) await dogVisit();
        await sleep(rand(90000, 150000));
      }
    };
    void loop();
    return () => {
      alive = false;
    };
  }, [dogVisit]);

  /* a few aspen leaves drift by outside in summer */
  useEffect(() => {
    if (sceneId !== "cabin" || season !== "summer") return;
    const id = setInterval(() => blowLeaves(Math.random() < 0.5 ? 1 : 3), 6500);
    return () => clearInterval(id);
  }, [sceneId, season, blowLeaves]);

  /* sleepy z's */
  useEffect(() => {
    if (!sleeping) return;
    mouthMode.current = "closed";
    const id = setInterval(() => {
      const h = headPos();
      spawn({ kind: "zzz", x: h.x, y: h.y - 30, text: Math.random() < 0.5 ? "z" : "Z" }, 2200);
    }, 900);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleeping, spawn]);

  /* stink slowly clears */
  useEffect(() => {
    const id = setInterval(() => setStink((v) => (v > 0 ? Math.max(0, v - 0.02) : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      speakAbort.current?.abort();
    },
    []
  );

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    sfx.setMuted(next);
    if (!next) sfx.unlockAudio();
  };

  /* ---------- actions (menu + keyboard) ---------- */
  type Action = { id: string; label: string; icon: React.ReactNode; tone: string; key?: string; run: () => void; active?: boolean };
  const actionGroups: { title: string; items: Action[] }[] = [
    {
      title: "Tricks",
      items: [
        { id: "talk", label: "Talk", icon: <MessageCircle />, tone: "bg-indigo-500", key: "1", run: talk },
        { id: "sit", label: "Sit", icon: <ArrowDown />, tone: "bg-sky-500", key: "2", run: doSit },
        { id: "lie", label: "Lie down", icon: <Moon />, tone: "bg-violet-500", key: "3", run: doLie },
        { id: "jump", label: "Jump", icon: <ArrowUp />, tone: "bg-emerald-500", key: "4", run: doJump },
        { id: "roll", label: "Roll over", icon: <RotateCw />, tone: "bg-teal-500", key: "5", run: doRoll },
        { id: "spin", label: "Spin", icon: <Sparkles />, tone: "bg-fuchsia-500", key: "6", run: doSpin },
      ],
    },
    {
      title: "Treats & play",
      items: [
        { id: "treat", label: "Treat", icon: <Bone />, tone: "bg-amber-500", key: "7", run: doTreat },
        { id: "pet", label: "Pet him", icon: <Hand />, tone: "bg-pink-500", key: "8", run: doPet },
        { id: "fetch", label: "Fetch", icon: <CircleSlash />, tone: "bg-rose-500", key: "9", run: doFetch },
        { id: "dinner", label: "Dinner time", icon: <Utensils />, tone: "bg-orange-500", key: "0", run: doDinner },
      ],
    },
    {
      title: "Chaos",
      items: [
        sceneId === "home"
          ? { id: "doorbell", label: "Ring the doorbell", icon: <Bell />, tone: "bg-yellow-500", key: "W", run: chaosThreat }
          : { id: "wind", label: "Gust of wind", icon: <Wind />, tone: "bg-cyan-500", key: "W", run: chaosThreat },
        sceneId === "home"
          ? { id: "car", label: "Car drives by", icon: <Car />, tone: "bg-red-500", key: "V", run: () => void command(carBy) }
          : { id: "herd", label: "Wildlife parade", icon: <Trees />, tone: "bg-green-600", key: "V", run: () => void command(() => wildlife(undefined, true)) },
        { id: "visitor", label: "Dog walks by", icon: <Dog />, tone: "bg-yellow-600", key: "G", run: () => void command(dogVisit) },
        { id: "bad", label: badMode ? "Bad dog mode: on" : "Bad dog mode", icon: <Skull />, tone: "bg-lime-500", key: "X", run: toggleBad, active: badMode },
        ...(badMode
          ? [
              { id: "bomb", label: "Stink bomb", icon: <Flame />, tone: "bg-lime-600", run: () => void command(() => doFart(true)) },
              { id: "poop", label: "Poop", icon: <CircleSlash />, tone: "bg-amber-700", run: () => void command(doPoop) },
            ]
          : []),
        ...(poops.length > 0 || stink > 0.05 ? [{ id: "clean", label: "Clean up", icon: <Brush />, tone: "bg-slate-500", key: "C", run: cleanUp }] : []),
      ],
    },
  ];
  const actionsRef = useRef(actionGroups);
  actionsRef.current = actionGroups;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (guideOpen || photosOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const k = e.key.toUpperCase();
      if (k === "ESCAPE") {
        setPanel(null);
        return;
      }
      if (k === "?" || k === "H") {
        setGuideOpen(true);
        return;
      }
      if (!stateRef.current.started) {
        if (k === "ENTER" || k === " ") start();
        return;
      }
      const hit = actionsRef.current.flatMap((g) => g.items).find((a) => a.key === k);
      if (hit) {
        e.preventDefault();
        hit.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideOpen, photosOpen]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
  const stinkOpacity = Math.min(0.55, stink * 0.6);
  const mi = moodInfo(moodScore);
  const crop = sceneCrop(scene, stage.w, stage.h);

  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden bg-slate-900 text-white">
      <div ref={stageRef} className="absolute inset-0">
        <CartoonScene sceneId={sceneId} season={season} viewBox={crop.viewBox} passer={passer} car={car} layer="back" />

        {/* tracks out in the meadow (behind the railing) */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          {tracks.filter((t) => t.meadow).map((t) => (
            <PawTrack key={t.id} t={t} />
          ))}
        </div>

        {/* Charles, when he's out in the meadow: between the meadow and the railing */}
        <div className="absolute inset-0 z-[3]">
          {sceneId === "cabin" && <CartoonScene sceneId={sceneId} season={season} viewBox={crop.viewBox} passer={null} car={null} layer="front" />}
        </div>

        {/* tracks on the deck */}
        <div className="pointer-events-none absolute inset-0 z-[4]">
          {tracks.filter((t) => !t.meadow).map((t) => (
            <PawTrack key={t.id} t={t} />
          ))}
        </div>

        {/* click the floor: he walks there */}
        <div className="absolute inset-0 z-[5] cursor-pointer" onClick={onFloorClick} aria-hidden="true" />

        {/* places you can send him */}
        {started &&
          scene.spots.map((spot) => {
            const p = sceneToStage(scene, spot.at[0], spot.at[1], stage.w, stage.h);
            if (p.x < 10 || p.x > stage.w - 10) return null;
            return (
              <button
                key={`${sceneId}-${spot.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void goToSpot(spot);
                }}
                className="group absolute z-[6] -translate-x-1/2 -translate-y-1/2"
                style={{ left: p.x, top: p.y }}
                aria-label={`Send Charles to the ${spot.label.toLowerCase()}`}
              >
                <span className="relative flex h-7 w-7 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/40 [animation-duration:2.4s]" />
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow ring-2 ring-white/60 transition group-hover:scale-110">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white opacity-80 backdrop-blur transition group-hover:opacity-100">
                  {spot.label}
                </span>
              </button>
            );
          })}

        {/* a real doorbell button at home, right by the door */}
        {sceneId === "home" &&
          started &&
          (() => {
            const b = sceneToStage(scene, 890, 330, stage.w, stage.h);
            if (b.x < 30 || b.x > stage.w - 30) return null;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  ringDoorbell();
                }}
                className="group absolute z-[6] -translate-x-1/2 -translate-y-1/2"
                style={{ left: b.x, top: b.y }}
                aria-label="Ring the doorbell"
                title="Ring the doorbell"
              >
                <span className="relative flex h-[72px] w-12 flex-col items-center justify-center rounded-2xl border-2 border-amber-900/60 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_6px_14px_rgba(0,0,0,.35)]">
                  <span className="absolute inset-0 animate-ping rounded-2xl ring-4 ring-amber-300/60 [animation-duration:2.2s]" />
                  <span
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-900/60 bg-gradient-to-b from-white to-amber-100 shadow-inner transition",
                      bellPressed ? "translate-y-0.5 scale-90 bg-amber-200" : "group-hover:scale-105",
                    ].join(" ")}
                  >
                    <Bell className="h-4 w-4 text-amber-800" />
                  </span>
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-amber-950 shadow">
                  Ring me
                </span>
              </button>
            );
          })()}

        {/* threat props, pinned to real spots in the scene */}
        <AnimatePresence>{threat && <ThreatProp key={threat.id} t={threat.t} sceneId={sceneId} stage={stage} />}</AnimatePresence>

        {/* poop (bad dog mode) */}
        <AnimatePresence>
          {poops.map((p) => (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute"
              style={{ left: p.x, bottom: p.bottom - 6 * p.scale, zIndex: p.depth > 1 ? 2 : p.depth < dogDepth ? 11 : 9 }}
              initial={{ scale: 0, y: -30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, rotate: 90 }}
              transition={{ type: "spring", stiffness: 400, damping: 14 }}
            >
              <div className="relative -translate-x-1/2">
                <PoopArt size={Math.round(dogW * 0.2 * p.scale)} />
                <svg viewBox="0 0 40 30" className="charles-stinkrise absolute -top-6 left-1/2 w-10 -translate-x-1/2" aria-hidden="true">
                  <path d="M8 28 C2 20 14 16 8 6 M20 28 C14 20 26 16 20 4 M32 28 C26 20 38 16 32 6" stroke="#8cc63f" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
                <span className="charles-fly absolute -top-2 left-1/2 h-1.5 w-1.5 rounded-full bg-gray-900" />
                <span className="charles-fly absolute -top-1 left-1/3 h-1.5 w-1.5 rounded-full bg-gray-900 [animation-delay:.4s]" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* kid's hand holding food */}
        <AnimatePresence>
          {snack && <KidHand key={snack.id} snack={snack} yell={kidYell} handBottom={dogBottom + dogH * 0.72 + 10} size={Math.round(dogW * 0.2)} />}
        </AnimatePresence>

        {/* THE DOG */}
        {/* the visiting dog */}
        {visitor && (
          <motion.div
            className="pointer-events-none absolute z-[9]"
            style={{
              left: visitorLeft,
              bottom: placeAt(visitor.depth).b,
              width: dogW * 0.95 * placeAt(visitor.depth).k,
              height: dogW * 0.95 * placeAt(visitor.depth).k * (128 / 180),
              x: "-50%",
            }}
          >
            <div className="h-full w-full" style={{ transform: `scaleX(${visitor.dir})` }}>
              <VisitorDog breed={visitor.breed} walking={visitor.walking} startled={visitor.startled} />
            </div>
          </motion.div>
        )}

        <motion.div
          className="absolute"
          style={{ left: leftCss, bottom: bottomMv, width: dogW, height: dogH, x: "-50%", scale: scaleMv, originX: 0.5, originY: 1, zIndex: inMeadow ? 2 : 10 }}
        >
          <motion.div className="h-full w-full" style={{ y: yMv, rotate: rotMv, rotateY: spinMv }}>
            <div
              className="h-full w-full cursor-pointer transition-transform duration-200"
              style={{ transform: `scaleX(${facing})` }}
              onClick={(e) => {
                e.stopPropagation();
                if (!started) return start();
                if (sleeping) return void command(async () => wake());
                void talk();
              }}
              onPointerMove={onDogPointerMove}
              role="button"
              tabIndex={0}
              aria-label="Talk to Charles"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void talk();
                }
              }}
            >
              <CharlesDog
                ref={svgRef}
                pose={pose}
                mood={mood}
                walking={walking}
                running={running}
                wag={wag}
                thinking={thinking}
                partsRef={partsRef}
                winter={season === "winter" && sceneId === "cabin"}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* particles */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {particles.map((p) => (
            <ParticleView key={p.id} p={p} />
          ))}
        </div>

        {/* stink haze */}
        <div
          className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_bottom,rgba(132,204,22,.7),rgba(101,163,13,.3)_45%,transparent_75%)] transition-opacity duration-1000"
          style={{ opacity: stinkOpacity }}
        />

        {/* speech bubble */}
        <AnimatePresence>
          {(bubble || thinking) && (
            <motion.div
              key="bubble"
              className="pointer-events-none absolute z-30 w-max max-w-[min(320px,86vw)]"
              style={{ left: bubbleLeft, bottom: bubbleBottom, x: "-50%" }}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
            >
              <div className="relative rounded-2xl border-2 border-slate-900/80 bg-white px-4 py-3 text-sm font-bold leading-snug text-slate-900 shadow-xl">
                {thinking && !bubble ? (
                  <span className="flex items-center gap-2 text-slate-500">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:.3s]" />
                    </span>
                    thinking about snacks
                  </span>
                ) : bubble ? (
                  <BubbleText bubble={bubble} />
                ) : null}
                <span className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-slate-900/80 bg-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------- title pill (top left) ---------------- */}
      <div className="pointer-events-none absolute left-2 top-2 z-40 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/55 p-1.5 pr-3 shadow-2xl backdrop-blur-xl">
          <Link
            href="/projects"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Back to projects"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mr-2">
            <div className="text-base font-black leading-tight tracking-tight sm:text-lg">Charles</div>
            <div className="hidden text-[11px] font-semibold text-white/55 sm:block">Lab/Chow. Sassy. Does not fetch.</div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${mi.cls}`}>
            <mi.Icon className="h-3.5 w-3.5" />
            {mi.label}
          </span>
        </div>
      </div>

      {/* ---------------- the dock: right side on desktop, bottom bar on phones ---------------- */}
      <nav
        aria-label="Charles controls"
        className="absolute inset-x-2 bottom-2 z-40 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-1/2 sm:-translate-y-1/2"
      >
        <div className="flex items-center justify-around gap-1 rounded-3xl border border-white/15 bg-slate-950/60 p-1.5 shadow-2xl backdrop-blur-xl sm:flex-col sm:justify-start sm:p-2">
          <DockButton label="Actions" active={panel === "actions"} tone="from-amber-400 to-orange-500" disabled={!started} onClick={() => setPanel(panel === "actions" ? null : "actions")}>
            <Zap />
          </DockButton>
          <DockButton label="Places" active={panel === "places"} tone="from-emerald-400 to-teal-500" disabled={!started} onClick={() => setPanel(panel === "places" ? null : "places")}>
            <MapPin />
          </DockButton>
          <DockButton label="Weather" active={panel === "weather"} tone="from-sky-400 to-indigo-500" onClick={() => setPanel(panel === "weather" ? null : "weather")}>
            {season === "winter" ? <Snowflake /> : <CloudSun />}
          </DockButton>
          <span className="hidden h-px w-10 bg-white/15 sm:my-1 sm:block" />
          <DockButton label="Guide" onClick={() => setGuideOpen(true)}>
            <BookOpen />
          </DockButton>
          <DockButton label="Photos" onClick={() => setPhotosOpen(true)} className="hidden sm:flex">
            <Camera />
          </DockButton>
          <DockButton label={muted ? "Muted" : "Sound"} onClick={toggleMute}>
            {muted ? <VolumeX /> : <Volume2 />}
          </DockButton>
          <ThemeDockButton />
        </div>
      </nav>

      {/* the open panel: big, easy tiles */}
      <AnimatePresence>
        {panel && (
          <motion.div
            key={panel}
            className="absolute inset-x-2 bottom-[92px] z-40 sm:inset-x-auto sm:bottom-auto sm:right-[112px] sm:top-1/2 sm:w-[360px] sm:-translate-y-1/2"
            initial={{ opacity: 0, x: 16, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="max-h-[52dvh] overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)]">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-sm font-black uppercase tracking-widest text-white/80">
                  {panel === "actions" ? "Actions" : panel === "places" ? "Places" : "Weather"}
                </div>
                <button type="button" onClick={() => setPanel(null)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close panel">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {panel === "actions" &&
                actionGroups.map((g) => (
                  <section key={g.title} className="mb-2">
                    <div className="px-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white/40">{g.title}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {g.items.map((a) => (
                        <Tile key={a.id} label={a.label} tone={a.tone} hint={a.key} active={a.active} onClick={a.run}>
                          {a.icon}
                        </Tile>
                      ))}
                    </div>
                  </section>
                ))}

              {panel === "places" && (
                <>
                  <div className="px-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white/40">Go somewhere</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {scene.spots.map((spot, i) => (
                      <Tile key={spot.id} label={spot.label} tone={SPOT_TONES[i % SPOT_TONES.length]} onClick={() => void goToSpot(spot)}>
                        <Footprints />
                      </Tile>
                    ))}
                  </div>
                  <div className="px-1 pb-1.5 pt-3 text-[10px] font-extrabold uppercase tracking-widest text-white/40">Travel</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(SCENES) as SceneId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        disabled={id === sceneId}
                        onClick={() => travelTo(id)}
                        className={[
                          "relative flex h-20 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-left shadow-lg ring-1 ring-white/10 transition active:scale-95",
                          id === "cabin" ? "from-emerald-600 to-green-800" : "from-orange-500 to-rose-600",
                          id === sceneId ? "opacity-60" : "hover:brightness-110",
                        ].join(" ")}
                      >
                        <span className="absolute right-2 top-2 opacity-80 [&>svg]:h-7 [&>svg]:w-7">{id === "cabin" ? <Mountain /> : <Home />}</span>
                        <span className="text-sm font-black">{SCENES[id].name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{id === sceneId ? "You are here" : "Go"}</span>
                      </button>
                    ))}
                  </div>
                  <p className="px-1 pt-3 text-[11px] font-semibold text-white/50">Tip: click anywhere on the floor and he walks right there.</p>
                </>
              )}

              {panel === "weather" && (
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "summer", label: "Summer", sub: "Wildflowers, butterflies, sunbeams", icon: <Sun />, tone: "from-amber-400 to-orange-500" },
                      { id: "winter", label: "Winter", sub: "Snow on absolutely everything", icon: <Snowflake />, tone: "from-sky-400 to-indigo-600" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => changeSeason(o.id)}
                      className={[
                        "relative flex h-32 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-left shadow-lg transition active:scale-95",
                        o.tone,
                        season === o.id ? "ring-4 ring-white/80" : "ring-1 ring-white/10 hover:brightness-110",
                      ].join(" ")}
                    >
                      <span className="absolute right-3 top-3 [&>svg]:h-9 [&>svg]:w-9">{o.icon}</span>
                      <span className="text-base font-black">{o.label}</span>
                      <span className="text-[11px] font-semibold leading-snug text-white/85">{o.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- HUD ---------------- */}
      <div className="pointer-events-none absolute left-2 top-[62px] z-30 flex flex-col gap-1.5 sm:left-4 sm:top-auto sm:bottom-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2 shadow-xl backdrop-blur-xl">
          <span className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold sm:inline-flex ${mi.cls}`}>
            <mi.Icon className="h-3.5 w-3.5" />
            {mi.label}
          </span>
          <div className="w-24 sm:w-32">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-white/60">
              <span>Good boy</span>
              <span className="tabular-nums text-white">{Math.round(stats.goodBoy)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stats.goodBoy > 60 ? "bg-emerald-400" : stats.goodBoy > 30 ? "bg-amber-400" : "bg-lime-400"}`}
                style={{ width: `${stats.goodBoy}%` }}
              />
            </div>
          </div>
          <div className="hidden gap-3 border-l border-white/10 pl-3 text-[11px] font-bold text-white/70 sm:flex">
            <span>
              <b className="tabular-nums text-white">{stats.snacks}</b> snacks stolen
            </span>
            <span>
              <b className="tabular-nums text-white">{stats.threats}</b> threats
            </span>
          </div>
        </div>
      </div>

      {/* clean-up shortcut when things get gross */}
      <AnimatePresence>
        {(poops.length > 0 || stink > 0.1) && started && (
          <motion.button
            type="button"
            onClick={cleanUp}
            className="absolute bottom-[92px] right-3 z-30 inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-4 py-2.5 text-sm font-extrabold text-lime-950 shadow-xl ring-2 ring-lime-200 transition hover:bg-lime-300 sm:bottom-4 sm:right-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Brush className="h-4 w-4" /> Clean up
          </motion.button>
        )}
      </AnimatePresence>

      {sleeping && started && (
        <div className="pointer-events-none absolute bottom-[96px] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/65 px-4 py-2 text-xs font-bold text-white backdrop-blur sm:bottom-6">
          Shh. Click him to wake him up. He will deny he was asleep.
        </div>
      )}

      {/* ---------------- intro ---------------- */}
      <AnimatePresence>
        {!started && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/75 p-6 text-center shadow-2xl backdrop-blur-xl"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
            >
              <div className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-indigo-200">
                <Zap className="h-3.5 w-3.5" /> AI robot dog
              </div>
              <h1 className="text-3xl font-black tracking-tight">Charles is napping</h1>
              <p className="mt-2 text-sm font-semibold text-white/70">
                Black Lab and Chow mix. Sassy. Barks at the wind mid-sentence. Steals food from small hands. Absolutely does not fetch.
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-base font-black text-slate-950 shadow-lg transition hover:brightness-110 active:scale-[.98]"
              >
                <Sun className="h-5 w-5" /> Wake him up
              </button>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white/60 hover:text-white"
              >
                <BookOpen className="h-3.5 w-3.5" /> How to play
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GuideDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        online={online}
        aiVoice={aiVoice}
        setAiVoice={setAiVoice}
        onPhotos={() => {
          setGuideOpen(false);
          setTimeout(() => setPhotosOpen(true), 220);
        }}
      />
      <PhotosDialog open={photosOpen} onClose={() => setPhotosOpen(false)} />

      <style>{PAGE_CSS}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top bar pieces                                                     */
/* ------------------------------------------------------------------ */

type PanelId = "actions" | "places" | "weather";

const SPOT_TONES = ["bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-pink-500", "bg-teal-500"];

/** A big dock button: icon over a label, glowing gradient when its panel is open. */
function DockButton({
  label,
  onClick,
  children,
  active,
  tone = "from-white/20 to-white/5",
  disabled,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  tone?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={label}
      className={[
        "group flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-white transition active:scale-95 disabled:opacity-40 sm:h-[68px] sm:w-[72px]",
        active ? `bg-gradient-to-br shadow-lg ${tone}` : "hover:bg-white/10",
        className,
      ].join(" ")}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition [&>svg]:h-6 [&>svg]:w-6 ${active ? "" : `bg-gradient-to-br ${tone} group-hover:scale-110`}`}>
        {children}
      </span>
      <span className="text-[10px] font-extrabold tracking-wide text-white/90 sm:text-[11px]">{label}</span>
    </button>
  );
}

function ThemeDockButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <DockButton label={dark ? "Evening" : "Daytime"} onClick={() => setTheme(dark ? "light" : "dark")} className="hidden sm:flex">
      {dark ? <Moon /> : <Sun />}
    </DockButton>
  );
}

/** A big square tile inside a panel. */
function Tile({
  label,
  tone,
  hint,
  active,
  onClick,
  children,
}: {
  label: string;
  tone: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition active:scale-95",
        active ? "border-lime-300/70 bg-lime-400/20" : "border-white/10 bg-white/[0.06] hover:border-white/25 hover:bg-white/[0.12]",
      ].join(" ")}
    >
      {hint && <kbd className="absolute right-1.5 top-1.5 rounded bg-white/10 px-1 text-[9px] font-bold text-white/50">{hint}</kbd>}
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg [&>svg]:h-5 [&>svg]:w-5 ${tone}`}>{children}</span>
      <span className="text-[12px] font-extrabold leading-tight">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Popups                                                             */
/* ------------------------------------------------------------------ */

const GUIDE: { icon: React.ReactNode; tone: string; title: string; body: string }[] = [
  { icon: <MousePointerClick />, tone: "from-indigo-500 to-violet-500", title: "Click Charles", body: "He tells you what's on his mind. Usually food." },
  { icon: <Footprints />, tone: "from-emerald-500 to-teal-500", title: "Click anywhere", body: "He walks there. Boss him around too much and he gets snarky." },
  { icon: <MapPin />, tone: "from-sky-500 to-cyan-500", title: "Places", body: "Send him to the bowl, the rug, the snack table, or travel between the cabin and home." },
  { icon: <CloudSun />, tone: "from-amber-400 to-orange-500", title: "Weather", body: "Summer wildflowers or winter with snow on absolutely everything." },
  { icon: <Hand />, tone: "from-pink-500 to-rose-500", title: "Pet him", body: "Scribble your cursor over him. Mood goes up. Dignity goes down." },
  { icon: <Utensils />, tone: "from-orange-500 to-red-500", title: "Dinner time", body: "A kid holds food at nose height. Rookie mistake." },
  { icon: <Smile />, tone: "from-emerald-400 to-lime-500", title: "Mood", body: "Treats and pets make him happy. Commands and fetch make him snarky." },
  { icon: <CircleSlash />, tone: "from-rose-500 to-fuchsia-500", title: "Fetch", body: "Not a service he offers. You were warned." },
  { icon: <Skull />, tone: "from-lime-500 to-green-600", title: "Bad dog mode", body: "Poop. Stink clouds. Zero regrets. Open a window." },
  { icon: <Moon />, tone: "from-violet-500 to-indigo-600", title: "Leave him alone", body: "He falls asleep. He will deny it." },
  { icon: <Trees />, tone: "from-green-500 to-emerald-700", title: "Wildlife", body: "Deer, elk, moose, bears and the odd mountain lion wander past the cabin all day. He has notes." },
  { icon: <Footprints />, tone: "from-sky-400 to-blue-600", title: "The meadow", body: "Click past the railing and he takes the steps down into the meadow. In winter he leaves tracks." },
  { icon: <Dog />, tone: "from-yellow-500 to-amber-700", title: "Visitors", body: "A neighborhood dog stops by now and then. Charles is very friendly. Too friendly." },
  { icon: <Bell />, tone: "from-amber-400 to-yellow-600", title: "Doorbell", body: "At home, push the doorbell by the door. He takes it personally. So do cars." },
];

function GuideDialog({
  open,
  onClose,
  online,
  aiVoice,
  setAiVoice,
  onPhotos,
}: {
  open: boolean;
  onClose: () => void;
  online: boolean | null;
  aiVoice: boolean;
  setAiVoice: (v: boolean) => void;
  onPhotos: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <DialogBackdrop transition className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition duration-200 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-6">
        <DialogPanel
          transition
          className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/90 p-5 text-white shadow-2xl backdrop-blur-xl transition duration-200 data-[closed]:scale-95 data-[closed]:opacity-0 sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">Field guide to Charles</DialogTitle>
              <p className="mt-1 text-sm font-semibold text-white/60">Everything you need to know to handle a sassy Lab/Chow.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {GUIDE.map((g) => (
              <div key={g.title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg [&>svg]:h-5 [&>svg]:w-5 ${g.tone}`}>{g.icon}</span>
                <div>
                  <div className="text-sm font-extrabold">{g.title}</div>
                  <div className="text-xs font-semibold text-white/60">{g.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700">
              <Keyboard className="h-5 w-5" />
            </span>
            <div className="text-xs font-semibold text-white/65">
              <b className="text-white">Shortcuts:</b> 1 to 0 for actions, W for doorbell or wind, V for wildlife or a passing car, G for a visiting dog, X for bad dog mode, C to clean up, H for this guide.
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                online === false ? "bg-amber-400/15 text-amber-200" : online ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/70"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${online === false ? "bg-amber-400" : online ? "bg-emerald-400" : "bg-white/50"}`} />
              {online === false ? "Offline: canned sass" : online ? "OpenAI brain + voice online" : "AI connects when he talks"}
            </span>
            <button
              type="button"
              onClick={() => setAiVoice(!aiVoice)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-extrabold text-white/80 hover:bg-white/15"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Voice: {aiVoice ? "AI" : "Robot"}
            </button>
            <button
              type="button"
              onClick={onPhotos}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-[11px] font-extrabold text-slate-950 hover:brightness-110"
            >
              <Camera className="h-3.5 w-3.5" />
              Meet the real Charles
            </button>
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-relaxed text-white/45">
            Barks are real recordings from Wikimedia Commons, used under CC BY-SA 4.0:{" "}
            <a className="underline hover:text-white" href="https://commons.wikimedia.org/wiki/File:Rottweiler_Barking.oga" target="_blank" rel="noopener noreferrer">
              &ldquo;Rottweiler Barking&rdquo; by MichaeltheFox8621
            </a>{" "}
            and{" "}
            <a className="underline hover:text-white" href="https://commons.wikimedia.org/wiki/File:Dog_barking.webm" target="_blank" rel="noopener noreferrer">
              &ldquo;Dog barking&rdquo; by Dr. Nono YesMaybe
            </a>
            , trimmed and pitched down. Everything else is drawn and synthesized in your browser.
          </p>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function PhotosDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <DialogBackdrop transition className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition duration-200 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-6">
        <DialogPanel
          transition
          className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/90 p-5 text-white shadow-2xl backdrop-blur-xl transition duration-200 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">Meet the real Charles</DialogTitle>
              <p className="mt-1 text-sm font-semibold text-white/60">The cartoon is based on these. He approved none of them.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <RealPhotos />
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage pieces                                                       */
/* ------------------------------------------------------------------ */

function BubbleText({ bubble }: { bubble: Bubble }) {
  return (
    <span>
      {bubble.segments.map((seg, i) => (
        <Fragment key={i}>
          {seg && <span className={i > bubble.active ? "opacity-35" : i === bubble.active ? "" : "opacity-80"}>{seg} </span>}
          {i < bubble.segments.length - 1 && (
            <span
              className={[
                "mr-1 inline-flex h-5 w-7 items-center justify-center rounded-md align-middle",
                i < bubble.active ? "bg-rose-500" : "bg-rose-500/20",
              ].join(" ")}
              aria-label="bark"
            >
              <BarkWaves size={14} />
            </span>
          )}
        </Fragment>
      ))}
    </span>
  );
}

function ParticleView({ p }: { p: Particle }) {
  const base = "absolute -translate-x-1/2 translate-y-1/2";
  const style = { left: p.x, bottom: p.y };
  switch (p.kind) {
    case "woof":
      return (
        <motion.div
          className={base}
          style={style}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.25, 1.4], opacity: [0, 1, 0], x: (p.dx ?? 1) * 24 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div style={{ transform: `scaleX(${p.dx ?? 1})` }}>
            <BarkWaves size={46} />
          </div>
        </motion.div>
      );
    case "cloud":
      return (
        <motion.div
          className={base}
          style={style}
          initial={{ scale: 0.2, opacity: 0.95, rotate: -10 }}
          animate={{ scale: 1.5, opacity: 0, x: p.dx, y: p.dy, rotate: 12 }}
          transition={{ duration: 2.4, ease: "easeOut" }}
        >
          <StinkCloud size={70} seed={Number(p.text ?? 0)} />
        </motion.div>
      );
    case "bomb":
      return (
        <motion.div
          className={`${base} drop-shadow-[0_0_14px_rgba(163,230,53,.9)]`}
          style={style}
          animate={{ x: [0, (p.dx ?? 0) * 0.5, p.dx ?? 0], y: [0, -170, p.dy ?? 0], rotate: 540 }}
          transition={{ duration: 0.9, times: [0, 0.45, 1], ease: ["easeOut", "easeIn"] }}
        >
          <StinkCloud size={38} seed={1} />
        </motion.div>
      );
    case "blast":
      return (
        <motion.div
          className={base}
          style={style}
          initial={{ scale: 0.15, opacity: 1 }}
          animate={{ scale: [0.15, 1.15, 1.4], opacity: [1, 0.95, 0], y: -50 }}
          transition={{ duration: 3 }}
        >
          <StinkCloud size={230} seed={2} />
        </motion.div>
      );
    case "heart":
      return (
        <motion.div
          className={base}
          style={style}
          initial={{ scale: 0.4, opacity: 1 }}
          animate={{ scale: 1.1, opacity: 0, y: -90, x: p.dx }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          <PropArt kind="heart" size={28} />
        </motion.div>
      );
    case "zzz":
      return (
        <motion.div
          className={`${base} text-3xl font-black text-white [text-shadow:0_2px_0_#1e1b4b,0_0_12px_rgba(99,102,241,.8)]`}
          style={style}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 0], y: -70, x: 30, scale: 1.2 }}
          transition={{ duration: 2.1 }}
        >
          {p.text}
        </motion.div>
      );
    case "crumb":
      return (
        <motion.div
          className={`${base} h-1.5 w-1.5 rounded-full bg-amber-700`}
          style={style}
          animate={{ x: p.dx, y: [0, -20, p.dy ?? 30], opacity: [1, 1, 0] }}
          transition={{ duration: 0.65 }}
        />
      );
    case "treat":
      return (
        <motion.div
          className={base}
          style={style}
          initial={{ x: p.dx, y: p.dy }}
          animate={{ x: [p.dx ?? 0, (p.dx ?? 0) * 0.5, 0], y: [p.dy ?? 0, Math.min(p.dy ?? 0, 0) - 90, 0], rotate: 720 }}
          transition={{ duration: 0.8, times: [0, 0.5, 1] }}
        >
          <PropArt kind="bone" size={40} />
        </motion.div>
      );
    case "ball": {
      const w = p.dx ?? 800;
      return (
        <motion.div
          className={base}
          style={style}
          animate={{ x: [0, -w * 0.3, -w * 0.55, -w * 0.78, -w * 1.1], y: [-40, -220, 0, -80, 0], rotate: -900 }}
          transition={{ duration: 1.6, times: [0, 0.3, 0.55, 0.75, 1], ease: "linear" }}
        >
          <PropArt kind="ball" size={34} />
        </motion.div>
      );
    }
    case "leaf": {
      if (p.text === "snow") {
        const dxs = p.dx ?? 600;
        return (
          <motion.div
            className={`${base} h-2 w-2 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,.9)]`}
            style={style}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: [0, dxs * 0.5, dxs], y: [0, (p.dy ?? 0) * 0.5 - 20, p.dy ?? 0], opacity: [0, 1, 0.6] }}
            transition={{ duration: 2.6, ease: "linear" }}
          />
        );
      }
      const colors = ["#f4c430", "#8cc152", "#d98e04"];
      const c = colors[Number(p.text ?? 0) % colors.length];
      const dx = p.dx ?? 600;
      const dy = p.dy ?? 0;
      return (
        <motion.div
          className={base}
          style={style}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
          animate={{ x: [0, dx * 0.33, dx * 0.66, dx], y: [0, dy * 0.3 - 30, dy * 0.7 + 20, dy], rotate: [0, 160, 320, 520], opacity: [0, 1, 1, 0.8] }}
          transition={{ duration: 3.4, ease: "linear" }}
        >
          <span className="block h-2.5 w-3.5 rounded-[60%_10%_60%_10%] shadow-[0_1px_2px_rgba(0,0,0,.35)]" style={{ background: `linear-gradient(135deg, ${c}, #6d8b2f)` }} />
        </motion.div>
      );
    }
    case "bell":
      return (
        <motion.div
          className={base}
          style={style}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.2, 1, 1.1, 1], opacity: [0, 1, 1, 1, 0], rotate: [0, 18, -18, 14, -10, 0] }}
          transition={{ duration: 1.7 }}
        >
          <PropArt kind="bell" size={64} className="drop-shadow-[0_4px_10px_rgba(0,0,0,.4)]" />
        </motion.div>
      );
    case "paw":
      return (
        <motion.div className={base} style={style} initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 1.2, opacity: 0 }} transition={{ duration: 0.8 }}>
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
            <g fill="#fff" stroke="#1e293b" strokeWidth="2">
              <ellipse cx="20" cy="26" rx="9" ry="7.5" />
              <circle cx="10" cy="15" r="4" />
              <circle cx="17" cy="10" r="4" />
              <circle cx="25" cy="10" r="4" />
              <circle cx="31" cy="16" r="4" />
            </g>
          </svg>
        </motion.div>
      );
    default:
      return (
        <motion.div className={`${base} text-sm font-black`} style={style} animate={{ y: -40, opacity: [1, 0] }} transition={{ duration: 1.2 }}>
          {p.text}
        </motion.div>
      );
  }
}

function KidHand({ snack, yell, handBottom, size }: { snack: Snack; yell: boolean; handBottom: number; size: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute top-0 z-[15]"
      style={{ left: `${snack.x}%`, bottom: handBottom, x: "-50%" }}
      initial={{ y: "-110%" }}
      animate={yell ? { y: 0, x: ["-50%", "-46%", "-54%", "-48%", "-50%"] } : { y: 0 }}
      exit={{ y: "-110%" }}
      transition={{ y: { type: "spring", stiffness: 160, damping: 18 }, x: { duration: 0.45, ease: "easeInOut" } }}
    >
      <div className="relative flex h-full flex-col items-center">
        <div className="w-10 flex-1 rounded-b-md border-x-2 border-slate-900/70 bg-[repeating-linear-gradient(0deg,#38bdf8_0_10px,#f472b6_10px_20px)]" />
        <div className="relative -mt-1 h-10 w-11 rounded-[40%_40%_50%_50%] border-2 border-slate-900/70 bg-[#f1c7a3] shadow">
          <div className="absolute -left-2 top-2 h-5 w-3.5 -rotate-12 rounded-full border-2 border-slate-900/70 bg-[#eab996]" />
        </div>
        <AnimatePresence>
          {!snack.stolen && (
            <motion.div className="absolute" style={{ bottom: -size * 0.55 }} exit={{ scale: 0, y: 40, opacity: 0 }} transition={{ duration: 0.2 }}>
              <PropArt kind={snack.kind} size={size} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {yell && (
            <motion.div
              className="absolute -left-20 bottom-4 rounded-xl border-2 border-slate-900 bg-white px-2.5 py-1 text-sm font-black text-rose-600 shadow"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: -6 }}
            >
              HEY!!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Animated cartoon of Charles's real territory, cross-fading between scenes and seasons. */
function CartoonScene({
  sceneId,
  season,
  viewBox,
  passer,
  car,
  layer = "back",
}: {
  sceneId: SceneId;
  season: Season;
  viewBox: string;
  passer: Passer | null;
  car: CarPass | null;
  /** The cabin is drawn in two layers so Charles can walk behind the railing. */
  layer?: "back" | "front";
}) {
  const winter = season === "winter";
  return (
    <div className="pointer-events-none absolute inset-0">
      <style>{SCENE_CSS + WILDLIFE_CSS}</style>
      <AnimatePresence initial={false}>
        <motion.div
          key={`${sceneId}-${season}`}
          className="absolute inset-0 dark:brightness-[.8] dark:saturate-[.9]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {sceneId === "home" ? (
            <HomeScene
              season={season}
              viewBox={viewBox}
              outside={car ? <PassingCar key={car.id} car={car} winter={winter} /> : null}
              room={car ? <RoomSweep key={car.id} car={car} /> : null}
            />
          ) : (
            <CabinScene
              season={season}
              viewBox={viewBox}
              layer={layer}
              passers={passer ? <Herd key={passer.id} passer={passer} winter={winter} width={SCENES.cabin.view.w} /> : null}
            />
          )}
        </motion.div>
      </AnimatePresence>
      {layer === "back" && <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />}
    </div>
  );
}

/** One paw print pressed into the snow; it slowly fills back in. */
function PawTrack({ t }: { t: { x: number; b: number; k: number; rot: number } }) {
  const size = Math.max(12, 30 * t.k);
  return (
    <div className="charles-track absolute -translate-x-1/2 translate-y-1/2" style={{ left: t.x, bottom: t.b, width: size, height: size }}>
      <svg viewBox="0 0 20 20" className="h-full w-full" style={{ transform: `rotate(${t.rot}deg) scaleY(.55)` }} aria-hidden="true">
        <g fill="#8fa6bf">
          <ellipse cx="10" cy="13" rx="4.6" ry="3.8" />
          <circle cx="4.6" cy="7.4" r="2" />
          <circle cx="8.2" cy="4.6" r="2" />
          <circle cx="11.8" cy="4.6" r="2" />
          <circle cx="15.4" cy="7.4" r="2" />
        </g>
      </svg>
    </div>
  );
}

function ThreatProp({ t, sceneId, stage }: { t: SceneThreat; sceneId: SceneId; stage: { w: number; h: number } }) {
  if (t.fx === "wind") return null;
  const pos = sceneToStage(SCENES[sceneId], t.at[0], t.at[1], stage.w, stage.h);
  const size = Math.round(((t.size ?? 40) * stage.h) / 640);
  return (
    <motion.div
      className="pointer-events-none absolute z-[5]"
      style={{ left: pos.x, top: pos.y, x: "-50%", y: "-50%" }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
    >
      {t.prop ? (
        <motion.div className="drop-shadow-[0_3px_4px_rgba(0,0,0,.35)]" animate={{ rotate: [0, -6, 5, -3, 0], y: [0, -4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <PropArt kind={t.prop} size={size} />
        </motion.div>
      ) : (
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-rose-400/80" />
          <span className="absolute inset-2 rounded-full border-2 border-rose-400" />
        </span>
      )}
      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
        threat: {t.label}
      </span>
    </motion.div>
  );
}

const PAGE_CSS = `
@keyframes charles-stinkrise { 0% { transform: translate(-50%, 4px) scaleY(.8); opacity: 0 } 40% { opacity: 1 } 100% { transform: translate(-50%, -14px) scaleY(1.1); opacity: 0 } }
@keyframes charles-fly { 0% { transform: translate(0,0) } 25% { transform: translate(12px,-9px) } 50% { transform: translate(-5px,-16px) } 75% { transform: translate(-12px,-5px) } 100% { transform: translate(0,0) } }
@keyframes stink-wiggle { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes charles-track { 0% { opacity: .9 } 40% { opacity: .65 } 100% { opacity: 0 } }
.charles-track { animation: charles-track 30s linear forwards }
.charles-stinkrise { animation: charles-stinkrise 1.6s ease-in-out infinite }
.charles-fly { animation: charles-fly .9s linear infinite }
.stink-lines { animation: stink-wiggle 1.2s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .charles-stinkrise, .charles-fly, .stink-lines { animation: none } }
`;
