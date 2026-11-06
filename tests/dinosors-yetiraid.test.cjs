// Yeti bands (Nov 2026): Yetis that meet wear matching scarves and raid the Snow People together —
// they stamp out the camp's fires and throw snow, rocks + trees at the people and their Frosthorns.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(__dirname, '..', request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const root = path.join(__dirname, '..', 'app', 'dinosors');
const { World } = require(path.join(root, 'sim', 'world.ts'));
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { raidOf } = require(path.join(root, 'sim', 'yetiRaid.ts'));

const DT = 1 / 30;
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w, i * DT) === true) return i * DT;
  }
  return -1;
}

function quiet(seed = 7) {
  const w = new World(seed);
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.storm = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals.clans.length = 0;
  w.rivals.brutes.length = 0;
  w.forest.enabled = false;
  w.seaFolk.enabled = false;
  w.sandFolk.enabled = false;
  w.snowFolk.enabled = false;
  w.snowLife.enabled = false;
  w.wildlife.enabled = false;
  return w;
}

test('Yetis that meet band up in matching scarves and raid a Snow People camp: fires out, people + animals pelted', () => {
  const w = quiet(31);
  const t = w.snowFolk.settle(w, 1, { x: w.camp.x + 1300, y: w.camp.y + 100 });
  assert.ok(t, 'a Snow People camp');
  if (!t.lodges.some((l) => l.kind === 'fire')) t.lodges.push({ x: t.x, y: t.y + 30, kind: 'fire', hp: 1 });
  const folk = w.snowFolk.members(t.id);
  const hp0 = folk.reduce((s, b) => s + b.hp, 0);
  const a = addDino(w, 'yeti', t.x - 900, t.y);
  const b = addDino(w, 'yeti', t.x - 860, t.y + 30);
  for (const y of [a, b]) {
    y.homeX = y.x;
    y.homeY = y.y;
  }
  run(w, 2);
  assert.ok(a.yetiPack && a.yetiPack === b.yetiPack, 'they band up');
  assert.ok(a.yetiScarf && a.yetiScarf === b.yetiScarf, 'in matching scarves');
  // a band has a look round first, then goes for the nearest camp
  const started = run(w, 90, () => !!raidOf(w, a));
  assert.ok(started >= 0, 'the band sets off on a raid');
  assert.equal(raidOf(w, a).t.id, t.id, 'on the Snow People');
  let fireOut = false;
  run(w, 150, () => {
    fireOut = !t.lodges.some((l) => l.kind === 'fire' && l.hp > 0);
    return fireOut && folk.reduce((s, o) => s + Math.max(0, o.hp), 0) < hp0 * 0.7;
  });
  assert.ok(fireOut, 'the camp fire is stamped out');
  const hp1 = w.snowFolk.members(t.id).reduce((s, o) => s + Math.max(0, o.hp), 0);
  assert.ok(hp1 < hp0, `the camp's people are hurt or killed (${hp0.toFixed(1)} → ${hp1.toFixed(1)})`);
});
