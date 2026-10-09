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

const { buildUniverseGraph, splitSourceList, teamNames } = require(path.join(__dirname, 'marvelverse-graph.ts'));
const hero = (id, name, relatives, groupAffiliation, firstAppearance = '') => ({
  id, name, total: 300,
  biography: { fullName: name, firstAppearance },
  connections: { relatives, groupAffiliation },
  images: { sm: '', md: '' },
});

test('family is explicit and shared teams remain inferred', () => {
  const a = hero(1, 'Alpha', 'Beta (sister); Gamma (possible son)', 'Cosmic Defenders', 'Alpha #1 (1962)');
  const b = hero(2, 'Beta', '', 'Cosmic Defenders');
  const c = hero(3, 'Gamma', '', 'Cosmic Defenders');
  const graph = buildUniverseGraph([a, b, c]);
  assert.equal(graph.relationships.find((edge) => edge.to === 2 && edge.kind === 'sibling')?.evidence, 'explicit');
  assert.equal(graph.relationships.some((edge) => edge.kind === 'child' && edge.to === 3), false);
  assert.equal(graph.relationships.find((edge) => edge.kind === 'team')?.evidence, 'inferred');
  assert.equal(graph.events.find((event) => event.id === 'appearance:1')?.publicationYear, 1962);
});

test('wiki chapter order is retained without inventing dates', () => {
  const a = hero(1, 'Alpha', '', '');
  const b = hero(2, 'Beta', '', '');
  const bio = { pageUrl: 'https://example.test/alpha', family: [{ label: 'Parents', items: ['Beta (father)'] }], facts: [], history: [{ title: 'Origin', text: 'Source text' }] };
  const graph = buildUniverseGraph([a, b], new Map([[1, bio]]));
  assert.equal(graph.relationships.find((edge) => edge.kind === 'parent')?.sourceUrl, bio.pageUrl);
  const chapter = graph.events.find((event) => event.kind === 'history-chapter');
  assert.equal(chapter.order, 0);
  assert.equal(chapter.publicationYear, undefined);
  assert.deepEqual(splitSourceList('Beta (father, deceased); Gamma (sibling)'), ['Beta (father, deceased)', 'Gamma (sibling)']);
});

test('an Earth tag alone is not treated as an alternate-universe relationship', () => {
  const graph = buildUniverseGraph([
    hero(1, 'Alpha', 'Beta (Earth-616, daughter)', ''),
    hero(2, 'Beta', '', ''),
  ]);
  assert.equal(graph.relationships.find((edge) => edge.evidence === 'explicit')?.kind, 'child');
  assert.equal(graph.relationships.some((edge) => edge.kind === 'alternate'), false);
});

test('genetic template and shared bite are origin links, never family links', () => {
  const spider = hero(1, 'Spider-Man', '', '');
  spider.biography.fullName = 'Peter Parker';
  const graph = buildUniverseGraph([
    spider,
    hero(2, 'Silk', 'Spider-Man (Peter Parker, bit by same spider)', ''),
    hero(3, 'Scarlet Spider II', 'Peter Parker (Spider-Man, genetic template)', ''),
  ]);
  const spiderLinks = graph.relationships.filter((edge) => edge.to === 1 || edge.from === 1);
  assert.equal(spiderLinks.length, 2);
  assert.ok(spiderLinks.every((edge) => edge.kind === 'origin' && edge.evidence === 'explicit'));
});

test('membership wording resolves to the same team without treating people as teams', () => {
  assert.deepEqual(teamNames('Member of the Avengers; formerly member of Outlaws'), ['Avengers', 'Outlaws']);
  const graph = buildUniverseGraph([
    hero(1, 'Alpha', '', 'Member of the Avengers, Beta'),
    hero(2, 'Beta', '', 'Avengers'),
  ]);
  assert.equal(graph.relationships.filter((edge) => edge.kind === 'team').length, 1);
});
