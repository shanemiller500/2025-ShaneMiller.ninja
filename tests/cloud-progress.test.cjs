// Fight World: the whole local profile round-trips through the cloud-save bundle.
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

// resolve the "@/..." path alias the app uses (tsconfig paths)
const Module = require('node:module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) request = path.join(__dirname, '..', request.slice(2));
  return origResolve.call(this, request, ...rest);
};

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

test('fight progress exports + imports as one bundle', () => {
  global.localStorage = fakeStorage();
  const s = require(path.join(__dirname, '..', 'app', 'marvel-fight-world', 'data', 'storage.ts'));
  s.saveSettings({ ...s.DEFAULT_SETTINGS, difficulty: 'hard', sfxVolume: 0.3 });
  s.saveFavorites([7, 3]);
  s.pushRecent(11);
  s.recordMatch({ fighterId: 7, fighterName: 'Hero', opponentId: 9, opponentName: 'Foe', won: true, kos: 2, perfects: 1, maxCombo: 14, fastestKo: 21.4 });
  s.recordTournamentWin();
  s.saveWorldProgress({ playerId: 7, zone: 'docks', x: 420 });
  const bundle = JSON.stringify(s.exportProgress());

  // a different player on a fresh browser loads it
  global.localStorage = fakeStorage();
  assert.equal(s.loadStats().matches, 0);
  assert.ok(s.importProgress(bundle));
  assert.equal(s.loadSettings().difficulty, 'hard');
  assert.deepEqual(s.loadFavorites(), [7, 3]);
  assert.deepEqual(s.loadRecent(), [11]);
  const st = s.loadStats();
  assert.equal(st.matches, 1);
  assert.equal(st.wins, 1);
  assert.equal(st.tournamentWins, 1);
  assert.equal(st.biggestCombo, 14);
  assert.deepEqual(s.loadWorldProgress(), { playerId: 7, zone: 'docks', x: 420 });
  assert.equal(s.importProgress('{"nope":true}'), false);
  assert.equal(s.importProgress('not json'), false);
});
