// Filename: NewsTab.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchMediaStackArticles } from './Mediastack-API-Call';
import { fetchFinnhubArticles   } from './Finnhub-API-Call';
import { fetchUmailArticles     } from './MoreNewsAPI';
import { FaChevronDown          } from 'react-icons/fa';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export interface Article {
  source:{id:string|null;name:string;image?:string|null};
  author :string|null;
  title  :string;
  description:string;
  url    :string;
  urlToImage:string|null;
  /* new optional arrays so we can reuse them later */
  images?:string[];
  thumbnails?:string[];
  publishedAt:string;
  content:string|null;
  categories:(string|null|undefined|any)[];
}

/* ------------------------------------------------------------------ */
/*  Helpers & constants                                               */
/* ------------------------------------------------------------------ */
const getDomain=(u:string)=>{try{return new URL(u).hostname;}catch{return'';}};
const firstImg =(html?:string|null)=>html?.match(/<img[^>]+src=['"]([^'"]+)['"]/i)?.[1]??null;

const LOGO_FALLBACK='/images/wedding.jpg';
const PLACEHOLDER  ='https://via.placeholder.com/600x350?text=No+Image';
const CBS_THUMB    ='https://upload.wikimedia.org/wikipedia/commons/3/3f/CBS_News.svg';

const PER_PAGE  =36;
const CACHE_TTL =30*60*1000;
const USA_ENDPOINT='https://u-mail.co/api/NewsAPI/us-news';

/* date sort helper */
const sortByDate=(arr:Article[])=>[...arr].sort(
  (a,b)=>+new Date(b.publishedAt)-+new Date(a.publishedAt));

/* simple U.S. filter */
const isUSA=(a:Article)=>{
  const cats=(Array.isArray(a.categories)?a.categories:[])
    .filter((c):c is string=>typeof c==='string')
    .map(c=>c.toLowerCase());
  const host=getDomain(a.url).toLowerCase();
  return cats.includes('us')||cats.includes('united states')||/\.us$/.test(host);
};

/* definitive image resolver */
const getDisplayImage=(a:Article)=>{
  if(a.urlToImage) return a.urlToImage;
  if(a.images?.length)      return a.images[0];
  if(a.thumbnails?.length)  return a.thumbnails[0];
  const fromContent=firstImg(a.content);
  if(fromContent) return fromContent;
  if(getDomain(a.url).toLowerCase().includes('cbsnews.com')) return CBS_THUMB;
  return null;
};

/* ------------------------------------------------------------------ */
/*  In-memory & localStorage caches                                   */
/* ------------------------------------------------------------------ */
let CACHE_ALL:{ts:number;data:Article[]} | null=null;
let USA_CACHE :{ts:number;data:Article[]} | null=null;
let USA_FETCH :Promise<void>|null=null;

