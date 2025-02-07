"use client";

import React, { useState, useEffect } from "react";
import { API_TOKEN } from "@/utils/config";

const IPOCalendarSection = () => {
  const [ipoEvents, setIpoEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const url = `https://finnhub.io/api/v1/calendar/ipo?from=2024-01-01&to=2025-01-01&token=${API_TOKEN}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ipoCalendar && data.ipoCalendar.length > 0) {
          setIpoEvents(data.ipoCalendar);
        } else {
          console.error("No IPO data found.");
        }
      })
      .catch((error) => console.error("Error fetching IPO calendar:", error));
  }, []);

  const filteredEvents = ipoEvents.filter((event) =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="p-4  rounded ">
      <h2 className="text-2xl font-bold mb-4">IPO Calendar</h2>
      <input
        type="text"
        placeholder="Search IPO events"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="p-2 border border-gray-300 rounded w-full mb-4 dark:border-gray-600 focus:outline-none"
      />
      {filteredEvents.length === 0 ? (
        <p className="text-center">No data found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredEvents.map((event, index) => (
            <div key={index} className="border border-gray-300 dark:border-gray-700 rounded p-4">
              <h5 className="text-lg font-bold mb-2">{event.name}</h5>
              <p className="text-sm mb-1">Date: {event.date}</p>
              <p className="text-sm mb-1">Exchange: {event.exchange}</p>
              <p className="text-sm mb-1">Price Range: {event.price}</p>
              <p className="text-sm mb-1">Shares: {event.shares}</p>
              <p className="text-sm">Status: {event.status}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default IPOCalendarSection;
