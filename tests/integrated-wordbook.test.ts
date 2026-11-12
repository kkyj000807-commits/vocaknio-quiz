import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createIntegratedWordbook, localBookIdentity, selectBookOrderedItems } from '../lib/integrated-wordbook';
import { arrangeWordbook, groupWordbookHeadwords } from '../lib/wordbook-display';
import { VOCAB, VOCAB_BY_NUM, WORDBOOK_VOCAB, WORDBOOK_RANGES, getVocabItem, getRangeItems, getAdditionalHeadwordMeanings, RANGES, registerStudyItems, type VocabItem } from '../lib/vocab';
import { getItemLearningTargets, getQuestionLearningTargetKey } from '../lib/canonical-learning';
import { buildQuizQuestions, getQuizCandidateItems, validateQuestion } from '../lib/quiz-engine';
import { createEmptyQuestionViewState, parseQuizSession, isQuizSessionContentCurrent } from '../lib/quiz-session';
import type { BookEdition, BookEntry } from '../lib/book-edition';
import { buildWordbookPracticeHref, getWordbookPracticeItems, parseWordbookPracticeRequest, parseWordbookPracticeScope, inspectWordbookPractice, practiceCandidate, practiceMasteredKeys, type WordbookPracticeScope } from '../lib/wordbook-practice';
import { selectAdaptiveItemNums, createEmptyAdaptiveHistory } from '../lib/adaptive-quiz';
import { createEmptySenseLearningState, getLearningTargetState } from '../lib/learning-state';

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
afterEach(() => { registerStudyItems(WORDBOOK_VOCAB); for (const num of [910001, 910002, 910003]) VOCAB_BY_NUM.delete(num); });

