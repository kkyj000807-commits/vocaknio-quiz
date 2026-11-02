import { describe, expect, it } from 'vitest';
import ts from 'typescript';

describe('active TypeScript input boundary', () => {
  it('checks current sources without recursively rechecking preserved output archives', () => {
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
    expect(parsed.errors).toEqual([]);
    expect(parsed.fileNames.filter(name => name.replaceAll('\\', '/').startsWith('output/'))).toEqual([]);
    for (const file of ['app/quiz.tsx', 'app/(tabs)/wordbook.tsx', 'components/wordbook-practice.tsx', 'lib/store.ts', 'lib/wordbook-practice.ts', 'tests/quiz-session.test.ts']) {
      expect(parsed.fileNames).toContain(file);
    }
  });
});
