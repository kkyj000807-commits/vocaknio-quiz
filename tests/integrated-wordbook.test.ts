import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createIntegratedWordbook, localBookIdentity } from '../lib/integrated-wordbook';
import { arrangeWordbook } from '../lib/wordbook-display';
import { VOCAB, WORDBOOK_VOCAB, getVocabItem, getRangeItems, RANGES, registerStudyItems, type VocabItem } from '../lib/vocab';
import { getItemLearningTargets, getQuestionLearningTargetKey } from '../lib/canonical-learning';
import { buildQuizQuestions, getQuizCandidateItems, validateQuestion } from '../lib/quiz-engine';
import { createEmptyQuestionViewState, parseQuizSession, isQuizSessionContentCurrent } from '../lib/quiz-session';
import type { BookEdition, BookEntry } from '../lib/book-edition';

const oldItem = (id: string, w: string, k: string): VocabItem => ({
  id, num: Number(id), sourceIndex: Number(id), sourceNumber: id, w, k, k_short: k, group: 'V101',
  p: '', category: 'V101', type: 'word', s: [], conceptId: '', conceptLabel: '', majorConceptLabel: '',
});
const book = (id: string, word: string, order: number, section = 'V101'): BookEntry => ({
  id, word, order, appIds: [], section, concept: '개념', chunk: '대표 뜻', chapter: null, automaticGrading: false,
  display: { meaning_display: '교재 ' + word, annotations: [], examples: [], patterns: [] },
});
const edition = (entries: BookEntry[]): BookEdition => ({ schema: 1, edition: '1.5', privateContent: true,
  datasetSha256: '', pdfSha256: '', canonicalSha256: '', entries, sections: ['V101', 'V301', '보카바이블 B', '숙어'], sourceCounts: {} });
afterEach(() => registerStudyItems(WORDBOOK_VOCAB));

describe('v1.5 uses existing vocabulary cards and learning contracts', () => {
  it('keeps every book row ordered and every distinct old meaning accessible, without changing inputs', () => {
    const original = [oldItem('1', 'second', '옛 뜻'), oldItem('2', 'first', '다른 뜻')];
    const source = edition([book('study-1', 'first', 1), book('study-2', 'new-word', 2), book('study-3', 'second', 3)]);
    const before = JSON.stringify([original, source]);
    const rows = createIntegratedWordbook(original, source);
    expect(rows.filter(row => row.book).map(row => row.w)).toEqual(['first', 'new-word', 'second']);
    expect(rows.filter(row => !row.book).map(row => row.id).sort()).toEqual(['1', '2']);
    expect(JSON.stringify([original, source])).toBe(before);
    expect(arrangeWordbook(rows, () => '', true).map(row => row.id)).toEqual(rows.map(row => row.id));
  });
  it('does not merge an alias, spelling-only link, different meaning, or editorial conflict', () => {
    const entry = book('study-1', 'crossroad', 1); entry.appIds = ['1']; entry.display!.approved_aliases = ['crossroads'];
    const rows = createIntegratedWordbook([oldItem('1', 'crossroads', entry.display!.meaning_display)], edition([entry]));
    expect(rows).toHaveLength(2);
    const same = book('study-2', 'first', 1); same.display!.meaning_display = '원뜻';
    expect(createIntegratedWordbook([oldItem('2', 'first', '원뜻')], edition([same]))[0].id).toBe('2');
    same.gradingReview = { status: 'requires_editorial_policy_review' };
    expect(createIntegratedWordbook([oldItem('2', 'first', '원뜻')], edition([same]))).toHaveLength(2);
  });
  it('keeps stable identities through reorder/filter and rejects collisions before registration', () => {
    const a = book('study-45', 'new', 1), b = book('study-46', 'other', 2, '보카바이블 B');
    const first = createIntegratedWordbook([], edition([a, b]));
    const reversed = createIntegratedWordbook([], edition([{ ...b, order: 1 }, { ...a, order: 2 }]));
    expect(first.map(row => [row.id, row.num]).sort()).toEqual(reversed.map(row => [row.id, row.num]).sort());
    expect(() => localBookIdentity({ id: 'unknown' })).toThrow();
    expect(() => createIntegratedWordbook([{ ...oldItem('1', 'old', '뜻'), num: first[0].num }], edition([a]))).toThrow();
    const originalObject = getVocabItem(VOCAB[0].num);
    registerStudyItems([...VOCAB, ...first]);
    expect(getVocabItem(VOCAB[0].num)).toBe(originalObject);
    expect(getRangeItems(RANGES.find(row => row.id === 'book-b')!)[0].id).toBe(first[1].id);
  });
  it('uses the common quiz/review/MASTER key without promoting unreviewed automatic answers', () => {
    const item = createIntegratedWordbook([], edition([book('study-912345', 'new-learning-fixture', 1, '보카바이블 B')]))[0];
    registerStudyItems([...VOCAB, item]);
    const key = getItemLearningTargets(item)[0].key;
    expect(key).toBe('book:v1.5:study-912345');
    const [q] = buildQuizQuestions({ mode: 'flashcard', itemNums: [item.num], count: 1 });
    expect(validateQuestion(q)).toBe(true);
    expect(getQuestionLearningTargetKey(q)).toBe(key);
    expect(getQuizCandidateItems({ mode: 'flashcard', rangeId: 'book-b', count: 10 }).map(row => row.num)).toContain(item.num);
    expect(buildQuizQuestions({ mode: 'kor-choice', itemNums: [item.num], count: 1 })).toEqual([]);
    expect(validateQuestion({ ...q, mode: 'kor-choice' })).toBe(false);
    const session = { schema: 1 as const, requestKey: 'fixture', sessionId: 'fixture', currentIndex: 0, completed: false,
      questions: [q], states: [createEmptyQuestionViewState()] };
    const reopened = JSON.parse(JSON.stringify(session));
    expect(parseQuizSession(reopened)).not.toBeNull();
    expect(isQuizSessionContentCurrent(reopened)).toBe(true);
    expect(getItemLearningTargets(VOCAB[0])[0].key).not.toBe(key);
  });
  it('does not fold separately bookmarked or MASTERed duplicates', () => {
    const first = oldItem('1', 'same', '뜻'), second = oldItem('2', 'same', '뜻');
    expect(arrangeWordbook([first, second])).toHaveLength(1);
    expect(arrangeWordbook([first, second], item => item.id)).toHaveLength(2);
  });
  it('has one ordinary WordCard path and collapsed content setup, not a second viewer', () => {
    const screen = fs.readFileSync('app/(tabs)/wordbook.tsx', 'utf8');
    expect(screen).not.toMatch(/IntegratedBookCard|BookEditionBrowser|LegacyWordbookScreen|renderRecord\(record\)/);
    expect(screen).toContain('<WordCard');
    expect(screen).toContain('onLoaded={setEdition} collapsible');
    expect(fs.readFileSync('app/_layout.tsx', 'utf8').indexOf('activateLocalBook(data)')).toBeGreaterThan(0);
  });
});
