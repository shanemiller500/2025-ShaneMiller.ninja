// Headless tests for settlement intelligence (Phase 1): crews spread across build sites,
// fetching from the nearest store, fair campfire seating, camp zones, and sky watching.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const root = path.join(__dirname, '..', 'app', 'dinosors', 'sim');
const { World } = require(path.join(root, 'world.ts'));
const { addHuman, pickFire, FIRE_SEATS } = require(path.join(root, 'humans.ts'));
const { buildThink, crewCap } = require(path.join(root, 'tasks.ts'));
const { siteKey } = require(path.join(root, 'build.ts'));
const { buildZones } = require(path.join(root, 'zones.ts'));

const DT = 1 / 30;
const run = (w, seconds) => { for (let i = 0; i < seconds / DT; i++) { w.update(DT); w.events.length = 0; } };

/** A quiet world with a camp: no wild dinos, no surprises, fixed weather + time. */
function camp(seed, techs = ['tools', 'fire', 'axe', 'basket', 'shelter']) {
  const w = new World(seed);
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.dinos.length = 0;
  for (const t of techs) w.camp.learned.add(t);
  w.camp.goal = null;
  return w;
}

test('builders spread across open sites instead of piling onto one', () => {
  const w = camp(501);
  const c = w.camp;
  w.timePaused = true;
  w.time = 10;
  Object.assign(c.stock, { stick: 60, stone: 60, grass: 60, leaves: 60, wood: 60, cooked: 60 });
  c.addShelter(w, c.x - 150, c.y + 90);
  c.addShelter(w, c.x + 150, c.y + 90);
  c.addShelter(w, c.x, c.y + 200);
  for (let i = 0; i < 12; i++) addHuman(w, c.x + (i - 6) * 10, c.y + 40, false, { role: 'builder' });
  let worst = 0;
  for (let k = 0; k < 30 * 40; k++) {
    w.update(DT);
    w.events.length = 0;
    const per = new Map();
    for (const h of w.humans) if (h.site) per.set(h.site, (per.get(h.site) || 0) + 1);
    for (const [key, n] of per) {
      const s = w.buildSites().find((x) => siteKey(x) === key);
      if (s) worst = Math.max(worst, n - crewCap(s));
    }
  }
  assert.ok(worst <= 1, `no site far over its crew cap (worst +${worst})`);
});

test('builders fetch materials from the nearest store that keeps them, not only the central pile', () => {
  const w = camp(502);
  const c = w.camp;
  Object.assign(c.stock, { stick: 20, wood: 20, stone: 20, grass: 20, leaves: 20 });
  // a finished storage hut far out, next to a new hut site
  // somewhere placeable well away from the camp pile
  let store = null;
  for (let k = 0; k < 40 && !store; k++) store = w.colony.addBuilding(w, 'storage', c.x + 600 + (k % 8) * 40, c.y + 120 + Math.floor(k / 8) * 50);
  assert.ok(store, 'a storage hut out in the field');
  store.built = 1;
  const hut = c.addShelter(w, store.x + 60, store.y + 60);
  // a builder a little way off: the storage hut is much nearer than the camp pile
  const h = addHuman(w, store.x + 150, store.y + 10, false, { role: 'builder' });
  w.update(DT);
  assert.ok(buildThink(w, h, (s) => s.id === hut.id));
  const door = w.colony.door(store);
  assert.ok(Math.hypot(h.tx - door.x, h.ty - door.y) < 40, 'heads for the nearby storage hut');
  assert.ok(Math.hypot(h.tx - c.pileX, h.ty - c.pileY) > 300, 'not all the way back to the camp pile');
});

test('campfires seat a fair number: nobody piles onto one fire while others sit empty', () => {
  const w = camp(503);
  const c = w.camp;
  w.campfires.length = 0;
  const fires = [[0, 14], [-220, 120], [220, 120]].map(([dx, dy]) => ({ id: w.nextId(), x: c.x + dx, y: c.y + dy, lit: true, fuel: 1, cook: 0 }));
  w.campfires.push(...fires);
  const people = Array.from({ length: 20 }, (_, i) => addHuman(w, c.x + (i - 10) * 8, c.y + 30, false, { role: 'gatherer' }));
  for (const h of people) {
    const seat = pickFire(w, h);
    if (!seat) continue;
    h.x = seat.x;
    h.y = seat.y;
    h.state = 'sitFire';
  }
  const at = fires.map((f) => people.filter((h) => h.fireId === f.id && h.state === 'sitFire').length);
  for (const n of at) assert.ok(n <= FIRE_SEATS, `at most ${FIRE_SEATS} round one fire (${at})`);
  assert.ok(at.every((n) => n > 0), `every fire gets company (${at})`);
  // two people never share a seat
  for (const f of fires) {
    const seats = people.filter((h) => h.fireId === f.id && h.state === 'sitFire').map((h) => h.seat);
    assert.equal(new Set(seats).size, seats.length, 'one person per seat');
  }
});

