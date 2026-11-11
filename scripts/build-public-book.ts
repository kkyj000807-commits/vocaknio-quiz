// Explicit 2026-11-11 owner authorization: publish study content, not PDF or learner data.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { inspectEncryptedBookPackage, revisedBookEdition, REVISED_BOOK_PDF_HASH } from '../lib/encrypted-book-package';
import { activateRevisedBook, createIntegratedWordbook, selectBookOrderedItems } from '../lib/integrated-wordbook';
import { WORDBOOK_VOCAB, getStudyVocab, getVocabItem } from '../lib/vocab';
import type { BookEdition, BookEntry } from '../lib/book-edition';

async function main() {
  const base = fs.readFileSync('analysis/book-edition-v1.5/current.json', 'utf8');
  const revision = fs.readFileSync('C:/Users/USER/Projects/파이널_단어장/data/edition_20261111_idiom_v1_7_3_content_closure/learning_projection.json', 'utf8');
  const verified = await inspectEncryptedBookPackage(new TextEncoder().encode(JSON.stringify({ schema: 2, edition: '1.7.4', pdfSha256: REVISED_BOOK_PDF_HASH, base, revision })));
  const current = revisedBookEdition(verified);
  const original = createIntegratedWordbook(WORDBOOK_VOCAB, verified.base);
  const currentIds = new Set(createIntegratedWordbook(WORDBOOK_VOCAB, current).map(item => item.id));
  const historicalIds = new Set(original.filter(item => item.book && !currentIds.has(item.id)).map(item => item.book!.id));
  // Explicit projection: no source envelopes, filesystem paths, PDFs or browser records.
  const entry = (row: BookEntry): BookEntry => ({ id: row.id, order: row.order, section: row.section,
    word: row.word, appIds: row.appIds, concept: row.concept, chunk: row.chunk, chapter: row.chapter,
    automaticGrading: row.automaticGrading, display: row.display, pronunciation: row.pronunciation,
    gradingReview: row.gradingReview, ...(row.printedNumber === undefined ? {} : { printedNumber: row.printedNumber }) });
  const project = (book: BookEdition, rows: BookEntry[]): BookEdition => ({ schema: book.schema,
    edition: book.edition, datasetSha256: book.datasetSha256, pdfSha256: book.pdfSha256,
    canonicalSha256: book.canonicalSha256, privateContent: true, // existing full-content adapter flag, not an access policy
    marker: 'FINETUNE_PUBLIC_STUDY_CONTENT', sections: book.sections,
    sourceCounts: Object.fromEntries(book.sections.map(section => [section, rows.filter(row => row.section === section).length])), entries: rows.map(entry) });
  const payload = { schema: 1, distribution: 'public-study',
    current: project(current, current.entries),
    historical: project(verified.base, verified.base.entries.filter(row => historicalIds.has(row.id))) };
  activateRevisedBook(payload.historical, payload.current);
  assert.equal(selectBookOrderedItems(getStudyVocab()).length, 17906);
  for (const row of original) assert.equal(getVocabItem(row.num)?.id, row.id);
  const bytes = Buffer.from(JSON.stringify(payload));
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const file = `book-1.7.4-${sha256.slice(0, 16)}.json`;
  fs.mkdirSync('public/data/book', { recursive: true });
  fs.writeFileSync(`public/data/book/${file}`, bytes);
  fs.writeFileSync('assets/public-book-manifest.json', JSON.stringify({ schema: 1, edition: '1.7.4',
    distribution: 'public-study', file: `data/book/${file}`, sha256, bytes: bytes.length,
    entries: current.entries.length, sourceCounts: current.sourceCounts,
    historicalEntries: payload.historical.entries.length, pdfSha256: REVISED_BOOK_PDF_HASH }) + '\n');
  console.log(JSON.stringify({ status: 'PASS', sha256, bytes: bytes.length, entries: 17906,
    historicalEntries: payload.historical.entries.length, retainedIds: original.length, learnerWrites: 0 }));
}
void main();
