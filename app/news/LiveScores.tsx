/* ------------------------------------------------------------------
   LiveScores — marquee + popup component (with inning/period + status)
------------------------------------------------------------------- */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface GameTeam {
  name    : string;
  score?  : string;
  points? : string;
  strokes?: string;
  thru?   : string;
  logo    : string;
  pos?    : string;
  sets?   : string[];
  team?   : string;
}

interface Game {
  id         : string;
  league     : string;
  startTime  : string;
  status     : string;
  competition: string;
  awayTeam   : GameTeam;
  homeTeam   : GameTeam;
  leaders?   : GameTeam[];
  seriesText?: string;
  recapLink? : string;
  highlight? : string;
  espnLink?  : string;
  isFinal    : boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers & constants                                               */
/* ------------------------------------------------------------------ */

const CORE_TABS = ['nba', 'nfl', 'mlb', 'nhl', 'soccer', 'mma'];

const isLive  = (s:string)=>/live|in progress|[1-9](st|nd|rd|th)/i.test(s);
const isFinal = (s:string)=>/final|finished|ft/i.test(s);

const todayET = () => {
  const [mm, dd, yy] = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/');
  return `${yy}${mm}${dd}`;
};

/* cache */
const CACHE_TTL = 30 * 60 * 1000;
const cache: Record<string,{ts:number;data:Game[]}> = {};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function LiveScores({ sport }:{ sport:string }) {
  const [games,setGames]     = useState<Game[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError]     = useState<string|null>(null);
  const [sel,setSel]         = useState<Game|null>(null);

  /* fetch ---------------------------------------------------------- */
  useEffect(()=>{
    const date = todayET();
    const key  = `${sport}-${date}`;
    let cancel=false;

    async function load(){
      setLoading(true); setError(null);
      try{
        if(cache[key] && Date.now()-cache[key].ts<CACHE_TTL){
          setGames(cache[key].data); setLoading(false); return;
        }
        const url = sport==='all'
          ? 'https://u-mail.co/api/sportsGames/others'
          : `https://u-mail.co/api/sportsGames/${sport}?date=${date}`;
        const res = await fetch(url,{ cache:'no-store' });
        if(!res.ok) throw new Error(`API ${res.status}`);
        let list:Game[] = (await res.json()).games ?? [];
        if(sport==='all') list=list.filter(g=>!CORE_TABS.includes(g.league));
        cache[key]={ts:Date.now(),data:list};
        if(!cancel) setGames(list);
      }catch(e:any){ if(!cancel) setError(e.message||'Error'); }
      finally      { if(!cancel) setLoading(false); }
    }
    load();
    const iv=setInterval(load,60_000);
    return()=>{ cancel=true; clearInterval(iv); };
  },[sport]);

  /* marquee -------------------------------------------------------- */
  const marquee = games.length>=3;
  const innerRef=useRef<HTMLDivElement|null>(null);
  const x=useMotionValue(0);
  const [wrapW,setWrapW]=useState(0);
  const [drag,setDrag]=useState(false);

  useEffect(()=>{
    if(!marquee) return;
    const meas=()=>{ if(innerRef.current) setWrapW(innerRef.current.offsetWidth); };
    meas(); window.addEventListener('resize',meas);
    return()=>window.removeEventListener('resize',meas);
  },[marquee,games]);

  useEffect(()=>{
    if(!marquee||!wrapW)return;
    let raf:number,last:number|null=null;
    const step=(t:number)=>{
      if(last==null) last=t;
      const dt=t-last; last=t;
      if(!drag && !sel){
        let nx=x.get()-20*dt/1000;
        if(nx<=-wrapW) nx+=wrapW;
        if(nx>0)      nx-=wrapW;
        x.set(nx);
      }
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[marquee,wrapW,drag,sel]);

  /* helpers -------------------------------------------------------- */
  const Img = ({src,alt,className}:{src?:string;alt:string;className:string}) =>
    src?<img src={src} alt={alt} className={className}/>:<></>;

  const StatusPill=(g:Game)=>isLive(g.status)?
    <span className="animate-pulse rounded bg-red-600 px-2 py-[1px] text-[10px] font-bold">
      LIVE
    </span>:
    g.isFinal?
    <span className="rounded bg-gray-700 px-2 py-[1px] text-[10px] font-bold">
      FINAL
    </span>:null;

  const TeamRow=({t}:{t:GameTeam})=>(
    <div className="flex items-center gap-1">
      <Img src={t.logo} alt={t.name} className="h-5 w-5 object-contain"/>
      <span className="font-medium">{t.name}</span>
    </div>
  );

  /* card ----------------------------------------------------------- */
  const Card=(g:Game)=>{
    let d=new Date(g.startTime);
    if(isNaN(d.getTime())) d=new Date(Date.parse(g.startTime));
    const timeStr=isNaN(d.getTime())?'':d.toLocaleTimeString([],{
      hour:'2-digit',minute:'2-digit'
    });
    const markAway=g.league==='f1'?g.awayTeam.points:g.awayTeam.score;
    const markHome=g.league==='f1'?g.homeTeam.points:g.homeTeam.score;

    return(
      <motion.div key={g.id} onClick={()=>setSel(g)}
        className="relative m-1 mt-3 min-w-[220px] cursor-pointer rounded border
                   bg-white p-2 text-xs shadow-sm transition hover:scale-[1.04]
                   dark:bg-brand-950"
        whileHover={{scale:1.06}}>
        {/* pill */}
        <div className="absolute -top-2 -right-2">{StatusPill(g)}</div>

        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="font-semibold">{g.league.toUpperCase()}</span>
          <span className="text-gray-500">{timeStr}</span>
        </div>
        {/* status line */}
        <div className="mb-1 text-[10px] text-indigo-500">{g.status}</div>

        <div className="mb-1 truncate text-[10px] text-gray-500">
          {g.competition}
        </div>

        <div className="mb-1 flex items-center justify-between">
          <TeamRow t={g.awayTeam}/>
          <span className="text-base font-bold">{markAway}</span>
        </div>
        <div className="flex items-center justify-between">
          <TeamRow t={g.homeTeam}/>
          <span className="text-base font-bold">{markHome}</span>
        </div>
      </motion.div>
    );
  };

  /* popup headers -------------------------------------------------- */
  const Header=(g:Game)=>{
    const d=new Date(g.startTime);
    const dateStr=isNaN(d.getTime())?'':d.toLocaleString([],{
      month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'
    });
    return(
      <div className="mb-2 flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{g.league.toUpperCase()}</span>
          {StatusPill(g)}
        </div>
        <div className="flex items-center justify-between text-indigo-400">
          <span>{g.status}</span>
          {dateStr && <span className="text-gray-400">{dateStr}</span>}
        </div>
      </div>
    );
  };

  /* sport-specific pop-ups ---------------------------------------- */
  const GolfPopup=(g:Game)=>(
    <>
      {Header(g)}
      <h3 className="mb-3 text-lg font-semibold">{g.competition}</h3>
      {g.leaders?.map(p=>(
        <div key={p.pos} className="mb-1 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Img src={p.logo} alt={p.name} className="h-6 w-6 object-contain"/>
            <span>{p.pos}. {p.name}</span>
          </div>
          <div className="text-right">
            <span className="font-bold">{p.score}</span>
            {p.strokes && <span className="ml-1 text-[11px] text-gray-400">({p.strokes})</span>}
            {p.thru    && <span className="ml-1 text-[11px] text-gray-400">Thru {p.thru}</span>}
          </div>
        </div>
      ))}
    </>
  );

  const F1Popup=(g:Game)=>(
    <>
      {Header(g)}
      <h3 className="mb-3 text-lg font-semibold">{g.competition}</h3>
      {g.leaders?.map(d=>(
        <div key={d.pos} className="mb-1 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Img src={d.logo} alt={d.name} className="h-6 w-6 object-contain"/>
            <span>{d.pos}. {d.name} — {d.team}</span>
          </div>
          <span className="font-bold">{d.points}</span>
        </div>
      ))}
    </>
  );

  const TennisPopup=(g:Game)=>(
    <>
      {Header(g)}
      <h3 className="mb-3 text-lg font-semibold">{g.competition}</h3>
      {[g.awayTeam,g.homeTeam].map((p,i)=>(
        <div key={i} className="mb-3 flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-2">
            <Img src={p.logo} alt={p.name} className="h-6 w-6 object-contain"/>
            <span className="font-medium">{p.name}</span>
            <span className="ml-auto text-lg font-bold">{p.score}</span>
          </div>
          {p.sets?.length && (
            <div className="ml-8 text-xs text-gray-400">Sets:&nbsp;{p.sets.join('  ')}</div>
          )}
        </div>
      ))}
    </>
  );

  const DefaultPopup=(g:Game)=>(
    <>
      {Header(g)}
      <h3 className="mb-1 text-lg font-semibold">
        {g.awayTeam.name} @ {g.homeTeam.name}
      </h3>
      {g.seriesText && (
        <p className="text-xs text-indigo-400 mb-1">{g.seriesText}</p>
      )}
      <p className="mb-3 text-sm text-gray-400">{g.competition}</p>

      {[g.awayTeam,g.homeTeam].map((t,i)=>(
        <div key={i} className="mb-2 flex items-center justify-between">
          <TeamRow t={t}/>
          <span className="text-xl font-bold">{t.score}</span>
        </div>
      ))}

      <hr className="my-3 border-gray-700"/>

      {g.recapLink && (
        <a href={g.recapLink} target="_blank"
           className="block text-center text-xs text-indigo-400 underline mb-2">
          Recap / Box&nbsp;Score
        </a>
      )}
      {g.highlight && (
        <a href={g.highlight} target="_blank"
           className="block text-center text-xs text-indigo-400 underline mb-2">
          Video&nbsp;Highlights
        </a>
      )}
      {g.espnLink && (
        <a href={g.espnLink} target="_blank"
           className="block text-center text-xs text-indigo-300 underline">
          View&nbsp;on&nbsp;ESPN&nbsp;↗
        </a>
      )}
    </>
  );

  const CloseBtn=(
    <button className="mt-4 w-full rounded bg-indigo-600 py-2" onClick={()=>setSel(null)}>
      Close
    </button>
  );

  /* render --------------------------------------------------------- */
  return(
    <section className="mb-6 mt-4 sm:mt-6">
      <h2 className="mb-2 text-lg font-medium">
        {sport==='all'?'Latest World Sports':"Today's Games"}
      </h2>

      {loading?(
        <p className="text-sm">Loading games …</p>
      ):error?(
        <p className="text-sm text-red-600">{error}</p>
      ):games.length===0?(
        <p className="text-sm">
          {sport==='all'?'No other sports today.'
                        :`No ${sport.toUpperCase()} games today.`}
        </p>
      ):marquee?(
        <div className="relative overflow-hidden">
          <motion.div className="flex cursor-grab" style={{x}}
            drag="x"
            onDragStart={()=>setDrag(true)}
            onDragEnd={()=>{ setDrag(false); const mod=(n:number,m:number)=>((n%m)+m)%m;
                             x.set(-mod(-x.get(),wrapW)); }}>
            <div className="flex" ref={innerRef}>{games.map(Card)}</div>
            <div className="flex">{games.map(Card)}</div>
          </motion.div>
        </div>
      ):(
        <div className="flex flex-wrap">{games.map(Card)}</div>
      )}

      {sel&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
             onClick={()=>setSel(null)}>
          <div onClick={e=>e.stopPropagation()}
               className="w-full max-w-sm rounded-lg bg-brand-900 p-5 text-white shadow-lg">
            {sel.league==='golf'    ? GolfPopup(sel)
             : sel.league==='f1'    ? F1Popup(sel)
             : sel.league==='tennis'? TennisPopup(sel)
             : DefaultPopup(sel)}
            {CloseBtn}
          </div>
        </div>
      )}
    </section>
  );
}
