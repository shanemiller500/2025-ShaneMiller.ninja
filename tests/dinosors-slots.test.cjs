const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { MAX_SLOTS, oldestToRemove } = require(path.join(__dirname, '..', 'app', 'dinosors', 'game', 'slots.ts'));
const slot = (id, savedAt, kind = 'manual') => ({ id, savedAt, kind });

test('the eleventh saved game removes the oldest archive and keeps Latest', () => {
  const existing = [slot('latest', 100, 'latest'), ...Array.from({ length: 9 }, (_, i) => slot(`save-${i}`, i))];
  assert.equal(existing.length, MAX_SLOTS);
  assert.deepEqual(oldestToRemove(existing, slot('new-save', 101)), ['save-0']);
  assert.deepEqual(oldestToRemove(existing, slot('latest', 102, 'latest')), []);
});

test('older save libraries trim to ten across manual and autosaves', () => {
  const existing = [slot('latest', 100, 'latest'), ...Array.from({ length: 12 }, (_, i) => slot(`save-${i}`, i, i % 2 ? 'auto' : 'manual'))];
  assert.deepEqual(oldestToRemove(existing), ['save-0', 'save-1', 'save-2']);
  assert.deepEqual(oldestToRemove(existing, slot('new-save', 101)), ['save-0', 'save-1', 'save-2', 'save-3']);
});

test('updating an existing slot does not evict another save', () => {
  const existing = [slot('latest', 100, 'latest'), ...Array.from({ length: 9 }, (_, i) => slot(`save-${i}`, i))];
  assert.deepEqual(oldestToRemove(existing, slot('save-0', 101)), []);
});