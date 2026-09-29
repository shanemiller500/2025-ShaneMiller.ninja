import { Download } from "lucide-react";
import { trackEvent } from "@/utils/mixpanel";

export const RESUME_PDF = "/PDF/ShaneMiller-2026.pdf?v=2026-09-19-aec-hybrid";

/* ------------------------------------------------------------------ */
/*  DownloadPDF Component                                              */
/* ------------------------------------------------------------------ */
export default function DownloadPDF({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={RESUME_PDF}
      download
      onClick={() => trackEvent("Resume Download", { downloadUrl: "2026-Resume-AEC", placement: compact ? "header" : "footer" })}
      className={`group inline-flex items-center gap-2 rounded-xl bg-indigo-500 font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600 hover:shadow-[0_0_28px_-4px_rgba(99,102,241,0.8)] ${compact ? "px-4 py-2 text-sm" : "px-6 py-3"}`}
    >
      <Download className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
      Download my resume
      <span className="font-mono text-[10px] uppercase tracking-wider text-white/70">PDF</span>
    </a>
  );
}
