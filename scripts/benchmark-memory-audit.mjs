import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
const output = process.argv[2];
const baseline = process.argv[3];
if (!output || !/^[a-f0-9]{7,40}$/.test(baseline ?? '')) throw new Error('Usage: node scripts/benchmark-memory-audit.mjs <existing QA export> <baseline SHA>');
const dataUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const readOld = file => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const oldSecurity = dataUrl(readOld('scripts/lib/production-security.mjs'));
const oldCode = readOld('scripts/audit-production-output.mjs')
  .replace('"./lib/production-security.mjs"', JSON.stringify(oldSecurity))
  .replace('"./lib/release-metadata.mjs"', JSON.stringify(pathToFileURL(path.resolve('scripts/lib/release-metadata.mjs')).href));
const run = target => {
  const code = `process.argv[2]=${JSON.stringify(output)}; const started=performance.now(); await import(${JSON.stringify(target)}); console.log('MEMORY_METRICS'+JSON.stringify({elapsedMs:performance.now()-started,rssBytes:process.memoryUsage().rss,heapUsedBytes:process.memoryUsage().heapUsed,maxRssKiB:process.resourceUsage().maxRSS}));`;
  const text = execFileSync(process.execPath, ['--max-old-space-size=256', '--input-type=module', '-e', code], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const [audit, metrics] = text.split('MEMORY_METRICS');
  return { audit: JSON.parse(audit), metrics: JSON.parse(metrics) };
};
const before = run(dataUrl(oldCode));
const after = run(pathToFileURL(path.resolve('scripts/audit-production-output.mjs')).href);
const equal = JSON.stringify(before.audit) === JSON.stringify(after.audit);
const result = { baseline, output, before: before.metrics, after: after.metrics, exactAuditResultEqual: equal, auditStatus: after.audit.status, heapLimitMiB: 256, note: 'Serial read-only identical export; maxRSS is OS peak, end RSS/heap separately reported. Not Metro/Vitest memory.' };
if (!equal || after.audit.status !== 'pass') throw new Error('Audit parity failed');
fs.mkdirSync('analysis/qa', { recursive: true });
fs.writeFileSync('analysis/qa/memory-audit-comparison.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
