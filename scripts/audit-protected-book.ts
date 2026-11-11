// Local-only, read-only acceptance: never prints private words or learner data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { inspectEncryptedBookPackage, revisedBookEdition, REVISED_BOOK_PDF_HASH } from '../lib/encrypted-book-package';
import { activateRevisedBook, createIntegratedWordbook, selectBookOrderedItems } from '../lib/integrated-wordbook';
import { WORDBOOK_VOCAB, getStudyVocab, getVocabItem } from '../lib/vocab';
import { buildQuizQuestions, validateQuestion } from '../lib/quiz-engine';

async function main() {
  const base = fs.readFileSync('analysis/book-edition-v1.5/current.json', 'utf8');
  const revision = fs.readFileSync('C:/Users/USER/Projects/파이널_단어장/data/edition_20261111_idiom_v1_7_3_content_closure/learning_projection.json', 'utf8');
  const payload = new TextEncoder().encode(JSON.stringify({ schema: 2, edition: '1.7.4', pdfSha256: REVISED_BOOK_PDF_HASH, base, revision }));
  const verified = await inspectEncryptedBookPackage(payload);
  const before = JSON.stringify(verified.base);
  const edition = revisedBookEdition(verified);
  assert.equal(edition.entries.length, 17906);
  assert.equal(edition.sourceCounts.V301, 2501);
  assert.equal(edition.sourceCounts['숙어'], 5789);
  const original = createIntegratedWordbook(WORDBOOK_VOCAB, verified.base);
  activateRevisedBook(verified.base, edition);
  const current = selectBookOrderedItems(getStudyVocab());
  assert.equal(current.length, 17906);
  const idioms = current.filter(row => row.book?.section === '숙어');
  for (const [i, row] of idioms.entries()) {
    const source = verified.revision[i];
    assert.equal(row.book?.id, source.id);
    assert.equal(row.w, source.headword);
    assert.equal(row.k, source.meaning_display);
    assert.equal(row.p, source.ipa);
    assert.equal(row.book?.pronunciation?.korean_pronunciation, source.korean_pronunciation);
    assert.equal(row.book?.printedNumber, i + 1);
  }
  for (const row of original) assert.equal(getVocabItem(row.num)?.id, row.id);
  assert.equal(JSON.stringify(verified.base), before);
  const questions = buildQuizQuestions({ mode: 'flashcard', count: 10, itemNums: idioms.slice(0, 10).map(row => row.num) });
  assert.equal(questions.length, 10);
  for (const q of questions) assert.equal(validateQuestion(q), true);
  console.log(JSON.stringify({ status: 'PASS', edition: edition.edition, entries: current.length,
    volumeOne: 12117, idioms: idioms.length, retainedOriginalIds: original.length,
    contentChecks: 'all revised idiom words/glosses/IPA/Korean/order exact', flashcards: questions.length,
    sourceUnchanged: true, learnerWrites: 0 }));
}
void main();
