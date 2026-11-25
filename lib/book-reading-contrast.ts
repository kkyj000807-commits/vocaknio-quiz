import lessons from '@/data/book-reading-contrasts.json';
import type { BookEntry } from './book-edition';

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
