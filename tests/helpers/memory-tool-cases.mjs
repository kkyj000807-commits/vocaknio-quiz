import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import resource from '../../scripts/lib/resource-budget.cjs';
import { failureCategory } from '../../scripts/lib/monitored-process.mjs';
import { scanPublicTextFile, textChunks } from '../../scripts/lib/public-text-scan.mjs';
import { writeJsonCheckpoint } from '../../scripts/lib/json-checkpoint.mjs';
const GiB = 1024 ** 3;
const snapshot = (ram = 6, commit = 30) => ({ physicalAvailableBytes: ram * GiB, commitAvailableBytes: commit * GiB, logicalCPUs: 20, provider: 'fixture', development: [] });
function withFiles(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finetune-stream-'));
  let serial = 0;
  const fixture = text => { const file = path.join(root, `${serial++}.js`); fs.writeFileSync(file, text); return file; };
  try { run(fixture); } finally { fs.rmSync(root, { recursive: true }); }
}
const original = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b|\bAIza[0-9A-Za-z_-]{30,}\b/;

// SAME assertions in full Vitest and low-overhead node:test; not weaker mocks.
export const memoryToolCases = [
  ['budget: clamps20/max-min conflicts without expanding heap', () => {
    const env = { VITEST_MAX_FORKS: '20', VITEST_MIN_FORKS: '20', VITEST_MAX_THREADS: '20', VITEST_MIN_THREADS: '20', NODE_OPTIONS: '--max-old-space-size=1024' };
    assert.equal(resource.chooseResourceBudget(snapshot(3), { env }).workers, 2);
    const low = resource.chooseResourceBudget(snapshot(1.5), { env });
    assert.equal(low.allowed, false); assert.equal(low.workers, 1);
    const patched = resource.workerEnvironment(low, env);
    assert.equal(patched.VITEST_MIN_FORKS, '1'); assert.equal(patched.VITEST_MAX_FORKS, '1'); assert.equal(patched.NODE_OPTIONS, env.NODE_OPTIONS);
  }],
  ['budget: honours1/2 caps and legacybuild alias, noCPU-count pools', () => {
    assert.equal(resource.chooseResourceBudget(snapshot(40), { env: {} }).workers, 2);
    assert.equal(resource.chooseResourceBudget(snapshot(40), { env: { VITEST_MAX_FORKS: '1' } }).workers, 1);
    assert.equal(resource.chooseResourceBudget(snapshot(40), { kind: 'build', env: { FINETUNE_BUILD_MAX_WORKERS: '20' } }).workers, 2);
    assert.equal(resource.chooseResourceBudget(snapshot(40), { kind: 'build', env: { VOCANEXUS_BUILD_MAX_WORKERS: '1' } }).workers, 1);
  }],
  ['budget: separatesRAM/commit/otheractive heavy processes', () => {
    assert.equal(resource.chooseResourceBudget(snapshot(1, 30), { env: {} }).allowed, false);
    assert.equal(resource.chooseResourceBudget(snapshot(30, 1), { env: {} }).allowed, false);
    const active = snapshot(); active.development = [{ pid: 123, role: 'expo-metro' }];
    assert.match(resource.chooseResourceBudget(active, { env: {} }).reasons.join(), /expo-metro:123/);
    active.development = [{ pid: 123, role: 'node-other' }]; assert.equal(resource.chooseResourceBudget(active, { env: {} }).allowed, true);
    active.development = [{ pid: process.pid, role: 'expo-metro' }]; assert.equal(resource.chooseResourceBudget(active, { env: {} }).allowed, true);
  }],
  ['budget: smallcases allowed, full type/build blocked', () => {
    assert.equal(resource.chooseResourceBudget(snapshot(1.5), { focused: true, env: {} }).allowed, true);
    assert.equal(resource.chooseResourceBudget(snapshot(1.5), { kind: 'type', env: {} }).allowed, false);
    assert.equal(resource.chooseResourceBudget(snapshot(1.5), { kind: 'build', env: {} }).allowed, false);
    assert.equal(resource.chooseResourceBudget(snapshot(0.5), { kind: 'native', focused: true, env: {} }).allowed, true);
    const heap = resource.chooseResourceBudget(snapshot(8), { kind: 'type', env: {}, heapLimitMiB: 1024 });
    assert.equal(heap.allowed, false); assert.equal(heap.blockedByHeap, true);
    assert.match(heap.reasons.join(), /heap/);
    assert.equal(resource.chooseResourceBudget(snapshot(8), { kind: 'type', env: { NODE_OPTIONS: '--max-old-space-size=1024' } }).blockedByHeap, true);
  }],
  ['budget: invalidcaps rejected and failure causes stay distinct', () => {
    assert.throws(() => resource.chooseResourceBudget(snapshot(), { env: { VITEST_MAX_FORKS: 'garbage' } }), /integer/);
    assert.equal(failureCategory(1, null, true), 'V8_HEAP_LIMIT');
    assert.equal(failureCategory(-1073740791, null, false), 'WINDOWS_NATIVE_CRASH_NOT_PROVEN_OOM');
    assert.equal(failureCategory(1, null, false), 'COMMAND_FAILED'); assert.equal(failureCategory(0, null, false), 'PASS');
  }],
  ['scan: originalsecret semantics at1/7/31/128byte boundaries', () => withFiles(fixture => {
    const cases = ['normal 한국어 文', 'JWT_SECRET', 'ghp_' + 'Q'.repeat(36), 'github_pat_' + '_X'.repeat(20), 'AKIA' + 'A'.repeat(16), 'AKIA' + 'A'.repeat(17), 'xoxb-' + '-'.repeat(22) + 'Z', 'sk-' + 'Q'.repeat(20), 'AIza' + 'Q'.repeat(30), 'xghp_' + 'Q'.repeat(25), 'ghp_' + 'Q'.repeat(25) + '_invalid', '-----BEGIN ' + 'RSA PRIVATE ' + 'KEY-----', '-----BEGIN RSA PRIVATE KEY----X', 'ghp_' + 'Q'.repeat(19), 'xox' + 'b-abcdefghijklmnopq-sk-QQ', 'AIza' + 'Q'.repeat(27) + '-sk-QQ'];
    for (const text of cases) for (const chunkBytes of [1, 7, 31, 128]) assert.equal(scanPublicTextFile(fixture(text), { chunkBytes }).secretPattern, original.test(text), `${chunkBytes}byte case`);
  })],
  ['scan: arbitrarylong tokens/header without full buffering', () => withFiles(fixture => {
    for (const text of ['ghp_' + 'Q'.repeat(200000), 'ghp_' + 'Q'.repeat(200000) + '_invalid', '-----BEGIN ' + 'A '.repeat(100000) + 'PRIVATE KEY-----']) assert.equal(scanPublicTextFile(fixture(text), { chunkBytes: 127 }).secretPattern, original.test(text));
  })],
  ['scan: UTF8/contracts/referencecounts crosschunk exactly', () => withFiles(fixture => {
    const text = '한국어🙂"/_expo/x.js" =\'/assets/x\' speechSynthesis voiceURI preferRecording vocab-learning vocab-definitions [OAuth] Params received:';
    const file = fixture(text); assert.equal([...textChunks(file, 1)].join(''), text);
    const result = scanPublicTextFile(file, { chunkBytes: 7, needles: ['speechSynthesis', 'vocab-learning'] });
    assert.equal(result.rootExpoReferences, 1); assert.equal(result.rootAssetReferences, 1); assert.equal(result.authDiagnostics, true);
    assert.equal(result.found.speechSynthesis, true); assert.equal(result.secretPattern, false);
    assert.equal(scanPublicTextFile(fixture('DATABASE_URL'), { chunkBytes: 2 }).serverConfiguration, true);
  })],
  ['scan: neverreturns secretvalues', () => withFiles(fixture => {
    const sentinel = 'ghp_' + 'Q'.repeat(40); assert.equal(JSON.stringify(scanPublicTextFile(fixture(sentinel))).includes(sentinel), false);
  })],
  ['checkpoint: NO_CHANGE keepsbytes/mtime; semanticchange writes; corruptpreserved', () => withFiles(fixture => {
    const old = { generatedAtKst: 'old', sourceCheckedAt: 'verified-old', items: [{ id: 'stable', answer: 2 }] };
    const file = fixture(JSON.stringify(old)); const bytes = fs.readFileSync(file); const stamp = fs.statSync(file).mtimeMs;
    assert.equal(writeJsonCheckpoint(file, { ...old, generatedAtKst: 'new' }, { ignoreGeneratedAt: true }), false);
    assert.deepEqual(fs.readFileSync(file), bytes); assert.equal(fs.statSync(file).mtimeMs, stamp);
    assert.equal(writeJsonCheckpoint(file, { ...old, sourceCheckedAt: 'verified-new' }, { ignoreGeneratedAt: true }), true);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).sourceCheckedAt, 'verified-new');
    const corrupt = fixture('{broken'); assert.throws(() => writeJsonCheckpoint(corrupt, old));
    assert.equal(fs.readFileSync(corrupt, 'utf8'), '{broken');
  })],
];
