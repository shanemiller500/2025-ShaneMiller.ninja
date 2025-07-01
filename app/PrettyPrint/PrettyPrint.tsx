'use client';

import { useState } from 'react';
import type { ChangeEvent } from 'react';

/* ------------------------------------------------------------------ */
/*  Optional JSON5 fallback                                           */
/* ------------------------------------------------------------------ */
let JSON5: any;
try {
  // @ts-ignore – optional dependency, only used locally
  JSON5 = await import('json5');
} catch {
  JSON5 = null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function PrettyPrint() {
  /* ------------------------------ state ----------------------------- */
  const [input,      setInput]      = useState('');   // raw user input
  const [pretty,     setPretty]     = useState('');   // HTML‑highlighted output
  const [rawPretty,  setRawPretty]  = useState('');   // plain (no HTML) output
  const [status,     setStatus]     = useState<'ok'|'api'|'fixed'|'loose'|'ok-xml'|'loose-xml'>('ok');
  const [fixLog,     setFixLog]     = useState<string[]>([]);
  const [copyLabel,  setCopyLabel]  = useState('Copy');
  const [loading,    setLoading]    = useState(false);

  /* -------------------------- example data -------------------------- */
  const validExamples: Record<string,string> = {
    /* JSON */
    'Simple object'   : '{"foo": 1, "bar": 2}',
    'Nested structure': '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}',
    'Large JSON'      : `{"employees":[{"id":1,"name":"Alice","department":"Engineering","skills":["JS","React","Node"]},{"id":2,"name":"Bob","department":"Marketing","skills":["SEO","Content"]},{"id":3,"name":"Carol","department":"HR","skills":["Recruiting","Relations"]},{"id":4,"name":"Dave","department":"Design","skills":["Photoshop","Figma","Sketch"]}]}`,
    /* XML */
    'Bookstore XML'   : `<books><book id=\"1\"><title>1984</title><author>George Orwell</author></book><book id=\"2\"><title>Brave New World</title><author>Aldous Huxley</author></book></books>`
  };

  const invalidExamples: Record<string,string> = {
    /* JSON */
    'Unquoted keys'   : '{foo: 1, bar: 2}',
    'Trailing comma'  : '{"foo": 1,}',
    'Missing comma'   : '{"foo":1 "bar":2}',
    'Large malformed' : `{ user: { id: 1,, name: "Alice", roles: ['admin','editor',], active: true, profile: { bio: "Loves coding", location "Wonderland", stats: { posts: 42, followers: 1000,, following: 150 } }, orders: [ { orderId: 1001, items: ["book","pen"], total: 29.99, }, { orderId: 1002, items: ["notebook"), total: 9.5 } ], createdAt: "2025-06-27T12:00:00Z" }`,
    /* XML */
    'Broken XML'      : `<users><user><name>Alice</name><user><name>Bob</name></users>`
  };

  /* ----------------------- helpers & formatters -------------------- */
  const escapeHtml = (str: string) => str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  /* JSON syntax highlight */
  const syntaxHighlightJSON = (json: string) =>
    json.replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, m => {
      let cls = 'text-emerald-400';
      if (/^"/.test(m))             cls = /:$/.test(m) ? 'text-sky-400' : 'text-pink-400';
      else if (/true|false/.test(m)) cls = 'text-yellow-300';
      else if (/null/.test(m))       cls = 'text-gray-400';
      return `<span class="${cls}">${m}</span>`;
    });

  /* XML syntax highlight (very light) */
  const syntaxHighlightXML = (xml: string) =>
    xml
      /* comments */
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-neutral-500">$1</span>')
      /* prolog */
      .replace(/(&lt;\?[^&]*?\?&gt;)/g, '<span class="text-amber-400">$1</span>')
      /* tags */
      .replace(/(&lt;\/?)([\w:-]+)(\s?)/g, '$1<span class="text-sky-400">$2</span>$3')
      /* attributes */
      .replace(/([\w:-]+)=(&quot;[^&]*?&quot;)/g, '<span class="text-emerald-400">$1</span>=<span class="text-pink-400">$2</span>');

  const syntaxHighlight = (src: string, isXml = false) =>
    isXml ? syntaxHighlightXML(escapeHtml(src)) : syntaxHighlightJSON(src);

  /* quick heuristic for XML */
  const looksLikeXML = (str: string) => /^\s*<(!|\?|[a-zA-Z])/i.test(str);

  /* naïve XML formatter (indent with 2 spaces) */
  const formatXML = (src: string) => {
    const PADDING = '  ';
    const reg = /(>)(<)(\/*)/g;
    let xml = src.replace(/\r?\n/g,'').replace(reg,'$1\n$2$3');
    let pad = 0;
    return xml.split('\n').map((node) => {
      if (node.match(/^<\//)) pad -= 1;
      const line = PADDING.repeat(Math.max(pad,0)) + node;
      if (node.match(/^<[^!?][^>]*[^\/]>$/)) pad += 1;
      return line;
    }).join('\n');
  };

  /* ------------------------- clipboard helper ---------------------- */
  const handleCopy = () => {
    navigator.clipboard.writeText(rawPretty).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy'), 10_000);
    });
  };

  /* --------------------------- formatter --------------------------- */
  const handleFormat = async () => {
    setFixLog([]);
    setLoading(true);
    try {
      /* -------------------------- XML path ------------------------- */
      if (looksLikeXML(input)) {
        try {
          /* try strict parsing via DOMParser to validate */
          const parser = new DOMParser();
          const dom    = parser.parseFromString(input, 'text/xml');
          const err    = dom.getElementsByTagName('parsererror')[0];
          if (err) throw new Error('Invalid XML');

          const formatted = formatXML(input.trim());
          setPretty(syntaxHighlight(formatted, true));
          setRawPretty(formatted);
          setStatus('ok-xml');
          return; // ✅ valid XML
        } catch {
          /* fallback – best‑effort pretty‑print even if not valid */
          const loose = formatXML(input.trim());
          setPretty(syntaxHighlight(loose, true));
          setRawPretty(loose);
          setStatus('loose-xml');
          return;
        }
      }

      /* -------------------------- JSON path ------------------------ */
      /* 1 – strict JSON.parse */
      try {
        const f = JSON.stringify(JSON.parse(input), null, 2);
        setPretty(syntaxHighlight(f));
        setRawPretty(f);
        setStatus('ok');
        return; // ✅ valid JSON
      } catch {/* malformed – continue */}

      /* 2 – JSON5 parse */
      if (JSON5) {
        try {
          const f = JSON.stringify(JSON5.parse(input), null, 2);
          setPretty(syntaxHighlight(f));
          setRawPretty(f);
          setStatus('fixed');
          setFixLog(['Parsed with JSON5 (single quotes, trailing commas, comments…).']);
          return; // ✅ fixed locally
        } catch {/* still malformed */}
      }

      /* 3 – external fixer (API) */
      try {
        const res  = await fetch('https://u-mail.co/api/jsonFormatter', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ json: input })
        });
        const data = await res.json();
        if (res.ok && data.formattedJson) {
          setPretty(syntaxHighlight(data.formattedJson));
          setRawPretty(data.formattedJson);
          setFixLog(data.fixLog ?? []);
          setStatus('api');
          return; // ✅ API fixed JSON
        }
        throw new Error(data.error || 'Bad API response');
      } catch {/* API failed, fall through */}

      /* 4 – loose JSON formatter */
      const loose = looseFormatJSON(input.trim());
      setPretty(syntaxHighlight(loose));
      setRawPretty(loose);
      setStatus('loose');
    } finally {
      setLoading(false);
    }
  };

  /* fallback JSON indenter if everything else fails */
  const looseFormatJSON = (src: string) => {
    let out = '', indent = 0, inStr = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"' && src[i-1] !== '\\') inStr = !inStr;
      if (!inStr) {
        if (ch === '{' || ch === '[') { out += ch + '\n' + '  '.repeat(++indent); continue; }
        if (ch === '}' || ch === ']') { out += '\n' + '  '.repeat(--indent) + ch; continue; }
        if (ch === ',')               { out += ch + '\n' + '  '.repeat(indent);  continue; }
      }
      out += ch;
    }
    return out;
  };

  /* recompute line numbers whenever output changes */
  const lines = pretty.split('\n');

  /* ------------------------------------------------------------------ */
  /*  JSX                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* title */}
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          AI JSON / XML Formatter
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Drop in raw JSON or XML & we'll fix syntax, standardise style, and pretty print huge data sets in a snap.
        </p>
      </header>

      {/* example dropdowns */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Working Examples
          </label>
          <select
            className="w-full p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm font-mono text-sm"
            defaultValue=""
            onChange={(e) => setInput(e.target.value)}
          >
            <option value="">Select example</option>
            {Object.entries(validExamples).map(([label,json]) => (
              <option key={label} value={json}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Broken Examples
          </label>
          <select
            className="w-full p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm font-mono text-sm"
            defaultValue=""
            onChange={(e) => setInput(e.target.value)}
          >
            <option value="">Select example</option>
            {Object.entries(invalidExamples).map(([label,json]) => (
              <option key={label} value={json}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* input area */}
      <textarea
        className="w-full h-60 resize-y rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm p-4 font-mono text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/70"
        placeholder='{"foo": 1, "bar": 2} OR <note><to>Alice</to></note>'
        value={input}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
      />

      {/* action button */}
      <div className="flex gap-3">
        <button
          onClick={handleFormat}
          className="bg-violet-600 hover:bg-violet-700 active:scale-95 transition text-white font-medium px-6 py-2 rounded-lg"
        >
          Format
        </button>
      </div>

      {/* spinner */}
      {loading && (
        <div className="flex justify-center py-6">
          <svg className="w-8 h-8 animate-spin text-neutral-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      )}

      {/* status banner */}
      {pretty && !loading && (
        <div
          className={`rounded-md px-4 py-3 text-sm font-medium shadow ${
            status === 'ok'       || status === 'ok-xml'    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' :
            status === 'api'                               ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
            status === 'fixed'                             ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' :
            status === 'loose'    || status === 'loose-xml'? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' : ''}`}
        >
          {status === 'ok'        && 'Valid JSON.'}
          {status === 'ok-xml'    && 'Valid XML.'}
          {status === 'api'       && 'Formatted by API.'}
          {status === 'fixed'     && 'Parsed with JSON5.'}
          {status === 'loose'     && 'Best‑effort JSON formatting.'}
          {status === 'loose-xml' && 'Best‑effort XML formatting.'}
        </div>
      )}

      {/* fix log */}
      {fixLog.length > 0 && !loading && (
        <details className="bg-amber-100/30 dark:bg-amber-800/20 rounded-lg p-4 text-sm open:shadow-inner">
          <summary className="font-semibold cursor-pointer">Changes made</summary>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            {fixLog.map((f,i) => <li key={i}>{f}</li>)}
          </ul>
        </details>
      )}

      {/* output pane */}
      {pretty && !loading && (
        <section className="relative rounded-lg border border-neutral-700/60 shadow-xl overflow-hidden">
          {/* copy btn */}
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 inline-flex items-center mr-2 px-3 py-1 bg-neutral-700 text-white text-sm rounded hover:bg-neutral-600"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m5-10H8l-2 2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-1l-2-2z" />
            </svg>
            {copyLabel}
          </button>

          <div className="max-h-[70vh] overflow-auto font-mono text-sm bg-neutral-900 text-white">
            <div className="flex">
              <ol className="flex-none bg-neutral-950/90 text-right tabular-nums py-4 pl-6 pr-4 leading-5 text-neutral-500 select-none">
                {lines.map((_,i) => <li key={i}>{i+1}</li>)}
              </ol>
              <pre className="p-4 leading-5">
                {lines.map((ln,i) => (
                  <code key={i} className="block whitespace-pre hover:bg-neutral-800/60 transition-colors" dangerouslySetInnerHTML={{ __html: ln || '&#8203;' }} />
                ))}
              </pre>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
