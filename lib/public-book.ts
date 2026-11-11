import manifest from '@/assets/public-book-manifest.json';
import type { BookEdition } from '@/lib/book-edition';
import { activateRevisedBook } from '@/lib/integrated-wordbook';

type PublicBook = { schema: number; distribution: string; current: BookEdition; historical: BookEdition };
export async function inspectPublicBook(bytes: ArrayBuffer): Promise<PublicBook> {
  if (bytes.byteLength !== manifest.bytes) throw new Error('Incomplete public book');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  if (Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') !== manifest.sha256)
    throw new Error('Public book checksum mismatch');
  const data: PublicBook = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (data.schema !== 1 || data.distribution !== 'public-study' || data.current.edition !== manifest.edition
    || data.current.entries.length !== manifest.entries || data.historical.entries.length !== manifest.historicalEntries
    || JSON.stringify(data.current.sourceCounts) !== JSON.stringify(manifest.sourceCounts)) throw new Error('Public book coverage mismatch');
  return data;
}

function bookUrl() {
  const prefix = typeof location !== 'undefined' && location.pathname.startsWith('/vocaknio-quiz') ? '/vocaknio-quiz/' : '/';
  return prefix + manifest.file;
}

/** Public content is independent of learner storage. A disabled/full cache must
 * never prevent study, clear a record, or ask the owner to import a private file. */
export async function loadPublicBook(): Promise<void> {
  const url = bookUrl();
  let cache: Cache | undefined;
  const deadline = <T>(promise: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Content cache timeout')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
  try {
    cache = typeof caches === 'undefined' ? undefined : await deadline(caches.open('finetune-public-study-v1'), 1500);
    const cached = cache && await deadline(cache.match(url), 1500);
    if (cached) {
      const data = await inspectPublicBook(await cached.arrayBuffer());
      activateRevisedBook(data.historical, data.current);
      return;
    }
  } catch { /* Cache is optional. Fetch and verify again; never touch learner keys. */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Public book unavailable');
    const copy = response.clone();
    const data = await inspectPublicBook(await response.arrayBuffer());
    activateRevisedBook(data.historical, data.current);
    // Activation does not wait for a cache write. The content remains available
    // for this visit even if the browser denies persistent storage.
    if (cache) void cache.put(url, copy).catch(() => undefined);
  } finally { clearTimeout(timer); }
}
