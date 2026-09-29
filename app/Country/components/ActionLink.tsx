import React from "react";
import { cn } from "../lib/utils";

interface ActionLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

export default function ActionLink({ href, icon, label }: ActionLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
        "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600",
        "dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300",
      )}
    >
      <span className="text-indigo-500 dark:text-indigo-300">{icon}</span>
      {label}
    </a>
  );
}
