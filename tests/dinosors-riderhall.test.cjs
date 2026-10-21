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
const { addHuman, shelterSpot } = require(path.join(root, 'sim', 'humans.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const shows = require(path.join(root, 'sim', 'shows.ts'));
const hall = require(path.join(root, 'sim', 'riderHall.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  for (const t of ['tools', 'fire', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 4; y <= cy + 20; y++) for (let x = cx + 2; x <= cx + 36; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < 8) addHuman(w, w.camp.x + w.humans.length * 16, w.camp.y + 30);
  return w;
}
function pit(w) {
  const p = w.colony.addBuilding(w, 'dragonPit', w.camp.x + 520, w.camp.y + 320);
  assert.ok(p && typeof p === 'object');
  p.built = 1;
  return p;
}
function dragonFor(w, rider) {
  const egg = { id: w.nextId(), breed: 'fire', x: w.camp.x + 500, y: w.camp.y + 300, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, skills: { trust: 1, follow: 1, flight: 1, rider: 1 } });
  keep.newDragonStats(dr);
  if (rider) keep.bondDragon(w, dr, rider);
  return dr;
}

test('the colosseum is always built round the dragon pit (and only one)', () => {
  const w = world(9001);
  assert.match(hall.placeHall(w), /dragon pit/);
  const p = pit(w);
  assert.equal(hall.placeHall(w), null);
  const b = w.colony.buildings.find((x) => x.kind === 'riderHall');
  assert.ok(b && Math.hypot(b.x - p.x, b.y - p.y) < 2, 'round the pit');
  assert.match(hall.placeHall(w), /already/);
});

test('every dragon rider + keeper gets their own room, right behind where their dragon sleeps, and sleeps there', () => {
  const w = world(9002);
  const p = pit(w);
  hall.placeHall(w);
  w.colony.buildings.find((x) => x.kind === 'riderHall').built = 1;
  const [r1, r2, plain] = w.humans.filter((h) => !h.child);
  const d1 = dragonFor(w, r1);
  dragonFor(w, r2);
  const folk = hall.hallFolk(w);
  assert.ok(folk.includes(r1) && folk.includes(r2) && !folk.includes(plain), 'only the dragon people');
  const room = hall.roomOf(w, r1);
  const bed = keep.roostOf(w, d1);
  assert.ok(Math.hypot(room.x - bed.x, room.y - bed.y) < 140, `room by its dragon's spot (${Math.hypot(room.x - bed.x, room.y - bed.y).toFixed(0)})`);
  assert.ok(Math.hypot(hall.roomOf(w, r2).x - room.x, hall.roomOf(w, r2).y - room.y) > 30, 'their own rooms');
  assert.deepEqual(shelterSpot(w, r1), { x: room.x, y: room.y }, 'it is home');
  assert.notDeepEqual(shelterSpot(w, plain), { x: room.x, y: room.y });
  // night: off to bed in their room
  w.time = 23;
  w.daylight = 0.05;
  r1.energy = 0.2;
  let slept = false;
  for (let i = 0; i < 30 * 60 && !slept; i++) {
    w.update(1 / 30);
    w.events.length = 0;
    w.daylight = 0.05;
    slept = hall.inRoom(w, r1);
  }
  assert.ok(slept, 'asleep in their room');
});

test('it grows with the pit and with the people in it', () => {
  const w = world(9003);
  const p = pit(w);
  hall.placeHall(w);
  w.colony.buildings.find((x) => x.kind === 'riderHall').built = 1;
  const people = w.humans.filter((h) => !h.child);
  dragonFor(w, people[0]);
  assert.equal(hall.hallTiers(w), 1);
  const small = hall.hallRing(p).rx;
  for (let i = 1; i < 8; i++) dragonFor(w, people[i]);
  assert.ok(hall.hallTiers(w) >= 3, `taller (${hall.hallTiers(w)} tiers)`);
  for (let i = 0; i < 400; i++) shows.pitGrow(w, 1);
  assert.ok(hall.hallRing(p).rx > small * 1.5, 'wider with the pit');
});
