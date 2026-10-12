import { it } from 'vitest';
import { definitionLoaderCases, definitionAuditCases } from './helpers/definition-loader-cases.mjs';
for (const [name, run] of [...definitionLoaderCases, ...definitionAuditCases]) it(name, run);
