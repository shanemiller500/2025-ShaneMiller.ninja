"use client";

import { Modal } from "@/components/ui/modal";

/** About + a gentle note that this mix of creatures is make-believe. */
export default function AboutPanel({ open, onClose, dragons = [], onWatchHatch }: { open: boolean; onClose: () => void; dragons?: { id: number; name: string; icon: string }[]; onWatchHatch?: (id: number) => void }) {
  const how: [string, string][] = [
    ["✋", "Drag to look around, pinch or scroll to zoom"],
    ["👆", "Tap anything: dinos, trees, water, the volcano…"],
    ["🦖", "Hold a dino to pick it up and move it"],
    ["👆👆", "Double-tap a dino to follow it around"],
    ["🧰", "Use the toy box at the bottom to change the world"],
    ["🏕️", "Tap the cave camp to help the cave people invent"],
    ["🧑", "Tap a person (shift-drag for a group), then tap a tree, rock, water, dino, wall… they work out the job"],
    ["🛠️", "Build homes, walls with gates + stairs, towers, Scorpions and workshops"],
    ["🛖", "Tap a home to see who lives there and upgrade it, tent → stone house"],
    ["☄️", "Dragons, blizzards… and what happens if a meteor hits the volcano?"],
  ];
  return (
    <Modal className="dl-modal" open={open} onClose={onClose} size="wide" accent="#22c55e" labelledBy="dl-about">
      {/* contents are only built while open (the exit animation keeps the last ones) */}
      {open && (
        <>
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
            {onWatchHatch && (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-400/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-emerald-900 dark:text-emerald-100">🐣 The dragon hatching film</div>
                    <div className="text-[13px] text-emerald-800/80 dark:text-emerald-100/70">Watch a baby dragon crack out of its egg and meet the one who hatched it.</div>
                  </div>
                  <button type="button" onClick={() => onWatchHatch(-1)}
                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-emerald-400 active:scale-95">
                    ▶ Watch a dragon hatch
                  </button>
                </div>
                {dragons.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[12px] font-semibold text-emerald-900/80 dark:text-emerald-100/70">Or replay one of yours:</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {dragons.map((d) => (
                        <button key={d.id} type="button" onClick={() => onWatchHatch(d.id)}
                          className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-slate-800 shadow-sm transition hover:bg-emerald-100 active:scale-95 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20">
                          {d.icon} {d.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
        </>
      )}
    </Modal>
  );
}
