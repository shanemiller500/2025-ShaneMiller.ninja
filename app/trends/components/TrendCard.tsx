// app/trends/components/TrendCard.tsx
import type { ReactNode } from "react";

export default function TrendCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  country?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-brand-900/60">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-brand-900 dark:text-white">{title}</h2>
          <span className="rounded-full border border-black/10 bg-indigo-50/80 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:border-white/10 dark:bg-white/10 dark:text-brand-300">
            Live
          </span>
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">{subtitle}</p>
        ) : null}
      </div>

      {children}
    </div>
  );
}
