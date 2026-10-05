// Headless tests for the Fight World engine (app/marvel-fight-world/engine).
// The engine is DOM-free, so we transpile its TypeScript on the fly and step fights in Node.
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

const root = path.join(__dirname, '..', 'app', 'marvel-fight-world', 'engine');
const { buildFighter, deriveArchetype } = require(path.join(root, 'fighters.ts'));
const { Match } = require(path.join(root, 'match.ts'));
const { AIController } = require(path.join(root, 'ai.ts'));
const { emptyInput } = require(path.join(root, 'types.ts'));

const hero = (id, name, powerstats, alignment = 'good') => ({
  id,
  name,
  powerstats,
  biography: { fullName: name, alignment },
  images: { xs: '', sm: '', md: '', lg: '' },
});

// Real dataset numbers for the featured cast
const SPIDEY = hero(620, 'Spider-Man', { intelligence: 90, strength: 55, speed: 67, durability: 75, power: 74, combat: 85 });
const HULK = hero(332, 'Hulk', { intelligence: 88, strength: 100, speed: 63, durability: 100, power: 98, combat: 85 });
const CAP = hero(149, 'Captain America', { intelligence: 69, strength: 19, speed: 38, durability: 55, power: 60, combat: 100 });
const NOBODY = hero(999, 'Generic Guy', { intelligence: 50, strength: 50, speed: 50, durability: 50, power: 50, combat: 50 });

/** Skip the intro so the fight is live. */
function live(m) {
  for (let i = 0; i < 200 && m.phase !== 'fight'; i++) m.step([emptyInput(), emptyInput()]);
  assert.equal(m.phase, 'fight');
}

function hold(m, p0 = {}, p1 = {}, frames = 1) {
  for (let i = 0; i < frames; i++) m.step([{ ...emptyInput(), ...p0 }, { ...emptyInput(), ...p1 }]);
}

function closeIn(m) {
  const [a, b] = m.fighters;
  a.x = -40;
  b.x = 40;
}

test('fighter definitions are balanced, not raw stats', () => {
  const hulk = buildFighter(HULK);
  const cap = buildFighter(CAP);
  assert.ok(hulk.maxHealth > cap.maxHealth);
  assert.ok(hulk.maxHealth <= 1500 && cap.maxHealth >= 950);
  assert.ok(hulk.physMul > cap.physMul);
  assert.ok(hulk.physMul / cap.physMul < 1.6, 'strength gap is compressed into a playable band');
  assert.equal(hulk.custom, true);
  assert.equal(hulk.moves.s2.name, 'Ground Smash');
  const generic = buildFighter(NOBODY);
  assert.equal(generic.custom, false);
  assert.ok(generic.moves.s1 && generic.moves.ult, 'archetype kit fills every slot');
  assert.equal(deriveArchetype({ intelligence: 40, strength: 95, speed: 20, durability: 95, power: 30, combat: 50 }), 'tank');
});

test('a jab connects and deals damage', () => {
  const m = new Match({ p1: buildFighter(SPIDEY), p2: buildFighter(HULK), seed: 1 });
  live(m);
  closeIn(m);
  const before = m.fighters[1].health;
  hold(m, { lp: true });
  hold(m, {}, {}, 20);
  assert.ok(m.fighters[1].health < before, 'health went down');
  assert.ok(m.events.some((e) => e.type === 'hit' && !e.blocked));
});

test('blocking stops normal damage; lows beat standing block; throws beat block', () => {
  const m = new Match({ p1: buildFighter(SPIDEY), p2: buildFighter(CAP), seed: 2 });
  live(m);
  closeIn(m);
  const cap = m.fighters[1];
  let hp = cap.health;
  // Cap holds block (button) while Spidey jabs
  hold(m, { lp: true }, { block: true });
  hold(m, {}, { block: true }, 20);
  assert.equal(cap.health, hp, 'standing block takes no damage from a jab');
  assert.ok(m.events.some((e) => e.type === 'hit' && e.blocked));

  hold(m, {}, {}, 30);
  closeIn(m);
  hp = cap.health;
  hold(m, { down: true, kick: true }, { block: true });
  hold(m, {}, { block: true }, 25);
  assert.ok(cap.health < hp, 'sweep (low) beats a standing block');

  hold(m, {}, {}, 80);
  closeIn(m);
  hp = cap.health;
  hold(m, { lp: true, kick: true }, { block: true });
  hold(m, {}, { block: true }, 30);
  assert.ok(cap.health < hp, 'throw beats block');
});

