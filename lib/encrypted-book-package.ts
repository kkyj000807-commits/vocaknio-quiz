import { inspectLocalBook, readRevisedBookContent, writeRevisedBookContent } from '@/lib/local-book-file';
import type { BookEdition } from '@/lib/book-edition';
import type { IdiomPlacement } from '@/lib/idiom-book-order';
import { activateRevisedBook } from '@/lib/integrated-wordbook';

export const REVISED_BOOK_VERSION = '1.7.4';
export const REVISED_BOOK_PDF_HASH = 'a2d2dfda7be3f8c0e08fd69615321f1b26d6fe2a8bebe83c40e6384f3be72955';

const REVISION_HASH = '7edd91a704b8e68d853c770cf6cc5e078e4f36f0a9f60b6480b03130f98ba9eb';
export type VerifiedIdiomRevision = { id: string; display_number: number; print_section: string;
  headword: string; meaning_display: string; ipa: string; korean_pronunciation: string;
  display_notes: string[]; source_member_ids: string[]; parent_label?: string; leaf?: string; core_label?: string | null };
export type VerifiedBookPackage = { base: BookEdition; revision: VerifiedIdiomRevision[]; placements: IdiomPlacement[] };

/** Validate both original edition and exact approved revision before touching any store. */
export async function inspectEncryptedBookPackage(payload: Uint8Array): Promise<VerifiedBookPackage> {
  if (!globalThis.crypto?.subtle || payload.byteLength > 96 * 1024 * 1024) throw new Error('Package unavailable');
  const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
  if (envelope?.schema !== 2 || envelope.edition !== REVISED_BOOK_VERSION || envelope.pdfSha256 !== REVISED_BOOK_PDF_HASH || typeof envelope.base !== 'string' || typeof envelope.revision !== 'string')
    throw new Error('Invalid package');
  const base = await inspectLocalBook(envelope.base);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(envelope.revision)));
  const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== REVISION_HASH) throw new Error('Revision checksum mismatch');
  const revision: VerifiedIdiomRevision[] = JSON.parse(envelope.revision).idioms;
  if (!Array.isArray(revision) || revision.length !== 5789) throw new Error('Incomplete revision');
  const oldIds = new Set(base.entries.filter(item => item.section === '숙어').map(item => item.id));
  const representatives = new Set<string>();
  const members = new Set<string>();
  const sections = ['V101', 'V201', 'V301', 'V401', 'V501', 'V502', 'V601', '부록', '추가 숙어'];
  const counts = Object.fromEntries(sections.map(section => [section, 0]));
  const placements = revision.map((row, index) => {
    if (!row || row.display_number !== index + 1 || !oldIds.has(row.id) || representatives.has(row.id) ||
      !sections.includes(row.print_section) || typeof row.headword !== 'string' || !row.headword.trim() ||
      typeof row.meaning_display !== 'string' || !row.meaning_display.trim() || typeof row.ipa !== 'string' ||
      typeof row.korean_pronunciation !== 'string' || !Array.isArray(row.display_notes) ||
      row.display_notes.some(value => typeof value !== 'string') || !Array.isArray(row.source_member_ids) ||
      !row.source_member_ids.includes(row.id)) throw new Error('Invalid revision entry');
    representatives.add(row.id); counts[row.print_section]++;
    for (const id of row.source_member_ids) {
      if (!oldIds.has(id) || members.has(id)) throw new Error('Conflicting original identity');
      members.add(id);
    }
    return { id: row.id, displayNumber: row.display_number, section: row.print_section, sourceIds: row.source_member_ids };
  });
  if (members.size !== 5863 || JSON.stringify(Object.values(counts)) !== JSON.stringify([166, 88, 12, 156, 622, 11, 2, 557, 4175]))
    throw new Error('Revision coverage mismatch');
  return { base, revision, placements };
}

/** v1.7.4 publisher preserves volume-one body; revised idioms replace (not append
 * to) their old gloss/IPA/notes. No old gloss, alias, or spelling fallback. */
export function revisedBookEdition({ base, revision }: VerifiedBookPackage): BookEdition {
  const sections = ['V101', 'V201', 'V301', 'V401', 'V501', 'V502', 'V601', '부록', '숙어'];
  const volumeOne = base.entries.filter(entry => sections.slice(0, -1).includes(entry.section));
  const old = new Map(base.entries.map(entry => [entry.id, entry]));
  const idioms = revision.map(row => {
    const prior = old.get(row.id);
    if (!prior) throw new Error('Missing source identity');
    return { ...prior, word: row.headword, appIds: [],
      concept: row.parent_label ?? '', chunk: row.core_label ?? row.leaf ?? '',
      printedNumber: row.display_number, chapter: null, automaticGrading: false,
      display: { meaning_display: row.meaning_display, annotations: row.display_notes, examples: [], patterns: [] },
      pronunciation: { ipa: row.ipa, korean_pronunciation: row.korean_pronunciation, pronunciation_status: 'verified-publisher-source' },
      gradingReview: { status: 'app_policy_not_validated' },
    };
  });
  const entries = [...volumeOne, ...idioms].map((entry, index) => ({ ...entry, order: index + 1 }));
  return { ...base, edition: REVISED_BOOK_VERSION, pdfSha256: REVISED_BOOK_PDF_HASH,
    datasetSha256: REVISION_HASH, sections,
    sourceCounts: Object.fromEntries(sections.map(section => [section, entries.filter(entry => entry.section === section).length])), entries };
}

export async function restoreRevisedBook(): Promise<boolean> {
  const raw = await readRevisedBookContent();
  if (raw === undefined) return false;
  const verified = await inspectEncryptedBookPackage(new TextEncoder().encode(raw));
  activateRevisedBook(verified.base, revisedBookEdition(verified));
  return true;
}
export async function persistRevisedBook(payload: Uint8Array) {
  const verified = await inspectEncryptedBookPackage(payload);
  const edition = revisedBookEdition(verified);
  // A successful request is not enough: the shared helper awaits transaction commit.
  await writeRevisedBookContent(new TextDecoder('utf-8', { fatal: true }).decode(payload));
  activateRevisedBook(verified.base, edition);
}
