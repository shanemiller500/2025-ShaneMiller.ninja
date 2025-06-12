/* eslint-disable @next/next/no-img-element */
'use client';

import React, {
  useEffect,
  useState,
  useMemo,
  KeyboardEvent,
  useCallback,
} from 'react';
import {
  FaGoogle,
  FaWikipediaW,
  FaTripadvisor,
  FaYoutube,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
} from 'react-icons/fa';

import FlightSearch from './FlightSearch';

/* ------------------------------------------------------------------ */
/*  Lite & Full country types                                         */
/* ------------------------------------------------------------------ */
interface LiteCountry {
  cca3: string;
  name: { common: string };
  flags?: { png?: string; alt?: string };
}

export interface FullCountry extends LiteCountry {
  latlng?: [number, number];
  capital?: string[];
  tld?: string[];
  area?: number;
  population?: number;
  continents?: string[];
  subregion?: string;
  languages?: Record<string, string>;
  currencies?: Record<string, { symbol: string }>;
  borders?: string[];
  timezones?: string[];
}

interface Extras {
  weather?: { temperature_2m: number };
  fx?: number | null;
  wiki?: { extract?: string; thumbnail?: { source: string } };
  sights?: { title: string; dist: number }[];
  photos?: string[];
}

/* ---------------- constants & helpers ---------------- */
const lc = (s: string) => s.toLowerCase();
const fmt = (n?: number) =>
  typeof n === 'number' ? n.toLocaleString() : '—';
const Spinner = () => (
  <div className="flex justify-center items-center py-10">
    <div className="h-10 w-10 animate-spin rounded-full border-t-4 border-b-4 border-indigo-500 dark:border-indigo-300" />
  </div>
);

export default function CountrySearch() {
  const [mini, setMini] = useState<LiteCountry[]>([]);
  const [initial, setInit] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LiteCountry[]>([]);
  const [full, setFull] = useState<FullCountry | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapURL, setMapURL] = useState('');

  /* ---- lightbox state ---- */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);

  const photos: string[] = extras?.photos ?? [];

  /* ---------------------------------------------------------------- */
  /*  Fetch the lite list on mount                                    */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const res = await fetch(
        'https://restcountries.com/v3.1/all?fields=name,flags,cca3'
      );
      const js = await res.json();
      if (Array.isArray(js)) setMini(js);
      setInit(false);
    })();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                        */
  /* ---------------------------------------------------------------- */
  const runSearch = () => {
    const hits = mini.filter((c) =>
      lc(c.name.common).includes(lc(q.trim()))
    );
    setResults(hits);
    setQ('');
    if (hits[0]) loadDetails(hits[0].cca3);
  };

  const loadDetails = async (cca3: string) => {
    setLoading(true);
    setExtras(null);

    const fullData: FullCountry = (
      await fetch(
        `https://restcountries.com/v3.1/alpha/${cca3}`
      ).then((r) => r.json())
    )[0];
    setFull(fullData);

    /* Map */
    if (fullData.latlng?.length === 2) {
      const [lat, lng] = fullData.latlng;
      setMapURL(
        `https://maps.google.com/maps?q=${lat},${lng}&z=4&output=embed`
      );
    } else setMapURL('');

    /* Extra data */
    const [weather, fx, wiki, geo, pics] = await Promise.all([
      fullData.latlng
        ? fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${fullData.latlng[0]}&longitude=${fullData.latlng[1]}&current_weather=true`
          )
            .then((r) => r.json())
            .then((j) => j.current_weather)
        : undefined,
      (() => {
        const code = fullData.currencies
          ? Object.keys(fullData.currencies)[0]
          : 'USD';
        return fetch(
          `https://api.exchangerate.host/latest?base=${code}&symbols=USD`
        )
          .then((r) => r.json())
          .then((j) => j.rates?.USD ?? null);
      })(),
      fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          fullData.name.common
        )}`
      ).then((r) => r.json()),
      fullData.latlng
        ? fetch(
            `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=20000&gslimit=8&gscoord=${fullData.latlng[0]}|${fullData.latlng[1]}&format=json&origin=*`
          )
            .then((r) => r.json())
            .then((j) => j.query?.geosearch)
        : undefined,
      fetch(`https://u-mail.co/api/photo?tags=${encodeURIComponent(fullData.name.common)}&limit=8`)
       .then(r => r.json())
        .catch(() => []),
    ]);

    setExtras({
      weather,
      fx,
      wiki,
      sights: geo?.map((g: any) => ({ title: g.title, dist: g.dist })) ?? [],
      photos: pics,
    });
    setLoading(false);
  };

  /* ---------------------------------------------------------------- */
  /*  Derived values                                                  */
  /* ---------------------------------------------------------------- */
  const neighbors = useMemo(
    () => mini.filter((c) => full?.borders?.includes(c.cca3)),
    [full, mini]
  );

  const topSights = useMemo(
    () =>
      extras?.sights
        ?.sort((a, b) => a.dist - b.dist)
        .slice(0, 6) || [],
    [extras]
  );

  /* ---------------------------------------------------------------- */
  /*  Lightbox navigation helpers                                     */
  /* ---------------------------------------------------------------- */
  const closeViewer = () => setViewerOpen(false);
  const prevImg = useCallback(
    () => setViewerIdx((i) => (i - 1 + photos.length) % photos.length),
    [photos.length]
  );
  const nextImg = useCallback(
    () => setViewerIdx((i) => (i + 1) % photos.length),
    [photos.length]
  );

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!viewerOpen) return;
      if (e.key === 'ArrowLeft') prevImg();
      else if (e.key === 'ArrowRight') nextImg();
      else if (e.key === 'Escape') closeViewer();
    },
    [viewerOpen, prevImg, nextImg]
  );

  /* ---------------------------------------------------------------- */
  /*  Small helpers                                                   */
  /* ---------------------------------------------------------------- */
  const Fact = ({ l, v }: { l: string; v: string | number }) => (
    <p className="text-sm">
      <b>{l}:</b> {v}
    </p>
  );

  /* ================================================================= */
  /*  RENDER                                                           */
  /* ================================================================= */
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-brand-900 dark:to-brand-900
                 text-gray-800 dark:text-gray-100 p-4"
      onKeyDown={handleKey}
      tabIndex={0} // allow keyboard events
    >
      {/* ---------------- Header ---------------- */}
      <h1 className="my-6 text-center text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        🌍 Travel Explorer
      </h1>

      {/* ---------------- search box ---------------- */}
      <div className="mx-auto mb-10 flex max-w-md gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Search country…"
          className="flex-1 rounded border p-3 text-sm sm:text-base"
        />
        <button
          onClick={runSearch}
          className="rounded bg-indigo-600 px-4 py-3 text-sm sm:text-base text-white"
        >
          Go
        </button>
      </div>

