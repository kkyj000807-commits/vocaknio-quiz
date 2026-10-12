import { runMonitoredNode } from './lib/monitored-process.mjs';
import resource from './lib/resource-budget.cjs';
const port = resource.positiveInteger(process.env.EXPO_PORT ?? '8081', 'EXPO_PORT');
if (port > 65535) throw new Error('EXPO_PORT must be <=65535');
const args = process.argv.slice(2);
if (args.some(arg => /^--max-workers/.test(arg))) throw new Error('Use FINETUNE_BUILD_MAX_WORKERS; the measured memory budget clamps it safely.');
const result = await runMonitoredNode(['node_modules/expo/bin/cli', 'start', '--web', '--port', String(port), ...args], {
  label: 'Expo Metro development server', kind: 'build',
  env: { ...process.env, EXPO_USE_METRO_WORKSPACE_ROOT: '1' },
});
process.exitCode = result.status;
