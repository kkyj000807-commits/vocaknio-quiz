import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

// Execute the actual screen's preparation closure, not a second implementation.
// Rendering and device interaction remain separate acceptance gates.
function preparation() {
  const file = ts.createSourceFile('quiz.tsx', fs.readFileSync('app/quiz.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'prepareQuestions') initializer = node.initializer!.getText(file);
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!initializer) throw new Error('Actual quiz preparation missing');
  return ts.transpileModule(`(${initializer})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

it('continues the exact scope after unreadable records without saving, migrating, or regrading them', async () => {
  const source = preparation();
  const selectedScope = { rangeId: 'book-idioms', query: 'same selection', concept: 'same concept', includeMastered: true, bookmarksOnly: false };
  const items = [{ num: 1000000001 }, { num: 1000000002 }];
  const questions = new Map(items.map(item => [item.num, { item, mode: 'flashcard' }]));
  const setters = Object.fromEntries([...source.matchAll(/\b(set[A-Z]\w+)\(/g)].map(match => [match[1], vi.fn()]));
  const scopeOptions: unknown[] = [];
  const ctx = {
    ...setters, practiceOnlyRef: { current: false }, isMovingRef: { current: false }, sessionCompletedRef: { current: false },
    questionViewStatesRef: { current: new Map() }, sessionIdRef: { current: '' }, failureStage: '', cancelled: false,
    wordbookScope: JSON.stringify(selectedScope), requestKey: 'same-request', mode: 'flashcard', count: 2,
    rangeStart: 1, rangeEnd: 2, rangeId: 'book-idioms', choiceLang: 'korean', itemNums: [], reviewKeys: ['book-target:exact'],
    parseWordbookPracticeRequest: JSON.parse,
    loadQuizSessionForStudy: vi.fn().mockRejectedValue(new Error('unreadable original')),
    loadMastered: vi.fn(), loadSenseLearningState: vi.fn(), loadBookmarks: vi.fn(),
    createEmptySenseLearningState: () => ({ targets: {} }), practiceMasteredKeys: () => [],
    getWordbookPracticeItems: vi.fn((_scope: unknown) => items),
    inspectWordbookPractice: vi.fn(async (options: unknown) => { scopeOptions.push(options); return { questions }; }),
    practiceCandidate: (item: unknown) => item,
    createEmptyAdaptiveHistory: () => ({ recentSessions: [] }),
    selectAdaptiveItemNums: vi.fn(() => items.map(item => item.num)),
    prepareAdaptiveQuizSession: vi.fn(), saveQuizSession: vi.fn(),
    getQuizStorageIssue: () => 'original record unreadable', createEmptyQuestionViewState: () => ({}),
  };
  const prepare = vm.runInNewContext(source, ctx) as (practice?: boolean) => Promise<void>;
  await expect(prepare()).rejects.toThrow('unreadable original');
  await prepare(true);
  expect(ctx.practiceOnlyRef.current).toBe(true);
  expect(ctx.loadQuizSessionForStudy).toHaveBeenCalledTimes(1);
  expect(ctx.loadMastered).not.toHaveBeenCalled();
  expect(ctx.loadSenseLearningState).not.toHaveBeenCalled();
  expect(ctx.prepareAdaptiveQuizSession).not.toHaveBeenCalled();
  expect(ctx.saveQuizSession).not.toHaveBeenCalled();
  expect(scopeOptions[0]).toMatchObject({ mode: 'flashcard', count: 2, itemNums: items.map(item => item.num),
    learningTargetKeys: ['book-target:exact'], allowMeaningFallback: false });
  expect(ctx.getWordbookPracticeItems.mock.calls[0][0]).toEqual(selectedScope);
  expect(setters.setQuestions).toHaveBeenLastCalledWith([...questions.values()]);
  expect(setters.setQuestionsReady).toHaveBeenLastCalledWith(true);
  expect(setters.setSessionNotice).toHaveBeenLastCalledWith(expect.stringContaining('이 탭에서만 유지'));
});
