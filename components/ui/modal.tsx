"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy?: string;
  /** Color of the hairline across the top edge */
  accent?: string;
  size?: "sm" | "md" | "wide" | "lg" | "xl";
  /** Hide the built-in close button (render your own) */
  hideClose?: boolean;
  className?: string;
  children: ReactNode;
}

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  wide: "sm:max-w-lg",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

/**
 * Portaled dialog: renders on <body> so transformed/blurred ancestors can't
 * trap the fixed overlay. Esc, backdrop click and the X all close it, page
 * scroll is locked only while open, and it animates out. Bottom sheet on mobile.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  accent = "#6366f1",
  size = "md",
  hideClose = false,
  className = "",
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={`relative isolate flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200/70 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#1a1a1d] sm:rounded-3xl ${SIZES[size]} ${className}`}
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 z-10 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
            />
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-white/15 sm:hidden" />
            {!hideClose && (
              <button
                type="button"
                autoFocus
                aria-label="Close"
                title="Close (Esc)"
                onClick={onClose}
                className="absolute right-3 top-3 z-20 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
