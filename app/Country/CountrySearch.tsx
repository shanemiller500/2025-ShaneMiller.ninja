/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState, useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  Minimal country list (fast)                                       */
/* ------------------------------------------------------------------ */
interface LiteCountry {
  cca3: string;
  name: { common: string };
  flags?: { png?: string; alt?: string };
}

/* ------------------------------------------------------------------ */
/*  Full country after click                                          */
/* ------------------------------------------------------------------ */
interface FullCountry {
  cca3: string;
  name: { common: string };
  latlng?: [number, number];
  flags?: { png?: string; alt?: string };
  capital?: string[];
  tld?: string[];
  area?: number;
  population?: number;
  continents?: string[];
  currencies?: Record<string, { symbol: string }>;
}

type Cabin = 'e' | 'pe' | 'b' | 'f';

interface Extras {
  weather?: { temperature_2m: number };
  fx?: number | null;
  wiki?: { extract?: string; thumbnail?: { source: string } };
  sights?: { title: string; dist: number }[];
  photos?: string[];
}

/* ---------------- tiny helpers ---------------- */
const lc = (s: string) => s.toLowerCase();
const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString() : '—');
const Spinner = () => (
  <div className="flex justify-center items-center py-10">
    <div className="animate-spin h-12 w-12 rounded-full border-t-4 border-b-4 border-indigo-500 dark:border-indigo-300" />
  </div>
);

/* ---------------- quick IATA map ---------------- */
const IATA: Record<string, string> = { USA:'JFK', GBR:'LHR', CAN:'YYZ', FRA:'CDG', DEU:'FRA', JPN:'NRT' /* …add more if you like */ };

