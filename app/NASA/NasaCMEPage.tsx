'use client';

import React, { useState, useEffect } from "react";
import { trackEvent } from "@/utils/mixpanel";

const API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY;

/**
 * Helper function to format a Date object as a UTC date string in YYYY-MM-DD.
 * @param {Date} date 
 * @returns {string}
 */
function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const monthString = month < 10 ? "0" + month : month.toString();
  let day = date.getUTCDate();
  const dayString = day < 10 ? "0" + day : day.toString();
  return `${year}-${monthString}-${dayString}`;
}

const NasaDONKIPage = () => {
  // Default date range: last 30 days (UTC)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return formatDateUTC(d);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return formatDateUTC(now);
  });
  const [cmeData, setCmeData] = useState<any[]>([]);
  const [flrData, setFlrData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch data from both CME and FLR endpoints.
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch CME events.
      const cmeResponse = await fetch(
        `https://api.nasa.gov/DONKI/CME?startDate=${startDate}&endDate=${endDate}&api_key=${API_KEY}`
      );
      const cmeJson = await cmeResponse.json();

      // Fetch Solar Flare (FLR) events.
      const flrResponse = await fetch(
        `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${API_KEY}`
      );
      const flrJson = await flrResponse.json();

      setCmeData(cmeJson);
      setFlrData(flrJson);
      trackEvent("DONKI Data Fetched", {
        cmeCount: cmeJson.length,
        flrCount: flrJson.length,
      });
    } catch (err) {
      console.error("Error fetching DONKI data:", err);
      setError("Error fetching data. Please try again.");
      trackEvent("DONKI Data Fetch Error", {
        error: err instanceof Error ? err.toString() : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on initial mount.
  useEffect(() => {
    fetchData();
  }, []);

  // Handler for the search form submission.
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    trackEvent("DONKI Search Performed", { startDate, endDate });
    fetchData();
  };

  // Helper to get the most recent event from a data array.
  const getLatestEvent = (data: any[]) => {
    if (!data || data.length === 0) return null;
    // Assume each event has a beginTime or peakTime field.
    const sorted = data.slice().sort((a, b) => {
      const timeA = a.beginTime || a.peakTime;
      const timeB = b.beginTime || b.peakTime;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
    return sorted[0];
  };

  const latestCME = getLatestEvent(cmeData);
  const latestFLR = getLatestEvent(flrData);

  return (
    <div className="p-4 dark:text-gray-100">
      <h2 className="text-3xl font-bold text-center mb-6">
        NASA DONKI Data: CME & Solar Flares
      </h2>
      <div className="mb-4 text-center">
        <p>
          Showing data from <strong>{startDate}</strong> to{" "}
          <strong>{endDate}</strong> (UTC)
        </p>
      </div>
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 justify-center mb-6">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 rounded p-2"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded p-2"
        />
        <button
          type="submit"
          className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded px-4 py-2 hover:bg-gradient-to-r from-indigo-600 to-purple-600 transition"
        >
          Search
        </button>
      </form>
      {loading && <p className="text-center">Loading data...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}
      {!loading && !error && (
        <>
          {/* Latest CME Event */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4 text-center">Latest CME Event</h3>
            {latestCME ? (
              <div className="border border-gray-300 rounded p-4 shadow">
                <p>
                  <strong>Date:</strong>{" "}
                  {latestCME.beginTime || latestCME.peakTime || "Unknown"}
                </p>
                <p>
                  <strong>Note:</strong>{" "}
                  {latestCME.note || "No additional info"}
                </p>
                {/* You can add more CME-specific fields here */}
              </div>
            ) : (
              <p className="text-center">
                No CME events found for this period.
              </p>
            )}
          </div>
          {/* Latest Solar Flare (FLR) Event */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4 text-center">
              Latest Solar Flare (FLR) Event
            </h3>
            {latestFLR ? (
              <div className="border border-gray-300 rounded p-4 shadow">
                <p>
                  <strong>Date:</strong>{" "}
                  {latestFLR.beginTime || latestFLR.peakTime || "Unknown"}
                </p>
                <p>
                  <strong>Class Type:</strong>{" "}
                  {latestFLR.classType || "Unknown"}
                </p>
                <p>
                  <strong>Source Location:</strong>{" "}
                  {latestFLR.sourceLocation || "Unknown"}
                </p>
                {/* You can add more FLR-specific fields here */}
              </div>
            ) : (
              <p className="text-center">
                No Solar Flare events found for this period.
              </p>
            )}
          </div>
          {/* All CME Events List */}
          {/* <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4 text-center">All CME Events</h3>
            {cmeData.length > 0 ? (
              <div className="space-y-4">
                {cmeData.map((event, index) => (
                  <div key={index} className="border border-gray-300 rounded p-4 shadow">
                    <p>
                      <strong>Date:</strong>{" "}
                      {event.beginTime || event.peakTime || "Unknown"}
                    </p>
                    <p>
                      <strong>Note:</strong>{" "}
                      {event.note || "No additional info"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center">No CME events found for this period.</p>
            )}
          </div> */}


          {/* All Solar Flare (FLR) Events List */}

          {/* <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4 text-center">
              All Solar Flare (FLR) Events
            </h3>
            {flrData.length > 0 ? (
              <div className="space-y-4">
                {flrData.map((event, index) => (
                  <div key={index} className="border border-gray-300 rounded p-4 shadow">
                    <p>
                      <strong>Date:</strong>{" "}
                      {event.beginTime || event.peakTime || "Unknown"}
                    </p>
                    <p>
                      <strong>Class Type:</strong>{" "}
                      {event.classType || "Unknown"}
                    </p>
                    <p>
                      <strong>Source Location:</strong>{" "}
                      {event.sourceLocation || "Unknown"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center">
                No Solar Flare events found for this period.
              </p>
            )}
          </div> */}
        </>
      )}
    </div>
  );
};

export default NasaDONKIPage;
