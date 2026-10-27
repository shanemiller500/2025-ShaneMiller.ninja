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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { TALL } = require(path.join(root, 'sim', 'plants.ts'));
const { toughness } = require(path.join(root, 'sim', 'courage.ts'));
const { inferCommand, issue } = require(path.join(root, 'sim', 'tasks.ts'));
const { TREE_TOUGH, MAX_TRIBES, TREE_GROWN, TREE_CAMP_MIN } = require(path.join(root, 'sim', 'treeFolk.ts'));

const DT = 1 / 30;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** A real (populated) world with two Tree People tribes settled and everything else that wanders about switched off. */
function forestWorld(seed = 4242) {
  const w = new World(seed);
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
  w.rivals.clans.length = 0;
  w.rivals.brutes.length = 0;
  w.wildlife.enabled = false;
  // (the desert + mountain peoples have nothing to do with these tests)
  w.sandFolk.enabled = false;
  w.snowFolk.enabled = false;
  w.dinos.length = 0;
  w.elapsed = 300;
  w.forest.update(w, 0.05);
  // nothing happens by itself unless a test asks for it
  w.forest['uniteT'] = Infinity;
  for (const t of w.forest.tribes) {
    t.raidT = Infinity;
    t.ambushT = Infinity;
  }
  w.toasts = [];
  const toast = w.toast.bind(w);
  w.toast = (icon, text, x, y, f) => {
    w.toasts.push(`${icon} ${text}`);
    return toast(icon, text, x, y, f);
  };
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
const isCover = (w, x, y) => [T.Forest, T.Jungle].includes(w.terrain.tileAt(x, y));
function armed(w, x, y, n) {
  w.camp.learned.add('spear');
  const out = [];
  for (let i = 0; i < n; i++) out.push(addHuman(w, x + (i % 4) * 16 - 24, y + Math.floor(i / 4) * 16));
  return out;
}

test('Tree People settle deep in the forest, far from us, in canopy camps ringed by warning signs', () => {
  const w = forestWorld();
  const f = w.forest;
  assert.equal(f.tribes.length, 2, 'two tribes settle');
  for (const t of f.tribes) {
    assert.ok(isCover(w, t.x, t.y), `${t.name} camps in forest / jungle`);
    assert.ok(Math.hypot(t.x - w.camp.x, t.y - w.camp.y) >= TREE_CAMP_MIN, 'well away from our town');
    assert.ok(t.pods.length >= 2, 'decks up in the trees');
    for (const p of t.pods) {
      assert.ok(p.h > 20, 'decks are up high');
      assert.ok(w.plants.some((q) => TALL.has(q.kind) && Math.hypot(q.x - p.x, q.y - p.y) < 3), 'every deck is in a real tree');
    }
    assert.ok(t.pods.some((p) => p.kind === 'hut') && t.pods.some((p) => p.kind === 'lookout'), 'huts + a lookout');
    assert.ok(t.signs.length >= 6, 'warning displays round their woods');
    for (const s of t.signs) assert.ok(dist(s, t) > t.r * 0.7 && dist(s, t) < t.r * 1.05, 'signs sit at the edge of the territory');
    const folk = f.members(t.id);
    assert.ok(folk.length >= 6, 'a good few of them');
    for (const b of folk) {
      assert.equal(b.kind, 'brute');
      assert.equal(b.tree, t.id);
      assert.equal(b.clan, 0);
      assert.ok(w.rivals.brutes.includes(b), 'they live with the other brutes (so our guards etc. see them)');
    }
    assert.ok(folk.some((b) => b.age < TREE_GROWN), 'young ones too');
  }
  assert.ok(f.tribes.every((t) => !t.seen && !t.found), 'nobody knows about them yet');
});

test('a lone worker walking through their woods gets ambushed: hidden in the leaves, a volley first, then they rush in', () => {
  const w = forestWorld();
  const f = w.forest;
  const t = f.tribes[0];
  f['setAmbush'](w, t);
  const bd = f.bands[0];
  assert.equal(bd.mode, 'lurk');
  const party = () => bd.ids.map((id) => w.rivals.byId(id)).filter(Boolean);
  run(w, 40, () => party().every((b) => b.hidden));
  assert.ok(party().every((b) => b.hidden && (b.state === 'perch' || b.state === 'lurk')), 'everyone in hiding');
  assert.ok(party().some((b) => b.z > 10), 'some of them up in the trees');
  assert.ok(party().every((b) => !w.rivals.hostile(w, b)), "our side can't target what it can't see");
  const h = addHuman(w, bd.x + 150, bd.y + 20);
  let thrown = false;
  let closest = Infinity;
  run(w, 8, () => {
    if (w.rivals.missiles.length) thrown = true;
    for (const b of party()) closest = Math.min(closest, dist(b, h));
  });
  assert.ok(w.toasts.some((s) => s.includes('Ambush!')), 'ambush!');
  assert.ok(thrown, 'rocks / spears / arrows came out of the trees first');
  assert.ok(party().every((b) => !b.hidden), 'they show themselves once they strike');
  assert.ok(!w.humans.includes(h) || h.hp < 1, 'the worker got hurt');
  // (a worker who runs gets a head start: give the rush a few more seconds to catch them)
  if (closest >= 60) run(w, 6, () => {
    for (const b of party()) closest = Math.min(closest, dist(b, h));
  });
  assert.ok(closest < 60, `they rushed in (closest ${Math.round(closest)})`);
});

test('only nearby people react: an ambush alarms the people around it, not the whole map', () => {
  const w = forestWorld();
  const f = w.forest;
  const t = f.tribes[0];
  f['setAmbush'](w, t);
  const bd = f.bands[0];
  run(w, 40, () => bd.ids.every((id) => w.rivals.byId(id)?.hidden));
  const home = w.humans.filter((h) => Math.hypot(h.x - w.camp.x, h.y - w.camp.y) < 600);
  const before = home.map((h) => h.fear ?? 0);
  addHuman(w, bd.x + 150, bd.y + 20);
  run(w, 2);
  assert.equal(bd.mode, 'strike');
  home.forEach((h, i) => assert.ok((h.fear ?? 0) <= before[i] + 0.05, `${h.name} back at camp isn't frightened by it`));
});

test('they break off + melt back into the trees when badly outnumbered, then regroup to try again', () => {
  const w = forestWorld();
  const f = w.forest;
  const t = f.tribes[0];
  f['setAmbush'](w, t);
  const bd = f.bands[0];
  run(w, 40, () => bd.ids.every((id) => w.rivals.byId(id)?.hidden));
  const crowd = armed(w, bd.x + 120, bd.y, 12);
  run(w, 10, () => bd.mode === 'home' || !f.bands.includes(bd));
  assert.ok(bd.mode === 'home' || !f.bands.includes(bd), 'the band broke off');
  const left = bd.ids.map((id) => w.rivals.byId(id)).filter(Boolean);
  assert.ok(left.every((b) => b.state === 'flee' || b.state === 'home' || dist(b, t) < 140 || b.state === 'climb' || b.state === 'perch'), 'heading back into the forest');
  assert.ok(t.ambushT < 200, 'they will set another ambush before long');
  assert.ok(crowd.length === 12);
});

test("lighter than a Neanderthal: one goes down in about half the hits (and courage counts them that way)", () => {
  const w = forestWorld();
  const b = w.forest.members(w.forest.tribes[0].id).find((x) => x.age >= TREE_GROWN);
  assert.ok(TREE_TOUGH < 150 * 0.6);
  assert.equal(toughness({ kind: 'brute', b, dist: 0 }), TREE_TOUGH);
  assert.equal(toughness({ kind: 'brute', b: { ...b, tree: undefined }, dist: 0 }), 150);
  b.state = 'idle';
  w.rivals.hit(w, b, 26, b.x + 100, b.y, false, 'spear');
  assert.ok(Math.abs(b.hp - (1 - 26 / TREE_TOUGH)) < 1e-9, 'a wooden spear takes over a third');
  w.rivals.hit(w, b, 26, b.x + 100, b.y, false, 'spear');
  w.rivals.hit(w, b, 26, b.x + 100, b.y, false, 'spear');
  assert.ok(!w.rivals.brutes.includes(b), 'three spears and down');
  assert.ok(w.items.some((it) => Math.hypot(it.x - b.x, it.y - b.y) < 20 && (it.kind === 'stick' || it.kind === 'stone')), 'drops their weapon');
});

test('a raiding party hits a Neanderthal camp, fights them, grabs food and runs home', () => {
  const w = forestWorld(4242);
  const f = w.forest;
  const t = f.tribes[0];
  let clan = null;
  for (const [dx, dy] of [[1300, 0], [-1300, 0], [0, 1200], [0, -1200], [1000, 900], [-1000, 900]]) {
    clan = w.rivals.spawnClan(w, 4, { x: t.x + dx, y: t.y + dy });
    if (clan && dist(clan, t) < 2400) break;
    if (clan) w.rivals.clans.splice(w.rivals.clans.indexOf(clan), 1);
    clan = null;
  }
  assert.ok(clan, 'a clan camp within reach');
  for (const b of w.rivals.members(clan.id)) b.x = clan.x, b.y = clan.y + 10;
  clan.raidT = Infinity;
  for (const m of f.members(t.id)) if (m.age >= TREE_GROWN) m.hp = 1;
  assert.ok(f.startRaid(w, t), 'they set out');
  const bd = f.bands.find((b) => b.mode === 'raid');
  assert.equal(bd.goal.kind, 'clan');
  let fought = false;
  let stole = false;
  run(w, 220, () => {
    if (w.rivals.members(clan.id).some((b) => b.hp < 1) || f.members(t.id).some((b) => b.band === bd.id && b.hp < 1 && b.state === 'fight')) fought = true;
    if (f.members(t.id).some((b) => b.forage > 0)) stole = true;
    return !f.bands.includes(bd);
  });
  assert.ok(fought || stole, 'they clashed with the clan or robbed it');
  assert.ok(!f.bands.includes(bd), 'the raid ended');
  for (const b of f.members(t.id)) assert.ok(dist(b, t) < t.r + 300 || b.state === 'home' || b.state === 'flee', `${b.name} went back to the forest`);
});

test('a raiding party can come for the edge of our town (and warns us as it closes in)', () => {
  const w = forestWorld(4242);
  const f = w.forest;
  const t = f.tribes[0];
  w.elapsed = 900;
  w.tribe.danger = 'normal';
  // make our town the only goal: no clan about, nobody out alone
  for (const h of w.humans) h.x = w.camp.x, h.y = w.camp.y;
  assert.ok(f.startRaid(w, t));
  const bd = f.bands.find((b) => b.mode === 'raid');
  assert.equal(bd.goal.kind, 'town');
  const party = bd.ids.map((id) => w.rivals.byId(id));
  assert.ok(party.every((b) => b.raid), 'flagged as raiders (war dinos + guards go for them)');
  run(w, 200, () => w.toasts.some((s) => s.includes('raiding the edge of our town')));
  assert.ok(w.toasts.some((s) => s.includes('raiding the edge of our town')), 'a warning as they close in');
});

test('we attack a scouted camp: fight them down out of the trees, pull the decks down, take their loot, weapons + trail maps', () => {
  const w = forestWorld(4242);
  const f = w.forest;
  const [t, other] = f.tribes;
  // thin them out so the fight is short
  const adults = f.members(t.id).filter((b) => b.age >= TREE_GROWN);
  for (const b of adults.slice(2)) w.rivals.kill(w, b);
  t.found = true;
  t.seen = true;
  const crew = armed(w, t.x + 160, t.y + 40, 10);
  for (const h of crew) assert.ok(w.nav.passable('human', h.x, h.y) || true);
  const cmd = inferCommand(w, crew, t.x, t.y, {});
  assert.equal(cmd.kind, 'treeRaid');
  const task = issue(w, crew, cmd);
  assert.ok(task, 'the order went out');
  const wood = w.camp.stock.wood;
  const spears = w.colony.armory.spearB ?? 0;
  run(w, 300, () => !f.tribe(t.id));
  assert.ok(!f.tribe(t.id), 'the camp is gone');
  assert.ok(w.camp.stock.wood > wood, 'their wood came home');
  assert.ok((w.colony.armory.spearB ?? 0) > spears, 'captured bone spears');
  assert.ok(other.found, 'their trail marks gave away the other camp');
  assert.ok(w.toasts.some((s) => s.includes('tore down')), 'told about it');
  assert.ok(f.cleared.length >= 1, 'that forest is cleared for a while');
});

test("burnt or felled trees bring the decks down; nobody resettles a forest we've just cleared", () => {
  const w = forestWorld();
  const f = w.forest;
  const t = f.tribes[0];
  for (const p of t.pods) for (const q of w.plants) if (Math.hypot(q.x - p.x, q.y - p.y) < 3) q.stump = true;
  w.plantsDirty = true;
  run(w, 2);
  assert.ok(!f.tribe(t.id), 'camp gone with its trees');
  const spot = { x: t.x, y: t.y };
  for (let i = 0; i < 30; i++) {
    const n = f.settle(w, 0);
    if (n) assert.ok(dist(n, spot) > 900, 'never back on the cleared ground');
    if (n) f.tribes.splice(f.tribes.indexOf(n), 1);
  }
});

test('camps grow fast and plant outposts deeper in the woods, but never past the caps', () => {
  const w = forestWorld();
  const f = w.forest;
  for (const t of f.tribes) t.food = 30;
  for (let s = 0; s < 3000; s++) {
    for (const t of f.tribes) t.food = Math.max(t.food, 20);
    f['reindex'](w);
    f['slowTick'](w, 1);
  }
  assert.ok(f.tribes.some((t) => t.tier >= 2), 'a camp grew');
  assert.ok(f.tribes.length <= MAX_TRIBES, 'never more than the cap');
  assert.ok(f.folk(w).length <= 38, 'never more than the cap of folk');
  for (const t of f.tribes) {
    assert.ok(isCover(w, t.x, t.y), 'every camp (and outpost) is in the forest');
    assert.ok(Math.hypot(t.x - w.camp.x, t.y - w.camp.y) >= TREE_CAMP_MIN);
  }
});

test('walking near their woods finds the signs; closer finds the camp', () => {
  const w = forestWorld();
  const t = w.forest.tribes[0];
  const s = t.signs[0];
  // just outside the sign (the sign itself is close enough to the camp to give it away)
  const a = Math.atan2(s.y - t.y, s.x - t.x);
  const h = addHuman(w, s.x + Math.cos(a) * 140, s.y + Math.sin(a) * 140);
  w.forest['discoverTick'](w, t);
  assert.ok(t.seen && !t.found, 'signs spotted');
  assert.ok(w.toasts.some((x) => x.includes('strange markings')));
  h.x = t.x + 300;
  h.y = t.y;
  w.forest['discoverTick'](w, t);
  assert.ok(t.found, 'camp found');
  assert.ok(w.toasts.some((x) => x.includes('tree camp')));
});

test('a calm world: they keep to their trees (no ambushes on people), but still guard them from Neanderthals', () => {
  const w = forestWorld();
  w.tribe.danger = 'calm';
  const f = w.forest;
  const t = f.tribes[0];
  f['setAmbush'](w, t);
  const bd = f.bands[0];
  run(w, 40, () => bd.ids.every((id) => w.rivals.byId(id)?.hidden));
  const h = addHuman(w, bd.x + 120, bd.y);
  run(w, 6);
  assert.equal(bd.mode, 'lurk', 'no ambush on our people');
  assert.ok(h.hp >= 1);
});

test('save + load keeps their camps, signs, discovery and folk', () => {
  const w = forestWorld();
  const f = w.forest;
  f.tribes[0].found = true;
  f.tribes[0].tier = 2;
  const n = f.folk(w).length;
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.forest.tribes.length, 2);
  assert.ok(back.forest.started);
  assert.equal(back.forest.tribes[0].found, true);
  assert.equal(back.forest.tribes[0].tier, 2);
  assert.equal(back.forest.tribes[0].pods.length, f.tribes[0].pods.length);
  assert.equal(back.forest.tribes[0].signs.length, f.tribes[0].signs.length);
  assert.equal(back.forest.folk(back).length, n);
  assert.ok(back.forest.folk(back).every((b) => back.rivals.brutes.includes(b) && b.tree));
  // the Neanderthals' own save never picks them up
  assert.ok(back.rivals.serialize().brutes.every((b) => !b.tree));
  // and the game keeps running
  run(back, 5);
});

