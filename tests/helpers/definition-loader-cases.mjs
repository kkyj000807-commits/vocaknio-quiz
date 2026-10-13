import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Execute the real, small loader with isolated network/index dependencies.
// Both native and Vitest adapters use these same assertions; no app corpus or
// learner storage is loaded. Transpilation is not a substitute for typecheck.
function loader(responses, pathname = '/vocaknio-quiz/quiz') {
  const calls = [];
  const entry = { headword: 'test', status: 'single_sense', representativeSenseId: 'test:n:1', senses: [{ senseId: 'test:n:1', partOfSpeech: 'n', definition: 'a test' }] };
  const healthy = { version: 'test', group: 'V101', items: { row: 'test' }, headwords: { test: entry } };
  const source = fs.readFileSync(new URL('../../lib/vocab-definitions.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: name => {
      if (name === '@/assets/vocab-definitions-oewn-2025.json') return { default: { version: 'test', coverage: {}, source: {} } };
      if (name === '@/lib/vocab') return { VOCAB_BY_ID: new Map([['row', { group: 'V101' }], ['other-row', { group: 'V101' }]]) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    window: { document: {}, location: { pathname } },
    fetch: async (...args) => {
      calls.push(args);
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response ?? { ok: true, json: async () => healthy };
    },
  }, { filename: 'lib/vocab-definitions.ts' });
  return { load: exports.loadVocabDefinition, calls, entry, healthy };
}

export const definitionLoaderCases = [
  ['a cached null pointer map cannot permanently poison subsequent retries', async () => {
    const api = loader([{ ok: true, json: async () => ({ version: 'test', group: 'V101', items: null, headwords: {} }) }]);
    await assert.rejects(api.load('row'));
    assert.deepEqual(await api.load('row'), api.entry);
    assert.equal(api.calls.length, 2);
  }],
  ...['null-items', 'null-headwords', 'array-items', 'array-headwords', 'wrong-group', 'null-root'].map(kind => [
    `invalid ${kind} is rejected before caching; a healthy retry recovers`, async () => {
      const payload = { version: 'test', group: 'V101', items: { row: 'test' }, headwords: {} };
      if (kind === 'null-items') payload.items = null;
      if (kind === 'null-headwords') payload.headwords = null;
      if (kind === 'array-items') payload.items = [];
      if (kind === 'array-headwords') payload.headwords = [];
      if (kind === 'wrong-group') payload.group = 'V201';
      const api = loader([{ ok: true, json: async () => kind === 'null-root' ? null : payload }]);
      await assert.rejects(api.load('row'), /판본/);
      assert.deepEqual(await api.load('row'), api.entry);
      assert.equal(api.calls.length, 2);
    },
  ]),
  ['HTTP/network/version failures can be retried without retaining a rejected promise', async () => {
    for (const bad of [new Error('offline'), { ok: false, status: 503 }, { ok: true, json: async () => ({ version: 'old' }) }]) {
      const api = loader([bad]);
      await assert.rejects(api.load('row'));
      assert.deepEqual(await api.load('row'), api.entry);
      assert.equal(api.calls.length, 2);
    }
  }],
  ['successful and simultaneous requests share one fetch, revalidating the preserved Pages URL', async () => {
    const api = loader([]);
    const [first, second] = await Promise.all([api.load('row'), api.load('row')]);
    assert.deepEqual(first, api.entry);
    assert.deepEqual(second, api.entry);
    await api.load('row');
    assert.equal(api.calls.length, 1);
    assert.equal(api.calls[0][0], '/vocaknio-quiz/data/vocab-definitions/test/v101.json');
    assert.equal(api.calls[0][1].cache, 'no-cache');
  }],
  ['unknown rows and absent pointers are safe empty results, not invented definitions', async () => {
    const api = loader([]);
    assert.equal(await api.load('unknown'), null);
    assert.equal(api.calls.length, 0);
    assert.equal(await api.load('other-row'), null);
    assert.equal(api.calls.length, 1);
  }],
];

function auditFixture() {
  const hash = '7d749f6e2c39e6970e4997839dcf6e42fd281f3c2fae0171d2192bae8cfa4b51';
  const groups = ['V101', 'V201', 'V301', 'V401', 'V501', 'V502', 'V601', 'APPENDIX'];
  const files = {
    'vocab-v1.4.json': [{ id: 'row', group: 'V101' }],
    'vocab-definitions-oewn-2025.json': { version: 'oewn-2025', source: { archiveSha256: hash, license: 'CC BY 4.0' }, coverage: { totalRows: 1, matchedRows: 1, singleSenseRows: 1, ambiguousRows: 0, aliasMatchedRows: 0, sourceNotFoundRows: 0, referenceExampleHeadwords: 0, referenceExampleSenses: 0, referenceExampleRows: 0, reviewedExampleTranslations: 0 } },
  };
  for (const group of groups) files[`${group.toLowerCase()}.json`] = { version: 'oewn-2025', group, source: { archiveSha256: hash }, items: {}, headwords: {} };
  files['v101.json'].items.row = 'test';
  files['v101.json'].headwords.test = { status: 'single_sense', representativeSenseId: 's1', senses: [{ senseId: 's1', partOfSpeech: 'n', definition: 'a test', examples: [] }] };
  return files;
}

function audit(files) {
  const url = new URL('../../scripts/audit-vocab-definitions.mjs', import.meta.url);
  const code = fs.readFileSync(url, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.url', JSON.stringify(url.href));
  let output;
  vm.runInNewContext(code, {
    fs: { readFileSync: name => JSON.stringify(files[path.basename(name)]) }, path, fileURLToPath,
    console: { log: value => { output = JSON.parse(value); } },
  }, { filename: 'scripts/audit-vocab-definitions.mjs' });
  return output;
}

export const definitionAuditCases = [
  ['indexed source lookup preserves coverage and status counts', () => {
    assert.deepEqual(audit(auditFixture()), { status: 'PASS', version: 'oewn-2025', totalRows: 1, matchedRows: 1, safeSingleSenseRows: 1, ambiguousReviewRows: 0, aliasReviewRows: 0, sourceNotFoundRows: 0, referenceExampleHeadwords: 0, referenceExampleRows: 0, reviewedExampleTranslations: 0 });
  }],
  ['indexed audit still rejects unknown/wrong/duplicate/missing rows, broken pointers and invalid senses', () => {
    const mutations = [
      [files => { files['v101.json'].items.unknown = 'test'; }, /Unknown vocabulary/],
      [files => { files['vocab-v1.4.json'][0].group = 'V201'; }, /wrong group/],
      [files => { files['v201.json'].items.row = 'test'; }, /Duplicate vocabulary/],
      [files => { delete files['v101.json'].items.row; }, /cover every row/],
      [files => { files['v101.json'].items.row = 'missing'; }, /pointer is broken/],
      [files => { files['v101.json'].headwords.test.senses = []; }, /exactly one sense/],
      [files => { files['v101.json'].headwords.test.senses[0].partOfSpeech = ''; }, /Incomplete OEWN/],
      [files => { files['vocab-definitions-oewn-2025.json'].coverage.singleSenseRows = 2; }, /singleSenseRows mismatch/],
      [files => { files['v101.json'].headwords.test.senses[0].examples = ["{'text': 'not English'}"]; }, /Malformed source example/],
      [files => { files['v101.json'].headwords.test.senses[0].reviewedExamples = [{ en: 'not in this sense', ko: '번역', cueKo: '단서' }]; }, /Unlinked example translation/],
    ];
    for (const [mutate, error] of mutations) { const files = auditFixture(); mutate(files); assert.throws(() => audit(files), error); }
  }],
];
