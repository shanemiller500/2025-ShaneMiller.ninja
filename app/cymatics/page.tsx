'use client';

import React, { useState } from "react";
import ChladniPage from "./ChladniPage";
import Tesseract4DPage from "./Tesseract4DPage";

const Page: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"chladni" | "tesseract">("chladni");

  return (
    <div className="min-h-screen  text-white">
      <nav className="flex space-x-4 p-4 border-b border-indigo-700">
        <button
          onClick={() => setActiveTab("chladni")}
          className={`px-4 py-2 rounded-t transition-colors ${
            activeTab === "chladni"
              ? "bg-indigo-800 border-b-2 border-indigo-500"
              : "bg-indigo-700 hover:bg-indigo-600"
          }`}
        >
          Chladni
        </button>
        <button
          onClick={() => setActiveTab("tesseract")}
          className={`px-4 py-2 rounded-t transition-colors ${
            activeTab === "tesseract"
              ? "bg-indigo-800 border-b-2 border-indigo-500"
              : "bg-indigo-700 hover:bg-indigo-600"
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
};

export default Page;
