"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import BikerShazz, { type ShazzPose } from "./BikerShazz";
import styles from "../day-out.module.css";

const JOKES = [
  "Tell ya what ya cunt, Indian or Harley? The Indian starts. The Harley pisses oil on the driveway to mark its territory.",
  "Harley riders wave at each other. Indian riders wave at the Harleys broken down on the side of the road. Suck on that, ya cunt.",
  "A Harley isn't loud, ya deaf old bastard. It's just telling the whole suburb you're coming, five minutes before you get there.",
  "Indian vs Harley, settled: whichever one you can still pick up when it tips over in the driveway. So neither, ya weak cunt.",
  "Every Harley comes with a free oil drip tray. It's called your fuckin' garage floor.",
  "Barnesy can still hit the big note in Working Class Man. You hit it getting out of the recliner, ya cunt.",
  "Barnesy's been screaming since the '70s and he's still got more puff than you on a flight of stairs.",
  "Barnesy's got a voice like gravel. You've got knees like gravel, ya creaky old cunt.",
  "You've retired from mowing the lawn more times than Farnsy's retired from touring. Get off ya arse.",
  "Brocky won Bathurst nine times. You've taken the wrong turn to Canungra at least that many, ya galah.",
  "Steve Irwin wrestled crocs. You wrestle the caravan awning, and the awning wins. Every. Single. Time.",
  "\"That's not a knife.\" That's attempt number four at reversing the caravan, ya useless cunt. Crikey.",
  "AC/DC said it's a long way to the top. They were talking about you backing the trailer up the driveway.",
  "Midnight Oil sang Beds Are Burning. Your camp cooking took it as a fuckin' challenge.",
  "Did I already tell you this one? Doesn't matter, ya won't remember, ya forgetful old cunt. Easiest crowd I've ever had.",
  "Upside of the memory going: every ride up Tamborine is a brand new adventure. Never been, apparently.",
  "Keys in the fridge again? Relax, at least they're next to the beer. Priorities intact, ya legend.",
  "Hang on, what was I saying? Ah, fuck it. Neither of us will remember in a minute anyway.",
  "Holden or Ford? Doesn't matter. You'll still reckon the one you had in '78 was better, ya stubborn cunt.",
  "The Chiko Roll was invented in Wagga and perfected by your arteries.",
  "Bunnings snag queue: the only line you've ever stood in without a fuckin' whinge.",
  "Reckon you can still pull a wheelie? The physio reckons no, and so do I, ya cunt.",
  "The tram's the only thing you'll overtake on the Gold Coast this year, and it's on bloody rails.",
  "Your campervan's got more rust than a Kingswood left on the beach at Bribie.",
  "Crocodile Dundee had the knife. You've got a Swiss Army knife with 40 tools and ya still use your teeth.",
];
const LINES: Record<"flip" | "moon" | "drink" | "smoke" | "throw" | "fall" | "up", string[]> = {
  flip: ["Swivel on that, ya cunt!", "That one's from me and the whole Smart Arse MC, ya old bastard.", "Here's the Harley warranty department's official response, ya cunt.", "Oi! Read it and weep, grandpa."],
  moon: ["Full moon over the Gold Coast tonight, ya cunt!", "Kiss that, old man. Best view you've had since '82.", "That's the only thing round here shinier than your chrome.", "Park ya eyes on that, ya perve. Ha!"],
  drink: ["Cheers, ya cunt! XXXX Gold: breakfast of champions.", "One for the road, and one for the other fuckin' road.", "Don't look at me like that. It's five o'clock somewhere, ya wowser.", "Ahhh. Beer's colder than your ex, ya cunt."],
  smoke: ["Doctor said quit. Doctor rides a Vespa, ya cunt.", "Got a light? Nah, found one. Tight arse.", "Want a drag? Course ya don't, you're soft as butter, ya cunt."],
  throw: ["Catch, ya cunt!", "Recycling, Aussie style!", "Heads up, ya slow bastard!", "Empty. Like your fuckin' head."],
  fall: ["Who moved the fuckin' ground?!", "I'm right! I'm right! Nobody saw that, ya cunts.", "That's not a stack, that's a tactical dismount, ya cunt.", "Ow. Fuck. Me stubby's alright though."],
  up: ["Right. Where was I? Oh yeah: you're a cunt.", "Back on the horse. Don't tell anyone, ya dobber.", "Sweet as. Barely a scratch. On the bike, I mean."],
};
// For anyone who'd rather not read the full-strength version.
const bleep = (text: string) => text.replace(/cunt/gi, "c**t").replace(/fuck/gi, "f**k").replace(/shit/gi, "sh*t").replace(/bastard/gi, "b*stard");
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const DRUNK_LABELS = ["Stone cold sober", "Tipsy", "Pissed", "Maggoted", "Absolutely legless"];
const FIRST_DELAY = 20_000, GAP = 150_000, GROUND = 22, VIEW_W = 260, VIEW_H = 180, FALL_AT = 4;
type Phase = "hidden" | "enter" | "parked" | "leave";
type Action = "flip" | "moon" | "drink" | "smoke" | "throw";
type Line = { text: string; ai: boolean };
type Fx = { id: number; kind: "smoke" | "tyre" | "skid" | "burst" | "bottle" | "shard" | "stars"; x: number; y: number; size: number; text?: string; dx?: number; dy?: number; arc?: number };
let uid = 0;

