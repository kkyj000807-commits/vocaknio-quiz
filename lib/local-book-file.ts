import { BOOK_EDITION, type BookEdition } from '@/lib/book-edition';
import { VOCAB_BY_ID } from '@/lib/vocab';

export const LOCAL_BOOK_MAX_BYTES = 96 * 1024 * 1024;
const DB_NAME = 'finetune-personal-book-content';
const STORE = 'verified-editions';

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
  if (typeof indexedDB === 'undefined') throw new Error('Device storage unavailable');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onblocked = () => { blocked = true; reject(new Error('Device storage blocked')); };
    request.onerror = () => reject(new Error('Device storage unavailable'));
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
  return new Promise((resolve, reject) => {
    let value: string | undefined;
    try {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      const key = `${expected.edition}:${expected.datasetSha256}`;
      const request = mode === 'readwrite' ? store.put(raw, key) : store.get(key);
      request.onsuccess = () => { if (mode === 'readonly') value = request.result; };
      // A successful put request is NOT a committed transaction.
      transaction.oncomplete = () => { db.close(); resolve(value); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error('Device storage failed')); };
    } catch { db.close(); reject(new Error('Device storage failed')); }
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