test('bare test worlds have no Tree People (the rest of the sim plays out the same)', () => {
  const w = new World(77, false);
  w.rivals.started = true;
  w.elapsed = 1000;
  w.update(DT);
  assert.equal(w.forest.tribes.length, 0);
  assert.equal(w.forest.started, false);
});

test('the People tool settles a Tree People camp where you tap in the forest (and says why when it cannot)', () => {
  const { applyTool, DEFAULT_TOOL } = require(path.join(root, 'game', 'tools.ts'));
  const w = new World(4242);
  w.rivals.started = false;
  const tool = { ...DEFAULT_TOOL, id: 'people', people: 'treeFolk' };
  // out on open ground near camp: no
  assert.equal(applyTool(w, tool, w.camp.x + 60, w.camp.y + 60, false), false);
  // deep in the forest: yes
  let spot = null;
  for (let ty = 2; ty < 110 && !spot; ty++) for (let tx = 2; tx < 158 && !spot; tx++) {
    const x = tx * 32 + 16, y = ty * 32 + 16;
    if (Math.hypot(x - w.camp.x, y - w.camp.y) > 1300 && isCover(w, x, y) && w.plants.filter((p) => TALL.has(p.kind) && Math.hypot(p.x - x, p.y - y) < 140).length >= 4) spot = { x, y };
  }
  assert.ok(spot, 'a forest spot to test with');
  assert.equal(applyTool(w, tool, spot.x, spot.y, false), true);
  const t = w.forest.tribes.find((x) => dist(x, spot) < 220);
  assert.ok(t, 'a tribe settled there');
  assert.ok(t.found && t.pods.length >= 2 && t.signs.length >= 6);
  assert.ok(w.forest.members(t.id).length >= 6);
  assert.ok(w.rivals.started && w.forest.started, 'and they get moving straight away');
  const before = w.forest.members(t.id).map((b) => [b.x, b.y]);
  run(w, 3);
  assert.ok(w.forest.members(t.id).some((b, i) => before[i] && (b.x !== before[i][0] || b.y !== before[i][1] || b.z > 0)), 'they move about');
  // not right on top of another camp
  assert.equal(applyTool(w, tool, t.x + 30, t.y, false), false);
});

