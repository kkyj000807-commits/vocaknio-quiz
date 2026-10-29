import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { approvedSharedEntries, readShared, sha, validateSharedLinks } from '../scripts/shared-learning';
import { isSharedSenseLinks, sharedLinkMatches, SHARED_LINK_SCHEMA, type LearningEntry } from '../lib/vocab-learning';

function fixture() {
  const index = JSON.parse(fs.readFileSync('assets/vocab-learning-index-v1.4.json', 'utf8'));
  const group = Object.values(index.items)[0] as { group: string };
  const data = JSON.parse(fs.readFileSync(`public/data/vocab-learning/${index.version}/${group.group.toLowerCase()}.json`, 'utf8'));
  const row = data.entries[0] as LearningEntry;
  const link = { itemId: row.itemIds[0], senseId: row.senseId, bookEntryId: 'stable-source',
    headword: row.headword, bookOriginalGloss: '원문은 별도', definitionKo: row.definitionKo,
    definitionEn: row.definitionEn, partOfSpeech: row.partOfSpeech, exampleEn: row.example.en, exampleKo: row.example.ko };
  const sharedLinks = { schema: SHARED_LINK_SCHEMA, contentVersion: index.version, sourceSha256: 'a'.repeat(64), review: 'existing approval', links: [link] };
  const occurrences = row.itemIds.map((id, num) => ({ id, num, w: row.headword, k: '원뜻', p: '', group: 'V101' }));
  return { row, link, sharedLinks, occurrences, version: index.version };
}

it('reuses real approved entries without dropping fields and rejects broken links/status', () => {
  const index = JSON.parse(fs.readFileSync('assets/vocab-learning-index-v1.4.json', 'utf8'));
  const group = Object.values(index.items)[0] as { group: string };
  const data = JSON.parse(fs.readFileSync(`public/data/vocab-learning/${index.version}/${group.group.toLowerCase()}.json`, 'utf8'));
  const row = data.entries[0];
  const ids = new Set<string>(row.itemIds);
  expect(approvedSharedEntries([row], ids)[0]).toBe(row);
  expect(() => approvedSharedEntries([{ ...row, definitionStatus: 'candidate' }], ids)).toThrow();
  expect(() => approvedSharedEntries([row], new Set())).toThrow();
  expect(() => approvedSharedEntries([row, row], ids)).toThrow();
  expect(approvedSharedEntries([{ ...row, unknownPreservedField: false }], ids)[0]).toHaveProperty('unknownPreservedField', false);
});

it('rejects changed bytes and unsupported schema without touching the previous export', () => {
  const { row, sharedLinks, occurrences, version } = fixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finetune-shared-'));
  const raw = JSON.stringify({ schema: 1, adapterVersion: 3, contentVersion: version, entries: [row], occurrences, sharedLinks });
  fs.writeFileSync(path.join(directory, 'shared.json'), raw);
  const artifacts = { 'print-supplement.csv': sha(''), 'book-linked-supplement.html': sha('') };
  for (const name of Object.keys(artifacts)) fs.writeFileSync(path.join(directory, name), '');
  const manifest = { schema: 1, adapterVersion: 3, contentVersion: version, sha256: sha(raw),
    bookSourceSha256: sharedLinks.sourceSha256, rows: occurrences.length, senses: 1, exportOccurrences: 1, artifacts };
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  expect(readShared(directory).entries).toEqual([row]);
  fs.writeFileSync(path.join(directory, 'shared.json'), raw + ' ');
  expect(() => readShared(directory)).toThrow('hash');
  fs.writeFileSync(path.join(directory, 'shared.json'), raw);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schema: 2 }));
  expect(() => readShared(directory)).toThrow('schema');
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(directory, 'print-supplement.csv'), 'partial update');
  expect(() => readShared(directory)).toThrow('artifact hash');
  expect(fs.readFileSync(path.join(directory, 'shared.json'), 'utf8')).toBe(raw);
});

it('preserves separate occurrences but rejects contradictory explanation for one sense', () => {
  const { row } = fixture();
  const other = { ...row, id: row.id + '-other', group: 'V201' };
  expect(approvedSharedEntries([row, other], new Set(row.itemIds))).toEqual([row, other]);
  expect(() => approvedSharedEntries([row, { ...other, definitionKo: '상충하는 뜻' }], new Set(row.itemIds))).toThrow('Conflicting');
});

it('binds links to POS, definitions and both examples, not only headword text', () => {
  const { row, link, sharedLinks, occurrences } = fixture();
  expect(validateSharedLinks(sharedLinks, [row], occurrences)).toBe(sharedLinks);
  for (const field of ['definitionKo', 'definitionEn', 'partOfSpeech', 'exampleEn', 'exampleKo'] as const) {
    expect(sharedLinkMatches(row, { ...link, [field]: '다른 값' })).toBe(false);
    expect(() => validateSharedLinks({ ...sharedLinks, links: [{ ...link, [field]: '다른 값' }] }, [row], occurrences)).toThrow('Stale');
  }
  expect(isSharedSenseLinks({ ...sharedLinks, links: [...sharedLinks.links, link] })).toBe(false);
  expect(isSharedSenseLinks({ ...sharedLinks, sourceSha256: 'broken' })).toBe(false);
  expect(isSharedSenseLinks({ ...sharedLinks, schema: 999 })).toBe(false);
  expect(() => validateSharedLinks(sharedLinks, [row], [])).toThrow('Stale');
});
