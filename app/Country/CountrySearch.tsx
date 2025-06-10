/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { FaGoogle, FaWikipediaW, FaTripadvisor, FaYoutube } from 'react-icons/fa';

/* ------------------------------------------------------------------ */
/*  Lite & Full country types                                        */
/* ------------------------------------------------------------------ */
interface LiteCountry {
  cca3: string;
  name: { common: string };
  flags?: { png?: string; alt?: string };
}

interface FullCountry extends LiteCountry {
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

type Cabin = 'e' | 'pe' | 'b' | 'f';
type TripType = 'round' | 'oneway';

interface Extras {
  weather?: { temperature_2m: number };
  fx?: number | null;
  wiki?: { extract?: string; thumbnail?: { source: string } };
  sights?: { title: string; dist: number }[];
  photos?: string[];
}

/* ---------------- constants & helpers ---------------- */
const IATA: Record<string, string> = {
  USA: 'JFK', GBR: 'LHR', CAN: 'YYZ', FRA: 'CDG', DEU: 'FRA', JPN: 'NRT',
};
const cabinMap: Record<Cabin, string> = { e: 'economy', pe: 'premiumeconomy', b: 'business', f: 'first' };
const lc = (s: string) => s.toLowerCase();
const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString() : '—');
const Spinner = () => (
  <div className="flex justify-center items-center py-10">
    <div className="animate-spin h-12 w-12 rounded-full border-t-4 border-b-4 border-indigo-500 dark:border-indigo-300" />
  </div>
);

