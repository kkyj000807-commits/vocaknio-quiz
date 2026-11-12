import { bookStudyDetails } from '@/lib/book-edition';
import { selectBookOrderedItems } from '@/lib/integrated-wordbook';
import { excludeFullyMasteredItems, getQuizLearningTargets } from '@/lib/canonical-learning';
import { getLearningTargetState, learningPriority, masteredTargetKeys, type SenseLearningState } from '@/lib/learning-state';
import { inspectQuizQuestions, type BuildQuizOptions, type QuizQuestion } from '@/lib/quiz-engine';
import { getRangeItems, getStudyVocab, QUIZ_MODES, WORDBOOK_RANGES, type QuizMode, type VocabItem } from '@/lib/vocab';

export function practiceMasteredKeys(state: SenseLearningState, includeMastered = false) {
  // Viewing the mastered list is not permission to resume its quiz targets.
  void includeMastered;
  return [...masteredTargetKeys(state)];
}

/** Current book rows only. Read-only projection, never a second progress store. */
export function getWordbookMasteryProgress(items: readonly VocabItem[], state: SenseLearningState) {
  const total = items.length;
  const remaining = excludeFullyMasteredItems(items, masteredTargetKeys(state)).length;
  const mastered = total - remaining;
  const percent = total === 0 ? 0 : remaining === 0 ? 100 : Math.min(99.99, Math.round(mastered / total * 10000) / 100);
  return { total, mastered, remaining, percent };
}

/** Section denominator ignores temporary search/bookmark/mastered-list filters. */
export function getWordbookScopeMasteryProgress(scope: Pick<WordbookPracticeScope, 'rangeId' | 'concept'>, state: SenseLearningState) {
  const items = getWordbookPracticeItems({ rangeId: scope.rangeId, concept: scope.concept, query: '',
    bookmarksOnly: false, includeMastered: true, includeLegacy: false }, new Set(), null);
  return getWordbookMasteryProgress(items, state);
}

/** Shared ranking identity: counts must follow the selector's existing dedup contract. */
export function practiceCandidate(item: VocabItem, mode: QuizMode, state: SenseLearningState, reviewKeys: string[] = []) {
  const ranked = getQuizLearningTargets(item, mode).filter(target => !reviewKeys.length || reviewKeys.includes(target.key))
    .map(target => ({ target, score: learningPriority(getLearningTargetState(state, target.key)) }))
    .sort((a, b) => b.score - a.score);
  const target = ranked[0] && getLearningTargetState(state, ranked[0].target.key);
  return { num: item.num, conceptId: item.conceptId, word: item.w, learningKey: ranked[0]?.target.key,
    learningPriority: ranked[0]?.score ?? 0, learningStatus: target?.status ?? 'NEW', lastStudiedAt: target?.lastStudiedAt ?? 0 };
}

/** Read-only preflight. No session, history, storage writes or automatic fallback. */
export async function inspectWordbookPractice(options: BuildQuizOptions, state: SenseLearningState,
  limit = Infinity, cancelled: () => boolean = () => false) {
  const questions = new Map<number, QuizQuestion>();
  const keys = new Set<string>();
  const words = new Set<string>();
  let visited = 0;
  for (const question of inspectQuizQuestions(options)) {
    if (cancelled()) return null;
    if (question) {
      const candidate = practiceCandidate(question.item, options.mode, state);
      const word = candidate.word.trim().toLowerCase().replace(/\s+/g, ' ');
      const key = candidate.learningKey?.trim() || word || `num:${candidate.num}`;
      if (!keys.has(key) && (!word || !words.has(word))) { keys.add(key); if (word) words.add(word); }
      questions.set(question.item.num, question);
      if (keys.size >= limit) break;
    }
    // Keep long, sparse/private sections responsive and cancel obsolete filters.
    if (++visited % 100 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return cancelled() ? null : { count: keys.size, questions };
}

/** A filter, not another vocabulary/learning store or a truncated ID snapshot. */
export type WordbookPracticeScope = {
  rangeId: string;
  concept: string;
  query: string;
  bookmarksOnly: boolean;
  includeMastered: boolean;
  includeLegacy?: boolean;
};

export function buildWordbookPracticeHref(scope: WordbookPracticeScope, mode: QuizMode, count: number) {
  // Expo Router exposes the URL fragment as params['#']. Fragments remain on
  // the device: a reload must not send private search/concept text to Pages.
  // Keep the entire request together: Expo can serialize a query after the hash
  // on reload, corrupting a mixed query/fragment request.
  return `/quiz#${encodeURIComponent(`wordbook:${JSON.stringify({ ...scope, mode, count })}`)}`;
}

export function parseWordbookPracticeRequest(encoded: string): WordbookPracticeScope & { mode: QuizMode; count: number } {
  const scope = parseWordbookPracticeScope(encoded);
  const value = JSON.parse(encoded);
  if (!QUIZ_MODES.some(option => option.id === value.mode)
    || !Number.isInteger(value.count) || value.count < 1 || value.count > 30) {
    throw new Error('Invalid wordbook study options');
  }
  return { ...scope, mode: value.mode, count: value.count };
}

export function parseWordbookPracticeScope(encoded: string): WordbookPracticeScope {
  const value: unknown = JSON.parse(encoded);
  if (!value || typeof value !== 'object') throw new Error('Invalid wordbook selection');
  const scope = value as Partial<WordbookPracticeScope>;
  if (typeof scope.rangeId !== 'string' || !WORDBOOK_RANGES.some(range => range.id === scope.rangeId)
    || typeof scope.concept !== 'string' || typeof scope.query !== 'string'
    || typeof scope.bookmarksOnly !== 'boolean' || typeof scope.includeMastered !== 'boolean'
    || (scope.includeLegacy !== undefined && typeof scope.includeLegacy !== 'boolean')) {
    throw new Error('Invalid wordbook selection');
  }
  return { rangeId: scope.rangeId, concept: scope.concept, query: scope.query,
    bookmarksOnly: scope.bookmarksOnly, includeMastered: scope.includeMastered,
    ...(scope.includeLegacy !== undefined ? { includeLegacy: scope.includeLegacy } : {}) };
}

/** Shared by the list and quiz. Empty/invalid selections must never become all. */
export function getWordbookPracticeItems(scope: WordbookPracticeScope, bookmarks: ReadonlySet<number>, learningState: SenseLearningState | null) {
  const range = WORDBOOK_RANGES.find(range => range.id === scope.rangeId);
  if (!range) throw new Error('Unknown wordbook section');
  let items = getRangeItems(range);
  const hasBook = getStudyVocab().some(item => item.book);
  // Historical IDs remain reachable in bookmark-only views, without combining records.
  items = selectBookOrderedItems(items, scope.includeLegacy || scope.bookmarksOnly, hasBook);
  if (hasBook && !scope.includeLegacy && range.kind === 'idioms') items = items.filter(item => item.book?.section === '숙어');
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
