import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import manifest from '../assets/public-book-manifest.json';
import { inspectPublicBook, loadPublicBook } from '../lib/public-book';
import { activateRevisedBook } from '../lib/integrated-wordbook';

vi.mock('@/lib/integrated-wordbook', () => ({ activateRevisedBook: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const bytes = () => fs.readFileSync(`public/${manifest.file}`);
describe('approved public book without owner import or password', () => {
  it('verifies exact publication hash, current counts and historical identities', async () => {
    const raw = bytes();
    const data = await inspectPublicBook(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
    expect(data.current.entries).toHaveLength(17906);
    expect(data.current.sourceCounts.V301).toBe(2501);
    expect(data.current.sourceCounts['숙어']).toBe(5789);
    expect(data.historical.entries).toHaveLength(manifest.historicalEntries);
    expect(data.current.entries[0].word).toBe('docile');
    await expect(inspectPublicBook(new ArrayBuffer(10))).rejects.toThrow('Incomplete');
    const changed = new Uint8Array(bytes()); changed[500] ^= 1;
    await expect(inspectPublicBook(changed.buffer)).rejects.toThrow('checksum');
  });
  it('loads with disabled caches/IndexedDB and performs no learner writes', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('caches', { open: vi.fn().mockRejectedValue(new Error('blocked')) });
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes()));
    vi.stubGlobal('fetch', fetcher);
    await loadPublicBook();
    expect(activateRevisedBook).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0][0])).toContain(manifest.file);
  });
  it('uses verified cached content offline without an import; rejects corrupt downloads', async () => {
    vi.stubGlobal('caches', { open: async () => ({ match: async () => new Response(bytes()) }) });
    const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher);
    await loadPublicBook();
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubGlobal('caches', undefined);
    fetcher.mockResolvedValueOnce(new Response('invalid'));
    await expect(loadPublicBook()).rejects.toThrow();
    expect(activateRevisedBook).toHaveBeenCalledOnce();
  });
  it('removes password/file-import steps and keeps root navigation accessible on migration failure', () => {
    const wordbook = fs.readFileSync('app/(tabs)/wordbook.tsx', 'utf8');
    const settings = fs.readFileSync('app/(tabs)/settings.tsx', 'utf8');
    const root = fs.readFileSync('app/_layout.tsx', 'utf8');
    expect(wordbook).not.toContain('<EncryptedBookUnlock');
    expect(wordbook).not.toContain('단권화 불러오기');
    expect(settings).not.toContain('<LocalBookImport');
    expect(root).toContain('loadPublicBook()');
    expect(root).not.toContain('setMigrationStatus("error")');
  });
  it('keeps same quiz constraints and prevents session-only answers from changing stored history', () => {
    const quiz = fs.readFileSync('app/quiz.tsx', 'utf8');
    expect(quiz).toContain('await prepareQuestions(true)');
    expect(quiz).toContain("failureStage !== 'CONTENT_PREPARE'");
    expect(quiz).toContain('practiceOnly ? { session: null, archived: false }');
    expect(quiz).toContain('if (!practiceOnly && nextQuestions.length) await saveQuizSession');
    expect(quiz.match(/if \(!practiceOnlyRef.current\) recordOneAnswer/g)).toHaveLength(4);
    expect(quiz).toContain("if (practiceOnlyRef.current) { handleFlashGrade('correct'); return; }");
    expect(quiz).toContain('learningTargetKeys: reviewKeys.length ? reviewKeys : undefined');
    expect(quiz).toContain('itemNums: scopedNums ??');
    expect(fs.readFileSync('app/result.tsx', 'utf8')).toContain("params.practiceOnly === '1'");
  });
});
