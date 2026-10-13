import { it } from 'vitest';
import { relationLayoutCases } from './helpers/relation-layout-cases.mjs';
for (const [name, run] of relationLayoutCases) it(name, run);
