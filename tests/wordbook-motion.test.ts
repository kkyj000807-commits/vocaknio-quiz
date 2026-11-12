import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const source = fs.readFileSync('app/(tabs)/wordbook.tsx', 'utf8');
function handler(overrides: Record<string, unknown> = {}) {
  const file = ts.createSourceFile('wordbook.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'handleLearningStatusPress') initializer = node.initializer!.getText(file);
    ts.forEachChild(node, visit);
  };
  visit(file);
  expect(initializer).not.toBe('');
  const ctx = {
    useCallback: (callback: unknown) => callback,
    masteryPending: { current: false },
    setIsUpdatingMaster: vi.fn(), setLearningState: vi.fn(), setMasteryMotionItem: vi.fn(),
    getLearningStorageIssue: () => null,
    getItemLearningTargets: () => [{ key: 'stable-target' }],
    learningState: { targets: {} },
    markLearningTargetMastered: vi.fn(),
    startLearningTargetAgain: vi.fn(),
    ...overrides,
  };
  const press = vm.runInNewContext(ts.transpileModule('(' + initializer + ')', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, ctx) as (item: { num: number }) => Promise<void>;
  return { ctx, press };
}

it('keeps the card until save succeeds and ignores rapid duplicate presses', async () => {
  let resolve!: (value: unknown) => void;
  const save = vi.fn(() => new Promise(done => { resolve = done; }));
  const { ctx, press } = handler({ markLearningTargetMastered: save });
  const pending = press({ num: 123 });
  await press({ num: 123 });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith('stable-target', 123);
  expect(ctx.setLearningState).not.toHaveBeenCalled();
  const saved = { targets: { 'stable-target': { status: 'MASTERED' } } };
  resolve(saved);
  await pending;
  expect(ctx.setLearningState).toHaveBeenCalledTimes(1);
  expect(ctx.setLearningState).toHaveBeenCalledWith(saved);
  expect(ctx.masteryPending.current).toBe(false);
  expect(ctx.setIsUpdatingMaster).toHaveBeenLastCalledWith(false);
});

it('does not remove a card on save failure and allows a later retry', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValueOnce({ targets: {} });
  const { ctx, press } = handler({ markLearningTargetMastered: save });
  await expect(press({ num: 123 })).resolves.toBeUndefined();
  expect(ctx.setLearningState).not.toHaveBeenCalled();
  expect(ctx.masteryPending.current).toBe(false);
  await press({ num: 123 });
  expect(save).toHaveBeenCalledTimes(2);
  expect(ctx.setLearningState).toHaveBeenCalledTimes(1);
});

it('preserves restore and storage protection semantics', async () => {
  const restored = { targets: { 'stable-target': { status: 'RELEARNING' } } };
  const restore = vi.fn().mockResolvedValue(restored);
  const { ctx, press } = handler({
    learningState: { targets: { 'stable-target': { status: 'MASTERED' } } },
    startLearningTargetAgain: restore,
  });
  await press({ num: 123 });
  expect(restore).toHaveBeenCalledTimes(1);
  expect(restore).toHaveBeenCalledWith('stable-target');
  expect(ctx.markLearningTargetMastered).not.toHaveBeenCalled();
  expect(ctx.setLearningState).toHaveBeenCalledWith(restored);
  const protectedHandler = handler({ getLearningStorageIssue: () => 'unreadable' });
  await protectedHandler.press({ num: 123 });
  expect(protectedHandler.ctx.markLearningTargetMastered).not.toHaveBeenCalled();
});

it('uses gentle settling transitions with system reduced-motion support, not delayed record writes', () => {
  expect(source).toContain('FadeOut.duration(280).easing(Easing.inOut(Easing.cubic))');
  expect(source).toContain('LinearTransition.duration(480).easing(Easing.inOut(Easing.cubic))');
  expect(source).toContain('itemLayoutAnimation={masteryMotionItem !== null ? CARD_LAYOUT : undefined}');
  expect(source).toContain('exiting={animateExit ? CARD_EXIT : undefined}');
  expect(source).toContain('onChangeText={value => { setMasteryMotionItem(null); setSearchQuery(value); }}');
  expect(source).toContain('includeMastered: showMastered || !!searchQuery.trim()');
  expect(source.match(/ReduceMotion.System/g)).toHaveLength(4);
  expect(source).not.toContain('nextHidden ? 82 : -82');
  expect(source).toContain('setMeaningHidden(nextHidden)');
});

it('reveals a guarded action on swipe rather than marking or deleting records on drag', () => {
  const file = ts.createSourceFile('wordbook.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callbacks: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && /^onSwipeable/.test(node.name.getText(file))) callbacks.push(node.getText(file));
    ts.forEachChild(node, visit);
  };
  visit(file);
  expect(callbacks.length).toBeGreaterThan(0);
  for (const callback of callbacks) expect(callback).not.toMatch(/onLearningStatusPress|markLearningTarget|removeItem|delete/);
  expect(source).toContain('disabled={readOnly || !swipeOpen}');
  expect(source).toContain('overshootLeft={false} overshootRight={false}');
  expect(source).not.toContain('✓ 마스터');
  expect(source).toContain('교재와 학습 기록은 보존됩니다');
});

