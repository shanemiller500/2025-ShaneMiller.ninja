import React from "react";

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export default function StatPill({ icon, label, value }: StatPillProps) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-sm text-indigo-500 dark:text-indigo-300">{icon}</span>
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</div>
      </div>
      <div className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
