import { BOOK_EDITION, type BookEdition } from '@/lib/book-edition';
import { VOCAB_BY_ID } from '@/lib/vocab';

export const LOCAL_BOOK_MAX_BYTES = 96 * 1024 * 1024;
const DB_NAME = 'finetune-personal-book-content';
const STORE = 'verified-editions';
export class LocalBookStorageError extends Error {
  constructor(readonly code: 'timeout' | 'blocked' | 'unavailable' | 'quota' | 'failed') {
    super(`Device storage ${code}`); this.name = 'LocalBookStorageError';
  }
}
function storageFailure(error: unknown): LocalBookStorageError {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  return new LocalBookStorageError(name === 'QuotaExceededError' ? 'quota'
    : name === 'SecurityError' || name === 'NotAllowedError' ? 'blocked' : 'failed');
}
export function localBookFailureMessage(error: unknown): string {
  const reason = error instanceof LocalBookStorageError ? {
    timeout: '교재 저장소 응답이 지연되어 기다리기를 멈췄습니다. 다시 확인해 주세요.',
    blocked: '교재 저장소 접근이 막혔습니다. 기존에 사용하던 브라우저의 일반 탭에서 다시 확인해 주세요.',
    unavailable: '이 브라우저에서 교재 저장소를 사용할 수 없습니다.',
    quota: '교재를 저장할 공간이 부족합니다. 사이트 데이터는 지우지 말고 기록부터 백업해 주세요.',
    failed: '교재 저장소 작업을 완료하지 못했습니다. 다시 확인해 주세요.',
  }[error.code] : '교재 파일의 판본·무결성 검증을 완료하지 못했습니다. 원본 파일을 보관해 주세요.';
  return `${reason} 앱이 기존 교재나 학습 기록을 삭제·초기화하지는 않았습니다.`;
}

// This database stores book CONTENT only. Never touch learner keys, journal or MASTER.
export function validateLocalBook(value: unknown, expected = BOOK_EDITION): BookEdition {
  if (!value || typeof value !== 'object') throw new Error('Invalid book');
  const data = value as BookEdition;
  if (data.schema !== 1 || data.edition !== expected.edition || !data.privateContent
    || typeof data.marker !== 'string'
    || data.datasetSha256 !== expected.datasetSha256 || data.pdfSha256 !== expected.pdfSha256
    || data.canonicalSha256 !== expected.canonicalSha256
    || JSON.stringify(data.sections) !== JSON.stringify(expected.sections)
    || !Array.isArray(data.entries) || !data.sourceCounts) throw new Error('Book version mismatch');
  const total = Object.values(expected.sourceCounts).reduce((a, b) => a + b, 0);
  if (data.entries.length !== total) throw new Error('Incomplete book');
  const ids = new Set<string>();
  const counts: Record<string, number> = Object.fromEntries(expected.sections.map(s => [s, 0]));
  for (const [index, entry] of data.entries.entries()) {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) || entry.order !== index + 1
      || typeof entry.word !== 'string' || !entry.word.trim() || !Object.prototype.hasOwnProperty.call(counts, entry.section)
      || typeof entry.concept !== 'string' || typeof entry.chunk !== 'string'
      || entry.automaticGrading !== false || !Array.isArray(entry.appIds)
      || entry.appIds.some(id => VOCAB_BY_ID.get(id)?.w !== entry.word)
      || !entry.display || typeof entry.display.meaning_display !== 'string'
      || !Array.isArray(entry.display.annotations) || !Array.isArray(entry.display.examples)
      || !Array.isArray(entry.display.patterns) || !entry.pronunciation
      || typeof entry.pronunciation.ipa !== 'string'
      || typeof entry.pronunciation.korean_pronunciation !== 'string'
      || !entry.gradingReview || typeof entry.gradingReview.status !== 'string') throw new Error('Invalid book entry');
    ids.add(entry.id); counts[entry.section]++;
  }
  if (Object.keys(data.sourceCounts).length !== expected.sections.length
    || expected.sections.some(s => counts[s] !== expected.sourceCounts[s] || data.sourceCounts[s] !== counts[s])) {
    throw new Error('Section count mismatch');
  }
  return data;
}

export async function inspectLocalBook(raw: string, expected = BOOK_EDITION): Promise<BookEdition> {
  const bytes = new TextEncoder().encode(raw);
  if (bytes.byteLength > LOCAL_BOOK_MAX_BYTES || !expected.localFileSha256 || !globalThis.crypto?.subtle) {
    throw new Error('Book verification unavailable');
  }
  const hash = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== expected.localFileSha256) throw new Error('Book checksum mismatch');
  const envelope = JSON.parse(raw);
  if (typeof envelope.payload !== 'string') throw new Error('Unsupported book file');
  return validateLocalBook(JSON.parse(envelope.payload), expected);
}

async function contentTransaction(mode: IDBTransactionMode, raw?: string, expected = BOOK_EDITION): Promise<string | undefined> {
  if (typeof indexedDB === 'undefined') throw new LocalBookStorageError('unavailable');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let finished = false;
    const fail = (error: LocalBookStorageError) => {
      if (finished) return;
      finished = true; clearTimeout(timer); reject(error);
    };
    const timer = setTimeout(() => fail(new LocalBookStorageError('timeout')), 15_000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DB_NAME, 1); }
    catch (error) { fail(storageFailure(error)); return; }
    request.onupgradeneeded = () => {
      if (finished) { request.transaction?.abort(); return; }
      request.result.createObjectStore(STORE);
    };
    request.onblocked = () => fail(new LocalBookStorageError('blocked'));
    request.onerror = () => fail(storageFailure(request.error));
    request.onsuccess = () => {
      if (finished) { request.result.close(); return; }
      finished = true; clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
  return new Promise((resolve, reject) => {
    let value: string | undefined;
    let settled = false;
    let transaction: IDBTransaction | undefined;
    const finish = (error?: LocalBookStorageError) => {
      if (settled) return;
      settled = true; clearTimeout(timer); db.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      // Ignore any later completion. Never retry a timed-out write automatically.
      finish(new LocalBookStorageError('timeout'));
      try { transaction?.abort(); } catch { /* already finished */ }
    }, 30_000);
    try {
      transaction = db.transaction(STORE, mode);
      transaction.oncomplete = () => finish();
      transaction.onabort = transaction.onerror = () => finish(storageFailure(transaction?.error));
      const store = transaction.objectStore(STORE);
      const key = `${expected.edition}:${expected.datasetSha256}`;
      const request = mode === 'readwrite' ? store.put(raw, key) : store.get(key);
      request.onsuccess = () => { if (mode === 'readonly') value = request.result; };
      // A successful put request is NOT a committed transaction.
    } catch (error) { finish(storageFailure(error)); }
  });
}
export async function loadLocalBook(expected = BOOK_EDITION): Promise<BookEdition | undefined> {
  const raw = await contentTransaction('readonly', undefined, expected);
  return raw === undefined ? undefined : inspectLocalBook(raw, expected);
}
export async function saveLocalBook(raw: string, expected = BOOK_EDITION): Promise<BookEdition> {
  const data = await inspectLocalBook(raw, expected);
  await contentTransaction('readwrite', raw, expected);
  return data;
}
