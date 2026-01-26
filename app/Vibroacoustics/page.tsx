"use client";

import { useState } from "react";

import ChladniPage from "./ChladniPage";
import Tesseract4DPage from "./Tesseract4DPage";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type TabKey = "chladni" | "tesseract";

/* ------------------------------------------------------------------ */
/*  VibroacousticsPage Component                                       */
/* ------------------------------------------------------------------ */
export default function VibroacousticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("chladni");

  return (
    <div className="min-h-screen  text-white">
      <nav className="flex space-x-4 p-4 border-b border-indigo-700">
        <button
          onClick={() => setActiveTab("chladni")}
          className={`px-4 py-2 rounded-t transition-colors ${
            activeTab === "chladni"
              ? "bg-brand-gradient border-b-2 border-indigo-500"
              : "bg-indigo-300 hover:bg-brand-gradient"
          }`}
        >
          Chladni
        </button>
        <button
          onClick={() => setActiveTab("tesseract")}
          className={`px-4 py-2 rounded-t transition-colors ${
            activeTab === "tesseract"
              ? "bg-brand-gradient border-b-2 border-indigo-500"
              : "bg-indigo-300 hover:bg-brand-gradient"
          }`}
        >
          Tesseract 4D
        </button>
      </nav>
      <div className="p-4">
        {activeTab === "chladni" && <ChladniPage />}
        {activeTab === "tesseract" && <Tesseract4DPage />}
      </div>
    </div>
  );
}
