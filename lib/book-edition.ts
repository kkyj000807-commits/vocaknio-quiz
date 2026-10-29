import edition from '@/assets/book-edition-v1.5.json';
import { VOCAB_BY_ID } from '@/lib/vocab';

export interface BookEntry {
  id: string; order: number; section: string; word: string; appIds: string[];
  concept: string; chunk: string; chapter: number | null; automaticGrading: boolean;
  display?: { meaning_display: string; annotations: unknown[]; examples: unknown[]; patterns: string[] };
  pronunciation?: { ipa: string; korean_pronunciation: string; pronunciation_status: string | null };
}
export const BOOK_EDITION = JSON.parse(edition.payload) as {
  schema: number; edition: string; datasetSha256: string; pdfSha256: string;
  privateContent: boolean; sections: string[]; sourceCounts: Record<string, number>; entries: BookEntry[];
};
export function bookMeanings(entry: BookEntry): string {
  if (BOOK_EDITION.privateContent && entry.display) return entry.display.meaning_display;
  return [...new Set(entry.appIds.map(id => VOCAB_BY_ID.get(id)?.k).filter(Boolean))].join(' / ');
}
export function bookNotes(entry: BookEntry): string[] {
  if (!BOOK_EDITION.privateContent || !entry.display) return [];
  return [...entry.display.annotations, ...entry.display.examples].map(value =>
    typeof value === 'string' ? value : value && typeof value === 'object'
      ? Object.values(value).filter(part => typeof part === 'string').join(' · ') : '').filter(Boolean);
}
export function selectBookEntries(section: string, concept: string, search: string): BookEntry[] {
  const query = search.trim().toLowerCase();
  return BOOK_EDITION.entries.filter(entry => (!section || entry.section === section) &&
    (!concept || entry.concept === concept) && (!query ||
      [entry.word, entry.concept, entry.chunk, bookMeanings(entry)].some(text => text.toLowerCase().includes(query))));
}
