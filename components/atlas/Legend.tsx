import type { LegendItem } from "./types";

/** One legend key: a dot, a ring or a line in the layer's colour. */
export function LegendSwatch({ item }: { item: LegendItem }) {
  const shape = item.shape ?? "dot";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
      {shape === "line" ? (
        <span className="h-[3px] w-4 rounded-full" style={{ background: item.color }} />
      ) : (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={shape === "ring" ? { boxShadow: `inset 0 0 0 2px ${item.color}` } : { background: item.color }}
        />
      )}
      {item.label}
    </span>
  );
}

export function Legend({ items, className = "" }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {items.map((i) => (
        <LegendSwatch key={i.label} item={i} />
      ))}
    </div>
  );
}