export default function CountrySearch() {
  /* ---------- master list ---------- */
  const [mini, setMini]           = useState<LiteCountry[]>([]);
  const [initialLoad, setInit]    = useState(true);

  /* ---------- search ---------- */
  const [q, setQ]                 = useState('');
  const [results, setResults]     = useState<LiteCountry[]>([]);
  const showFeatured              = !results.length;

  /* ---------- details ---------- */
  const [full, setFull]           = useState<FullCountry | null>(null);
  const [extras, setExtras]       = useState<Extras | null>(null);
  const [loading, setLoading]     = useState(false);
  const [mapURL, setMapURL]       = useState('');

  /* ---------- flight form ---------- */
  const [from, setFrom]   = useState('');
  const [depart, setDepart]=useState('');
  const [ret, setRet]     = useState('');
  const [cabin, setCabin] = useState<Cabin>('e');
  const [adults, setAdults]=useState(1);
  const [kids, setKids]   = useState(0);
  const [inf, setInf]     = useState(0);

  /* ---------- load lite list ---------- */
  useEffect(() => {
    (async () => {
      const res = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,cca3');
      const js  = await res.json();
      if (Array.isArray(js)) setMini(js);
      setInit(false);
    })();
  }, []);

  /* ---------- search fn ---------- */
  const runSearch = () => {
    const hit = mini.filter(c => lc(c.name.common).includes(lc(q.trim())));
    setResults(hit);
    setQ('');
    if (hit[0]) loadDetails(hit[0].cca3);
  };

  /* ---------- load per-country detail ---------- */
  const loadDetails = async (cca3: string) => {
    setLoading(true);
    setExtras(null);
    const full: FullCountry = (await fetch(`https://restcountries.com/v3.1/alpha/${cca3}`).then(r=>r.json()))[0];
    setFull(full);

    /* Map */
    if (full.latlng?.length===2){
      const [lat,lng]=full.latlng;
      setMapURL(`https://maps.google.com/maps?q=${lat},${lng}&z=4&output=embed`);
    } else setMapURL('');

    /* Parallel extras – all free, no keys */
    const [weather, fx, wiki, geo, flickr] = await Promise.all([
      full.latlng
        ? fetch(`https://api.open-meteo.com/v1/forecast?latitude=${full.latlng[0]}&longitude=${full.latlng[1]}&current_weather=true`).then(r=>r.json()).then(j=>j.current_weather)
        : undefined,
      (() => {
        const code = full.currencies ? Object.keys(full.currencies)[0] : 'USD';
        return fetch(`https://api.exchangerate.host/latest?base=${code}&symbols=USD`).then(r=>r.json()).then(j=>j.rates?.USD??null);
      })(),
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(full.name.common)}`).then(r=>r.json()),
      full.latlng
        ? fetch(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=20000&gslimit=8&gscoord=${full.latlng[0]}|${full.latlng[1]}&format=json&origin=*`).then(r=>r.json()).then(j=>j.query?.geosearch)
        : undefined,
      fetch(`https://www.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&tags=${encodeURIComponent(full.name.common)}`)
        .then(r=>r.json()).then(j=>j.items.slice(0,6).map((it:any)=>it.media.m)).catch(()=>[])
    ]);

    setExtras({ weather, fx, wiki, sights: geo?.map((g:any)=>({title:g.title,dist:g.dist})), photos:flickr });
    setLoading(false);
  };

  /* ---------- flight link ---------- */
  const to = full ? IATA[full.cca3] || full.capital?.[0] || full.name.common : '';
  const flightURL = full
    ? `https://www.google.com/travel/flights#flt=${(from||'')}.${to}.${depart || ''}${ret?`*${to}.${from||''}.${ret}`:''};px:${adults}${kids?`%2C${kids}`:''}${inf?`%2C${inf}`:''};sc:${cabin}`
    : '#';

  /* ---------- quick components ---------- */
  const Fact = ({l,v}:{l:string;v:string|number})=> <p className="text-sm"><b>{l}:</b> {v}</p>;
  const Counter = ({label,val,set,min}:{label:string;val:number;set:(n:number)=>void;min:number})=>(
    <div className="flex justify-between border rounded p-2 text-sm">
      <span>{label}</span>
      <div className="flex gap-2">
        <button onClick={()=>set(Math.max(min,val-1))} className="px-2 border rounded">–</button>
        {val}
        <button onClick={()=>set(val+1)} className="px-2 border rounded">+</button>
      </div>
    </div>
  );

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-brand-950 dark:to-brand-900 text-gray-800 dark:text-gray-100 p-4">
      <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text my-6">🌍 Travel Explorer</h1>

      {/* search */}
      <div className="max-w-lg mx-auto flex gap-2 mb-10">
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
               placeholder="Search country…" className="flex-1 p-3 border rounded"/>
        <button onClick={runSearch} className="px-4 py-3 bg-indigo-600 text-white rounded">Go</button>
      </div>

      {/* grid */}
      {initialLoad? <Spinner/>:
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-12">
          {(showFeatured?mini.slice(0,4):results).map(c=>(
            <div key={c.cca3} onClick={()=>loadDetails(c.cca3)} className="border rounded p-3 bg-white/60 dark:bg-brand-900/40 cursor-pointer hover:shadow transition">
              {c.flags?.png && <img src={c.flags.png} className="w-10 h-6 border rounded-sm mb-1"/>}
              <span className="text-sm">{c.name.common}</span>
            </div>
          ))}
        </div>}

      {/* detail pane */}
      {full && extras && (
        <div className="max-w-5xl mx-auto bg-white/70 dark:bg-brand-900/40 backdrop-blur p-6 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold mb-4">{full.name.common}</h2>

          {loading ? <Spinner/> : (
            <>
              {mapURL && <iframe src={mapURL} height={300} className="w-full rounded mb-4" loading="lazy"/>}
              {extras.photos?.[0] && <img src={extras.photos[0]} className="w-full h-52 object-cover rounded mb-6" alt="hero" loading="lazy"/>}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <Fact l="Capital"     v={full.capital?.[0]??'—'} />
                <Fact l="Population"  v={fmt(full.population)} />
                <Fact l="Area"        v={`${fmt(full.area)} km²`} />
                <Fact l="Currency"    v={full.currencies?Object.values(full.currencies)[0].symbol:'—'}/>
                <Fact l="FX→USD"      v={extras.fx??'—'} />
                <Fact l="Temp (°C)"   v={extras.weather?extras.weather.temperature_2m:'—'} />
              </div>

              {extras.sights && (
                <>
                  <h3 className="font-semibold mb-2">Nearby sights</h3>
                  <ul className="list-disc list-inside text-sm mb-6">
                    {extras.sights.map((s,i)=><li key={i}>{s.title} – {(s.dist/1000).toFixed(1)} km</li>)}
                  </ul>
                </>
              )}

              {extras.wiki?.extract && <blockquote className="italic text-gray-700 dark:text-gray-300 mb-6">{extras.wiki.extract}</blockquote>}

              {/* flickr carousel */}
              {extras.photos && (
                <div className="flex gap-2 overflow-x-auto mb-6">
                  {extras.photos.map((p,i)=><img key={i} src={p} className="w-32 h-20 object-cover rounded"/> )}
                </div>
              )}

              {/* travel links */}
              <div className="flex flex-wrap gap-3 mb-8 text-sm">
                <a href={`https://news.google.com/search?q=${encodeURIComponent(full.name.common+' travel')}`} target="_blank" className="underline">Google News</a>
                <a href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(full.name.common)}`} target="_blank" className="underline">Wikivoyage Guide</a>
                <a href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(full.name.common)}`} target="_blank" className="underline">TripAdvisor</a>
                {full.tld?.[0] && <a href={`https://visit${full.tld[0].replace('.','')}`} target="_blank" className="underline">Official Tourism</a>}
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(full.name.common+' travel guide')}`} target="_blank" className="underline">YouTube Guides</a>
              </div>

              {/* flight builder */}
              <h3 className="font-semibold mb-2">Flight builder</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                <input placeholder="From (IATA)" value={from} onChange={e=>setFrom(e.target.value.toUpperCase())} className="p-2 border rounded"/>
                <input type="date" value={depart} onChange={e=>setDepart(e.target.value)} className="p-2 border rounded"/>
                <input type="date" value={ret} onChange={e=>setRet(e.target.value)} className="p-2 border rounded"/>
                <select value={cabin} onChange={e=>setCabin(e.target.value as Cabin)} className="p-2 border rounded">
                  <option value="e">Economy</option><option value="pe">Premium Eco</option><option value="b">Business</option><option value="f">First</option>
                </select>
                <Counter label="Adults" val={adults} set={setAdults} min={1}/>
                <Counter label="Kids"   val={kids}   set={setKids}   min={0}/>
                <Counter label="Infants"val={inf}    set={setInf}    min={0}/>
              </div>
              <a href={flightURL} target="_blank" className="inline-block w-full h-12 flex items-center justify-center bg-indigo-600 text-white rounded shadow hover:opacity-90">Search flights →</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
