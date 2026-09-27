"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface AssistantModalShellProps {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}

export default function AssistantModalShell({
  title,
  icon,
  onClose,
  children,
  size = "md",
}: AssistantModalShellProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modalRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-[0_32px_100px_-40px_rgba(15,23,42,0.7)] backdrop-blur-xl dark:border-white/10 dark:bg-[#18181d]/95 ${
          size === "lg" ? "max-w-lg" : "max-w-md"
        } outline-none`}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />
        <header className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-indigo-200/70 bg-indigo-50/70 text-indigo-600 dark:border-indigo-400/15 dark:bg-indigo-400/[0.06] dark:text-indigo-300">
            {icon}
          </span>
          <h2 id={titleId} className="flex-1 text-sm font-medium text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-t border-slate-200/70 p-4 sm:p-5 dark:border-white/[0.07]">
          {children}
        </div>
      </div>
    </div>
  );
}
