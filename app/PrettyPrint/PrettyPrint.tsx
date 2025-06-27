'use client';

import { useState } from 'react';
import type { ChangeEvent } from 'react';
// ⬇ optional second-pass parser -------------------------------------------
let JSON5: any;
try {
  // dynamically import so the component still compiles if the pkg isn’t installed
  // @ts-ignore – runtime check handles absence
  JSON5 = await import('json5');
} catch {
  JSON5 = null;
}

/* -------------------------------------------------------------------------- */
/*                               PrettyPrint UI                               */
/* -------------------------------------------------------------------------- */
export default function PrettyPrint() {
  /* ------------------------------- state ---------------------------------- */
  const [input, setInput]           = useState('');
  const [pretty, setPretty]         = useState('');   // formatted / highlighted
  const [rawPretty, setRawPretty]   = useState('');   // plain JSON string, no tags
  const [status, setStatus]         = useState<'ok' | 'fixed' | 'loose' | 'err'>('ok');
  const [fixLog, setFixLog]         = useState<string[]>([]);
  const [viewRaw, setViewRaw]       = useState(false); // toggle raw vs hl

  /* --------------------------- tiny helpers ------------------------------- */
  const syntaxHighlight = (json: string) =>
    json.replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      m => {
        let cls = 'text-emerald-400';
        if (/^"/.test(m))            cls = /:$/.test(m) ? 'text-sky-400'  : 'text-pink-400';
        else if (/true|false/.test(m)) cls = 'text-yellow-300';
        else if (/null/.test(m))       cls = 'text-gray-400';
        return `<span class="${cls}">${m}</span>`;
      }
    );

  /** Very loose formatter that indents on `{ [`, outdents on `} ]`, splits on `,` */
  const looseFormat = (src: string) => {
    let out = '';
    let indent = 0;
    let inStr = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"' && src[i - 1] !== '\\') inStr = !inStr;
      if (!inStr) {
        if (ch === '{' || ch === '[') {
          out += ch + '\n' + '  '.repeat(++indent);
          continue;
        }
        if (ch === '}' || ch === ']') {
          out += '\n' + '  '.repeat(--indent) + ch;
          continue;
        }
        if (ch === ',') {
          out += ch + '\n' + '  '.repeat(indent);
          continue;
        }
      }
      out += ch;
    }
    return out;
  };

  /** One-click copy */
  const copy = () => navigator.clipboard.writeText(rawPretty).then(() => {
    // quick toast – native alert is fine for now
    alert('Copied!');
  });

  /* --------------------------- main handler ------------------------------ */
  const handleFormat = () => {
    setFixLog([]);
    /* ---- 1: strict JSON.parse ------------------------------------------ */
    try {
      const formatted = JSON.stringify(JSON.parse(input), null, 2);
      setPretty(syntaxHighlight(formatted));
      setRawPretty(formatted);
      setStatus('ok');
      return;
    } catch { /* keep going */ }

    /* ---- 2: permissive JSON5.parse ------------------------------------- */
    if (JSON5) {
      try {
        const formatted = JSON.stringify(JSON5.parse(input), null, 2);
        setPretty(syntaxHighlight(formatted));
        setRawPretty(formatted);
        setStatus('fixed');
        setFixLog(['Parsed with JSON5 (allows single quotes, trailing commas, unquoted keys, etc.).']);
        return;
      } catch { /* fall through */ }
    }

    /* ---- 3: last-ditch loose formatter --------------------------------- */
    const loose = looseFormat(input.trim());
    setPretty(syntaxHighlight(loose));
    setRawPretty(loose);
    setStatus('loose');
  };

  /* recompute numbered lines each render – cheap ------------------------- */
  const lines = pretty.split('\n');

  /* ----------------------------- render ---------------------------------- */
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* title */}
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          JSON Pretty Printer
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Paste any JSON-ish blob valid broken, or downright ugly and I’ll tidy it up.
        </p>
      </header>

      {/* input box */}
      <textarea
        className="w-full h-60 resize-y rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm p-4 font-mono text-sm shadow-inner
                   focus:outline-none focus:ring-2 focus:ring-violet-500/70"
        placeholder='{"foo": 1, "bar": 2}'
        value={input}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
      />

      {/* action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleFormat}
          className="bg-violet-600 hover:bg-violet-700 active:scale-95 transition text-white font-medium px-6 py-2 rounded-lg"
        >
          Format&nbsp;JSON
        </button>

        {pretty && (
          <button
            onClick={copy}
            className="bg-neutral-700/80 hover:bg-neutral-700 active:scale-95 transition text-white text-sm px-4 py-2 rounded-lg"
          >
            Copy&nbsp;Output
          </button>
        )}

        {pretty && (
          <label className="ml-auto flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 select-none">
            <input
              type="checkbox"
              className="accent-violet-600"
              checked={viewRaw}
              onChange={() => setViewRaw(v => !v)}
            />
            Raw&nbsp;text
          </label>
        )}
      </div>

      {/* status banner */}
      {pretty && (
        <div
          className={`rounded-md px-4 py-3 text-sm font-medium shadow
            ${status === 'ok'   ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' :
              status === 'fixed' ? 'bg-amber-50  text-amber-700  dark:bg-amber-900/20  dark:text-amber-300' :
              'bg-rose-50   text-rose-700   dark:bg-rose-900/20   dark:text-rose-300'}`}
        >
          {status === 'ok'   && '✅ Perfectly valid JSON.'}
          {status === 'fixed' && '⚠ Input was not strict JSON; parsed with JSON5.'}
          {status === 'loose' && '❌ Could not parse; showing best-effort indentation.'}
        </div>
      )}

      {/* fix log */}
      {fixLog.length > 0 && (
        <details className="bg-amber-100/30 dark:bg-amber-800/20 rounded-lg p-4 text-sm open:shadow-inner">
          <summary className="font-semibold cursor-pointer">What I fixed</summary>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            {fixLog.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </details>
      )}

      {/* output pane */}
      {pretty && (
        <section className="relative rounded-lg border border-neutral-700/60 shadow-xl overflow-hidden">
<div className="max-h-[70vh] overflow-auto font-mono text-sm bg-neutral-900 text-white">
  <div className="flex">
    {/* ── LINE NUMBERS ─────────────────────────────────────────────── */}
    <ol
      className="flex-none bg-neutral-950/90 text-right tabular-nums
                 py-4 pl-6 pr-4 leading-5 text-neutral-500 select-none">
      {lines.map((_, i) => (
        <li key={i}>{i + 1}</li>
      ))}
    </ol>

    {/* ── CODE LINES ──────────────────────────────────────────────── */}
    <pre className="p-4 leading-5">
      {viewRaw
        ? rawPretty
        : lines.map((ln, i) => (
            <code
              key={i}
              className="block whitespace-pre hover:bg-neutral-800/60 transition-colors leading-5"
              /* keep empty lines */
              dangerouslySetInnerHTML={{ __html: ln || '&#8203;' }}
            />
          ))}
    </pre>
  </div>
</div>

      
        </section>
      )}
    </div>
  );
}
