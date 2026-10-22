const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const root = path.join(__dirname, '..', 'app', 'dinosors');
const { World } = require(path.join(root, 'sim', 'world.ts'));
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { makeCarcass, carcassTotal } = require(path.join(root, 'sim', 'carcass.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const clean = require(path.join(root, 'sim', 'cleanup.ts'));

const DT = 1 / 30;
function world(seed, people = 8) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'fire']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 16; y <= cy + 16; y++) for (let x = cx - 16; x <= cx + 90; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < people) addHuman(w, w.camp.x - 60 + (w.humans.length % 4) * 30, w.camp.y + 40 + Math.floor(w.humans.length / 4) * 24);
  return w;
}
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
function body(w, species, x, y) {
  const d = addDino(w, species, x, y, { age: 9999 });
  const it = makeCarcass(w, d);
  w.removeDino(d);
  return it;
}

test('dead animals + loose bones inside our borders get cleared up first: meat, hide, teeth and bones to the stores', () => {
  const w = world(9701);
  const people = w.humans.filter((h) => !h.child);
  people[0].role = 'guard';
  for (const h of people.slice(1)) h.role = 'gatherer';
  const town = body(w, 'trike', w.camp.x + 260, w.camp.y + 80);
  const far = body(w, 'trike', w.camp.x + 2700, w.camp.y + 60);
  const loose = w.addItem('bones', w.camp.x - 200, w.camp.y + 120);
  const scrap = w.addItem('meat', w.camp.x + 120, w.camp.y - 60, { amount: 1 });
  const stock = { ...w.camp.stock };
  const farLeft = carcassTotal(far.carcass);
  let guardLeft = false;
  const post = { x: people[0].x, y: people[0].y };
  let crew = 0;
  const done = run(w, 400, () => {
    if (people[0].cleaning) guardLeft = true;
    crew = Math.max(crew, w.humans.filter((h) => h.cleaning).length);
    return !w.items.includes(town) && !w.items.includes(loose) && !w.items.includes(scrap);
  });
  assert.ok(done, `town cleared (body left: ${w.items.includes(town) ? carcassTotal(town.carcass) : 0}, loose bones: ${w.items.includes(loose)}, meat: ${w.items.includes(scrap)})`);
  assert.ok(crew >= 2, `several pitched in (${crew})`);
  assert.ok(!guardLeft, 'the guard stays on watch');
  // the last loads are still on their way to the stores
  run(w, 30, () => !w.humans.some((h) => h.cleaning && h.carry));
  void post;
  assert.ok(w.camp.stock.bone > stock.bone + 2, `bones to the stores (${stock.bone} → ${w.camp.stock.bone})`);
  assert.ok(w.camp.stock.meat + w.camp.stock.cooked > stock.meat + stock.cooked, 'meat to the stores');
  assert.equal(carcassTotal(far.carcass), farLeft, 'nobody walked off to the one far outside the town');
  assert.equal(clean.townMess(w).length, 0);
});

test('clean-up never takes everyone: other work carries on', () => {
  const w = world(9702, 10);
  for (const h of w.humans) h.role = 'gatherer';
  for (let i = 0; i < 5; i++) body(w, 'para', w.camp.x + 200 + i * 60, w.camp.y + 60 + (i % 2) * 70);
  let most = 0;
  run(w, 30, () => { most = Math.max(most, w.humans.filter((h) => h.cleaning).length); });
  const adults = w.humans.filter((h) => !h.child).length;
  assert.ok(most >= 2 && most <= Math.ceil(adults * 0.45), `crew ${most} of ${adults}`);
});

test('a player order comes first: someone on a task is never pulled off to clean', () => {
  const w = world(9703, 3);
  const { issue } = require(path.join(root, 'sim', 'tasks.ts'));
  const [a] = w.humans.filter((h) => !h.child);
  body(w, 'trike', w.camp.x + 200, w.camp.y + 60);
  issue(w, [a], { kind: 'move', icon: '👣', label: 'Go', x: w.camp.x - 400, y: w.camp.y, target: 0 });
  let cleaned = false;
  run(w, 8, () => { if (a.cleaning) cleaned = true; });
  assert.ok(!cleaned);
});