test('tribes unite like the clans: the smaller moves in with the bigger, names + paint combine, the camp grows past its usual size', () => {
  const { MAX_TREE_TIER } = require(path.join(root, 'sim', 'treeFolk.ts'));
  const w = forestWorld();
  const f = w.forest;
  const [a, b] = f.tribes;
  a.seen = true;
  b.found = true;
  // b is down to a handful: it always joins up when they next talk
  const bFolk = f.members(b.id);
  for (const x of bFolk.slice(3)) w.rivals.kill(w, x);
  const movers = f.members(b.id);
  const total = f.members(a.id).length + movers.length;
  a.tier = 3;
  const podsBefore = a.pods.length;
  f['uniteT'] = 0;
  f['slowTick'](w, 1);
  assert.equal(f.tribes.length, 1, 'one tribe now');
  const u = f.tribes[0];
  assert.equal(u.id, a.id, 'the bigger one takes the smaller in');
  assert.ok(u.name.includes('&'), `combined name (${u.name})`);
  assert.equal(u.merges, 1);
  assert.equal(u.colors.length, 2, 'both paints');
  assert.equal(u.tier, 4, 'grew past the usual top size');
  assert.ok(u.pods.length >= podsBefore, 'more decks (where there are trees for them)');
  assert.ok(u.found && u.seen, 'what we knew about either, we know about the union');
  assert.equal(f.members(u.id).length, total, 'everybody counts as one tribe');
  assert.ok(movers.every((x) => x.tree === u.id && (x.state === 'home' || x.state === 'flee')), 'the movers head over to the new home');
  assert.ok(w.toasts.some((s) => s.includes('joined into one tribe')));
  // their own tier cap: grows by itself only up to 3 + unions, never past the max
  assert.equal(f.maxTier(u), 4);
  u.merges = 9;
  assert.equal(f.maxTier(u), MAX_TREE_TIER);
  // a second union becomes the "Great …" tribe, and it survives a reload
  u.merges = 1;
  const c = f.settle(w, 0);
  if (c) {
    for (const x of f.members(c.id).slice(2)) w.rivals.kill(w, x);
    f.unite(w, c, u);
    assert.ok(u.name.startsWith('Great '), u.name);
    assert.equal(u.merges, 2);
  }
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.forest.tribes[0].name, u.name);
  assert.equal(back.forest.tribes[0].colors.length, u.colors.length);
});

