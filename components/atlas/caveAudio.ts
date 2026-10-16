/* ------------------------------------------------------------------ */
/*  Ambient cave sound for CaveScope dives, built with Tone.js:        */
/*  a low rock drone, water drips in a long reverb, a river where the  */
/*  cave has one, and a soft sonar ping each time the scan sweeps.     */
/*  Everything is synthesized — no audio files. Start it only from a   */
/*  user gesture (browsers block audio otherwise).                     */
/* ------------------------------------------------------------------ */
import type { CaveSpec } from "./caveGen";

export interface CaveAudio {
  ping: () => void;
  stop: () => void;
}

export async function startCaveAudio(spec: Pick<CaveSpec, "style" | "river">): Promise<CaveAudio> {
  const Tone = await import("tone");
  await Tone.start();
  const lava = spec.style === "lavatube";

  // start silent and fade in
  const master = new Tone.Volume(-60).toDestination();
  const reverb = new Tone.Reverb({ decay: lava ? 3.5 : 7, wet: 0.55 }).connect(master);

  // drone: brown noise through a low-pass + a quiet sub tone that breathes
  const droneFilter = new Tone.Filter(lava ? 240 : 170, "lowpass").connect(master);
  const noise = new Tone.Noise("brown").connect(droneFilter);
  noise.volume.value = -30;
  const sub = new Tone.Oscillator(lava ? 49 : 41, "sine").connect(master);
  sub.volume.value = -34;
  const breath = new Tone.LFO(0.05, -40, -31).connect(sub.volume);

  // drips: short high sine blips, randomly timed, mostly heard through the reverb
  const drip = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 } }).connect(reverb);
  drip.volume.value = -20;
  let dripTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleDrip = () => {
    dripTimer = setTimeout(() => {
      const f = 1400 + Math.random() * 1600;
      drip.triggerAttackRelease(f, 0.05);
      // a drop sometimes lands twice
      if (Math.random() < 0.3) setTimeout(() => drip.triggerAttackRelease(f * 0.92, 0.04), 90 + Math.random() * 120);
      scheduleDrip();
    }, (lava ? 2400 : 700) + Math.random() * (lava ? 5000 : 2600));
  };
  scheduleDrip();

  // river: band-passed pink noise
  let river: InstanceType<typeof Tone.Noise> | null = null;
  let riverFilter: InstanceType<typeof Tone.Filter> | null = null;
  if (spec.river) {
    riverFilter = new Tone.Filter({ frequency: 700, type: "bandpass", Q: 0.6 }).connect(master);
    river = new Tone.Noise("pink").connect(riverFilter);
    river.volume.value = -34;
    river.start();
  }

  // sonar ping for the scan sweep
  const pinger = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 0.4 } }).connect(reverb);
  pinger.volume.value = -24;

  noise.start();
  sub.start();
  breath.start();
  master.volume.rampTo(-6, 1.5);

  return {
    ping: () => {
      const now = Tone.now();
      pinger.triggerAttackRelease(1320, 0.12, now);
      pinger.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    },
    stop: () => {
      if (dripTimer) clearTimeout(dripTimer);
      master.volume.rampTo(-60, 0.4);
      setTimeout(() => {
        for (const n of [noise, sub, breath, river]) n?.stop();
        for (const n of [noise, sub, breath, drip, pinger, river, riverFilter, droneFilter, reverb, master]) n?.dispose();
      }, 450);
    },
  };
}