export default function CountrySearch() {
  const [mini, setMini] = useState<LiteCountry[]>([]);
  const [initialLoad, setInit] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LiteCountry[]>([]);
  const [full, setFull] = useState<FullCountry | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapURL, setMapURL] = useState('');
  const [from, setFrom] = useState('');
  const [depart, setDepart] = useState('');
  const [ret, setRet] = useState('');
  const [cabin, setCabin] = useState<Cabin>('e');
  const [tripType, setTripType] = useState<TripType>('round');
  const [adults, setAdults] = useState(1);
  const [seniors, setSeniors] = useState(0);
  const [kids, setKids] = useState(0);
  const [inf, setInf] = useState(0);

  useEffect(() => {
    (async () => {
      const res = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,cca3');
      const js = await res.json();
      if (Array.isArray(js)) setMini(js);
      setInit(false);
    })();
  }, []);

  const runSearch = () => {
    const hits = mini.filter(c => lc(c.name.common).includes(lc(q.trim())));
    setResults(hits);
    setQ('');
    if (hits[0]) loadDetails(hits[0].cca3);
  };

  const loadDetails = async (cca3: string) => {
    setLoading(true);
    setExtras(null);
    const fullData: FullCountry = (await fetch(`https://restcountries.com/v3.1/alpha/${cca3}`).then(r => r.json()))[0];
    setFull(fullData);
    if (fullData.latlng?.length === 2) {
      const [lat, lng] = fullData.latlng;
      setMapURL(`https://maps.google.com/maps?q=${lat},${lng}&z=4&output=embed`);
    } else setMapURL('');
    const [weather, fx, wiki, geo, flickr] = await Promise.all([
      fullData.latlng
        ? fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${fullData.latlng[0]}&longitude=${fullData.latlng[1]}&current_weather=true`
          )
            .then(r => r.json())
            .then(j => j.current_weather)
        : undefined,
      (() => {
        const code = fullData.currencies ? Object.keys(fullData.currencies)[0] : 'USD';
        return fetch(`https://api.exchangerate.host/latest?base=${code}&symbols=USD`)
          .then(r => r.json())
          .then(j => j.rates?.USD ?? null);
      })(),
      fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(fullData.name.common)}`
      ).then(r => r.json()),
      fullData.latlng
        ? fetch(
            `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=20000&gslimit=8&gscoord=${fullData.latlng[0]}|${fullData.latlng[1]}&format=json&origin=*`
          )
            .then(r => r.json())
            .then(j => j.query?.geosearch)
        : undefined,
      fetch(
        `https://www.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&tags=${encodeURIComponent(
          fullData.name.common
        )}`
      )
        .then(r => r.json())
        .then(j => j.items.slice(0, 6).map((it: any) => it.media.m))
        .catch(() => []),
    ]);
    setExtras({ weather, fx, wiki, sights: geo?.map((g: any) => ({ title: g.title, dist: g.dist })) ?? [], photos: flickr });
    setLoading(false);
  };

  const to = full ? IATA[full.cca3] || full.capital?.[0] || '' : '';
  const flightURL = full
    ? `https://www.skyscanner.com/transport/flights/${from}/${to}/${depart}${
        tripType === 'round' && ret ? `/${ret}` : ''
      }/?adults=${adults}&seniors=${seniors}&children=${kids}&infants=${inf}&cabinclass=${cabinMap[cabin]}`
    : '#';

  const neighbors = useMemo(() => mini.filter(c => full?.borders?.includes(c.cca3)), [full, mini]);
  const topSights = useMemo(() => extras?.sights?.sort((a, b) => a.dist - b.dist).slice(0, 6) || [], [extras]);

  const Fact = ({ l, v }: { l: string; v: string | number }) => <p className="text-sm"><b>{l}:</b> {v}</p>;
  const Counter = ({ label, val, set, min }: { label: string; val: number; set: (n: number) => void; min: number }) => (
    <div className="flex justify-between border rounded p-2 text-sm">
      <span>{label}</span>
      <div className="flex gap-2">
        <button onClick={() => set(Math.max(min, val - 1))} className="px-2 border rounded">–</button>
        {val}
        <button onClick={() => set(val + 1)} className="px-2 border rounded">+</button>
      </div>
    </div>
  );

  const showFeatured = !results.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-brand-900 dark:to-brand-900 text-gray-800 dark:text-gray-100 p-4">
      <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text my-6">
        🌍 Travel Explorer
      </h1>

      <div className="max-w-lg mx-auto flex gap-2 mb-10">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runSearch()}
          placeholder="Search country…"
          className="flex-1 p-3 border rounded"
        />
        <button onClick={runSearch} className="px-4 py-3 bg-indigo-600 text-white rounded">Go</button>
      </div>

      {initialLoad ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-12">
          {(showFeatured ? mini.slice(0, 8) : results).map(c => (
            <div
              key={c.cca3}
              onClick={() => { loadDetails(c.cca3); setResults([]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="border rounded p-3 bg-white/70 dark:bg-brand-950 cursor-pointer hover:shadow transition"
            >
              {c.flags?.png && <img src={c.flags.png} alt={c.flags.alt} className="w-12 h-8 rounded-sm mb-1" />}
              <span className="text-sm">{c.name.common}</span>
            </div>
          ))}
        </div>
      )}

      {full && extras && (
        <div className="max-w-5xl mx-auto bg-white/80 dark:bg-brand-900/50 backdrop-blur p-6 rounded-lg shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            {full.flags?.png && (
              <img
                src={full.flags.png}
                alt={full.flags.alt || `Flag of ${full.name.common}`}
                className="w-20 h-auto rounded border shadow"
              />
            )}
            <h2 className="text-3xl font-bold">{full.name.common}</h2>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <> 
              {mapURL && <iframe src={mapURL} height={300} className="w-full rounded mb-6" loading="lazy" />} 
              {extras.photos?.length && (
                <div className="flex gap-2 overflow-x-auto mb-6">
                  {extras.photos.map((p, i) => (
                    <img key={i} src={p} alt="Gallery" className="w-32 h-20 object-cover rounded" />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                <Fact l="Capital" v={full.capital?.[0] ?? '—'} />
                <Fact l="Population" v={fmt(full.population)} />
                <Fact l="Area" v={`${fmt(full.area)} km²`} />
                <Fact l="Currency" v={full.currencies ? Object.values(full.currencies)[0].symbol : '—'} />
                <Fact l="FX→USD" v={extras.fx ?? '—'} />
                <Fact l="Temp (°C)" v={extras.weather?.temperature_2m ?? '—'} />
                <Fact l="Region" v={full.continents?.join(', ') ?? '—'} />
                <Fact l="Subregion" v={full.subregion ?? '—'} />
                <Fact l="Languages" v={full.languages ? Object.values(full.languages).join(', ') : '—'} />
                <Fact l="Timezones" v={full.timezones?.slice(0, 3).join(', ') ?? '—'} />
              </div>

              {neighbors.length > 0 && (
                <>
                  <h3 className="font-semibold mb-2">Neighboring Countries</h3>
                  <div className="flex gap-2 overflow-x-auto mb-6">
                    {neighbors.map(n => (
                      <div
                        key={n.cca3}
                        onClick={() => { loadDetails(n.cca3); setResults([]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="cursor-pointer flex flex-col items-center p-2 bg-white dark:bg-brand-950 rounded shadow hover:shadow-lg transition"
                      >
                        {n.flags?.png && <img src={n.flags.png} alt={n.name.common} className="w-12 h-auto mb-1 rounded" />}
                        <span className="text-xs">{n.name.common}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {topSights.length > 0 && (
                <>
                  <h3 className="font-semibold mb-2">Top Places to Visit</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {topSights.map((s, i) => (
                      <a
                        key={i}
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.title)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="block p-4 bg-white rounded shadow hover:shadow-lg transition"
                      >
                        <p className="font-medium">{s.title}</p>
                        <p className="text-sm text-gray-500">{(s.dist / 1000).toFixed(1)} km away</p>
                      </a>
                    ))}
                  </div>
                </>
              )}

              {extras.wiki?.extract && (
                <blockquote className="italic text-gray-700 dark:text-gray-300 mb-6">{extras.wiki.extract}</blockquote>
              )}

              <div className="flex flex-wrap gap-3 mb-8 text-sm">
                <a href={`https://news.google.com/search?q=${encodeURIComponent(full.name.common + ' travel')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                  <FaGoogle /> Google News
                </a>
                <a href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(full.name.common)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                  <FaWikipediaW /> Wikivoyage
                </a>
                <a href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(full.name.common)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                  <FaTripadvisor /> Tripadvisor
                </a>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(full.name.common + ' travel guide')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                  <FaYoutube /> YouTube Guides
                </a>
              </div>

              <h3 className="font-semibold mb-2">Flight Search</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setTripType('round')}
                  className={`px-3 py-1 rounded ${
                    tripType === 'round' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  Round Trip
                </button>
                <button
                  onClick={() => setTripType('oneway')}
                  className={`px-3 py-1 rounded ${
                    tripType === 'oneway' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  One Way
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                <input
                  placeholder="From (IATA Code)"
                  value={from}
                  onChange={e => setFrom(e.target.value.toUpperCase())}
                  className="p-2 border rounded text-brand-900"
                />
                <input
                  type="date"
                  placeholder="Depart"
                  value={depart}
                  onChange={e => setDepart(e.target.value)}
                  className="p-2 border rounded text-brand-900"
                />
                {tripType === 'round' && (
                  <input
                    type="date"
                    placeholder="Return"
                    value={ret}
                    onChange={e => setRet(e.target.value)}
                    className="p-2 border rounded text-brand-900"
                  />
                )}
                <select
                  value={cabin}
                  onChange={e => setCabin(e.target.value as Cabin)}
                  className="p-2 border rounded text-brand-900"
                >
                  <option value="e">Economy</option>
                  <option value="pe">Premium Economy</option>
                  <option value="b">Business</option>
                  <option value="f">First</option>
                </select>
                <Counter label="Adults" val={adults} set={setAdults} min={1} />
                <Counter label="Seniors" val={seniors} set={setSeniors} min={0} />
                <Counter label="Kids" val={kids} set={setKids} min={0} />
                <Counter label="Infants" val={inf} set={setInf} min={0} />
              </div>
              <a
                href={flightURL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full h-12 flex items-center justify-center bg-brand-gradient text-white rounded shadow hover:opacity-90"
              >
                Search Flights →
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