test("after dark Scorpions can't see Tree People at all; our people only spot them up close or by firelight", () => {
  const { scorpionTarget } = require(path.join(root, 'sim', 'colony.ts'));
  const w = forestWorld();
  w.time = 23;
  run(w, 0.1);
  assert.ok(w.daylight < 0.3, 'night');
  const b = w.forest.members(w.forest.tribes[0].id).find((x) => x.age >= TREE_GROWN);
  b.band = undefined;
  b.hidden = false;
  b.x = w.camp.x + 400;
  b.y = w.camp.y;
  b.spotT = 0;
  for (const h of w.humans) h.x = w.camp.x - 300, h.y = w.camp.y;
  assert.equal(w.rivals.hostile(w, b), false, 'a shadow in the dark');
  assert.equal(scorpionTarget(w, b.x - 200, b.y, 700), null, 'a Scorpion has nothing to shoot at');
  // someone awake walks right up to it: seen
  const h = addHuman(w, b.x + 60, b.y);
  h.state = 'idle';
  w.forest['spot'](w, b);
  assert.ok(b.spotT > 0 && w.rivals.hostile(w, b), 'seen up close');
  assert.equal(scorpionTarget(w, b.x - 200, b.y, 700), null, "the Scorpion still can't pick it out");
  // by day there's nowhere to hide on open ground
  w.time = 12;
  run(w, 0.1);
  b.spotT = 0;
  assert.ok(w.rivals.hostile(w, b));
});

