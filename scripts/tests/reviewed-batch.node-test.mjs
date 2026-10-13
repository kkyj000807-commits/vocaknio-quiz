import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const batch = read('data/vocab-learning/reviewed-batch-20261014.json');
const index = read('assets/vocab-learning-index-v1.4.json');
const release = read('release.config.json');
const vocab = new Map(read('assets/vocab-v1.4.json').map(row => [row.id, row]));
const directory = `public/data/vocab-learning/${release.version}`;
const entries = fs.readdirSync(directory).filter(name => /^v\d+\.json$|^appendix\.json$/.test(name))
  .flatMap(name => read(path.join(directory, name)).entries);

test('counts unique senses, not duplicated group export entries', () => {
  assert.equal(index.coverage.senses, new Set(entries.map(e => e.senseId)).size);
  assert.equal(index.coverage.headwords, new Set(entries.map(e => e.headword.toLowerCase())).size);
  assert.equal(index.coverage.exportEntries, entries.length);
});

test('every approved row resolves to its exact bilingual lesson through the existing loader index', () => {
  for (const source of batch) {
    for (const id of source.itemIds) {
      assert.equal(vocab.get(id)?.w.toLowerCase(), source.headword);
      assert.ok(index.items[id]?.entryIds.includes(source.id), `${id}: missing lesson pointer`);
      const payload = read(path.join(directory, `${index.items[id].group.toLowerCase()}.json`));
      const actual = payload.entries.find(e => e.id === source.id);
      assert.equal(actual.senseId, source.senseId);
      assert.deepEqual(actual.example, source.example);
      assert.deepEqual(actual.relationMeaningsKo, source.relationMeaningsKo);
      assert.equal(actual.definitionKo, source.definitionKo);
    }
  }
});

test('batch keeps meanings, original examples, provenance and short individual relation glosses', () => {
  assert.equal(batch.length, 15);
  assert.equal(new Set(batch.map(e => e.senseId)).size, 15);
  assert.equal(new Set(batch.map(e => e.example.en)).size, 15);
  for (const entry of batch) {
    assert.equal(entry.definitionKind, 'editorial');
    assert.equal(entry.example.kind, 'editorial');
    assert.ok(entry.example.ko && entry.example.cueKo && entry.examTrapKo && entry.usageKo);
    assert.ok(new Set(entry.sources.map(s => s.independenceGroup)).size >= 2);
    assert.ok(entry.sources.every(s => s.role === 'reference'));
    for (const word of [...entry.exactSynonyms, ...entry.nearSynonyms]) {
      const gloss = entry.relationMeaningsKo[word];
      assert.ok(gloss && gloss.length <= 24, `${entry.headword}/${word}: short gloss`);
      assert.notEqual(gloss, entry.definitionKo);
    }
  }
});

test('uncertain original glosses are not silently promoted with approved rows', () => {
  const approved = new Set(batch.flatMap(e => e.itemIds));
  for (const id of ['JBKROW001265', 'JBKROW002114', 'JBKROW001825', 'JBKROW002111', 'JBKROW017652', 'JBKROW020684']) {
    assert.ok(!approved.has(id));
  }
});
