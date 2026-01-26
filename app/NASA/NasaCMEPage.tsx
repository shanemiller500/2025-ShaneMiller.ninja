"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY || "";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
      {children}
    </div>
  );
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function NasaDONKIPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return formatDateUTC(d);
  });

  const [endDate, setEndDate] = useState(() => formatDateUTC(new Date()));

  const [cmeData, setCmeData] = useState<any[]>([]);
  const [flrData, setFlrData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    if (!API_KEY) {
      setLoading(false);
      setError("Missing NASA API key (NEXT_PUBLIC_NASA_API_KEY).");
      return;
    }

    try {
      const [cmeRes, flrRes] = await Promise.all([
        fetch(
          `https://api.nasa.gov/DONKI/CME?startDate=${startDate}&endDate=${endDate}&api_key=${API_KEY}`
        ),
        fetch(
          `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${API_KEY}`
        ),
      ]);

      const cmeJson = await cmeRes.json();
      const flrJson = await flrRes.json();

      setCmeData(Array.isArray(cmeJson) ? cmeJson : []);
      setFlrData(Array.isArray(flrJson) ? flrJson : []);

      trackEvent("DONKI Data Fetched", {
        cmeCount: Array.isArray(cmeJson) ? cmeJson.length : 0,
        flrCount: Array.isArray(flrJson) ? flrJson.length : 0,
      });
    } catch (err: any) {
      console.error("Error fetching DONKI data:", err);
      setError("Error fetching data. Try again.");
      trackEvent("DONKI Data Fetch Error", { error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    trackEvent("DONKI Search Performed", { startDate, endDate });
    fetchData();
  };

  const getLatestEvent = (data: any[]) => {
    if (!data?.length) return null;
    const sorted = data.slice().sort((a, b) => {
      const timeA = a.beginTime || a.peakTime || a.startTime;
      const timeB = b.beginTime || b.peakTime || b.startTime;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
    return sorted[0];
  };

  const latestCME = useMemo(() => getLatestEvent(cmeData), [cmeData]);
  const latestFLR = useMemo(() => getLatestEvent(flrData), [flrData]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
          CME & Solar Flares
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-white/60">
          UTC range: <span className="font-extrabold">{startDate}</span> →{" "}
          <span className="font-extrabold">{endDate}</span>
        </p>
      </div>

      <Card>
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="w-full">
            <label className="text-xs font-extrabold text-gray-700 dark:text-white/70">
              Start (UTC)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-gray-800 shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         dark:border-white/10 dark:bg-brand-900 dark:text-white/90"
            />
          </div>

          <div className="w-full">
            <label className="text-xs font-extrabold text-gray-700 dark:text-white/70">
              End (UTC)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-gray-800 shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         dark:border-white/10 dark:bg-brand-900 dark:text-white/90"
            />
          </div>

          <button
            type="submit"
            className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-2 text-sm font-extrabold text-gray-800 shadow-sm hover:bg-black/[0.06]
                       dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
          >
            Search
          </button>
        </form>

        {loading ? (
          <div className="mt-3 text-sm font-bold text-gray-700 dark:text-white/70">
            Loading…
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 text-sm font-bold text-red-500">{error}</div>
        ) : null}
      </Card>

      {!loading && !error ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <div className="text-xs font-extrabold text-gray-600 dark:text-white/60">
              Latest CME
            </div>
            {latestCME ? (
              <div className="mt-2 space-y-2">
                <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                  {latestCME.beginTime || latestCME.peakTime || "Unknown time"}
                </div>
                <div className="text-sm font-semibold text-gray-700 dark:text-white/70">
                  {latestCME.note || "No note"}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-extrabold text-gray-800 dark:text-white/80">
                    Details
                  </summary>
                  <pre className="mt-2 max-h-[260px] overflow-auto rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10">
                    {safeJson(latestCME)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">
                No CME events found.
              </div>
            )}
          </Card>

          <Card>
            <div className="text-xs font-extrabold text-gray-600 dark:text-white/60">
              Latest Solar Flare
            </div>
            {latestFLR ? (
              <div className="mt-2 space-y-2">
                <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                  {latestFLR.beginTime || latestFLR.peakTime || "Unknown time"}
                </div>
                <div className="text-sm font-semibold text-gray-700 dark:text-white/70">
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    Class:
                  </span>{" "}
                  {latestFLR.classType || "—"}{" "}
                  <span className="mx-2 text-gray-400 dark:text-white/30">•</span>
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    Source:
                  </span>{" "}
                  {latestFLR.sourceLocation || "—"}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-extrabold text-gray-800 dark:text-white/80">
                    Details
                  </summary>
                  <pre className="mt-2 max-h-[260px] overflow-auto rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10">
                    {safeJson(latestFLR)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">
                No flare events found.
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-4">
          <details className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
            <summary className="cursor-pointer text-sm font-extrabold text-gray-900 dark:text-white">
              All CME Events ({cmeData.length})
            </summary>
            <div className="mt-3 grid gap-3">
              {cmeData.map((event, idx) => (
                <Card key={idx}>
                  <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                    {event.beginTime || event.peakTime || "Unknown time"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/70">
                    {event.note || "No note"}
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-extrabold text-gray-800 dark:text-white/80">
                      Raw
                    </summary>
                    <pre className="mt-2 max-h-[220px] overflow-auto rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10">
                      {safeJson(event)}
                    </pre>
                  </details>
                </Card>
              ))}
              {!cmeData.length ? (
                <div className="text-sm font-semibold text-gray-700 dark:text-white/70">
                  No CME events.
                </div>
              ) : null}
            </div>
          </details>

          <details className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900 sm:p-5">
            <summary className="cursor-pointer text-sm font-extrabold text-gray-900 dark:text-white">
              All Solar Flare Events ({flrData.length})
            </summary>
            <div className="mt-3 grid gap-3">
              {flrData.map((event, idx) => (
                <Card key={idx}>
                  <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                    {event.beginTime || event.peakTime || "Unknown time"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/70">
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      Class:
                    </span>{" "}
                    {event.classType || "—"}{" "}
                    <span className="mx-2 text-gray-400 dark:text-white/30">•</span>
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      Source:
                    </span>{" "}
                    {event.sourceLocation || "—"}
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-extrabold text-gray-800 dark:text-white/80">
                      Raw
                    </summary>
                    <pre className="mt-2 max-h-[220px] overflow-auto rounded-2xl bg-black/[0.03] p-3 text-xs font-semibold text-gray-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10">
                      {safeJson(event)}
                    </pre>
                  </details>
                </Card>
              ))}
              {!flrData.length ? (
                <div className="text-sm font-semibold text-gray-700 dark:text-white/70">
                  No flare events.
                </div>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
