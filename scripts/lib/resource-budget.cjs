const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const v8 = require('node:v8');

const MiB = 1024 ** 2;
const workerKeys = ['VITEST_MAX_FORKS', 'VITEST_MIN_FORKS', 'VITEST_MAX_THREADS', 'VITEST_MIN_THREADS'];

function positiveInteger(value, name) {
  if (value === undefined || value === '') return undefined;
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error(`${name}: positive integer required`);
  return Number(value);
}

function readMemorySnapshotSync() {
  if (process.platform === 'win32') {
    try {
      const command = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); ' + fs.readFileSync(path.join(path.dirname(module.filename), '../resource-snapshot.ps1'), 'utf8');
      return JSON.parse(execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
        encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
      }));
    } catch {
      // Failed measurement is not evidence of sufficient commit headroom.
      return { measuredAt: new Date().toISOString(), provider: 'Windows measurement unavailable', physicalTotalBytes: os.totalmem(), physicalAvailableBytes: os.freemem(), commitAvailableBytes: null, logicalCPUs: os.availableParallelism?.() ?? os.cpus().length, development: [] };
    }
  }
  return { measuredAt: new Date().toISOString(), provider: 'OS physical-only (commit unavailable)', physicalTotalBytes: os.totalmem(), physicalAvailableBytes: os.freemem(), commitAvailableBytes: null, logicalCPUs: os.availableParallelism?.() ?? os.cpus().length, development: [] };
}

function chooseResourceBudget(snapshot, { kind = 'test', focused = false, env = process.env, heapLimitMiB = v8.getHeapStatistics().heap_size_limit / MiB } = {}) {
  // Estimates are conservative admission budgets, NOT measured worker peaks.
  // Full type check previously measured ~1.35 GiB; preserve 3GiB full-run gate.
  const reserveMiB = kind === 'native' ? 256 : focused ? 384 : 768;
  const parentMiB = kind === 'native' ? 64 : kind === 'build' ? 1536 : kind === 'type' ? 1536 : focused ? 128 : 256;
  const workerMiB = kind === 'native' ? 64 : focused ? 256 : 768;
  const fullMinimumMiB = Math.max(kind === 'native' ? 384 : kind === 'type' || kind === 'build' || !focused ? 3072 : 768, reserveMiB + parentMiB + workerMiB);
  const physicalMiB = Number(snapshot.physicalAvailableBytes) / MiB;
  const commitValue = snapshot.commitAvailableBytes === null || snapshot.commitAvailableBytes === undefined ? NaN : Number(snapshot.commitAvailableBytes) / MiB;
  const commitMiB = Number.isFinite(commitValue) ? Math.max(0, commitValue) : null;
  const measured = Number.isFinite(physicalMiB) && physicalMiB > 0;
  const availableMiB = measured ? Math.min(physicalMiB, commitMiB ?? physicalMiB) : 0;
  const memoryWorkers = Math.max(1, Math.floor((availableMiB - reserveMiB - parentMiB) / workerMiB));
  const requested = kind === 'build'
    ? positiveInteger(env.FINETUNE_BUILD_MAX_WORKERS ?? env.VOCANEXUS_BUILD_MAX_WORKERS, 'FINETUNE_BUILD_MAX_WORKERS')
    : Math.min(...workerKeys.map(key => positiveInteger(env[key], key) ?? Infinity));
  const workers = Math.max(1, Math.min(focused ? 1 : 2, snapshot.logicalCPUs || 1, memoryWorkers, requested ?? Infinity));
  const knownWindowsCommit = process.platform !== 'win32' || commitMiB !== null;
  const concurrentHeavy = (snapshot.development ?? []).filter(p => p.pid !== process.pid && ['vitest', 'typescript', 'expo-metro'].includes(p.role));
  const reasons = [];
  const declaredHeapCaps = [...String(env.NODE_OPTIONS ?? '').matchAll(/--max[-_]old[-_]space[-_]size[=\s]+(\d+)/g)].map(match => Number(match[1])).filter(value => value > 0);
  const heapBudgetMiB = Math.min(heapLimitMiB, ...declaredHeapCaps);
  const blockedByHeap = kind === 'type' && (!Number.isFinite(heapBudgetMiB) || heapBudgetMiB < 1536);
  if (blockedByHeap) reasons.push(`known full type demand exceeds heap budget ${Math.round(heapBudgetMiB)}MiB <1536MiB; no automatic heap expansion`);
  if (!measured || availableMiB < fullMinimumMiB) reasons.push(`available ${Math.round(availableMiB)}MiB < admission ${fullMinimumMiB}MiB`);
  if (!knownWindowsCommit) reasons.push('Windows commit measurement unavailable');
  if (concurrentHeavy.length) reasons.push(`other heavy processes active: ${concurrentHeavy.map(p => `${p.role}:${p.pid}`).join(',')}`);
  return { kind, focused, workers, reserveMiB, parentMiB, workerEstimateMiB: workerMiB, minimumAvailableMiB: fullMinimumMiB, heapBudgetMiB: Math.round(heapBudgetMiB), blockedByHeap, physicalAvailableMiB: Math.round(physicalMiB), commitAvailableMiB: commitMiB === null ? null : Math.round(commitMiB), allowed: reasons.length === 0, reasons, measurement: snapshot.provider };
}

function workerEnvironment(plan, env = process.env) {
  // Caller limits are upper bounds. Clamp MIN too, preventing MIN=20/MAX=1.
  return { ...env, ...Object.fromEntries(workerKeys.map(key => [key, String(key.includes('_MIN_') ? 1 : plan.workers)])), FINETUNE_BUILD_MAX_WORKERS: String(plan.workers) };
}

module.exports = { readMemorySnapshotSync, chooseResourceBudget, workerEnvironment, positiveInteger };
