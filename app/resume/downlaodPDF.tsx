import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  DownloadPDF Component                                              */
/* ------------------------------------------------------------------ */
export default function DownloadPDF() {
  const handleDownloadClick = (): void => {
    trackEvent("Resume Download", { downloadUrl: "2025-Resume" });
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <a
        href="/PDF/Shane_Miller_Resume.pdf"
        download
        onClick={handleDownloadClick}
        className="inline-flex items-center px-6 py-3 bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white font-semibold rounded-lg shadow-md transform transition duration-300 ease-in-out hover:scale-105 hover:shadow-xl focus:outline-none"
      >
        {/* Download Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
        </svg>
        Download My Resume
      </a>
    </div>
  );
}