/* restore USA cache from localStorage */
try {
    const raw = localStorage.getItem('usaNewsCache');
    if (raw) {
      const parsed = JSON.parse(raw) as { ts: number; data: Article[] };
      if (parsed && Date.now() - parsed.ts < CACHE_TTL) USA_CACHE = parsed;
      else localStorage.removeItem('usaNewsCache');
    }
}catch{/* ignore */}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function NewsTab(){
  const [region,setRegion]=useState<'All'|'USA'|'World'>('All');
  const [provider,setProvider]=useState('All');
  const [page,setPage]=useState(1);
  const [fade,setFade]=useState(false);

  const [articles,setArticles]=useState<Article[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  /* -------- initial generic feeds -------- */
  useEffect(()=>{let cancel=false;
    (async()=>{
      if(CACHE_ALL && Date.now()-CACHE_ALL.ts<CACHE_TTL){
        setArticles(CACHE_ALL.data);return;
      }
      setLoading(true);
      try{
        const [ms,fh,um]=await Promise.allSettled([
          fetchMediaStackArticles(1),
          fetchFinnhubArticles(),
          fetchUmailArticles(),
        ]);
        const ok=(r:PromiseSettledResult<Article[]>)=>r.status==='fulfilled'?r.value:[];
        const merged=sortByDate([...ok(ms),...ok(fh),...ok(um)]);
        if(!cancel){CACHE_ALL={ts:Date.now(),data:merged};setArticles(merged);}
      }catch(e:any){if(!cancel)setError(e.message??'Unknown error');}
      finally{if(!cancel)setLoading(false);}
    })();
    return()=>{cancel=true;};
  },[]);

  /* -------- USA dedicated feed (once / 30 min, debounced) -------- */
  useEffect(()=>{let cancel=false;
    if(region!=='USA')return;
    if(USA_CACHE && Date.now()-USA_CACHE.ts<CACHE_TTL)return;

    if(!USA_FETCH){
      USA_FETCH=(async()=>{
        try{
          const res=await fetch(USA_ENDPOINT,{cache:'no-store'});
          if(!res.ok)throw new Error(`US feed ${res.status}`);
          const json=await res.json();
          const data:Article[]=json.results.map((r:any)=>({
            source:{id:null,name:getDomain(r.link),image:r.sourceImage},
            author:r.author||null,
            title:r.headline,
            description:r.description,
            url:r.link,
            urlToImage:r.image ?? null,
            images:Array.isArray(r.images)?r.images:[],
            thumbnails:Array.isArray(r.thumbnails)?r.thumbnails:[],
            publishedAt:r.publishedAt,
            content:r.content,
            categories:r.categories,
          }));
          USA_CACHE={ts:Date.now(),data};
          localStorage.setItem('usaNewsCache',JSON.stringify(USA_CACHE));
        }catch(e){console.warn('USA endpoint error:',(e as Error).message);}
      })().finally(()=>{USA_FETCH=null;});
    }

    USA_FETCH.then(()=>{if(!cancel) setArticles(a=>a);});
    return()=>{cancel=true;};
  },[region]);

  /* -------- combine & filter -------- */
  const dataset=useMemo(()=>{
    if(region==='USA'){
      const extra=USA_CACHE?.data??[];
      const fromGeneric=articles.filter(isUSA);
      return sortByDate(Array.from(new Map([...extra,...fromGeneric].map(a=>[a.title,a])).values()));
    }
    if(region==='World') return articles.filter(a=>!isUSA(a));
    return articles;
  },[region,articles]);

  const providers=useMemo(
    ()=>['All',...Array.from(new Set(articles.map(a=>a.source.name))).sort()],
    [articles]
  );

  const byProvider = provider==='All'?dataset:dataset.filter(a=>a.source.name===provider);

  /* featured + paging */
  const featured=byProvider.filter(a=>getDisplayImage(a)).slice(0,100);
  const rest    =byProvider.filter(a=>!featured.includes(a));
  useEffect(()=>setPage(1),[region,provider]);

  const totalPages=Math.max(1,Math.ceil(rest.length/PER_PAGE));
  const pageNews =rest.slice((page-1)*PER_PAGE,page*PER_PAGE);

  const changePage=(n:number)=>{
    if(fade)return;
    window.scrollTo({top:0,behavior:'smooth'});
    setFade(true);
    setTimeout(()=>{setPage(n);setFade(false);},400);
  };

  /* ---------------- render ---------------- */
  return(
    <div>
      {error&&<p className="mb-4 rounded bg-red-100 p-3 font-medium text-red-700">{error}</p>}

      {/* region + provider */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {(['All','USA','World'] as const).map(r=>(
          <button key={r} onClick={()=>setRegion(r)}
            className={`rounded-full px-3 py-1 text-sm ${region===r?'bg-indigo-600 text-white':'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'}`}>
            {r}
          </button>
        ))}
      </div>

      {featured.length>0&&<FeaturedSlider articles={featured}/>}

      <div className={`transition-opacity duration-300 ${fade?'opacity-0':'opacity-100'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {pageNews.map(a=><ArticleCard key={a.url} article={a}/>)}
        </div>
        <Pagination page={page} totalPages={totalPages} loading={loading}
          onPrev={()=>changePage(page-1)} onNext={()=>changePage(page+1)}/>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  UI sub-components                                                  */
/* =================================================================== */


function Pagination({page,totalPages,loading,onPrev,onNext}:{page:number;totalPages:number;loading:boolean;onPrev:()=>void;onNext:()=>void;}){
  return(
    <div className="mt-8 flex flex-col items-center gap-4 pb-8">
      <div className="flex gap-4">
        <button disabled={page===1||loading} onClick={onPrev}
          className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white disabled:opacity-40">Previous</button>
        <button disabled={(page===totalPages&&!loading)||loading} onClick={onNext}
          className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white disabled:opacity-40">Next</button>
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">Page {page} / {totalPages}</span>
      {loading&&<p className="text-gray-500 dark:text-gray-400">Loading…</p>}
    </div>
  );
}

function FeaturedSlider({articles}:{articles:Article[]}){
  const [idx,setIdx]=useState(0);
  const total=articles.length;
  useEffect(()=>{const id=setInterval(()=>setIdx(i=>(i+1)%total),6000);return()=>clearInterval(id);},[total]);
  const move=(d:number)=>setIdx((idx+d+total)%total);
  return(
    <div className="relative mb-10 overflow-hidden rounded-lg shadow-lg">
      <button onClick={()=>move(-1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-2 text-white hover:bg-black/60">‹</button>
      <button onClick={()=>move(1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-2 text-white hover:bg-black/60">›</button>
      <span className="absolute right-3 top-2 z-20 rounded bg-black/60 py-1 px-2 text-xs text-white">{idx+1} / {total}</span>
      <div className="whitespace-nowrap transition-transform duration-700" style={{transform:`translateX(-${idx*100}%)`}}>
        {articles.map(a=>(
          <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-block w-full">
            <img src={getDisplayImage(a)??PLACEHOLDER} onError={e=>(e.currentTarget.src=PLACEHOLDER)}
                 alt={a.title} className="h-44 w-full object-cover sm:h-64"/>
            <div className="bg-white p-5 dark:bg-brand-950">
              <h2 className="line-clamp-2 text-xl font-bold text-gray-800 dark:text-gray-100">{a.title}</h2>
              <MetaLine article={a}/>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ArticleCard({article}:{article:Article}){
  const imgSrc=getDisplayImage(article);
  const hasImg=!!imgSrc;
  return(
    <a href={article.url} target="_blank" rel="noopener noreferrer"
       className="block transform rounded-lg bg-white shadow transition hover:scale-[1.02] hover:shadow-xl dark:bg-brand-950">
      {hasImg&&<img src={imgSrc!} alt={article.title}
             onError={e=>(e.currentTarget.style.display='none')}
             className="h-40 w-full object-cover sm:h-36"/>}
      <div className={`flex flex-col gap-2 p-4 ${hasImg?'mt-1':''}`}>
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-gray-800 dark:text-gray-100">{article.title}</h3>
        <MetaLine article={article} small/>
      </div>
    </a>
  );
}

function MetaLine({article,small=false}:{article:Article;small?:boolean}){
  const logo=article.source.image??`https://logo.clearbit.com/${getDomain(article.url)}`;
  return(
    <div className={`flex flex-col ${small?'text-xs':''}`}>
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <img src={logo} onError={e=>(e.currentTarget.src=LOGO_FALLBACK)}
             alt={article.source.name} className="h-8 w-8 object-contain"/>
        <span>{article.source.name}</span>
      </div>
      <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        {new Date(article.publishedAt).toLocaleDateString()}{' '}
        {new Date(article.publishedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
      </span>
    </div>
  );
}
