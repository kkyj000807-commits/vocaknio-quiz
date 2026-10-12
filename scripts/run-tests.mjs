import { runMonitoredNode } from './lib/monitored-process.mjs';
import resource from './lib/resource-budget.cjs';
const input = process.argv.slice(2); const args = []; const env = { ...process.env };
for (let i = 0; i < input.length; i++) {
  const match = input[i].match(/^--(maxWorkers|minWorkers)(?:=(.*))?$/);
  if (match) {
    const cap = resource.positiveInteger(match[2] ?? input[++i], match[1]);
    if (cap === undefined) throw new Error(`${match[1]}: missing value`);
    if (match[1] === 'maxWorkers') for (const key of ['VITEST_MAX_FORKS', 'VITEST_MAX_THREADS']) env[key] = String(Math.min(cap, resource.positiveInteger(env[key], key) ?? cap));
  } else {
    if (/^--poolOptions/.test(input[i])) throw new Error('Pool 상한은 VITEST_MAX_FORKS/MAX_THREADS로 지정하세요. 자원 계획에서 제한합니다.');
    args.push(input[i]);
  }
}
const positional = args.filter(arg => !arg.startsWith('-'));
const focused = positional.length > 0 && positional.every(arg => /(?:^|[/\\])tests[/\\].*\.test\.[cm]?[jt]sx?$/.test(arg));
const result = await runMonitoredNode(['node_modules/vitest/vitest.mjs', 'run', ...args], { label: focused ? 'focused regression' : 'full regression', focused, env });
process.exitCode = result.status;
