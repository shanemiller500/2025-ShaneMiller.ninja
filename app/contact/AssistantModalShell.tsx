"use client";

import { useId } from "react";
import { Modal } from "@/components/ui/modal";

interface AssistantModalShellProps {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}

// The contact page's AI assistants, on the site-wide Modal (portal, Esc/backdrop close,
// scroll lock, bottom sheet on phones). Parents mount this only while it's open.
export default function AssistantModalShell({ title, icon, onClose, children, size = "md" }: AssistantModalShellProps) {
  const titleId = useId();
  return (
    <Modal open onClose={onClose} labelledBy={titleId} size={size === "lg" ? "wide" : "md"}>
      <header className="flex shrink-0 items-center gap-3 px-4 py-3.5 pr-14 sm:px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500 text-white shadow-[0_0_14px_-2px_rgba(99,102,241,0.6)]">{icon}</span>
        <h2 id={titleId} className="flex-1 font-semibold text-slate-900 dark:text-white">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-slate-200/70 p-4 dark:border-white/[0.08] sm:p-5">
        {children}
      </div>
    </Modal>
  );
}
