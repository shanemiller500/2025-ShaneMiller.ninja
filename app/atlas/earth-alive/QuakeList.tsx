"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Waves } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { depthColor, type QuakeFeature } from "@/utils/geo/quakes";

const SHOW = 150;

/** Scrollable quake list — newest or largest first. Clicking a row selects it on the map. */
export function QuakeList({
  quakes,
  selectedId,
  onSelect,
}: {
  quakes: QuakeFeature[];
  selectedId?: string | number;
  onSelect: (q: QuakeFeature) => void;
}) {
  const [sort, setSort] = useState<"newest" | "largest">("newest");
  const rows = useMemo(() => {
    const list = [...quakes];
    list.sort(sort === "newest" ? (a, b) => b.properties.time - a.properties.time : (a, b) => b.properties.mag - a.properties.mag);
    return list.slice(0, SHOW);
  }, [quakes, sort]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Segmented
          id="quake-sort"
          ariaLabel="Sort earthquakes"
          value={sort}
          onChange={setSort}
          options={[
            { key: "newest", label: "Newest" },
            { key: "largest", label: "Largest" },
          ]}
        />
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {quakes.length > SHOW ? `${SHOW} of ${quakes.length.toLocaleString()}` : `${quakes.length} quakes`}
        </span>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {rows.map((q) => {
          const p = q.properties;
          const active = p.id === selectedId;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(q)}
                aria-current={active || undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-indigo-500/10 ring-1 ring-indigo-500/30" : "hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-bold shadow-sm"
                  style={{ background: depthColor(p.depth), color: p.depth < 70 ? "#1c1917" : "#fff" }}
                >
                  {p.mag.toFixed(1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{p.place}</span>
                  <span className="block font-mono text-[10px] text-slate-400">
                    {formatDistanceToNowStrict(p.time, { addSuffix: true })} · {p.depth} km
                  </span>
                </span>
                {p.tsunami === 1 && <Waves className="h-4 w-4 shrink-0 text-sky-500" aria-label="Tsunami flag" />}
              </button>
            </li>
          );
        })}
        {!rows.length && <li className="py-10 text-center text-xs text-slate-400">No earthquakes in this window.</li>}
      </ul>
    </div>
  );
}
