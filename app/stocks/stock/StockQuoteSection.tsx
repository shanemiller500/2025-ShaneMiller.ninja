// Filename: StockQuoteSection.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chart }                 from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

import { API_TOKEN }             from '@/utils/config';
import {
  formatSupplyValue,
  formatDate,
  formatDateWeirdValue,
} from '@/utils/formatters';

import MarketWidgets             from './MarketWidgets';
import NewsWidget                from './NewsWidget';
import LiveStreamTickerWidget    from './LiveStreamTickerWidget';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface CandleData {
  c: number[]; h: number[]; l: number[]; o: number[]; s: string; t: number[]; v: number[];
}
interface QuoteData {
  c:number; d:number; dp:number; h:number; l:number; o:number; pc:number; v:number; t:number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const fmt = (v: number|undefined|null, d=2)=>
  v==null||isNaN(v as any)?'—':parseFloat(v.toString()).toFixed(d);

const gridRow=(k:string,v:string|React.ReactNode)=>(
  <div key={k} className="flex justify-between gap-4 border-b pb-1 text-sm dark:border-gray-700">
    <span className="text-gray-500 dark:text-gray-400">{k}</span>
    <span className="font-medium text-gray-800 dark:text-gray-100 text-right">{v}</span>
  </div>
);

const btnPrimary   = 'px-4 py-2 rounded text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 focus:outline-none';
const btnSecondary = 'px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 focus:outline-none';

const fmtDateTime = (ms:number) =>
  new Intl.DateTimeFormat('en-US', { dateStyle:'medium', timeStyle:'short' }).format(ms);

/* ---------- helpers for News cards ---------- */
const timeAgo=(ms:number)=>{
  const d=Date.now()-ms;
  if(d<60_000)   return `${Math.floor(d/1_000)} s ago`;
  if(d<3_600_000)return `${Math.floor(d/60_000)} m ago`;
  if(d<86_400_000)return `${Math.floor(d/3_600_000)} h ago`;
  return formatDate(ms);
};
const logoFromUrl=(url?:string)=>{
  try{const h=new URL(url??'').hostname.replace(/^www\./,'');
      return h?`https://logo.clearbit.com/${h}?size=64`:'';}
  catch{return'';}
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function StockQuoteSection() {
  const [symbolInput,setSymbolInput]=useState('');
  const [suggestions,setSuggestions]=useState<string[]>([]);
  const [stockData,setStockData]=useState<{profile:any;quote:QuoteData;metric:any}|null>(null);
  const [candleData,setCandleData]=useState<CandleData|null>(null);
  const [newsData,setNewsData]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const chartCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const chartRef=useRef<Chart|null>(null);

  /* ------------- autocomplete ---------------- */
  useEffect(()=>{
    if(!symbolInput.trim()){setSuggestions([]);return;}
    const t=setTimeout(async()=>{
      const data=await fetch(`https://finnhub.io/api/v1/search?q=${symbolInput}&token=${API_TOKEN}`)
        .then(r=>r.json()).catch(()=>({result:[]}));
      setSuggestions(data.result?.slice(0,6).map((i:any)=>i.symbol)??[]);
    },300);
    return()=>clearTimeout(t);
  },[symbolInput]);

  const metric=(k:string)=>stockData?.metric?.metric?.[k];

  const handleSearch=async(sym?:string)=>{
    const symbol=(sym??symbolInput).trim().toUpperCase();
    if(!symbol) return;
    setLoading(true);setError('');
    try{
      const [quote,profile,metricData]=await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_TOKEN}`).then(r=>r.json()),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_TOKEN}`).then(r=>r.json()),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${API_TOKEN}`).then(r=>r.json()),
      ]);
      if(!profile.name) throw new Error('Invalid symbol');

      const now=Math.floor(Date.now()/1000);
      const from=now-30*86400;
      const candles: CandleData|null=await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${API_TOKEN}`
      ).then(r=>r.json()).then(d=>d.s==='ok'?d:null).catch(()=>null);

      const toDate=new Date().toISOString().slice(0,10);
      const fromDate=new Date(Date.now()-86400000).toISOString().slice(0,10);
      const news=await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${API_TOKEN}`
      ).then(r=>r.json()).catch(()=>[]);

      setStockData({profile,quote,metric:metricData});
      setCandleData(candles);
      setNewsData(news);
    }catch(e:any){setError(e.message??'Error fetching data');}
    finally{setLoading(false);}
  };
  const handleClear=()=>{
    setSymbolInput('');setSuggestions([]);setStockData(null);
    setCandleData(null);setNewsData([]);setError('');
  };

  /* ------------- chart render -------------- */
  useEffect(()=>{
    if(!chartCanvasRef.current||!candleData?.t?.length) return;
    chartRef.current?.destroy();
    const ctx=chartCanvasRef.current.getContext('2d');if(!ctx)return;
    chartRef.current=new Chart(ctx,{
      type:'line',
      data:{labels:candleData.t.map(t=>new Date(t*1000)),
            datasets:[{label:'Close',data:candleData.c,
                       borderColor:'#4F46E5',backgroundColor:'rgba(99,102,241,.12)',
                       fill:true,tension:.2}]},
      options:{responsive:true,maintainAspectRatio:false,
               scales:{x:{type:'time',time:{unit:'day',displayFormats:{day:'MMM d'}}}},
               plugins:{legend:{display:false}}},
    });
  },[candleData]);

  /* --------------------------- UI --------------------------- */
  return(
    <section className="p-4 space-y-10">
      <h2 className="text-2xl font-bold">Stock Quote</h2>

      {/* search */}
      <div className="space-y-2">
        <input
          value={symbolInput}
          onChange={e=>setSymbolInput(e.target.value)}
          placeholder="Enter symbol (e.g., AAPL)"
          className="p-2 w-full border rounded dark:bg-brand-900 dark:border-gray-600"
        />
        {!!suggestions.length&&(
          <ul className="border rounded divide-y dark:border-gray-700 max-h-48 overflow-auto bg-white dark:bg-brand-900">
            {suggestions.map(s=>(
              <li key={s} className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={()=>{setSymbolInput(s);setSuggestions([]);}}>
                {s}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={()=>handleSearch()} className={`${btnPrimary} w-full sm:w-auto`}>Search</button>
          <button onClick={handleClear}       className={`${btnSecondary} w-full sm:w-auto`}>Clear</button>
        </div>
      </div>

      {/* default widgets */}
      {!stockData&&!loading&&(
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MarketWidgets onSelectTicker={t=>{setSymbolInput(t);handleSearch(t);}}/>
            <NewsWidget/>
          </div>
          {/* <LiveStreamTickerWidget/> */}
        </>
      )}

      {loading&&<p className="text-center">Loading…</p>}
      {error&&<p className="text-center text-red-500">{error}</p>}

      {/* data + chart + news */}
      {stockData&&(
        <div className="space-y-10">

          {/* info card */}
          <div className="rounded-lg shadow-md p-6 bg-white dark:bg-brand-950">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {stockData.profile.name}
                  <span className="font-normal text-gray-500"> ({stockData.profile.ticker})</span>
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">  As of {fmtDateTime((stockData.quote.t ?? Date.now()/1000) * 1000)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Exchange: {stockData.profile.exchange}
                </p>
              </div>
              {stockData.profile.logo&&(
                <img src={stockData.profile.logo} alt="logo"
                     className="w-16 h-16 object-contain rounded-full self-start sm:self-center"/>
              )}
            </div>

            {/* price */}
            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-extrabold">${formatSupplyValue(stockData.quote.c)}</span>
              <span className={`${stockData.quote.dp>=0?'text-green-600':'text-red-600'} font-semibold`}>
                {stockData.quote.dp>=0?'+':''}{formatSupplyValue(stockData.quote.dp)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Vol {formatSupplyValue(stockData.quote.v)}
              </span>
            </div>

            {/* metrics */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {[
                ['Open',`$${formatSupplyValue(stockData.quote.o)}`],
                ['High',`$${formatSupplyValue(stockData.quote.h)}`],
                ['Low',`$${formatSupplyValue(stockData.quote.l)}`],
                ['Market Cap',`$${formatSupplyValue(metric('marketCapitalization'))}`],
                ['Shares Out.',`${formatSupplyValue(metric('sharesOutstanding'))}`],
                ['P/E (TTM)',fmt(metric('peTTM'))],
                ['P/S (TTM)',fmt(metric('psTTM'))],
                ['Dividend Yield',`${fmt(metric('currentDividendYieldTTM'))}%`],
                ['Beta',fmt(metric('beta'))],
                ['50-Day MA',`$${formatSupplyValue(metric('50DayMovingAverage'))}`],
                ['52-Wk High',`$${formatSupplyValue(metric('52WeekHigh'))}`],
                ['High Date',formatDateWeirdValue(metric('52WeekHighDate'))],
                ['52-Wk Low',`$${formatSupplyValue(metric('52WeekLow'))}`],
                ['Low Date',formatDateWeirdValue(metric('52WeekLowDate'))],
              ].map(([k,v])=>gridRow(k as string,v))}
            </div>
          </div>

          {/* chart */}
          {candleData&&(
            <div className="relative h-60 sm:h-72 md:h-80 w-full">
              <canvas ref={chartCanvasRef} className="w-full h-full"/>
            </div>
          )}

          {/* news */}
          <div className="space-y-4">
            <h4 className="text-xl font-semibold">Latest News</h4>

            {newsData.length===0&&(
              <p className="text-gray-500 dark:text-gray-400">No recent news for this ticker.</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {newsData.map(n=>{
                const imgAvail=typeof n.image==='string'&&n.image.trim();
                const headline=n.headline??n.title??'Untitled article';
                const publishedMs=((n.datetime??0)*1000)||Date.parse(n.datetime);
                const srcLogo=logoFromUrl(n.url);
                return(
                  <a key={n.id??n.url} href={n.url} target="_blank" rel="noopener noreferrer"
                     className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border dark:border-gray-700
                                hover:shadow-md bg-white dark:bg-brand-950 transition">
                    {imgAvail&&(
                      <img src={n.image} alt=""
                           className="w-full sm:w-24 h-40 sm:h-24 object-cover rounded-md shrink-0"
                           onError={e=>(e.currentTarget.style.display='none')}/>
                    )}

                    <div className="flex flex-col justify-between flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug line-clamp-2">{headline}</p>

                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {srcLogo&&(
                          <img src={srcLogo} alt="" className="w-4 h-4 rounded-sm"
                               onError={e=>(e.currentTarget.style.display='none')}/>
                        )}
                        <span className="truncate max-w-[6rem] md:max-w-none">
                          {new URL(n.url).hostname.replace(/^www\./,'')}
                        </span>
                        <span className="mx-1">·</span>
                        <span>{timeAgo(publishedMs)}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