test('in the evening, off-duty people of any job (not just gatherers) come to the fires', () => {
  const w = camp(504);
  const c = w.camp;
  w.timePaused = true;
  w.time = 21;
  Object.assign(c.stock, { cooked: 50 });
  w.campfires.length = 0;
  w.campfires.push({ id: w.nextId(), x: c.x, y: c.y + 14, lit: true, fuel: 1, cook: 0 }, { id: w.nextId(), x: c.x + 200, y: c.y + 100, lit: true, fuel: 1, cook: 0 });
  const people = ['farmer', 'cook', 'hunter', 'gatherer', 'smith', 'guard'].map((role, i) => addHuman(w, c.x + i * 10, c.y + 40, false, { role, energy: 1, hunger: 0 }));
  run(w, 25);
  const sat = people.filter((h) => h.state === 'sitFire' || (h.fireId && h.state === 'walk')).map((h) => h.role);
  assert.ok(sat.length >= 3, `several jobs at the fire (${sat})`);
  assert.ok(!sat.includes('guard'), 'guards stay on watch');
});

test('homes far from the cave form their own zone, and Auto gives it a fire + a store', () => {
  const { stagesOf } = require(path.join(root, 'build.ts'));
  const w = camp(505);
  const c = w.camp;
  c.stock.stick = 20;
  c.stock.wood = 20;
  for (const dx of [0, 70]) {
    const s = c.addShelter(w, c.x + 900 + dx, c.y + 250);
    s.stage = stagesOf(s).length;
  }
  addHuman(w, c.x, c.y, false, { role: 'auto' });
  const zones = buildZones(w);
  assert.ok(zones.length >= 2, 'an outlying zone');
  const out = zones.find((z) => z.id > 0 && z.homes.length === 2);
  assert.ok(out && out.fires === 0 && out.stores === 0);
  w.day = 2;
  w.tribe.zones = zones;
  const fires = w.campfires.length;
  w.tribe.autoImprove(w);
  assert.equal(w.campfires.length, fires + 1, 'a campfire for the outlying homes');
  assert.ok(Math.hypot(w.campfires.at(-1).x - out.x, w.campfires.at(-1).y - out.y) < 120);
  w.elapsed += 80;
  w.tribe.zones = buildZones(w);
  w.tribe.autoImprove(w);
  const st = w.colony.buildings.find((b) => b.kind === 'storage');
  assert.ok(st && Math.hypot(st.x - out.x, st.y - out.y) < 250, 'and a storage hut out there');
});

test('the next automatic weather is rolled a change early, and that is what comes', () => {
  const w = camp(506);
  w.weather.auto = true;
  let checked = 0;
  for (let k = 0; k < 30 * 900; k++) {
    const before = w.weather.changes;
    const next = w.weather.upcoming;
    w.update(DT);
    w.events.length = 0;
    if (w.weather.changes !== before && next) {
      assert.equal(w.weather.kind, next);
      checked++;
    }
  }
  assert.ok(checked >= 3, `several changes seen (${checked})`);
});

test('sky watching: someone stargazes on clear nights, knowledge grows, and it survives a save', () => {
  const w = camp(507);
  const c = w.camp;
  w.weather.set(w, 'clear');
  w.timePaused = true;
  w.time = 23;
  Object.assign(c.stock, { cooked: 80 });
  for (let i = 0; i < 4; i++) addHuman(w, c.x + i * 10, c.y + 40, false, { role: 'gatherer', energy: 1, hunger: 0 });
  run(w, 30);
  assert.ok(w.sky.watcher, 'a stargazer');
  assert.equal(w.humans.find((h) => h.id === w.sky.watcher).state, 'stargaze');
  assert.ok(w.sky.knowledge > 10, `learning (${w.sky.knowledge})`);
  // no learning in the day or under cloud
  const k = w.sky.knowledge;
  w.time = 12;
  run(w, 10);
  assert.ok(w.sky.knowledge - k < 1, 'nothing by day');
  assert.equal(w.sky.watcher, 0);
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(Math.abs(back.sky.knowledge - w.sky.knowledge) < 1);
});

test('sky lore forecasts rough weather ahead of time, mostly right but not always', () => {
  let hits = 0;
  let misses = 0;
  let warned = 0;
  for (const seed of [601, 602, 603, 604]) {
    const w = camp(seed);
    w.weather.auto = true;
    w.sky.knowledge = 500;
    for (let k = 0; k < 30 * 3000; k++) {
      w.update(DT);
      for (const e of w.events) if (e.type === 'toast' && /Sky watchers/.test(e.text)) warned++;
      w.events.length = 0;
    }
    hits += w.sky.hits;
    misses += w.sky.misses;
  }
  assert.ok(warned > 0, 'warnings were given');
  assert.ok(hits > misses, `mostly right (${hits} right, ${misses} wrong)`);
  assert.ok(misses > 0, 'not perfect');
});
