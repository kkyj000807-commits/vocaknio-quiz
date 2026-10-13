import { test } from 'node:test';
import { relationLayoutCases } from './helpers/relation-layout-cases.mjs';
for (const [name, run] of relationLayoutCases) test(name, run);
