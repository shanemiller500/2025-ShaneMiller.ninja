export default function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="flex items-center gap-3 rounded-full border border-slate-200/70 bg-white px-5 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </div>
  );
}
