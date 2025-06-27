'use client';

import { useState } from 'react';

export default function PrettyPrint() {
  /* -------------------------------- state ------------------------------- */
  const [input,      setInput]      = useState('');
  const [rawOutput,  setRawOutput]  = useState('');
  const [htmlOutput, setHtmlOutput] = useState('');
  const [error,      setError]      = useState('');
  const [warning,    setWarning]    = useState('');
  const [fixes,      setFixes]      = useState<string[]>([]);
  const [showOut,    setShowOut]    = useState(false);

  /* ------------------------------- helpers ------------------------------ */
  const syntaxHighlight = (json: string) =>
    json.replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      m => {
        let cls = 'text-emerald-400';
        if (/^"/.test(m))      cls = /:$/.test(m) ? 'text-sky-400'  : 'text-pink-400';
        else if (/true|false/.test(m)) cls = 'text-yellow-300';
        else if (/null/.test(m))       cls = 'text-gray-400';
        return `<span class="${cls}">${m}</span>`;
      }
    );

  const autoFixJson = (bad: string) => {
    let fixed = bad, log: string[] = [];

    if (/\'/.test(fixed)) {
      fixed = fixed.replace(/'/g, '"');
      log.push('Replaced single quotes with double quotes.');
    }
    const unquoted = /([{,]\s*)([a-zA-Z0-9_]+)(\s*):/g;
    if (unquoted.test(fixed)) {
      fixed = fixed.replace(unquoted, '$1"$2"$3:');
      log.push('Added quotes around unquoted keys.');
    }
    if (/,\s*}/.test(fixed) || /,\s*]/.test(fixed)) {
      fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      log.push('Removed trailing commas.');
    }
    const diffBrace   = (fixed.match(/{/g) || []).length - (fixed.match(/}/g) || []).length;
    const diffBracket = (fixed.match(/\[/g) || []).length - (fixed.match(/]/g) || []).length;
    if (diffBrace   > 0) { fixed += '}'.repeat(diffBrace);   log.push('Added missing closing brace(s).'); }
    if (diffBracket > 0) { fixed += ']'.repeat(diffBracket); log.push('Added missing closing bracket(s).'); }

    return { fixed, log };
  };

  /* --------------------------------- main -------------------------------- */
  const prettyPrint = () => {
    setError(''); setWarning(''); setFixes([]); setShowOut(false);

    try {
      const formatted = JSON.stringify(JSON.parse(input), null, 2);
      setRawOutput(formatted);
      setHtmlOutput(syntaxHighlight(formatted));
      setWarning('✅ JSON is valid and well formatted.');
      setShowOut(true);
    } catch {
      const { fixed, log } = autoFixJson(input);
      try {
        const formatted = JSON.stringify(JSON.parse(fixed), null, 2);
        setRawOutput(formatted);
        setHtmlOutput(syntaxHighlight(formatted));
        setWarning('⚠ Input was invalid. Auto-fixed and formatted below.');
        setFixes(log);
        setShowOut(true);
      } catch {
        setRawOutput(input);
        setHtmlOutput(syntaxHighlight(input));
        setError('❌ Could not fully parse JSON. Showing best-effort formatting below.');
        setShowOut(true);
      }
    }
  };

  const copyToClipboard = () =>
    navigator.clipboard.writeText(rawOutput).then(() => alert('Copied to clipboard!'));

  /* --------------- build line-by-line array for display ------------------ */
  const htmlLines = htmlOutput.split('\n');   // every render, cheap enough

  /* -------------------------------- render ------------------------------- */
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
          JSON Pretty Printer
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Paste raw or broken JSON. I’ll fix it and pretty-print the output.
        </p>
      </header>

      <textarea
        className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        placeholder="Paste your JSON here…"
        value={input}
        onChange={e => setInput(e.target.value)}
      />

      <button
        onClick={prettyPrint}
        className="bg-violet-600 hover:bg-violet-700 active:scale-95 transition text-white font-medium px-6 py-2 rounded-lg"
      >
        Format JSON
      </button>

      {error   && <div className="text-red-600 font-medium">{error}</div>}
      {warning && (
        <div
          className={`mt-2 font-medium ${
            warning.includes('✅') ? 'text-green-600' : 'text-yellow-500'
          }`}
        >
          {warning}
        </div>
      )}
      {fixes.length > 0 && (
        <aside className="text-sm text-gray-600 dark:text-gray-400 border-l-4 border-yellow-400 pl-4 mt-2">
          <p className="font-semibold">Fixes Applied:</p>
          <ul className="list-disc ml-5">{fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </aside>
      )}

      {/* ----------------------------- output box -------------------------- */}
      {showOut && (
        <section className="relative">
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 active:scale-95 transition text-white px-2 py-1 rounded"
          >
            Copy
          </button>

          <div className="grid grid-cols-[max-content_1fr] max-h-[70vh] overflow-auto rounded-lg border border-gray-700 bg-[#1e1e1e] shadow-xl text-sm">
            {/* line numbers */}
            <ol className="sticky left-0 bg-[#1a1a1a] text-gray-500 py-4 pl-6 pr-4 select-none leading-5">
              {htmlLines.map((_, i) => (
                <li key={i} className="tabular-nums">{i + 1}</li>
              ))}
            </ol>

            {/* code lines */}
            <pre className="p-4 font-mono text-white">
              {htmlLines.map((ln, i) => (
                <code
                  key={i}
                  dangerouslySetInnerHTML={{ __html: ln || '&#8203;' }} // keep empty lines
                  className="block whitespace-pre hover:bg-[#272727] transition"
                />
              ))}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
