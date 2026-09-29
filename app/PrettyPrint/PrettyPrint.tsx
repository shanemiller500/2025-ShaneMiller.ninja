"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Braces, Check, ChevronRight, ClipboardPaste, Copy, Download, Eraser, FileUp, ListTree, Loader2, Minimize2, Sparkles, Wand2 } from "lucide-react";

import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { Segmented } from "@/components/ui/segmented";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */
type Status = "ok" | "ok-xml" | "fixed" | "api" | "loose" | "loose-xml";
type Indent = "2" | "4" | "tab";
type View = "code" | "tree";

const API_ENDPOINT = "https://u-mail.co/api/jsonFormatter";
const STATUS: Record<Status, { label: string; tone: string }> = {
  ok: { label: "Valid JSON", tone: "emerald" },
  "ok-xml": { label: "Valid XML", tone: "emerald" },
  fixed: { label: "Repaired with JSON5 (quotes, commas, comments)", tone: "amber" },
  api: { label: "Repaired by AI", tone: "indigo" },
  loose: { label: "Best-effort JSON formatting: still has errors", tone: "rose" },
  "loose-xml": { label: "Best-effort XML formatting: still has errors", tone: "rose" },
};
const TONES: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const EXAMPLES: { label: string; broken?: boolean; text: string }[] = [
  { label: "Simple object", text: '{"foo": 1, "bar": 2}' },
  { label: "Nested users", text: '{"users":[{"id":1,"name":"Alice","active":true},{"id":2,"name":"Bob","active":false,"manager":null}]}' },
  { label: "Team JSON", text: '{"employees":[{"id":1,"name":"Alice","department":"Engineering","skills":["JS","React","Node"]},{"id":2,"name":"Bob","department":"Marketing","skills":["SEO","Content"]},{"id":3,"name":"Carol","department":"HR","skills":["Recruiting","Relations"]}]}' },
  { label: "Bookstore XML", text: '<books><book id="1"><title>1984</title><author>George Orwell</author></book><book id="2"><title>Brave New World</title><author>Aldous Huxley</author></book></books>' },
  { label: "Unquoted keys", broken: true, text: "{foo: 1, bar: 2}" },
  { label: "Trailing comma", broken: true, text: '{"foo": 1,}' },
  { label: "Missing comma", broken: true, text: '{"foo":1 "bar":2}' },
  { label: "Big mess", broken: true, text: '{ user: { id: 1,, name: "Alice", roles: [\'admin\',\'editor\',], active: true, profile: { bio: "Loves coding", location "Wonderland", stats: { posts: 42, followers: 1000,, following: 150 } }, orders: [ { orderId: 1001, items: ["book","pen"], total: 29.99, }, { orderId: 1002, items: ["notebook"), total: 9.5 } ] }' },
  { label: "Broken XML", broken: true, text: "<users><user><name>Alice</name><user><name>Bob</name></users>" },
];

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */
const indentUnit = (i: Indent) => (i === "tab" ? "\t" : " ".repeat(Number(i)));
// Escape first so pasted markup can never become live HTML in the output.
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const looksLikeXML = (s: string) => /^\s*<(!|\?|[a-zA-Z])/.test(s);