{/* ---------------- country tiles ---------------- */}
{initial ? (
  <Spinner />
) : (
  <div className="mb-12 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
    {(results.length ? results : mini.slice(0, 12)).map((c) => (
      <div
        key={c.cca3}
        onClick={() => {
          loadDetails(c.cca3);
          setResults([]);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="cursor-pointer rounded-lg border bg-white/30 dark:bg-black/30 bg-cover bg-center p-0 shadow transition hover:shadow-lg relative overflow-hidden "
        style={{
          backgroundImage: c.flags?.png
            ? `url(${c.flags.png})`
            : undefined,
        }}
      >
        {/* semi-opaque overlay so text is legible */}
        <div className="absolute inset-0 bg-black/30" />
        <span className="relative z-10 block w-full py-2 text-center text-sm font-medium text-white">
          {c.name.common}
        </span>
      </div>
    ))}
  </div>
)}


      {/* ---------------- detail panel ---------------- */}
      {full && extras && (
        <div className="mx-auto max-w-5xl rounded-lg bg-white/80 p-4 shadow-lg backdrop-blur dark:bg-brand-900/50 sm:p-6">
          {/* title + flag */}
          <div className="mb-4 flex items-center gap-4">
            {full.flags?.png && (
              <img
                src={full.flags.png}
                alt={full.flags.alt || `Flag of ${full.name.common}`}
                className="h-auto w-16 rounded border shadow sm:w-20"
              />
            )}
            <h2 className="text-xl font-bold sm:text-3xl">
              {full.name.common}
            </h2>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <>
              {/* map */}
              {mapURL && (
                <iframe
                  src={mapURL}
                  height={260}
                  className="mb-6 w-full rounded sm:h-72"
                  loading="lazy"
                />
              )}

              {/* gallery */}
              {photos.length > 0 && (
                <div className="mb-6 flex gap-2 overflow-x-auto">
                  {photos.map((p, i) => (
                    <img
                      key={i}
                      src={p}
                      alt="Gallery"
                      onClick={() => {
                        setViewerIdx(i);
                        setViewerOpen(true);
                      }}
                      className="h-16 w-24 flex-shrink-0 cursor-pointer rounded object-cover sm:h-20 sm:w-32"
                    />
                  ))}
                </div>
              )}

              {/* quick facts */}
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <Fact l="Capital" v={full.capital?.[0] ?? '—'} />
                <Fact l="Population" v={fmt(full.population)} />
                <Fact l="Area" v={`${fmt(full.area)} km²`} />
                <Fact
                  l="Currency"
                  v={
                    full.currencies
                      ? Object.values(full.currencies)[0].symbol
                      : '—'
                  }
                />
                <Fact l="Region" v={full.continents?.join(', ') ?? '—'} />
                <Fact l="Subregion" v={full.subregion ?? '—'} />
                <Fact
                  l="Languages"
                  v={
                    full.languages
                      ? Object.values(full.languages).join(', ')
                      : '—'
                  }
                />
                <Fact
                  l="Timezones"
                  v={full.timezones?.slice(0, 3).join(', ') ?? '—'}
                />
              </div>

 {/* ---------------- neighbors ---------------- */}
{neighbors.length > 0 && (
  <>
    <h3 className="mb-2 font-semibold">
      Neighboring Countries
    </h3>
    <div className="mb-6 flex gap-2 overflow-x-auto">
      {neighbors.map((n) => (
        <div
          key={n.cca3}
          onClick={() => {
            loadDetails(n.cca3);
            setResults([]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="
            relative
            flex-shrink-0
            w-24 h-16
            cursor-pointer
            overflow-hidden
            rounded-lg
            shadow
            transition hover:shadow-lg
            bg-contain bg-center bg-no-repeat
          "
          style={{
            backgroundImage: n.flags?.png
              ? `url(${n.flags.png})`
              : undefined,
          }}
        >
          {/* dark overlay for readability */}
          <div className="absolute inset-0 bg-black/30" />
          {/* country name */}
          <span className="absolute bottom-1 w-full text-center text-xs font-medium text-white">
            {n.name.common}
          </span>
        </div>
      ))}
    </div>
  </>
)}

              {/* top sights */}
              {topSights.length > 0 && (
                <>
                  <h3 className="mb-2 font-semibold">Top Places to Visit</h3>
                  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {topSights.map((s, i) => (
                      <a
                        key={i}
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          s.title
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded bg-white p-4 shadow transition hover:shadow-lg"
                      >
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-gray-500">
                          {(s.dist / 1000).toFixed(1)} km away
                        </p>
                      </a>
                    ))}
                  </div>
                </>
              )}

              {/* wiki summary */}
              {extras.wiki?.extract && (
                <blockquote className="mb-6 italic text-gray-700 dark:text-gray-300">
                  {extras.wiki.extract}
                </blockquote>
              )}

              {/* helpful links */}
              <div className="mb-8 flex flex-wrap gap-3 text-sm">
                <a
                  href={`https://news.google.com/search?q=${encodeURIComponent(
                    full.name.common + ' travel'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 underline"
                >
                  <FaGoogle /> Google News
                </a>
                <a
                  href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(
                    full.name.common
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 underline"
                >
                  <FaWikipediaW /> Wikivoyage
                </a>
                <a
                  href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(
                    full.name.common
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 underline"
                >
                  <FaTripadvisor /> Tripadvisor
                </a>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    full.name.common + ' travel guide'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 underline"
                >
                  <FaYoutube /> YouTube Guides
                </a>
              </div>

              {/* flight search */}
              <FlightSearch full={full} />
            </>
          )}
        </div>
      )}

      {/* ---------------- Image Lightbox ---------------- */}
      {viewerOpen && photos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
          {/* close btn */}
          <button
            onClick={closeViewer}
            className="absolute right-4 top-4 text-2xl text-white"
          >
            <FaTimes />
          </button>

          {/* prev & next */}
          <button
            onClick={prevImg}
            className="absolute left-4 text-3xl text-white"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={nextImg}
            className="absolute right-4 text-3xl text-white"
          >
            <FaChevronRight />
          </button>

          {/* image */}
          <img
            src={photos[viewerIdx]}
            alt="Large"
            className="max-h-[80vh] max-w-[90vw] rounded shadow-lg"
            onClick={nextImg} // tap image to advance
          />
        </div>
      )}
    </div>
  );
}
