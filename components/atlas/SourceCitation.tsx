import type { Citation } from "./types";

/** "Sources" footer — every visible layer's data credit, with its licence. */
export function SourceCitation({ citations, className = "" }: { citations: Citation[]; className?: string }) {
  const unique = citations.filter((c, i) => citations.findIndex((o) => o.href === c.href) === i);
  if (!unique.length) return null;
  return (
    <p className={`text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 ${className}`}>
      <span className="font-mono uppercase tracking-wider">Sources · </span>
      {unique.map((c, i) => (
        <span key={c.href}>
          {i > 0 && " · "}
          <a href={c.href} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-300 underline-offset-2 hover:text-indigo-500 dark:decoration-white/20">
            {c.label}
          </a>
          {c.license && <span> ({c.license})</span>}
        </span>
      ))}
    </p>
  );
}
