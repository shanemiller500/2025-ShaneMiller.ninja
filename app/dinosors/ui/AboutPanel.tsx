"use client";

import { Modal } from "@/components/ui/modal";

/** About + a gentle note that this mix of creatures is make-believe. */
export default function AboutPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const how: [string, string][] = [
    ["✋", "Drag to look around, pinch or scroll to zoom"],
    ["👆", "Tap anything: dinos, trees, water, the volcano…"],
    ["🦖", "Hold a dino to pick it up and move it"],
    ["👆👆", "Double-tap a dino to follow it around"],
    ["🧰", "Use the toy box at the bottom to change the world"],
    ["🏕️", "Tap the cave camp to help the cave people invent"],
  ];
  return (
    <Modal open={open} onClose={onClose} size="wide" accent="#22c55e" labelledBy="dl-about">
      <div className="dl-scroll overflow-y-auto p-6 text-slate-800 dark:text-slate-100">
        <div className="text-4xl">🦕🌋🔥</div>
        <h2 id="dl-about" className="mt-2 text-2xl font-bold">
          About Dinosaur Land
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Dinosaur Land is a make-believe prehistoric playground. Explore, experiment and see how the animals, weather, fire and volcano all affect each other.
        </p>
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-[14px] leading-relaxed text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
          <div className="font-bold">🕰️ A little time-travel secret</div>
          In real life, these animals didn’t all live together! Stegosaurus lived about 150 million years ago, T. rex about 66 million years ago, and people only showed up around 300,000 years ago — long after the big dinosaurs were gone. Here, everyone gets to hang out together just for fun.
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {how.map(([i, t]) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-slate-100 px-3 py-2 text-[14px] dark:bg-white/5">
              <span className="w-8 text-center text-2xl">{i}</span>
              {t}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">All sounds are made live by your browser — no recordings. Your world saves on this device.</p>
      </div>
    </Modal>
  );
}