test('chained attacks build a combo and trigger named combo bonus', () => {
  const m = new Match({ p1: buildFighter(SPIDEY), p2: buildFighter(HULK), seed: 3 });
  live(m);
  closeIn(m);
  // Spidey Flurry: lp, lp, kick — press each as the previous connects
  hold(m, { lp: true });
  hold(m, {}, {}, 6);
  hold(m, { lp: true });
  hold(m, {}, {}, 6);
  hold(m, { kick: true });
  hold(m, {}, {}, 30);
  const spidey = m.fighters[0];
  assert.ok(spidey.maxCombo >= 3, `combo reached ${spidey.maxCombo}`);
  assert.ok(m.events.some((e) => e.type === 'combo' && e.label === 'Spidey Flurry'));
});

test('ultimate needs a full meter, freezes for the super flash, and does big but fair damage', () => {
  const m = new Match({ p1: buildFighter(HULK), p2: buildFighter(SPIDEY), seed: 4 });
  live(m);
  closeIn(m);
  const [hulk, spidey] = m.fighters;
  hold(m, { ult: true });
  assert.equal(hulk.move, null, 'no ultimate without meter');
  hulk.meter = 100;
  hold(m, {}, {}, 2);
  hold(m, { ult: true });
  assert.equal(hulk.slot, 'ult');
  assert.ok(m.superFreeze > 0, 'super flash');
  assert.equal(hulk.meter, 0);
  const before = spidey.health;
  hold(m, {}, {}, 160);
  const dealt = before - spidey.health;
  assert.ok(dealt > spidey.def.maxHealth * 0.12, `ultimate hurts (${dealt})`);
  assert.ok(dealt < spidey.def.maxHealth * 0.6, 'ultimate is not an instant win');
});

test('Hulk hits harder than Captain America', () => {
  const m = new Match({ p1: buildFighter(HULK), p2: buildFighter(CAP), seed: 5 });
  const [hulk, cap] = m.fighters;
  const hulkPunch = m.computeDamage(hulk, cap, hulk.def.moves.hp, 1, false, 1);
  const capPunch = m.computeDamage(cap, hulk, cap.def.moves.hp, 1, false, 1);
  assert.ok(hulkPunch > capPunch * 1.4, `${hulkPunch} vs ${capPunch}`);
});

test('specials fire projectiles that hit', () => {
  const m = new Match({ p1: buildFighter(SPIDEY), p2: buildFighter(HULK), seed: 6 });
  live(m);
  m.fighters[0].x = -300;
  m.fighters[1].x = 100;
  hold(m, { special: true });
  hold(m, {}, {}, 16);
  assert.ok(m.projectiles.length > 0, 'web pull fired');
  const hp = m.fighters[1].health;
  hold(m, {}, {}, 60);
  assert.ok(m.fighters[1].health < hp, 'projectile hit');
});

test('AI vs AI plays complete matches to a K.O. winner, and rematch resets', () => {
  for (const diff of ['easy', 'normal', 'hard', 'insane']) {
    const m = new Match({ p1: buildFighter(SPIDEY), p2: buildFighter(HULK), roundsToWin: 1, seed: 11 });
    const a = new AIController(diff, 21);
    const b = new AIController(diff, 37);
    let frames = 0;
    let kos = 0;
    while (m.phase !== 'over' && frames < 60 * 60 * 4) {
      m.step([a.tick(m.fighters[0], m.fighters[1], m), b.tick(m.fighters[1], m.fighters[0], m)]);
      for (const e of m.events) if (e.type === 'ko') kos++;
      m.events.length = 0;
      frames++;
    }
    assert.equal(m.phase, 'over', `${diff}: match finished (${frames} frames)`);
    assert.ok(m.winner === 0 || m.winner === 1);
    const hits = m.fighters[0].hitsLanded + m.fighters[1].hitsLanded;
    assert.ok(hits > 5, `${diff}: real fighting happened (${hits} hits, ${kos} KOs)`);
    m.rematch();
    assert.equal(m.phase, 'intro');
    assert.deepEqual(m.wins, [0, 0]);
    assert.equal(m.fighters[0].health, m.fighters[0].def.maxHealth);
  }
});
