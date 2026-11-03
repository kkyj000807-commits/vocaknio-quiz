/** Read-only audit of the pinned private file; outputs counts, never book prose. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { inspectLocalBook } from '../lib/local-book-file';
import { createIntegratedWordbook, selectBookOrderedItems } from '../lib/integrated-wordbook';
import { VOCAB, WORDBOOK_VOCAB, getVocabItem, registerStudyItems } from '../lib/vocab';
import { arrangeWordbook } from '../lib/wordbook-display';
import { buildQuizQuestions } from '../lib/quiz-engine';
import { createHash } from 'node:crypto';

async function main() {
  const edition = await inspectLocalBook(fs.readFileSync(process.argv[2], 'utf8'));
  const original = JSON.stringify(VOCAB);
  const rows = createIntegratedWordbook(WORDBOOK_VOCAB, edition);
  const bookRows = rows.filter(item => item.book);
  const printed = selectBookOrderedItems(rows);
  assert.equal(printed.length, edition.entries.length);
  assert.deepEqual(printed.map(item => item.book!.id), edition.entries.map(entry => entry.id));
  for (const section of edition.sections) assert.equal(printed.filter(item => item.book!.section === section).length, edition.sourceCounts[section]);
  assert.equal(selectBookOrderedItems(rows, true).length, rows.length);
  assert.deepEqual(bookRows.map(item => item.book!.id), edition.entries.map(entry => entry.id));
  assert.equal(new Set(rows.map(item => item.id)).size, rows.length);
  assert.equal(new Set(rows.map(item => item.num)).size, rows.length);
  const retainedIds = new Set(rows.map(row => row.id));
  for (const item of VOCAB) assert(retainedIds.has(item.id), 'Original ID missing');
  assert.equal(JSON.stringify(VOCAB), original);
  const display = arrangeWordbook(rows, () => '', true);
  const representedBookIds = new Set(display.flatMap(item => [item, ...(item.displayDuplicates ?? [])]).filter(item => item.book).map(item => item.book!.id));
  assert.equal(representedBookIds.size, edition.entries.length);
  const represented = new Set(display.flatMap(item => item.displaySourceIds!));
  assert(rows.every(item => represented.has(item.id)));
  registerStudyItems(rows);
  for (const item of rows.filter(row => row.localBook)) {
    assert.equal(getVocabItem(item.num), item);
    assert.equal(buildQuizQuestions({ mode: 'flashcard', itemNums: [item.num], count: 1 }).length, 1);
    assert.equal(buildQuizQuestions({ mode: 'kor-choice', itemNums: [item.num], count: 1 }).length, 0);
  }
  assert.equal(createHash('sha256').update(fs.readFileSync('assets/vocab-v1.4.json')).digest('hex'), edition.canonicalSha256);
  console.log(JSON.stringify({ status: 'PASS_SOURCE_ID_UI_LEARNING_CONTRACT', originalRows: VOCAB.length,
    bookRows: bookRows.length, printedListRows: printed.length, printedOrderExact: true, sections: edition.sourceCounts,
    spellingLinked: edition.entries.filter(entry => entry.appIds.length).length,
    spellingUnlinked: edition.entries.filter(entry => !entry.appIds.length).length,
    newStableLearningItems: rows.filter(row => row.localBook).length,
    exactExistingDisplayBindings: bookRows.filter(row => !row.localBook).length,
    combinedRows: rows.length, displayRows: display.length, exactDisplayFolds: rows.length - display.length,
    inaccessibleBookRows: 0, originalIdsPreserved: VOCAB.length, learnerWrites: 0,
    automaticAnswerPromotions: 0, semanticApproval: false }));
}
void main();
