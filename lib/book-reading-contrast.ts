import lessons from '@/data/book-reading-contrasts.json';
import type { BookEntry } from './book-edition';
import type { VocabItem } from './vocab';

// Match the printed sense as well as the ID: historical or edited imports must
// not inherit a contrast solely because they reuse a headword or a number.
const index = new Map(lessons.flatMap(lesson => lesson.targets.map(target =>
  [target.id, { target, lesson }] as const)));

export function bookReadingContrast(entry: BookEntry) {
  const match = index.get(entry.id);
  if (!match || entry.historical || match.target.word !== entry.word ||
      match.target.section !== entry.section || match.target.meaning !== entry.display?.meaning_display) return undefined;
  return match.lesson;
}

// Quiz snapshots can carry the original vocabulary row without its printed-book wrapper.
// Reuse the printed contrast only on these exact V101 occurrences, never by spelling alone.
const quizTargets = new Map([
  ['JBKROW000099', 'study-00084'], ['JBKROW000100', 'study-00085'],
  ['JBKROW000303', 'study-00275'], ['JBKROW000304', 'study-00276'],
]);
export function quizReadingContrast(item: VocabItem) {
  const id = quizTargets.get(item.id);
  const match = id && index.get(id);
  if (!match || item.group !== match.target.section || item.w !== match.target.word || item.k !== match.target.meaning) return undefined;
  if (item.book && (item.book.id !== id || bookReadingContrast(item.book) !== match.lesson)) return undefined;
  return match.lesson;
}
