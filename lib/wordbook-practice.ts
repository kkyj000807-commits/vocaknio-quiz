import { bookStudyDetails } from '@/lib/book-edition';
import { excludeFullyMasteredItems } from '@/lib/canonical-learning';
import type { SenseLearningState } from '@/lib/learning-state';
import { getRangeItems, WORDBOOK_RANGES, type QuizMode } from '@/lib/vocab';

/** A filter, not another vocabulary/learning store or a truncated ID snapshot. */
export type WordbookPracticeScope = {
  rangeId: string;
  concept: string;
  query: string;
  bookmarksOnly: boolean;
  includeMastered: boolean;
};

export function buildWordbookPracticeHref(scope: WordbookPracticeScope, mode: QuizMode, count: number) {
  // Expo Router exposes the URL fragment as params['#']. Fragments remain on
  // the device: a reload must not send private search/concept text to Pages.
  return `/quiz?mode=${encodeURIComponent(mode)}&count=${count}&rangeId=${encodeURIComponent(scope.rangeId)}&choiceLang=korean#${encodeURIComponent(`wordbook:${JSON.stringify(scope)}`)}`;
}

export function parseWordbookPracticeScope(encoded: string): WordbookPracticeScope {
  const value: unknown = JSON.parse(encoded);
  if (!value || typeof value !== 'object') throw new Error('Invalid wordbook selection');
  const scope = value as Partial<WordbookPracticeScope>;
  if (typeof scope.rangeId !== 'string' || !WORDBOOK_RANGES.some(range => range.id === scope.rangeId)
    || typeof scope.concept !== 'string' || typeof scope.query !== 'string'
    || typeof scope.bookmarksOnly !== 'boolean' || typeof scope.includeMastered !== 'boolean') {
    throw new Error('Invalid wordbook selection');
  }
  return { rangeId: scope.rangeId, concept: scope.concept, query: scope.query,
    bookmarksOnly: scope.bookmarksOnly, includeMastered: scope.includeMastered };
}

/** Shared by the list and quiz. Empty/invalid selections must never become all. */
export function getWordbookPracticeItems(scope: WordbookPracticeScope, bookmarks: ReadonlySet<number>, learningState: SenseLearningState | null) {
  const range = WORDBOOK_RANGES.find(range => range.id === scope.rangeId);
  if (!range) throw new Error('Unknown wordbook section');
  let items = getRangeItems(range);
  if (scope.concept) items = items.filter(item => (item.book?.concept ?? item.conceptLabel) === scope.concept);
  const query = scope.query.trim().toLowerCase();
  if (query) items = items.filter(item => [item.w, item.k, item.conceptLabel, item.majorConceptLabel, item.book?.chunk ?? '',
    ...item.s, ...(item.book ? bookStudyDetails(item.book).map(note => note.text) : [])]
    .some(text => text.toLowerCase().includes(query)));
  if (!scope.includeMastered && learningState) {
    const masteredKeys = new Set(Object.values(learningState.targets).filter(target => target.status === 'MASTERED').map(target => target.key));
    items = excludeFullyMasteredItems(items, masteredKeys);
  }
  if (scope.bookmarksOnly) items = items.filter(item => bookmarks.has(item.num));
  return items;
}
