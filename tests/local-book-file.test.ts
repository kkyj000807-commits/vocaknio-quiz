import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { BOOK_EDITION, bookMeanings, selectBookEntries, type BookEdition } from '../lib/book-edition';
import { inspectLocalBook, validateLocalBook, loadLocalBook, saveLocalBook, localBookFailureMessage, readRevisedBookContent, writeRevisedBookContent } from '../lib/local-book-file';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
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
  it('uses a distinct revision key and awaits its transaction commit', async () => {
    fixture();
    const db = database();
    let completed = false;
    const saved = writeRevisedBookContent('verified fixture').then(() => { completed = true; });
    await vi.waitFor(() => expect(db.keys).toHaveLength(1));
    expect(completed).toBe(false);
    expect(db.keys).toEqual(['verified-encrypted-package:1.7.4']);
    db.commit(); await saved;
    expect(await readRevisedBookContent()).toBe('verified fixture');
    expect(db.opened).toEqual(['finetune-personal-book-content', 'finetune-personal-book-content']);
    expect(db.keys.every(key => key === 'verified-encrypted-package:1.7.4')).toBe(true);
  });
  it.each(['QuotaExceededError', 'SecurityError'])('classifies %s without exposing browser details', async name => {
    vi.stubGlobal('indexedDB', { open: () => { throw Object.assign(new Error('private-detail'), { name }); } });
    const error = await loadLocalBook().catch(error => error);
    expect(error.code).toBe(name === 'QuotaExceededError' ? 'quota' : 'blocked');
    expect(localBookFailureMessage(error)).not.toContain('private-detail');
    expect(localBookFailureMessage(error)).toContain('삭제·초기화하지는 않았습니다');
  });
  it('bounds a stalled open and closes a late connection without reading or overwriting', async () => {
    vi.useFakeTimers();
    const close = vi.fn(); const transaction = vi.fn();
    const request: any = { result: { close, transaction } };
    vi.stubGlobal('indexedDB', { open: () => request });
    const pending = expect(loadLocalBook()).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    request.onsuccess();
    expect(close).toHaveBeenCalledOnce(); expect(transaction).not.toHaveBeenCalled();
  });
  it('does not wait forever when a content read stops responding', async () => {
    vi.useFakeTimers();
    const abort = vi.fn(); const close = vi.fn();
    const tx = { abort, objectStore: () => ({ get: () => ({}) }) };
    vi.stubGlobal('indexedDB', { open: () => {
      const request: any = { result: { close, transaction: () => tx } };
      queueMicrotask(() => request.onsuccess()); return request;
    } });
    const pending = expect(loadLocalBook()).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(30_000); await pending;
    expect(abort).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  });
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
