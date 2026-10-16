"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface FeatureDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Small mono line above the title, e.g. "Earthquake" */
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Colour of the eyebrow dot */
  accent?: string;
  children?: ReactNode;
}

/**
 * Detail panel for whatever was clicked on an atlas map. Lives inside the map frame
 * (so it survives fullscreen): a right-hand panel on wide screens, a bottom sheet on phones.
 */
export function FeatureDrawer({ open, onClose, eyebrow, title, subtitle, accent = "#6366f1", children }: FeatureDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label={typeof title === "string" ? title : eyebrow}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="absolute inset-x-2 bottom-2 z-20 flex max-h-[62%] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[#141418]/95 md:inset-x-auto md:bottom-3 md:right-14 md:top-3 md:max-h-none md:w-[360px]"
        >
          <header className="flex items-start gap-3 border-b border-slate-200/70 px-4 pb-3 pt-4 dark:border-white/[0.07]">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                  {eyebrow}
                </p>
              )}
              {title && <h3 className="mt-1 font-aspekta text-lg font-[650] leading-tight text-slate-900 dark:text-white">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="-mr-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Label/value grid used inside drawers. */
export function FactGrid({ facts }: { facts: [string, ReactNode][] }) {
  const shown = facts.filter(([, v]) => v != null && v !== "");
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
      {shown.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{k}</dt>
          <dd className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100" title={typeof v === "string" ? v : undefined}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** External link row used at the bottom of drawers. */
export function DrawerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
    >
      {children}
      <span aria-hidden>↗</span>
    </a>
  );
}
