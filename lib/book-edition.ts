import edition from '@/assets/book-edition-v1.5.json';
import { VOCAB_BY_ID } from '@/lib/vocab';

export interface BookEntry {
  id: string; order: number; section: string; word: string; appIds: string[];
  concept: string; chunk: string; chapter: number | null; automaticGrading: boolean;
  display?: { meaning_display: string; annotations: unknown[]; examples: unknown[]; patterns: string[];
    synonym_hints?: string[]; approved_aliases?: string[] };
  pronunciation?: { ipa: string; korean_pronunciation: string; pronunciation_status: string | null;
    korean_pronunciation_status?: string | null };
  gradingReview?: { status: string; original_answer_preserved?: boolean };
}
export interface BookEdition {
  schema: number; edition: string; datasetSha256: string; pdfSha256: string;
  privateContent: boolean; sections: string[]; sourceCounts: Record<string, number>; entries: BookEntry[];
  canonicalSha256: string; localFileSha256?: string; marker?: string;
}
export const BOOK_EDITION = JSON.parse(edition.payload) as BookEdition;
export function bookMeanings(entry: BookEntry, source = BOOK_EDITION): string {
  if (source.privateContent && entry.display) return entry.display.meaning_display;
  return [...new Set(entry.appIds.map(id => VOCAB_BY_ID.get(id)?.k).filter(Boolean))].join(' / ');
}
export function bookNotes(entry: BookEntry, source = BOOK_EDITION): string[] {
  if (!source.privateContent || !entry.display) return [];
  return bookStudyDetails(entry).map(note => `${note.label}: ${note.text}${note.source ? ` · 출처: ${note.source}` : ''}`);
}
export interface BookStudyDetail { label: string; text: string; source?: string }
// Pure projection of supplied editorial content. Never invent corrections, senses or aliases.
export function bookStudyDetails(entry: BookEntry): BookStudyDetail[] {
  if (!entry.display) return [];
  const project = (values: unknown[], fallback: string): BookStudyDetail[] => values.flatMap(value => {
    if (typeof value === 'string') return value.trim() ? [{ label: fallback, text: value }] : [];
    if (!value || typeof value !== 'object') return [];
    const note = value as Record<string, unknown>;
    if (typeof note.text !== 'string' || !note.text.trim()) return [];
    return [{ label: typeof note.kind === 'string' ? note.kind : fallback, text: note.text,
      ...(typeof note.source === 'string' ? { source: note.source } : {}) }];
  });
  return [...project(entry.display.annotations, '학습 주석'), ...project(entry.display.examples, '예문')];
}
export function bookNeedsEditorialReview(entry: BookEntry): boolean {
  return entry.gradingReview?.status === 'requires_editorial_policy_review';
}
export function bookPronunciation(entry: BookEntry): string {
  if (!entry.pronunciation) return '';
  const ipa = entry.pronunciation.ipa || 'IPA 미확인';
  const korean = entry.pronunciation.korean_pronunciation.trim();
  return korean ? `${ipa} · ${korean.startsWith('≈') ? korean : `≈ ${korean}`}` : ipa;
}
export function selectBookEntries(section: string, concept: string, search: string, source = BOOK_EDITION): BookEntry[] {
  const query = search.trim().toLowerCase();
  return source.entries.filter(entry => (!section || entry.section === section) &&
    (!concept || entry.concept === concept) && (!query ||
      [entry.word, entry.concept, entry.chunk, bookMeanings(entry, source)].some(text => text.toLowerCase().includes(query))));
}