function highlightJSON(json: string) {
  return escapeHtml(json).replace(
    /(&quot;(?:\\u[\da-fA-F]{4}|\\[^u]|(?!&quot;)[^\\])*&quot;(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "text-emerald-600 dark:text-emerald-400";
      if (m.startsWith("&quot;")) cls = /:$/.test(m) ? "text-sky-700 dark:text-sky-400" : "text-pink-600 dark:text-pink-400";
      else if (/true|false/.test(m)) cls = "text-amber-600 dark:text-amber-300";
      else if (m === "null") cls = "text-slate-400 dark:text-slate-500";
      return `<span class="${cls}">${m}</span>`;
    },
  );
}
function highlightXML(xml: string) {
  return escapeHtml(xml)
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-slate-400 dark:text-slate-500">$1</span>')
    .replace(/(&lt;\?[\s\S]*?\?&gt;)/g, '<span class="text-amber-600 dark:text-amber-400">$1</span>')
    .replace(/([\w:-]+)=(&quot;[^&]*?&quot;)/g, '<span class="text-emerald-600 dark:text-emerald-400">$1</span>=<span class="text-pink-600 dark:text-pink-400">$2</span>')
    .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="text-sky-700 dark:text-sky-400">$2</span>');
}
function formatXML(src: string, unit: string) {
  let pad = 0;
  return src.replace(/\r?\n/g, "").replace(/(>)\s*(<)(\/*)/g, "$1\n$2$3").split("\n").map((node) => {
    if (/^<\//.test(node)) pad -= 1;
    const line = unit.repeat(Math.max(pad, 0)) + node;
    if (/^<[^!?][^>]*[^/]>$/.test(node) && !/<\/[^>]+>$/.test(node)) pad += 1;
    return line;
  }).join("\n");
}
function looseFormatJSON(src: string, unit: string) {
  let out = "", depth = 0, inStr = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' && src[i - 1] !== "\\") inStr = !inStr;
    if (!inStr && (ch === "{" || ch === "[")) { out += ch + "\n" + unit.repeat(++depth); continue; }
    if (!inStr && (ch === "}" || ch === "]")) { out += "\n" + unit.repeat(Math.max(0, --depth)) + ch; continue; }
    if (!inStr && ch === ",") { out += ",\n" + unit.repeat(depth); continue; }
    out += ch;
  }
  return out;
}
function stats(value: unknown) {
  let keys = 0, arrays = 0, depth = 0;
  const walk = (v: unknown, d: number) => {
    depth = Math.max(depth, d);
    if (Array.isArray(v)) { arrays++; v.forEach((x) => walk(x, d + 1)); }
    else if (v && typeof v === "object") Object.entries(v).forEach(([, x]) => { keys++; walk(x, d + 1); });
  };
  walk(value, 0);
  return { keys, arrays, depth };
}
const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
const TABS: DashboardTab<"format">[] = [{ key: "format", label: "Formatter", hint: "JSON · XML", icon: <Braces className="h-4 w-4" /> }];

export default function PrettyPrint() {
  const [input, setInput] = useState("");
  const [raw, setRaw] = useState("");
  const [html, setHtml] = useState("");
  const [parsed, setParsed] = useState<unknown>(undefined);
  const [status, setStatus] = useState<Status | null>(null);
  const [fixLog, setFixLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [indent, setIndent] = useState<Indent>("2");
  const [view, setView] = useState<View>("code");
  const fileInput = useRef<HTMLInputElement>(null);

  const show = useCallback((text: string, st: Status, value?: unknown, log: string[] = []) => {
    const xml = st === "ok-xml" || st === "loose-xml";
    setRaw(text); setHtml(xml ? highlightXML(text) : highlightJSON(text));
    setParsed(value); setStatus(st); setFixLog(log);
    if (value === undefined) setView("code");
    trackEvent("PrettyPrint Formatted", { status: st });
  }, []);

  const format = useCallback(async (minify = false) => {
    const src = input.trim();
    if (!src) return;
    const unit = minify ? "" : indentUnit(indent);
    const dump = (v: unknown) => (minify ? JSON.stringify(v) : JSON.stringify(v, null, unit));
    setLoading(true);
    try {
      if (looksLikeXML(src)) {
        const ok = !new DOMParser().parseFromString(src, "text/xml").getElementsByTagName("parsererror")[0];
        const out = minify ? src.replace(/>\s+</g, "><") : formatXML(src, unit);
        show(out, ok ? "ok-xml" : "loose-xml");
        return;
      }
      try { const v = JSON.parse(src); show(dump(v), "ok", v); return; } catch { /* try repairs */ }
      try {
        const JSON5 = (await import("json5")).default;
        const v = JSON5.parse(src);
        show(dump(v), "fixed", v, ["Parsed leniently: single quotes, unquoted keys, trailing commas and comments are allowed."]);
        return;
      } catch { /* still broken */ }
      try {
        const res = await fetch(API_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ json: src }) });
        const data = await res.json();
        if (res.ok && typeof data.formattedJson === "string") {
          let v: unknown;
          try { v = JSON.parse(data.formattedJson); } catch { v = undefined; }
          show(v !== undefined ? dump(v) : data.formattedJson, "api", v, Array.isArray(data.fixLog) ? data.fixLog : []);
          return;
        }
      } catch { /* AI unavailable */ }
      show(looseFormatJSON(src, unit || "  "), "loose");
    } finally {
      setLoading(false);
    }
  }, [input, indent, show]);

  // Ctrl/⌘ + Enter formats from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void format(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [format]);

  const info = useMemo(() => (parsed !== undefined ? stats(parsed) : null), [parsed]);
  const lines = raw ? raw.split("\n") : [];
  const htmlLines = html ? html.split("\n") : [];
  const isXml = status === "ok-xml" || status === "loose-xml";

  const copy = () => navigator.clipboard?.writeText(raw).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); });
  const download = () => {
    const url = URL.createObjectURL(new Blob([raw], { type: isXml ? "application/xml" : "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = isXml ? "formatted.xml" : "formatted.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const paste = async () => { try { setInput(await navigator.clipboard.readText()); } catch { /* clipboard blocked */ } };
  const upload = (file?: File) => { if (file) file.text().then(setInput); };

  const toolButton = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white";

  return (
    <DashboardShell
      id="prettyprint"
      path="~/prettyprint"
      liveLabel="ai repair"
      title="JSON & XML Prettifier"
      description="Paste messy JSON or XML. Valid data is formatted instantly; broken data is repaired (lenient parsing first, then AI) with a list of exactly what was fixed."
      tabs={TABS}
      renderPanel={() => (
        <div className="p-4 sm:p-6">
          {/* Examples */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Try</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} type="button" onClick={() => setInput(ex.text)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${ex.broken
                  ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:text-emerald-300 dark:hover:bg-emerald-500/10"}`}>
                {ex.broken ? "✕ " : "✓ "}{ex.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Input editor */}
            <Editor
              title="input"
              right={<>
                <button type="button" className={toolButton} onClick={paste}><ClipboardPaste className="h-3.5 w-3.5" />Paste</button>
                <button type="button" className={toolButton} onClick={() => fileInput.current?.click()}><FileUp className="h-3.5 w-3.5" />Open</button>
                <button type="button" className={toolButton} onClick={() => { setInput(""); setRaw(""); setHtml(""); setStatus(null); setFixLog([]); setParsed(undefined); }} disabled={!input && !raw}><Eraser className="h-3.5 w-3.5" />Clear</button>
                <input ref={fileInput} type="file" accept=".json,.xml,.txt,application/json,text/xml" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              </>}
              footer={input ? `${input.split("\n").length} lines · ${bytes(new Blob([input]).size)}` : "Drop a file or paste"}
            >
              <textarea value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
                placeholder={'{"foo": 1, "bar": 2}\n\nor\n\n<note><to>Alice</to></note>'}
                aria-label="JSON or XML to format"
                className="h-[420px] w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-5 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-600" />
            </Editor>

            {/* Output editor */}
            <Editor
              title={isXml ? "output.xml" : "output.json"}
              right={<>
                {parsed !== undefined && <Segmented id="ppView" ariaLabel="Output view" value={view} onChange={setView}
                  options={[{ key: "code", label: <><Braces className="h-3 w-3" />Code</> }, { key: "tree", label: <><ListTree className="h-3 w-3" />Tree</> }]} />}
                <button type="button" className={toolButton} onClick={copy} disabled={!raw}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button>
                <button type="button" className={toolButton} onClick={download} disabled={!raw}><Download className="h-3.5 w-3.5" />Save</button>
              </>}
              footer={raw ? `${lines.length} lines · ${bytes(new Blob([raw]).size)}${info ? ` · ${info.keys} keys · ${info.arrays} arrays · depth ${info.depth}` : ""}` : "Formatted output appears here"}
            >
              <div className="h-[420px] overflow-auto">
                {loading && <div className="flex h-full items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Repairing…</div>}
                {!loading && !raw && <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><Sparkles className="h-6 w-6 text-indigo-400/70" /><p className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Nothing yet. Hit Format</p></div>}
                {!loading && raw && view === "tree" && parsed !== undefined && <div className="p-4 font-mono text-[13px] leading-6"><TreeNode value={parsed} name="root" depth={0} /></div>}
                {!loading && raw && (view === "code" || parsed === undefined) && (
                  <div className="flex min-w-max font-mono text-[13px] leading-5">
                    <ol className="sticky left-0 select-none bg-slate-50 py-4 pl-4 pr-3 text-right tabular-nums text-slate-400 dark:bg-[#0d0f14] dark:text-slate-600">{lines.map((_, i) => <li key={i}>{i + 1}</li>)}</ol>
                    <pre className="py-4 pr-6">{htmlLines.map((ln, i) => <code key={i} className="block whitespace-pre text-slate-800 hover:bg-indigo-50/70 dark:text-slate-200 dark:hover:bg-white/[0.04]" dangerouslySetInnerHTML={{ __html: ln || "&#8203;" }} />)}</pre>
                  </div>
                )}
              </div>
            </Editor>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => format()} disabled={!input.trim() || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600 disabled:opacity-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Format &amp; fix
            </button>
            <button type="button" onClick={() => format(true)} disabled={!input.trim() || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]">
              <Minimize2 className="h-4 w-4" />Minify
            </button>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Ctrl/⌘ + Enter</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Indent</span>
              <Segmented id="ppIndent" ariaLabel="Indent" value={indent} onChange={setIndent} options={[{ key: "2", label: "2" }, { key: "4", label: "4" }, { key: "tab", label: "Tab" }]} />
            </div>
          </div>

          {/* Result status + what was fixed */}
          <AnimatePresence>
            {status && !loading && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 space-y-3">
                <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${TONES[STATUS[status].tone]}`}>
                  {status.startsWith("ok") ? <Check className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}{STATUS[status].label}
                </div>
                {fixLog.length > 0 && (
                  <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">What was fixed ({fixLog.length})</p>
                    <ul className="space-y-1.5">
                      {fixLog.map((fix, i) => <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{fix}</li>)}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Editor chrome: a dark code window with traffic lights              */
/* ------------------------------------------------------------------ */
function Editor({ title, right, footer, children }: { title: string; right?: ReactNode; footer: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_12px_32px_-20px_rgba(15,23,42,0.35)] dark:border-white/[0.08] dark:bg-[#0d0f14] dark:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.7)]">
      <div className="flex items-center gap-3 border-b border-slate-200/70 bg-slate-50 px-3 py-2 dark:border-white/[0.06] dark:bg-[#12151c]">
        <span className="flex gap-1.5" aria-hidden><i className="h-2.5 w-2.5 rounded-full bg-rose-400/80" /><i className="h-2.5 w-2.5 rounded-full bg-amber-400/80" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /></span>
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{title}</span>
        <div className="ml-auto flex items-center gap-1">{right}</div>
      </div>
      {children}
      <div className="border-t border-slate-200/70 bg-slate-50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:border-white/[0.06] dark:bg-[#12151c] dark:text-slate-500">{footer}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tree view: collapsible JSON                                        */
/* ------------------------------------------------------------------ */
function TreeNode({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object";
  const label = <span className="text-sky-700 dark:text-sky-400">{/^\d+$/.test(name) ? name : `"${name}"`}</span>;

  if (!isObject) {
    const cls = typeof value === "string" ? "text-pink-600 dark:text-pink-400" : typeof value === "boolean" ? "text-amber-600 dark:text-amber-300" : value === null ? "text-slate-400 dark:text-slate-500" : "text-emerald-600 dark:text-emerald-400";
    return <div className="pl-5">{label}<span className="text-slate-400 dark:text-slate-500">: </span><span className={cls}>{typeof value === "string" ? `"${value}"` : String(value)}</span></div>;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <div className={depth ? "pl-3" : ""}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded text-left text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-white/[0.05]">
        <ChevronRight className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
        {label}<span className="text-slate-400 dark:text-slate-500">: {isArray ? "[" : "{"}</span>
        {!open && <span className="text-slate-400 dark:text-slate-500">…{isArray ? "]" : "}"}</span>}
        <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-600">{entries.length} {isArray ? "items" : "keys"}</span>
      </button>
      {open && <div className="ml-[7px] border-l border-slate-200 dark:border-white/[0.08]">{entries.map(([k, v]) => <TreeNode key={k} name={k} value={v} depth={depth + 1} />)}</div>}
      {open && <div className="pl-5 text-slate-400 dark:text-slate-500">{isArray ? "]" : "}"}</div>}
    </div>
  );
}
