import React from "react";

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export default function StatPill({ icon, label, value }: StatPillProps) {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-indigo-500 dark:text-indigo-400 text-sm">{icon}</span>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40">{label}</div>
      </div>
      <div className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{value}</div>
    </div>
  );
}
