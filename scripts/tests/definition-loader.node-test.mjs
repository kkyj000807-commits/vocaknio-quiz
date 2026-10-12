import { test } from 'node:test';
import { definitionLoaderCases, definitionAuditCases } from '../../tests/helpers/definition-loader-cases.mjs';
for (const [name, run] of [...definitionLoaderCases, ...definitionAuditCases]) test(name, run);
