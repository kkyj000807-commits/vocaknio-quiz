import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// The same real-screen effect and assertions run in Vitest and low-memory Node.
export function confirmedQuizRecoveryCase() {
  const source = fs.readFileSync(new URL('../../app/quiz.tsx', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('quiz.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let recoveryEffect;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect'
      && node.arguments[1]?.getText(parsed).includes('sessionRecoveryFailed')) {
      const callback = node.arguments[0];
      if (ts.isArrowFunction(callback)) recoveryEffect = callback;
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.ok(recoveryEffect, 'storage recovery must reconnect to the blocked quiz screen');
  const code = ts.transpileModule(`(${recoveryEffect.getText(parsed)})();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const restarts = [], failedStates = [], readyStates = [];
  const context = { sessionRecoveryFailed: true, preparationFailure: 'STORAGE_RECOVERY', quizStorageIssue: 'conflict',
    requestKey: 'same-request', automaticResumeRequestRef: { current: null },
    recoveryBusyRef: { current: false }, setSessionRecoveryFailed: value => failedStates.push(value),
    setQuestionsReady: value => readyStates.push(value), setRestartToken: update => restarts.push(update(7)) };
  const run = () => vm.runInNewContext(code, context);
  run(); assert.equal(restarts.length, 0);
  context.quizStorageIssue = null; context.preparationFailure = 'CONTENT_PREPARE';
  run(); assert.equal(restarts.length, 0);
  context.preparationFailure = 'STORAGE_RECOVERY'; context.recoveryBusyRef.current = true;
  run(); assert.equal(restarts.length, 0);
  context.recoveryBusyRef.current = false;
  run(); assert.deepEqual(restarts, [8]);
  assert.deepEqual(failedStates, [false]); assert.deepEqual(readyStates, [false]);
  run(); assert.equal(restarts.length, 1);
  context.requestKey = 'other-request'; context.sessionRecoveryFailed = false;
  run(); assert.equal(restarts.length, 1);
  context.sessionRecoveryFailed = true; context.quizStorageIssue = 'unreadable';
  run(); assert.equal(restarts.length, 1);
  context.quizStorageIssue = null;
  run(); assert.deepEqual(restarts, [8, 8]);
}
