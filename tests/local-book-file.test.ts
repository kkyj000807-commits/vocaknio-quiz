import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { BOOK_EDITION, bookMeanings, selectBookEntries, type BookEdition } from '../lib/book-edition';
import { inspectLocalBook, validateLocalBook, loadLocalBook, saveLocalBook } from '../lib/local-book-file';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const data: BookEdition = { ...BOOK_EDITION, privateContent: true, marker: 'local-fixture', sections: ['V101'], sourceCounts: { V101: 1 },
    entries: [{ id: 'fixture-study-only', order: 1, word: 'fixture', section: 'V101', appIds: [], concept: '', chunk: '', chapter: null,
      automaticGrading: false, display: { meaning_display: '교재 원뜻', annotations: [], examples: [], patterns: [] },
      pronunciation: { ipa: '', korean_pronunciation: '참고', pronunciation_status: null }, gradingReview: { status: 'app_policy_not_validated' } }] };
  const raw = JSON.stringify({ payload: JSON.stringify(data) });
  const expected = { ...data, localFileSha256: createHash('sha256').update(raw).digest('hex') };
  vi.stubGlobal('crypto', webcrypto);
  return { data, raw, expected };
}
function database(initial?: string, abortWrite = false) {
  let stored = initial;
  let commit: (() => void) | undefined;
  const opened: string[] = [];
  const keys: string[] = [];
  const close = vi.fn();
  vi.stubGlobal('indexedDB', { open(name: string) {
    opened.push(name);
    const request: Record<string, unknown> = {};
    queueMicrotask(() => {
      request.result = { close, transaction(storeName: string, mode: string) {
        expect(storeName).toBe('verified-editions');
        const transaction: Record<string, unknown> = {};
        const requestFor = (key: string, raw?: string) => {
          keys.push(key);
          const operation: Record<string, unknown> = {};
          queueMicrotask(() => {
            operation.result = mode === 'readonly' ? stored : key;
            (operation.onsuccess as (() => void) | undefined)?.();
            const complete = () => {
              if (abortWrite && mode === 'readwrite') (transaction.onabort as () => void)();
              else { if (mode === 'readwrite') stored = raw; (transaction.oncomplete as () => void)(); }
            };
            if (mode === 'readwrite') commit = complete; else complete();
          });
          return operation;
        };
        transaction.objectStore = () => ({ get: (key: string) => requestFor(key), put: (raw: string, key: string) => requestFor(key, raw) });
        return transaction;
      } };
      (request.onsuccess as () => void)();
    });
    return request;
  } });
  return { opened, keys, close, stored: () => stored, commit: () => { if (!commit) throw new Error('No transaction'); commit(); } };
}

describe('local book content: no learner migration or upload', () => {
  it('pins exact file hash before parsing and does not mutate public data', async () => {
    const { raw, expected } = fixture();
    const before = JSON.stringify(BOOK_EDITION);
    const data = await inspectLocalBook(raw, expected);
    expect(bookMeanings(data.entries[0], data)).toBe('교재 원뜻');
    expect(selectBookEntries('', '', '교재', data)).toHaveLength(1);
    expect(JSON.stringify(BOOK_EDITION)).toBe(before);
    await expect(inspectLocalBook(raw + ' ', expected)).rejects.toThrow('checksum');
    expect(() => validateLocalBook({ ...data, entries: [] }, expected)).toThrow('Incomplete');
    expect(() => validateLocalBook({ ...data, entries: [{ ...data.entries[0], automaticGrading: true }] }, expected)).toThrow('Invalid');
  });
  it('does not report storage success before transaction commit; reopens exact content', async () => {
    const { raw, expected } = fixture(); const db = database();
    let done = false;
    const saved = saveLocalBook(raw, expected).then(value => { done = true; return value; });
    // Hashing uses the real async WebCrypto API. Wait for the fake put request only.
    await vi.waitFor(() => expect(db.keys).toHaveLength(1));
    expect(done).toBe(false); expect(db.stored()).toBeUndefined();
    db.commit(); await saved;
    expect((await loadLocalBook(expected))?.entries).toHaveLength(1);
    expect(db.opened.every(name => name === 'finetune-personal-book-content')).toBe(true);
    expect(db.keys.every(key => key === `${expected.edition}:${expected.datasetSha256}`)).toBe(true);
  });
  it('preserves previous book on aborted write and leaves unsupported stored values intact', async () => {
    const { raw, expected } = fixture(); const db = database('previous-content-sentinel', true);
    const saved = saveLocalBook(raw, expected);
    await vi.waitFor(() => expect(db.keys).toHaveLength(1)); db.commit();
    await expect(saved).rejects.toThrow('storage');
    expect(db.stored()).toBe('previous-content-sentinel');
    await expect(loadLocalBook(expected)).rejects.toThrow('checksum');
    expect(db.stored()).toBe('previous-content-sentinel');
  });
  it('fails explicitly on unavailable storage and never calls network or learner storage APIs', async () => {
    const { raw, expected } = fixture();
    vi.stubGlobal('indexedDB', undefined);
    await expect(saveLocalBook(raw, expected)).rejects.toThrow('unavailable');
    for (const file of ['lib/local-book-file.ts', 'components/local-book-import.tsx']) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|axios|localStorage|sessionStorage|@\/lib\/store/);
    }
  });
});
