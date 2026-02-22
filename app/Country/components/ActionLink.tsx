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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        "border border-black/10 dark:border-white/10",
        "bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12]",
        "text-gray-700 dark:text-white/80 shadow-sm transition",
      )}
    >
      <span className="text-indigo-500 dark:text-indigo-400">{icon}</span>
      {label}
    </a>
  );
}
