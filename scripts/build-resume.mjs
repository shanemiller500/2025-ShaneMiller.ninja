import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The website and printable resume use the same factual content.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'app/resume/content.json'), 'utf8'));
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const { trilon } = content;
const renderRole = (entry) => `<article class="role">
  <div class="role-header"><h3>${escape(entry.title)}</h3><span class="dates">${escape(entry.startDate)} – ${escape(entry.endDate)}</span></div>
  <div class="org">${escape(entry.org)}</div><p>${escape(entry.description)}</p>
</article>`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Shane Miller Resume</title>
<style>
  @page { size: Letter; margin: .5in .55in; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1e293b; font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.34; }
  .sheet { break-after: page; }
  .sheet:last-child { break-after: auto; }
  h1 { margin: 0 0 3pt; font-size: 25pt; letter-spacing: -.5pt; color: #0f172a; }
  .headline { font-size: 11pt; font-weight: bold; color: #3730a3; margin-bottom: 6pt; }
  .contact { font-size: 9pt; color: #475569; margin-bottom: 12pt; }
  h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 1pt; border-bottom: 1pt solid #cbd5e1; padding-bottom: 4pt; margin: 12pt 0 7pt; color: #3730a3; }
  h3 { font-size: 10pt; margin: 8pt 0 2pt; color: #0f172a; }
  h4 { font-size: 9.5pt; margin: 8pt 0 3pt; }
  p { margin: 0 0 6pt; }
  ul { margin: 3pt 0 7pt; padding-left: 14pt; }
  li { margin-bottom: 4pt; }
  .role-header { display: flex; justify-content: space-between; gap: 8pt; align-items: baseline; }
  .dates { white-space: nowrap; color: #475569; font-size: 8.5pt; }
  .org { color: #475569; font-size: 9pt; margin-bottom: 4pt; }
  .role { break-inside: avoid; margin-bottom: 6pt; }
  .skills { font-size: 8.5pt; line-height: 1.3; }
  .skills p { margin-bottom: 2pt; }
  .continuation { font-size: 9pt; color: #64748b; margin-bottom: 7pt; }
  a { color: inherit; text-decoration: none; }
  @media screen {
    body { background: #e2e8f0; }
    .sheet { width: 8.5in; min-height: 11in; padding: .5in .55in; margin: 0 auto 16px; background: white; }
  }
</style></head><body>
<section class="sheet">
  <h1>Shane Miller</h1>
  <div class="headline">${escape(content.headline)}</div>
  <div class="contact">Boulder, CO · 415-810-9124 · <a href="mailto:shanemiller500@gmail.com">shanemiller500@gmail.com</a> · <a href="https://shanemiller.ninja">shanemiller.ninja</a></div>
  <h2>Professional summary</h2><p>${escape(content.summary)}</p>
  <h2>Professional experience</h2>
  ${renderRole(trilon)}
  ${content.previousExperience.slice(0, 3).map(renderRole).join('')}
</section>
<section class="sheet">
  <div class="continuation">Shane Miller · Experience, technology &amp; education</div>
  ${content.previousExperience.slice(3).map(renderRole).join('')}
  <h2>Technology &amp; tools</h2>
  <div class="skills">${content.skills.map((category) => `<p><strong>${escape(category.title)}:</strong> ${escape(category.skills.join(', '))}</p>`).join('')}</div>
  <h2>Education</h2>
  <div class="skills">
    <p><strong>Certificate in Mid-Tier Development</strong> · IHS Markit / Dev-U · October–November 2014</p>
    <p><strong>Web Development Immersive</strong> · General Assembly · December 2013–July 2014</p>
  </div>
</section></body></html>`;

const executable = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => candidate && fs.existsSync(candidate));
if (!executable) throw new Error('Set CHROME_PATH to a Chromium browser executable.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shane-resume-'));
const source = path.join(temp, 'resume.html');
fs.writeFileSync(source, html);
const browser = spawn(executable, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--no-default-browser-check', '--remote-debugging-port=0',
  `--user-data-dir=${path.join(temp, 'browser')}`, 'about:blank'], { windowsHide: true });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Browser startup timed out.')), 20000);
    browser.once('error', (error) => { clearTimeout(timeout); reject(error); });
    browser.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Browser exited: ${code}`)); });
    browser.stderr.on('data', (data) => {
      const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('Browser debugging connection failed.'));
  });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const job = pending.get(message.id);
    if (job) {
      pending.delete(message.id);
      clearTimeout(job.timeout);
      if (message.error) job.reject(new Error(message.error.message));
      else job.resolve(message.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out.`)); }, 20000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: pathToFileURL(source).href }, sessionId);
  await send('Runtime.evaluate', {
    expression: 'new Promise(resolve => { if (document.readyState === "complete") resolve(); else window.addEventListener("load", resolve, {once: true}); }).then(() => document.fonts.ready).then(() => true)',
    awaitPromise: true,
  }, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 816, height: 1056, deviceScaleFactor: 1, mobile: false }, sessionId);
  const measurements = await send('Runtime.evaluate', {
    expression: 'Array.from(document.querySelectorAll(".sheet"), el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })',
    returnByValue: true,
  }, sessionId);
  const pages = measurements.result.value;
  if (!Array.isArray(pages) || pages.length !== 2 || pages.some((page) => page.height > 1057)) {
    throw new Error(`Resume overflows the two-page layout: ${JSON.stringify(pages)}`);
  }
  for (const [index, clip] of pages.entries()) {
    const preview = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale: 1 } }, sessionId);
    fs.writeFileSync(path.join(temp, `page-${index + 1}.png`), Buffer.from(preview.data, 'base64'));
  }
  const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false }, sessionId);
  const output = path.join(root, 'public/PDF/ShaneMiller-2026.pdf');
  fs.writeFileSync(output, Buffer.from(pdf.data, 'base64'));
  console.log(`PDF: ${output}\nPreviews: ${temp}`);
} finally {
  socket?.close();
  browser.kill();
}
