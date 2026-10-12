import { it } from 'vitest';
import { memoryToolCases } from './helpers/memory-tool-cases.mjs';
for (const [name, run] of memoryToolCases.filter(([name]) => name.startsWith('budget:'))) it(name, run);
