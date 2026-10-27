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
const { wallNeed, wallMaxHp } = require(path.join(root, 'sim', 'build.ts'));
const { DEFAULT_TOOL, applyTool } = require(path.join(root, 'game', 'tools.ts'));
const { MAP_W, T, TILE } = require(path.join(root, 'sim', 'types.ts'));

const MEGA = { ...DEFAULT_TOOL, id: 'build', build: 'megagate' };

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.dragons.timer = Infinity;
  if (w.snowFolk) w.snowFolk.enabled = false;
  for (const t of ['tools', 'fire', 'axe', 'spear', 'basket', 'shelter', 'palisade']) w.camp.learned.add(t);
  for (let i = 0; i < 4; i++) addHuman(w, w.camp.x + i * 12, w.camp.y + 40, false, {});
  return w;
}

/** a 4-tile-wide river running north-south just east of camp */
function river(w) {
  const tx0 = Math.floor(w.camp.x / TILE) + 9;
  const cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 8; y <= cy + 8; y++) {
    for (let x = tx0 - 1; x <= tx0 + 4; x++) w.terrain.tiles[y * MAP_W + x] = x >= tx0 && x < tx0 + 4 ? T.Deep : T.Grass;
  }
  w.terrain.version++;
  return { tx0, ty: cy + 2 };
}

const finish = (w) => {
  for (const wl of w.tribe.walls) if (wl.mega) {
    wl.built = 1;
    wl.hp = wallMaxHp(wl);
  }
  w.tribe.version++;
  w.nav.sync(w);
};

test('tapping the river plans one shark mouth bank to bank, shut by default', () => {
  const w = world(9101);
  const { tx0, ty } = river(w);
  assert.ok(applyTool(w, MEGA, (tx0 + 1.5) * TILE, (ty + 0.5) * TILE, false), 'placed');
  const mega = w.tribe.walls.filter((wl) => wl.mega);
  assert.equal(mega.length, 4, 'spans the whole river (the narrow way across)');
  assert.ok(mega.every((wl) => wl.ty === ty && wl.part === 'gate' && !wl.open && !wl.auto));
  assert.deepEqual(wallNeed(mega[0]), { r: 'bone', n: 3 });
  // dry land is refused
  assert.equal(applyTool(w, MEGA, w.camp.x, w.camp.y + 120, false), false);
});

test('shut: our people cross on the jaw, dinos are stopped; opened: anyone crosses', () => {
  const w = world(9102);
  const { tx0, ty } = river(w);
  applyTool(w, MEGA, (tx0 + 1.5) * TILE, (ty + 0.5) * TILE, false);
  w.nav.sync(w);
  const i = ty * MAP_W + tx0 + 1;
  assert.ok(w.nav.ok('human', i), 'builders can stand on the scaffold');
  assert.ok(!w.nav.ok('dino', i), 'dinos cannot');
  finish(w);
  assert.ok(w.nav.ok('human', i));
  assert.ok(!w.nav.ok('dino', i), 'jaws shut on dinos');
  // the tribe never opens it by itself
  for (let k = 0; k < 20; k++) w.tribe.update(w, 0.2);
  assert.ok(w.tribe.walls.filter((wl) => wl.mega).every((wl) => !wl.open), 'still shut');
  const g = w.tribe.walls.find((wl) => wl.mega);
  const span = w.tribe.megaSpan(g);
  assert.equal(span.length, 4);
  for (const o of span) w.tribe.setGate(o, true, true);
  w.nav.sync(w);
  assert.ok(w.nav.ok('dino', i), 'open for everyone');
});

test('the Megalodon gate survives a save', () => {
  const w = world(9103);
  const { tx0, ty } = river(w);
  applyTool(w, MEGA, (tx0 + 1.5) * TILE, (ty + 0.5) * TILE, false);
  finish(w);
  const data = JSON.parse(JSON.stringify(w.tribe.serialize()));
  const w2 = world(9103);
  w2.tribe.clear();
  w2.tribe.load(w2, data);
  const mega = w2.tribe.walls.filter((wl) => wl.mega);
  assert.equal(mega.length, 4);
  assert.ok(mega.every((wl) => !wl.open && !wl.auto));
});
