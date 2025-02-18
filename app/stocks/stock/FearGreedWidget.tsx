"use client";

import React from "react";

interface FearGreedWidgetProps {
  index: number; // a value between 0 and 100
}

const getFearGreedLabel = (index: number): string => {
  if (index < 20) return "Extreme Fear";
  if (index < 40) return "Fear";
  if (index < 60) return "Neutral";
  if (index < 80) return "Greed";
  return "Extreme Greed";
};

const FearGreedWidget: React.FC<FearGreedWidgetProps> = ({ index }) => {
  const label = getFearGreedLabel(index);

  return (
    <div className="p-4">
      <div className="text-center text-sm font-semibold mb-2">
        Fear and Greed Index: {index.toFixed(0)} ({label})
      </div>
      <div className="w-full mt-2">
        <div className="relative h-4 rounded-full bg-gradient-to-r from-red-500 via-gray-300 to-green-500">
          {/* Marker positioned according to the index value */}
          <div
            className="absolute top-0 h-4 w-1 bg-black"
            style={{ left: `${index}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span>Fear</span>
          <span>Neutral</span>
          <span>Greed</span>
        </div>
      </div>
    </div>
  );
};

export default FearGreedWidget;
