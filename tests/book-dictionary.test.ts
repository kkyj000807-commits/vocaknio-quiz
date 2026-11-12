import fs from 'node:fs';
import crypto from 'node:crypto';
import { expect, it } from 'vitest';
import { createIntegratedWordbook } from '@/lib/integrated-wordbook';
import { WORDBOOK_VOCAB } from '@/lib/vocab';

const read = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const manifest = read('assets/public-book-manifest.json');
const book = read('public/' + manifest.file).current;
const index = read('public/data/book-dictionary/oewn-2025/index.json');
const shards = new Map<string, any>();
const norm = (s: string) => s.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
function reference(word: string) {
  const shard = index.headwords[norm(word)];
  if (!shard) return null;
  if (!shards.has(shard)) shards.set(shard, read(`public/data/book-dictionary/oewn-2025/${shard}.json`));
  return shards.get(shard).headwords[norm(word)];
}

it('covers the complete active book with honest reference counts and a pinned source', () => {
  expect(index.bookSha256).toBe(manifest.sha256);
  expect(crypto.createHash('sha256').update(fs.readFileSync('public/'+manifest.file)).digest('hex')).toBe(manifest.sha256);
  expect(index.source.license).toBe('CC BY 4.0');
  const rows = book.entries.map((e: any) => reference(e.word));
  expect(rows.length).toBe(17906);
  expect(rows.filter(Boolean).length).toBe(index.coverage.referenceRows);
  expect(rows.filter((r: any)=>r?.senses.some((s: any)=>s.examples.length)).length).toBe(index.coverage.exampleRows);
  expect(rows.filter(Boolean).length).toBeGreaterThan(12000);
  for (const [word, shard] of Object.entries(index.headwords)) {
    expect(shard).toMatch(/^[0-9a-f]$/);
    const entry=reference(word);
    expect(norm(entry.headword)).toBe(word);
    expect(entry.referenceOnly).toBe(true);
    expect(entry.senses.length).toBeGreaterThan(0);
    for(const sense of entry.senses) {
      expect(sense.definition.trim()).not.toBe('');
      expect(sense.senseId).toBeTruthy();
      expect(sense.synsetId).toBeTruthy();
      expect(Array.isArray(sense.synsetMembers)).toBe(true);
      for(const example of sense.reviewedExamples) expect(sense.examples).toContain(example.en);
    }
  }
});

it('reaches new book IDs without changing identity or merging the two boilerplate senses', () => {
  const calumny=createIntegratedWordbook(WORDBOOK_VOCAB,book).find(x=>x.book && x.w==='calumny')!;
  expect(calumny.id).toBe('book:v1.5:study-00028');
  expect(reference(calumny.w).senses.length).toBeGreaterThan(0);
  const senses=reference('boilerplate').senses;
  expect(senses.some((s:any)=>s.definition.includes('legal documents'))).toBe(true);
  expect(senses.some((s:any)=>s.definition.includes('plate iron'))).toBe(true);
  expect(new Set(senses.map((s:any)=>s.synsetId)).size).toBe(senses.length);
  const quiz=read('assets/vocab-definition-quiz-oewn-2025.json');
  expect(quiz.items[calumny.id]).toBeUndefined();
});