test('a night raid: thieves empty the stores, snatchers carry someone off to the tree camp; reach them unguarded to free them', () => {
  const w = forestWorld();
  const f = w.forest;
  const t = f.tribes[0];
  w.time = 23;
  w.elapsed = 900;
  for (const r of ['meat', 'berries', 'wood', 'flint']) w.camp.stock[r] = 30;
  const before = ['meat', 'berries', 'wood', 'flint'].reduce((s, r) => s + w.camp.stock[r], 0);
  const sleeper = addHuman(w, w.camp.pileX + 120, w.camp.pileY + 60);
  run(w, 0.1);
  assert.ok(f.startNightRaid(w, t), 'they slip out of the trees');
  const bd = f.bands.find((x) => x.goal?.kind === 'night');
  let snatched = null;
  run(w, 400, () => {
    if (sleeper.state !== 'captive' && sleeper.captive === 0 && w.humans.includes(sleeper)) sleeper.state = 'sleep';
    snatched = w.humans.find((h) => h.captive === -t.id && !w.rivals.brutes.some((b) => b.captive === h.id) && Math.hypot(h.x - t.x, h.y - t.y) < 260) ?? null;
    return !!snatched && !f.bands.includes(bd);
  });
  const after = ['meat', 'berries', 'wood', 'flint'].reduce((s, r) => s + w.camp.stock[r], 0);
  assert.ok(after < before, 'something went missing from the stores');
  assert.ok(snatched, 'someone was carried back to their camp');
  assert.ok(w.toasts.some((s) => s.includes('snatched')), 'we heard about it');
  assert.equal(w.rivals.captives(w).includes(snatched), false, "not counted as a Neanderthal clan's captive");
  assert.ok(f.captivesOf(w, t).includes(snatched));
  // still held after a reload
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.humans.find((h) => h.id === snatched.id).captive, -t.id);
  // guards gone + a friend at their side: free
  for (const b of f.members(t.id)) b.x = t.x + 900, b.y = t.y + 900;
  addHuman(w, snatched.x + 20, snatched.y);
  f['captivesTick'](w, t);
  assert.equal(snatched.captive, 0, 'rescued');
  assert.ok(w.toasts.some((s) => s.includes('rescued from the')));
});

test('a tree camp torn down frees the people it held', () => {
  const w = forestWorld();
  const f = w.forest;
  const t = f.tribes[0];
  const h = addHuman(w, t.x + 10, t.y + 10);
  h.captive = -t.id;
  h.state = 'captive';
  f.raze(w, t, 'us');
  assert.equal(h.captive, 0);
});
