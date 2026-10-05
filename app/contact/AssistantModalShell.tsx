"use client";

import { useId } from "react";
import { Modal } from "@/components/ui/modal";
import { trackButtonSpotlight } from "./contact-effects";
import "./contact.css";

interface AssistantModalShellProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}

export default function AssistantModalShell({ title, description, icon, onClose, children, size = "md" }: AssistantModalShellProps) {
  const titleId = useId();
  return (
    <Modal open onClose={onClose} labelledBy={titleId} size={size === "lg" ? "wide" : "md"} className="contact-assistant">
      <div onPointerMove={trackButtonSpotlight} className="relative flex min-h-0 flex-1 flex-col">
        <header className="contact-assistant-header flex shrink-0 items-start gap-4 px-5 pb-6 pt-7 pr-14 sm:px-7 sm:pr-14">
          <span className="contact-assistant-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white">{icon}</span>
          <div className="min-w-0">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">Writing assistant</p>
            <h2 id={titleId} className="font-aspekta text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </header>
        <div className="contact-assistant-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-7 pt-6 sm:px-7">
          {children}
        </div>
      </div>
    </Modal>
  );
}
