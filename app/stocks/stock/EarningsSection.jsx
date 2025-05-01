"use client";

import React, { useState, useEffect } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatSupplyValue } from "@/utils/formatters";

const EarningsSection = () => {
  const [earningsData, setEarningsData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=2024-01-01&to=2024-04-31&token=${API_TOKEN}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.earningsCalendar) {
          const today = new Date().toISOString().slice(0, 10);
          const sorted = data.earningsCalendar.sort((a, b) => {
            if (a.date === today) return -1;
            if (b.date === today) return 1;
            return a.date.localeCompare(b.date);
          });
          setEarningsData(sorted);
        }
      })
      .catch((error) => console.error("Error fetching earnings data:", error));
  }, []);

  const filteredEarnings = earningsData.filter((item) =>
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="p-4 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Earnings Info</h2>
      <input
        type="text"
        placeholder="Search by ticker symbol"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="p-2 border border-gray-300 rounded w-full mb-4  dark:border-gray-600 focus:outline-none dark:bg-brand-900"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 dark:border-gray-700">
          <thead className="">
            <tr>
              <th className="p-2 text-sm font-semibold">Symbol</th>
              <th className="p-2 text-sm font-semibold">Date</th>
              <th className="p-2 text-sm font-semibold">EPS Estimate</th>
              <th className="p-2 text-sm font-semibold">Revenue Actual</th>
              <th className="p-2 text-sm font-semibold">EPS Surprise</th>
              <th className="p-2 text-sm font-semibold">Quarter</th>
            </tr>
          </thead>
          <tbody>
            {filteredEarnings.map((item, index) => (
              <tr key={index} className="border-b border-gray-300 dark:border-gray-700">
                <td className="p-2 text-sm">{item.symbol}</td>
                <td className="p-2 text-sm">{item.date}</td>
                <td className="p-2 text-sm">{item.epsEstimate ? formatSupplyValue(item.epsEstimate) : "--"}</td>
                <td className="p-2 text-sm">{item.revenueActual ? formatSupplyValue(item.revenueActual) : "--"}</td>
                <td className="p-2 text-sm">{item.epsSurprise}</td>
                <td className="p-2 text-sm">{item.quarter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default EarningsSection;
