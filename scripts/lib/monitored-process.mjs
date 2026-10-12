import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import resource from './resource-budget.cjs';
const { readMemorySnapshotSync, chooseResourceBudget, workerEnvironment } = resource;

export function failureCategory(exitCode, signal, heapFailure) {
  if (heapFailure) return 'V8_HEAP_LIMIT';
  if (signal) return `PROCESS_SIGNAL_${signal}`;
  if (exitCode === -1073740791 || exitCode === 3221226505) return 'WINDOWS_NATIVE_CRASH_NOT_PROVEN_OOM';
  return exitCode === 0 ? 'PASS' : 'COMMAND_FAILED';
}

export async function runMonitoredNode(args, { label, kind = 'test', focused = false, admissionOnly = false, cwd = process.cwd(), env = process.env, sampleIntervalMs = 5000, reportRoot = path.join(cwd, 'analysis/qa/resource-runs') } = {}) {
  const before = readMemorySnapshotSync();
  const explicitChildHeap = Number(args.join(' ').match(/--max-old-space-size[= ](\d+)/)?.[1]) || null;
  const plan = chooseResourceBudget(before, { kind, focused, env, heapLimitMiB: explicitChildHeap ?? v8.getHeapStatistics().heap_size_limit / 1024 ** 2 });
  const report = { schema: 1, label, startedAt: new Date().toISOString(), before, plan, nodeVersion: process.version, inheritedHeapLimitMiB: Math.round(v8.getHeapStatistics().heap_size_limit / 1024 ** 2), explicitChildHeapLimitMiB: Number(args.join(' ').match(/--max-old-space-size[= ](\d+)/)?.[1]) || null, samples: [], childPid: null, peakChildPrivateBytes: null, peakChildWorkingSetBytes: null };
  fs.mkdirSync(reportRoot, { recursive: true });
  const filename = path.join(reportRoot, `${Date.now()}-${process.pid}-${kind}.json`);
  const save = () => fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
  console.log(`자원 계획: ${JSON.stringify(plan)}`);
  if (!plan.allowed) {
    Object.assign(report, { status: plan.blockedByHeap ? 'BLOCKED_HEAP_BUDGET' : 'BLOCKED_RESOURCE', exitCode: 75, endedAt: new Date().toISOString() });
    save(); console.error(`실행 보류: ${plan.reasons.join('; ')}. 진단: ${path.relative(cwd, filename)}`);
    return { status: 75, report: filename };
  }
  if (admissionOnly) {
    Object.assign(report, { status: 'READY', exitCode: 0, endedAt: new Date().toISOString() });
    save(); return { status: 0, report: filename };
  }
  // Never alter NODE_OPTIONS/heap, retry a failed workload or kill user apps.
  const childArgs = kind === 'build' ? [...args, '--max-workers', String(plan.workers)] : args;
  const metricsDirectory = filename.replace(/\.json$/, '-processes');
  fs.mkdirSync(metricsDirectory, { recursive: true });
  const metricsModule = new URL('./resource-metrics.mjs', import.meta.url).href;
  const child = spawn(process.execPath, ['--import', metricsModule, ...childArgs], { cwd, env: { ...workerEnvironment(plan, env), FINETUNE_RESOURCE_METRICS_DIR: metricsDirectory }, stdio: ['inherit', 'inherit', 'pipe'], shell: false, windowsHide: true });
  report.childPid = child.pid ?? null;
  let stderrTail = ''; let heapFailure = false; const diagnosticProcessIds = new Set();
  child.stderr?.on('data', data => {
    process.stderr.write(data);
    stderrTail = (stderrTail + data.toString()).slice(-4096);
    heapFailure ||= /heap out of memory|Reached heap limit|Allocation failed/i.test(stderrTail);
    for (const match of stderrTail.matchAll(/\[(\d+):(?:0x)?[0-9a-f]+\]/gi)) diagnosticProcessIds.add(Number(match[1]));
  });
  const sample = () => {
    const snapshot = readMemorySnapshotSync();
    const pids = new Set([child.pid]);
    let changed = true;
    while (changed) { changed = false; for (const p of snapshot.development ?? []) if (pids.has(p.parentPid) && !pids.has(p.pid)) { pids.add(p.pid); changed = true; } }
    const processes = (snapshot.development ?? []).filter(p => pids.has(p.pid));
    const privateBytes = processes.reduce((sum, p) => sum + p.privateBytes, 0);
    const workingSetBytes = processes.reduce((sum, p) => sum + p.workingSetBytes, 0);
    if (processes.length) {
      report.peakChildPrivateBytes = Math.max(report.peakChildPrivateBytes ?? 0, privateBytes);
      report.peakChildWorkingSetBytes = Math.max(report.peakChildWorkingSetBytes ?? 0, workingSetBytes);
    }
    report.samples.push({ measuredAt: snapshot.measuredAt, physicalAvailableBytes: snapshot.physicalAvailableBytes, commitAvailableBytes: snapshot.commitAvailableBytes, processes });
    if (report.samples.length > 360) report.samples.shift(); // bounded diagnostics, not unbounded logs
    save();
  };
  const timer = setInterval(sample, sampleIntervalMs); timer.unref();
  save();
  const outcome = await new Promise(resolve => {
    child.once('error', () => resolve({ code: null, signal: null, spawnError: true }));
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  clearInterval(timer);
  Object.assign(report, { endedAt: new Date().toISOString(), after: readMemorySnapshotSync(), exitCode: outcome.code, signal: outcome.signal, status: failureCategory(outcome.code, outcome.signal, heapFailure), spawnError: outcome.spawnError ?? false });
  report.processMetrics = fs.readdirSync(metricsDirectory).filter(name => /^\d+(?:-\d+)?\.json$/.test(name)).flatMap(name => {
    try { return [JSON.parse(fs.readFileSync(path.join(metricsDirectory, name), 'utf8'))]; } catch { return []; }
  });
  report.diagnosticProcessIds = [...diagnosticProcessIds]; // Node stderr prefixes; candidate PIDs, not raw stderr
  // These per-process OS peaks are not simultaneous and must NOT be summed.
  save();
  console.log(`자원 결과: ${report.status} / PID ${report.childPid} / sampled peak private ${report.peakChildPrivateBytes === null ? 'not sampled' : Math.round(report.peakChildPrivateBytes / 1024 ** 2) + 'MiB'} / ${path.relative(cwd, filename)}`);
  return { status: outcome.code ?? 1, report: filename };
}