describe('v1.5 uses existing vocabulary cards and learning contracts', () => {
  it('groups a headword across sections while retaining different meanings and independent IDs', () => {
    const first = oldItem('10001', 'bank', '강둑');
    const second = { ...oldItem('10002', 'bank', '은행'), group: 'V301' as const };
    const third = { ...oldItem('10003', 'bank', '기울다'), group: 'V501' as const };
    const original = [first, second, third];
    const before = JSON.stringify(original);
    const grouped = groupWordbookHeadwords(arrangeWordbook(original, item => item.id, true));
    expect(grouped).toHaveLength(1);
    expect(grouped[0].displaySourceIds).toEqual(['10001', '10002', '10003']);
    expect(grouped[0].displaySourceGroups).toEqual(['V101', 'V301', 'V501']);
    expect(grouped[0].displayDuplicates?.map(row => row.k)).toEqual(['은행', '기울다']);
    expect(JSON.stringify(original)).toBe(before);
  });
  it('does not regroup idioms or non-volume-one material', () => {
    const a = { ...oldItem('10011', 'take over', '인수하다'), type: 'idiom' as const };
    const b = { ...oldItem('10012', 'take over', '이어받다'), type: 'idiom' as const };
    const outside = { ...oldItem('10013', 'take over', '별도 자료'), group: 'PERSONAL' as const };
    expect(groupWordbookHeadwords([a, b, outside])).toEqual([a, b, outside]);
  });
  it('exposes stored alternate glosses without changing the original entries or learning IDs', () => {
    const groups = new Map<string, VocabItem[]>();
    for (const row of VOCAB) {
      const key = row.w.trim().toLowerCase().replace(/\s+/g, ' ');
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const sameWord = [...groups.values()].find(rows => new Set(rows.map(row => row.k.trim())).size > 1)!;
    expect(sameWord).toBeDefined();
    const original = JSON.stringify(sameWord);
    const expected = [...new Set(sameWord.map(row => row.k.trim()).filter(k => k && k !== sameWord[0].k.trim()))];
    expect(getAdditionalHeadwordMeanings(sameWord[0])).toEqual(expected);
    expect(JSON.stringify(sameWord)).toBe(original);
  });
  it('shows precisely the printed placements by default and retains extra old senses only on explicit inclusion', () => {
    const entries = [book('study-950001', 'first-book', 1, 'V301'), book('study-950002', 'second-book', 2, 'V301'),
      book('study-950003', 'book-phrase', 3, 'V301'), book('study-950004', 'book-idiom', 4, '숙어')];
    entries[1].word = entries[0].word; entries[1].display = entries[0].display;
    const old = [VOCAB[0]];
    const rows = createIntegratedWordbook(old, edition(entries)); registerStudyItems(rows);
    const before = JSON.stringify(rows);
    const selected = { rangeId: 'all', concept: '', query: '', bookmarksOnly: false, includeMastered: true };
    const exact = getWordbookPracticeItems(selected, new Set(), null);
    expect(exact.map(item => item.book!.id)).toEqual(entries.map(entry => entry.id));
    expect(exact).toHaveLength(4); // Printed repeat placements are not silently folded away.
    expect(getWordbookPracticeItems({ ...selected, rangeId: 'idioms' }, new Set(), null).map(item => item.book!.section)).toEqual(['숙어']);
    expect(getWordbookPracticeItems({ ...selected, includeLegacy: true }, new Set(), null).at(-1)?.id).toBe(old[0].id);
    expect(getWordbookPracticeItems({ ...selected, query: old[0].w }, new Set(), null)).toEqual([]);
    expect(getWordbookPracticeItems({ ...selected, query: old[0].w, includeLegacy: true }, new Set(), null).map(item => item.id)).toContain(old[0].id);
    expect(selectBookOrderedItems([...rows].reverse()).map(item => item.book!.order)).toEqual([1, 2, 3, 4]);
    expect(parseWordbookPracticeScope(JSON.stringify({ ...selected, includeLegacy: true })).includeLegacy).toBe(true);
    expect(() => parseWordbookPracticeScope(JSON.stringify({ ...selected, includeLegacy: 'yes' }))).toThrow();
    expect(getVocabItem(old[0].num)?.id).toBe(old[0].id);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('counts built questions and the same adaptive target once without promoting private or reference rows', async () => {
    const rows = [oldItem('910001', 'unique-fixture', '뜻'), oldItem('910002', 'unique-fixture', '뜻'),
      { ...oldItem('910003', 'reference-fixture', '참고 뜻'), referenceOnly: true },
      ...createIntegratedWordbook([], edition([book('study-930001', 'private-fixture', 1)]))];
    registerStudyItems([...VOCAB, ...rows]);
    for (const row of rows.filter(row => !row.localBook)) VOCAB_BY_NUM.set(row.num, row);
    const state = createEmptySenseLearningState(); const before = JSON.stringify([rows, state]);
    const options = { mode: 'kor-choice' as const, count: 30, itemNums: rows.map(row => row.num) };
    const result = (await inspectWordbookPractice(options, state))!;
    expect(result.count).toBe(1); expect(result.questions.size).toBe(2);
    const selected = selectAdaptiveItemNums({ candidates: [...result.questions.values()].map(q => practiceCandidate(q.item, options.mode, state)),
      count: 30, mode: options.mode, history: createEmptyAdaptiveHistory(), strategy: 'weighted' });
    expect(selected).toHaveLength(result.count);
    expect(selected.every(num => validateQuestion(result.questions.get(num)!))).toBe(true);
    expect((await inspectWordbookPractice({ ...options, mode: 'flashcard' }, state))!.count).toBe(2);
    expect((await inspectWordbookPractice({ ...options, itemNums: [] }, state))!.count).toBe(0);
    expect(await inspectWordbookPractice(options, state, 30, () => true)).toBeNull();
    expect(JSON.stringify([rows, state])).toBe(before);
  });
  it('honours protected MASTER and caps the read-only preview at thirty', async () => {
    const state = createEmptySenseLearningState(); const rows = VOCAB.slice(0, 200);
    const result = (await inspectWordbookPractice({ mode: 'flashcard', count: 30, itemNums: rows.map(row => row.num) }, state, 30))!;
    expect(result.count).toBe(30);
    const item = rows[0]; const key = getItemLearningTargets(item)[0].key;
    state.targets[key] = { ...getLearningTargetState(state, key), status: 'MASTERED', lastStudiedAt: Date.now() };
    expect(practiceMasteredKeys(state)).toContain(key); expect(practiceMasteredKeys(state, true)).toContain(key);
    state.targets[key].lastStudiedAt = 0;
    expect(practiceMasteredKeys(state)).toContain(key);
    expect((await inspectWordbookPractice({ mode: 'flashcard', count: 10, itemNums: [item.num], masteredTargetKeys: practiceMasteredKeys(state) }, state))!.count).toBe(0);
  });
  const scope = (rangeId = 'all'): WordbookPracticeScope => ({ rangeId, concept: '', query: '', bookmarksOnly: false, includeMastered: false });
  it('partitions every current idiom by its printed subsection without losing order or widening quiz scope', () => {
    const source = JSON.parse(fs.readFileSync('public/data/book/book-1.7.4-0be56a709696210a.json', 'utf8')).current as BookEdition;
    const entries = source.entries.filter(entry => entry.section === '숙어');
    registerStudyItems(createIntegratedWordbook([], { ...source, entries }));
    const rangeId = WORDBOOK_RANGES.find(range => range.kind === 'idioms')!.id;
    const all = getWordbookPracticeItems(scope(rangeId), new Set(), null);
    expect(all).toHaveLength(5789);
    const concepts = [...new Set(entries.map(entry => entry.concept))];
    expect(concepts).toEqual(['101', '201', '301', '401', '501', '502', '601', '부록', '추가 숙어']);
    const partition = concepts.flatMap(concept => {
      const selected = { ...scope(rangeId), concept };
      const reloaded = parseWordbookPracticeScope(JSON.stringify(selected));
      const rows = getWordbookPracticeItems(reloaded, new Set(), null);
      expect(rows.map(row => row.book!.id)).toEqual(entries.filter(entry => entry.concept === concept).map(entry => entry.id));
      return rows.map(row => row.book!.id);
    });
    expect(new Set(partition).size).toBe(all.length);
    expect(partition).toEqual(all.map(row => row.book!.id));
    const first = all[0];
    const state = createEmptySenseLearningState();
    const key = getItemLearningTargets(first)[0].key;
    state.targets[key] = { ...getLearningTargetState(state, key), status: 'MASTERED' };
    const search = { ...scope(rangeId), query: first.w, includeMastered: true };
    expect(getWordbookPracticeItems(search, new Set(), state).some(row => row.id === first.id)).toBe(true);
    expect(getWordbookPracticeItems(scope(rangeId), new Set(), state).some(row => row.id === first.id)).toBe(false);
    expect(practiceMasteredKeys(state, true)).toContain(key);
  });
  it('keeps private search/concept text out of HTTP requests while surviving reload', () => {
    const selected = { ...scope(), concept: '개인 개념 & # 100%', query: '개인 검색 문구?' };
    const url = new URL(buildWordbookPracticeHref(selected, 'kor-choice', 20), 'https://fixture.invalid');
    expect(url.pathname).toBe('/quiz');
    expect(url.search).toBe('');
    expect(decodeURIComponent(url.search)).not.toContain(selected.concept);
    expect(decodeURIComponent(url.search)).not.toContain(selected.query);
    const fragment = decodeURIComponent(url.hash.slice(1));
    expect(fragment.startsWith('wordbook:')).toBe(true);
    expect(parseWordbookPracticeScope(fragment.slice('wordbook:'.length))).toEqual(selected);
    expect(parseWordbookPracticeRequest(fragment.slice('wordbook:'.length))).toEqual({ ...selected, mode: 'kor-choice', count: 20 });
  });
  it('retains mode/count with special private text through fragment-only URL serialization', () => {
    const selected = { ...scope('v301'), query: '매혹 & # 100% ?mode=flashcard' };
    for (const mode of ['kor-choice', 'syn-choice', 'definition-choice', 'flashcard'] as const) {
      const href = buildWordbookPracticeHref(selected, mode, 5);
      const reloaded = new URL(new URL(href, 'https://fixture.invalid').href);
      expect(reloaded.search).toBe('');
      expect(parseWordbookPracticeRequest(decodeURIComponent(reloaded.hash.slice(1)).slice('wordbook:'.length)))
        .toEqual({ ...selected, mode, count: 5 });
    }
    for (const extra of [{ mode: 'unknown', count: 5 }, { mode: 'kor-choice', count: 0 }, { mode: 'kor-choice', count: 31 }, { mode: 'kor-choice', count: 1.5 }]) {
      expect(() => parseWordbookPracticeRequest(JSON.stringify({ ...selected, ...extra }))).toThrow();
    }
  });
  it('resolves every selected section and all 250 matching entries, not only the first 200', () => {
    const entries = Array.from({ length: 250 }, (_, index) => book(`study-${10000 + index}`, `fixture-${index}`, index + 1, 'V301'));
    entries.push(book('study-20000', 'different-section', 1, 'V502'));
    const rows = createIntegratedWordbook([], edition(entries)); registerStudyItems(rows);
    const rangeId = RANGES.find(range => range.group === 'V301')!.id;
    const selected = getWordbookPracticeItems({ ...scope(rangeId), concept: '개념', query: 'fixture-' }, new Set(), null);
    expect(selected).toHaveLength(250);
    expect(selected.at(-1)?.w).toBe('fixture-249');
    expect(selected.every(item => item.book?.section === 'V301')).toBe(true);
    expect(getWordbookPracticeItems(scope(RANGES.find(range => range.group === 'V502')!.id), new Set(), null)).toHaveLength(1);
  });
  it('uses the same concept, text, bookmark, and mastered filters without changing input records', () => {
    const rows = createIntegratedWordbook([], edition([book('study-22001', 'keep', 1, 'V301'), book('study-22002', 'other', 2, 'V301')]));
    registerStudyItems(rows);
    const state = createEmptySenseLearningState();
    const target = getItemLearningTargets(rows[0])[0].key;
    state.targets[target] = { ...getLearningTargetState(state, target), status: 'MASTERED', lastStudiedAt: Date.now() };
    const selected = { ...scope(), query: 'KEEP', concept: '개념', bookmarksOnly: true };
    const bookmarks = new Set([rows[0].num]); const before = JSON.stringify([rows, state, [...bookmarks]]);
    expect(getWordbookPracticeItems(selected, bookmarks, state)).toEqual([]);
    expect(getWordbookPracticeItems({ ...selected, includeMastered: true }, bookmarks, state).map(item => item.id)).toEqual([rows[0].id]);
    expect(getWordbookPracticeItems({ ...selected, includeMastered: true }, new Set(), state)).toEqual([]);
    expect(JSON.stringify([rows, state, [...bookmarks]])).toBe(before);
  });
  it('preserves B and idiom boundaries and keeps new book entries self-assessment only', () => {
    const rows = createIntegratedWordbook([], edition([book('study-23001', 'B-word', 1, '보카바이블 B'), book('study-23002', 'idiom', 2, '숙어')]));
    registerStudyItems(rows);
    for (const [rangeId, expected] of [['book-b', rows[0]], ['idioms', rows[1]]] as const) {
      const pool = getWordbookPracticeItems(scope(rangeId), new Set(), null);
      expect(pool.map(item => item.id)).toEqual([expected.id]);
      expect(buildQuizQuestions({ mode: 'kor-choice', itemNums: pool.map(item => item.num), count: 5 })).toEqual([]);
      expect(buildQuizQuestions({ mode: 'flashcard', itemNums: pool.map(item => item.num), count: 5 })).toHaveLength(1);
    }
  });
  it('does not widen empty selections or malformed scopes, including logic mode', () => {
    expect(parseWordbookPracticeScope(JSON.stringify(scope()))).toEqual(scope());
    for (const invalid of ['', 'null', '{}', JSON.stringify({ ...scope(), rangeId: 'missing' }), JSON.stringify({ ...scope(), bookmarksOnly: 'false' })]) {
      expect(() => parseWordbookPracticeScope(invalid)).toThrow();
    }
    const empty = getWordbookPracticeItems({ ...scope(), query: 'never-match-unique-fixture-zzzzz' }, new Set(), null);
    expect(empty).toEqual([]);
    for (const mode of ['kor-choice', 'syn-choice', 'definition-choice', 'sentence-completion', 'flashcard'] as const) {
      expect(buildQuizQuestions({ mode, rangeId: 'all', count: 10, itemNums: empty.map(item => item.num) })).toEqual([]);
    }
  });
  it('carries scope through session identity and keeps empty scoped IDs explicit', () => {
    const source = fs.readFileSync('app/quiz.tsx', 'utf8');
    expect(source.indexOf('parseWordbookPracticeRequest(wordbookScope)')).toBeLessThan(source.indexOf('await loadQuizSessionForStudy(requestKey)'));
    expect(source).toContain('...(wordbookScope !== undefined ? { wordbookScope } : {})');
    expect(source).toContain('itemNums: scopedNums ??');
    expect(source).toContain('practiceMasteredKeys(learningState, selectedScope?.includeMastered)');
    const screen = fs.readFileSync('app/(tabs)/wordbook.tsx', 'utf8');
    expect(screen).toContain('getWordbookPracticeItems(practiceScope, bookmarks, learningState)');
    expect(screen).not.toContain('slice(0, 200)');
    expect(screen).not.toContain('행 묶음');
  });
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
    const entry = book('study-99', 'same', 1); entry.display!.meaning_display = '뜻';
    const integrated = createIntegratedWordbook([first, second], edition([entry]));
    const folded = arrangeWordbook(integrated, () => '', true);
    expect(folded).toHaveLength(1);
    expect(folded[0].book?.id).toBe(entry.id);
    expect(folded[0].displaySourceIds).toEqual(['1', '2']);
  });
  it('folds only exact private content in the same section and keeps independent rows accessible', () => {
    const first = book('study-940001', 'same-local-fixture', 1, 'V301');
    const second = { ...first, id: 'study-940002', order: 2 };
    const distinct = { ...first, id: 'study-940003', order: 3, display: { ...first.display!, examples: ['different example'] } };
    const otherConcept = { ...first, id: 'study-940004', order: 4, concept: '다른 개념' };
    const rows = createIntegratedWordbook([], edition([first, second, distinct, otherConcept]));
    const before = JSON.stringify(rows);
    const folded = arrangeWordbook(rows, () => 'NEW', true);
    expect(folded).toHaveLength(3);
    expect(folded[0].displaySourceIds).toEqual([rows[0].id, rows[1].id]);
    expect(folded[0].displayDuplicates).toEqual([rows[1]]);
    expect(getItemLearningTargets(rows[0])[0].key).not.toBe(getItemLearningTargets(rows[1])[0].key);
    expect(arrangeWordbook(rows, item => item.id, true)).toHaveLength(4);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('has one ordinary WordCard path with automatic public content, not a second viewer or setup', () => {
    const screen = fs.readFileSync('app/(tabs)/wordbook.tsx', 'utf8');
    expect(screen).not.toMatch(/IntegratedBookCard|BookEditionBrowser|LegacyWordbookScreen|renderRecord\(record\)/);
    expect(screen).toContain('<WordCard');
    expect(screen).not.toContain('<LocalBookImport');
    expect(screen).not.toContain("router.push('/settings?book=1')");
    expect(screen).not.toContain('<EncryptedBookUnlock');
    expect(fs.readFileSync('app/_layout.tsx', 'utf8')).toContain('loadPublicBook()');
    expect(screen).not.toContain('setIncludeLegacy');
    expect(screen).toContain('setEdition(getActiveBookEdition() ?? BOOK_EDITION)');
    expect(fs.readFileSync('app/(tabs)/settings.tsx', 'utf8')).not.toContain('<LocalBookImport');
    expect(screen).toContain('!(item.book?.concept || item.book?.chunk)');
    expect(fs.readFileSync('app/_layout.tsx', 'utf8').indexOf('loadPublicBook()')).toBeGreaterThan(0);
    for (const path of ['app/(tabs)/wrong.tsx', 'app/(tabs)/bookmarks.tsx', 'app/result.tsx']) {
      const source = fs.readFileSync(path, 'utf8');
      expect(source).toContain('.map(getVocabItem)');
      expect(source).not.toMatch(/VOCAB\.find/);
      expect(source).toContain('BookLearningDetails');
    }
  });
});