// `summon` increments each time the "Call Shazz" button is pressed.
export default function SmartArse({ topic, summon }: { topic: string; summon: number }) {
  const [muted, setMuted] = useState<boolean | null>(null);
  const [clean, setClean] = useState(false);
  const [phase, setPhaseState] = useState<Phase>("hidden");
  const [line, setLine] = useState<Line | null>(null);
  const [talking, setTalking] = useState(false);
  const [pose, setPose] = useState<ShazzPose>("ride");
  const [drunk, setDrunk] = useState(0);
  const [fx, setFx] = useState<Fx[]>([]);
  const [width, setWidth] = useState(210);
  const [atX, setAtX] = useState(0);
  const [moving, setMoving] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [menu, setMenu] = useState(false);
  const bike = useRef<HTMLButtonElement>(null);
  const place = useRef({ x: -500, tilt: 0, pivot: 60 });
  const phaseRef = useRef<Phase>("hidden");
  const drunkRef = useRef(0);
  const busy = useRef(false);
  const frame = useRef(0);
  const deck = useRef<string[]>([]);
  const ai = useRef<Record<string, { at: number; list: string[] }>>({});
  const topicRef = useRef(topic);
  topicRef.current = topic;
  const scale = width / VIEW_W;
  const height = VIEW_H * scale;

  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const add = (item: Omit<Fx, "id">) => setFx(list => [...list.slice(-180), { ...item, id: ++uid }]);
  const remove = (id: number) => setFx(list => list.filter(item => item.id !== id));
  const s = () => (bike.current?.offsetWidth || width) / VIEW_W;
  const later = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
  const draw = useCallback(() => {
    const el = bike.current; if (!el) return;
    const { x, tilt, pivot } = place.current, k = el.offsetWidth / VIEW_W;
    el.style.transformOrigin = `${pivot * k}px ${172 * k}px`;
    el.style.transform = `translateX(${x}px) rotate(${tilt}deg)`;
  }, []);
  const animate = (duration: number, step: (t: number) => void) => new Promise<void>(resolve => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      step(t); draw();
      if (t < 1) frame.current = requestAnimationFrame(tick); else resolve();
    };
    frame.current = requestAnimationFrame(tick);
  });

  const speak = useCallback((text: string, fromAi = false) => {
    // The more she drinks, the more she hiccups.
    const hic = drunkRef.current >= 2 ? pick([" *hic*", " *hic* ...", " *burp*"]) : "";
    setLine({ text: text + hic, ai: fromAi });
    setTalking(true); window.setTimeout(() => setTalking(false), 1800);
  }, []);
  // AI jokes are fetched per topic and used first; the built-in list is the fallback.
  const loadAi = useCallback(async () => {
    const key = topicRef.current, cached = ai.current[key];
    if (cached && (cached.list.length || Date.now() - cached.at < 600_000)) return;
    ai.current[key] = { at: Date.now(), list: [] };
    try {
      const response = await fetch("/api/day-out/smartarse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: key }), signal: AbortSignal.timeout(15000) });
      const body: { jokes?: unknown } = response.ok ? await response.json() : {};
      if (Array.isArray(body.jokes)) ai.current[key].list.push(...body.jokes.filter((joke): joke is string => typeof joke === "string"));
    } catch { /* built-in jokes cover it */ }
  }, []);
  const say = useCallback(() => {
    const fresh = ai.current[topicRef.current]?.list.shift();
    if (!fresh && !deck.current.length) deck.current = [...JOKES].sort(() => Math.random() - 0.5);
    speak(fresh || deck.current.pop()!, !!fresh);
    if (!ai.current[topicRef.current]?.list.length) void loadAi();
  }, [loadAi, speak]);

  async function fall() {
    const k = s(), x = place.current.x;
    setPose("fallen");
    add({ kind: "burst", x: x + 30 * k, y: GROUND + 70 * k, size: 0, text: "THUD!" });
    for (let i = 0; i < 6; i++) add({ kind: "tyre", x: x + (40 + i * 18) * k, y: GROUND + 4, size: 30 + Math.random() * 20 });
    await later(500);
    add({ kind: "stars", x: x + 10 * k, y: GROUND + 34 * k, size: 0, text: "★ ✦ ★" });
    speak(pick(LINES.fall));
    await later(4200);
    drunkRef.current = 0; setDrunk(0); setPose("ride");
    speak(pick(LINES.up));
  }
  async function act(action: Action) {
    if (phaseRef.current !== "parked" || busy.current) return;
    busy.current = true;
    const k = s(), x = place.current.x;
    setPose(action);
    if (action === "drink") {
      drunkRef.current += 1; setDrunk(drunkRef.current);
      if (drunkRef.current >= FALL_AT) { speak("One more for the road… whoa, whoa, WHOA—"); await later(900); await fall(); busy.current = false; return; }
      speak(pick(LINES.drink));
      await later(1400);
      // Empty. Slam it into the road.
      const handY = GROUND + (VIEW_H - 60) * k;
      add({ kind: "bottle", x: x + 143 * k, y: handY, size: 0, dx: 25 + Math.random() * 45, dy: handY - GROUND - 6, arc: -35 });
      await later(700);
    } else if (action === "throw") {
      speak(pick(LINES.throw));
      await later(300);
      // Lob a stubby behind her; it smashes on the road.
      const startX = x + 80 * k, startY = GROUND + (VIEW_H - 8) * k, dx = -(90 + Math.random() * 260);
      add({ kind: "bottle", x: startX, y: startY, size: 0, dx, dy: startY - GROUND - 6 });
      await later(700);
    } else if (action === "smoke") {
      speak(pick(LINES.smoke));
      for (let i = 0; i < 8; i++) { add({ kind: "smoke", x: x + 151 * k + i * 2, y: GROUND + (VIEW_H - 38) * k, size: 10 + i * 2 }); await later(280); }
    } else {
      speak(pick(action === "flip" ? LINES.flip : LINES.moon));
      add({ kind: "burst", x: x + (action === "moon" ? 20 : 120) * k, y: height + GROUND + 30, size: 0, text: action === "moon" ? "FULL MOON!" : "OI!" });
      await later(2600);
    }
    setPose("ride");
    busy.current = false;
  }
  // Click the road and she rides over there, turning round if she has to go left.
  async function rideTo(clientX: number) {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    const k = s(), w = bike.current.offsetWidth, x0 = place.current.x;
    const target = Math.max(8, Math.min(window.innerWidth - w - 8, clientX - w / 2));
    if (Math.abs(target - x0) < 12) return;
    busy.current = true; setMoving(true);
    const left = target < x0; setFacingLeft(left);
    const rearAt = (x: number) => x + (left ? VIEW_W - 60 : 60) * k, exhaustAt = (x: number) => x + (left ? VIEW_W - 16 : 16) * k;
    let lastPuff = 0, lastRear: number | null = null;
    await animate(Math.max(600, Math.abs(target - x0) * 2.2), t => {
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, x = x0 + (target - x0) * e, now = performance.now();
      place.current = { x, tilt: 0, pivot: 60 };
      if (now - lastPuff > 70) { lastPuff = now; add({ kind: "smoke", x: exhaustAt(x), y: GROUND + (VIEW_H - 128) * k, size: 12 + Math.random() * 10 }); }
      // Skid the back tyre while she pulls up.
      if (t > 0.75) {
        const rear = rearAt(x);
        if (lastRear !== null && Math.abs(rear - lastRear) > 0) add({ kind: "skid", x: Math.min(rear, lastRear), y: GROUND + 5 * k, size: Math.abs(rear - lastRear) + 1 });
        if (now - lastPuff < 5) add({ kind: "tyre", x: rear, y: GROUND + 4, size: 20 + Math.random() * 12 });
        lastRear = rear;
      }
    });
    setFacingLeft(false); setAtX(target); setMoving(false);
    busy.current = false;
    if (Math.random() < 0.5) speak(pick(["Happy now, ya bossy cunt?", "Righto, parked. Where's me beer?", "Don't tell me where to park, ya cunt. …Fine.", "This spot's got better views of your bald patch."]));
  }
  // She sobers up one beer every 45 seconds.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (busy.current || drunkRef.current === 0) return;
      drunkRef.current -= 1; setDrunk(drunkRef.current);
    }, 45_000);
    return () => clearInterval(timer);
  }, []);
  // Left alone, she gets restless: rides somewhere or pulls a random trick every few seconds.
  const restless = useRef<() => void>(() => {});
  restless.current = () => {
    if (phaseRef.current !== "parked" || busy.current) return;
    if (Math.random() < 0.4) void rideTo(40 + Math.random() * (window.innerWidth - 80));
    else void act(pick(["drink", "flip", "moon", "smoke", "throw", "flip", "smoke"] as Action[]));
  };
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => { restless.current(); next(); }, 5000 + Math.random() * 7000); };
    next();
    return () => clearTimeout(timer);
  }, [phase]);
  const smash = (item: Fx) => {
    remove(item.id);
    const x = item.x + (item.dx || 0);
    add({ kind: "burst", x: x - 30, y: GROUND + 30, size: 0, text: "SMASH!" });
    for (let i = 0; i < 9; i++) add({ kind: "shard", x, y: GROUND + 6, size: 4 + Math.random() * 6, dx: (Math.random() - 0.5) * 90, dy: -(Math.random() * 26) });
  };

  const arrive = useCallback(async () => {
    if (phaseRef.current !== "hidden") { if (phaseRef.current === "parked") say(); return; }
    const w = window.innerWidth < 640 ? 150 : 210, k = w / VIEW_W;
    setWidth(w); setPhase("enter"); setPose("ride"); void loadAi();
    const park = window.innerWidth - w - 16;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { place.current = { x: park, tilt: 0, pivot: 60 }; draw(); }
    else {
      const start = -w - 80; let lastPuff = 0, lastRear: number | null = null, screeched = false;
      await animate(1900, t => {
        const x = start + (park - start) * (1 - Math.pow(1 - t, 3));
        const braking = t > 0.5, now = performance.now();
        // Braking dips the nose over the front wheel and shakes a little.
        place.current = { x, tilt: braking ? 3 * (1 - t) * 2 + Math.sin(t * 90) * 0.6 : 0, pivot: 205 };
        if (now - lastPuff > 60) {
          lastPuff = now;
          add({ kind: "smoke", x: x + 16 * k, y: GROUND + (VIEW_H - 128) * k, size: 14 + Math.random() * 10 });
          if (braking) add({ kind: "tyre", x: x + 60 * k, y: GROUND + 4, size: 24 + Math.random() * 16 });
        }
        if (braking) {
          const rear = x + 60 * k;
          if (!screeched) { screeched = true; add({ kind: "burst", x: x + 80 * k, y: VIEW_H * k + GROUND + 20, size: 0, text: "SCREEECH!" }); }
          if (lastRear !== null && rear > lastRear) add({ kind: "skid", x: lastRear, y: GROUND + 5 * k, size: rear - lastRear + 1 });
          lastRear = rear;
        }
      });
      await animate(250, t => { place.current = { ...place.current, tilt: 1.2 * (1 - t) }; });
    }
    setAtX(park); setPhase("parked"); say();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, loadAi, say]);

  async function leave(mute = false) {
    if (phaseRef.current !== "parked" || busy.current) return;
    setLine(null); setMenu(false); setPhase("leave"); setPose("ride");
    if (mute) { setMuted(true); try { localStorage.setItem("day-out-smartarse-muted", "1"); } catch { /* ignore */ } }
    const k = s();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const x0 = place.current.x, rear = x0 + 60 * k; let lastPuff = 0;
      add({ kind: "burst", x: x0 - 20, y: VIEW_H * k * 0.6 + GROUND, size: 0, text: "BRAAAP!" });
      add({ kind: "skid", x: rear - 30 * k, y: GROUND + 5 * k, size: 44 * k });
      // Burnout on the spot, then a wheelie off the right-hand side.
      await animate(800, t => {
        place.current = { x: x0 + Math.sin(t * 120) * 1.5, tilt: 0, pivot: 60 };
        const now = performance.now();
        if (now - lastPuff > 40) { lastPuff = now; add({ kind: "tyre", x: rear - 10 + Math.random() * 20, y: GROUND + 2, size: 28 + Math.random() * 22 }); }
      });
      const end = window.innerWidth + 120; let lastRear = rear;
      await animate(1400, t => {
        const x = x0 + (end - x0) * t * t * t, now = performance.now();
        place.current = { x, tilt: -Math.min(16, t * 60) * (t < 0.8 ? 1 : (1 - t) * 5), pivot: 60 };
        if (now - lastPuff > 50) { lastPuff = now; add({ kind: "smoke", x: x + 16 * k, y: GROUND + (VIEW_H - 128) * k, size: 16 + Math.random() * 12 }); }
        const r = x + 60 * k;
        if (t < 0.35 && r > lastRear) { add({ kind: "skid", x: lastRear, y: GROUND + 5 * k, size: r - lastRear + 1 }); lastRear = r; }
      });
    }
    place.current = { x: -500, tilt: 0, pivot: 60 }; draw();
    setPhase("hidden");
  }

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("day-out-smartarse-muted") === "1");
      setClean(localStorage.getItem("day-out-smartarse-clean") === "1");
    } catch { setMuted(false); }
    const onResize = () => {
      if (phaseRef.current !== "parked" || !bike.current) return;
      place.current.x = Math.min(place.current.x, window.innerWidth - bike.current.offsetWidth - 8); draw(); setAtX(place.current.x);
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(frame.current); };
  }, [draw]);
  useEffect(() => {
    if (muted !== false) return;
    const first = window.setTimeout(arrive, FIRST_DELAY);
    const repeat = window.setInterval(() => { if (phaseRef.current === "hidden") void arrive(); }, GAP);
    return () => { clearTimeout(first); clearInterval(repeat); };
  }, [muted, arrive]);
  useEffect(() => {
    if (!summon) return;
    setMuted(false);
    try { localStorage.removeItem("day-out-smartarse-muted"); } catch { /* ignore */ }
    void arrive();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summon]);
  function toggleClean() {
    setClean(value => { try { localStorage.setItem("day-out-smartarse-clean", value ? "0" : "1"); } catch { /* ignore */ } return !value; });
  }

  const onRoad = phase !== "hidden" || fx.some(item => item.kind === "skid" || item.kind === "shard");
  const actions: [Action, string][] = [["drink", "🍺 Crack a tinnie"], ["flip", "🖕 Flip us off"], ["moon", "🍑 Show us ya arse"], ["smoke", "🚬 Light a durry"], ["throw", "🍾 Chuck a bottle"]];
  return <div className={styles.stage}>
    <div className={`${styles.road} ${onRoad ? styles.roadOn : ""} ${phase === "parked" ? styles.roadClickable : ""}`} onClick={event => void rideTo(event.clientX)} title={phase === "parked" ? "Click to move Shazz here" : undefined} />
    {fx.map(item => {
      if (item.kind === "burst" || item.kind === "stars") return <span key={item.id} className={styles[item.kind]} style={{ left: item.x, bottom: item.y }} onAnimationEnd={() => remove(item.id)}>{item.text}</span>;
      if (item.kind === "bottle") return <span key={item.id} className={styles.bottleX} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px` }} onAnimationEnd={event => event.target === event.currentTarget && smash(item)}>
        <span className={styles.bottleY} style={{ ["--dy" as string]: `${item.dy}px`, ["--arc" as string]: `${item.arc ?? -110}px` }}><span className={styles.bottle} /></span>
      </span>;
      if (item.kind === "shard") return <span key={item.id} className={styles.shard} style={{ left: item.x, bottom: item.y, width: item.size, height: item.size, ["--dx" as string]: `${item.dx}px`, ["--dy" as string]: `${item.dy}px` }} onAnimationEnd={() => remove(item.id)} />;
      return <span key={item.id} className={styles[item.kind]} onAnimationEnd={() => remove(item.id)}
        style={item.kind === "skid" ? { left: item.x, bottom: item.y, width: item.size } : { left: item.x - item.size / 2, bottom: item.y - item.size / 2, width: item.size, height: item.size }} />;
    })}
    <button ref={bike} className={`${styles.shazz} ${phase === "enter" || phase === "leave" || moving ? styles.moving : ""} ${talking ? styles.talking : ""}`}
      style={{ width, height, bottom: GROUND, visibility: phase === "hidden" ? "hidden" : "visible", transform: "translateX(-500px)" }}
      onClick={() => phase === "parked" && void act(pick(actions)[0])} tabIndex={phase === "parked" ? 0 : -1} aria-label="Big Shazz. Poke her and see what happens">
      <span style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}><span className={drunk ? styles.wobble : ""} style={{ ["--wobble" as string]: `${Math.min(drunk, 3) * 2.5}deg` }}><BikerShazz pose={pose} drunk={drunk} /></span></span>
    </button>
    {phase === "parked" && !moving && line && (() => {
      const bubbleW = Math.min(370, window.innerWidth - 32), head = atX + 118 * scale;
      const left = Math.max(16, Math.min(window.innerWidth - bubbleW - 16, head - bubbleW + 70));
      return <aside className={styles.bubble} style={{ left, width: bubbleW, bottom: height + GROUND + 16 }} role="status" aria-live="polite">
        <div className={styles.bubbleHead}>
          <span>Big Shazz · Smart Arse MC{drunk ? ` · ${"🍺".repeat(drunk)}` : ""}</span>
          <button onClick={() => void leave()} aria-label="Send Shazz off"><X size={20} aria-hidden /></button>
        </div>
        <p>{clean ? bleep(line.text) : line.text}</p>
        <span className={styles.jokeSource}>Click the road to move her · 🤘 on the left for tricks</span>
        <div className={styles.bubbleActions}>
          <button onClick={say}>Another one</button>
          <button onClick={() => void leave()}>Yeah, righto</button>
          <button onClick={() => void leave(true)}>Piss off, Shazz</button>
          <button onClick={toggleClean} aria-pressed={clean}>{clean ? "Swearing: bleeped" : "Swearing: full"}</button>
        </div>
        <span className={styles.bubbleTail} style={{ left: Math.max(16, Math.min(bubbleW - 42, head - left - 13)) }} />
      </aside>;
    })()}
    {phase !== "hidden" && <div className={styles.drunkMeter} role="meter" aria-label="Shazz's drunk meter" aria-valuemin={0} aria-valuemax={FALL_AT} aria-valuenow={drunk}>
      <span className={styles.drunkLabel}>Drunk-o-meter: <b>{DRUNK_LABELS[Math.min(drunk, FALL_AT)]}</b></span>
      <span className={styles.drunkTrack}><span className={styles.drunkFill} style={{ width: `${(Math.min(drunk, FALL_AT) / FALL_AT) * 100}%` }} /></span>
      <span className={styles.drunkCans} aria-hidden>{Array.from({ length: FALL_AT }, (_, i) => <span key={i} className={i < drunk ? styles.canFull : ""}>🍺</span>)}</span>
    </div>}
    {phase === "parked" && <div className={`${styles.trickBar} ${menu ? styles.trickBarOpen : ""}`}>
      <button className={styles.trickToggle} onClick={() => setMenu(open => !open)} aria-expanded={menu} aria-label="Shazz's tricks">{menu ? "✕" : "🤘"}</button>
      {menu && actions.map(([action, label]) => <button key={action} className={styles.trick} onClick={() => void act(action)}>
        <span aria-hidden>{label.split(" ")[0]}</span><em>{label.split(" ").slice(1).join(" ")}</em>
      </button>)}
    </div>}
  </div>;
}
