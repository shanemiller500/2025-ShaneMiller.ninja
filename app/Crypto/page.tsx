"use client";

import React from "react";
import LiveStreamHeatmap from "./LiveStreamHeatmap"; // Adjust path if needed
import TopGainersLosers from "./TopGainersLosers";
import CryptoChartPrices from "./CryptoChartPrices";

const CryptoDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100 p-4 space-y-8">
      <h1 className="text-4xl font-bold text-center">Crypto Dashboard</h1>
      <section>
        <LiveStreamHeatmap />
      </section>
      <section>
        <TopGainersLosers />
      </section>
      <section>
        <CryptoChartPrices />
      </section>
    </div>
  );
};

export default CryptoDashboard;
