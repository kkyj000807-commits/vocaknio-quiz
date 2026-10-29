import type { BookEdition, BookEntry } from '@/lib/book-edition';
import { registerStudyItems, WORDBOOK_VOCAB, type VocabItem } from '@/lib/vocab';

export const LOCAL_BOOK_NUM_BASE = 1_000_000_000;
export function localBookIdentity(entry: Pick<BookEntry, 'id'>) {
  const created = /^study-new-([0-9a-f]{20})$/.exec(entry.id);
  // Separate numeric namespace for source-assigned hash IDs. Twelve hex digits
  // fit exactly in a JS safe integer; complete-batch collision checks are mandatory.
  if (created) return { id: `book:v1.5:${entry.id}`, num: 2_000_000_000 + Number.parseInt(created[1].slice(0, 12), 16) };
  const match = /^study-(\d+)$/.exec(entry.id);
  const suffix = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(suffix) || suffix <= 0 || suffix >= 1_000_000_000) throw new Error('Invalid stable study identity');
  return { id: `book:v1.5:${entry.id}`, num: LOCAL_BOOK_NUM_BASE + suffix };
}
const sectionGroup = (section: string): VocabItem['group'] =>
  section === '부록' ? 'APPENDIX' : /^V[1-6]0[12]$/.test(section) ? section as VocabItem['group'] : 'PERSONAL';

/** Exact display duplicates only. Spelling links/aliases NEVER authorize a sense or history merge. */
export function createIntegratedWordbook(original: readonly VocabItem[], edition: BookEdition): VocabItem[] {
  if (!edition.privateContent) return [...original];
  const byWord = new Map<string, VocabItem[]>();
  for (const item of original) { const rows = byWord.get(item.w) ?? []; rows.push(item); byWord.set(item.w, rows); }
  const consumed = new Set<string>();
  const rows: VocabItem[] = [];
  const seenIds = new Set(original.map(item => item.id));
  const seenNums = new Set(original.map(item => item.num));
  const anchors = new Map<string, number>();
  for (const entry of edition.entries) {
    if (!entry.display?.meaning_display.trim()) throw new Error('Missing study meaning');
    if (!anchors.has(entry.word)) anchors.set(entry.word, entry.order);
    // Literal word/gloss/IPA match only, no editorial conflict or alias inference.
    const exact = entry.gradingReview?.status !== 'requires_editorial_policy_review'
      ? (byWord.get(entry.word) ?? []).find(item => !consumed.has(item.id) && item.k === entry.display!.meaning_display &&
        (!entry.pronunciation?.ipa || item.p === entry.pronunciation.ipa)) : undefined;
    if (exact) { consumed.add(exact.id); rows.push({ ...exact, book: entry }); continue; }
    const identity = localBookIdentity(entry);
    if (seenIds.has(identity.id) || seenNums.has(identity.num)) throw new Error('Conflicting study identity');
    seenIds.add(identity.id); seenNums.add(identity.num);
    rows.push({ ...identity, sourceIndex: entry.order, sourceNumber: entry.id,
      w: entry.word, k: entry.display.meaning_display, k_short: entry.display.meaning_display,
      p: entry.pronunciation?.ipa ?? '', s: [], group: sectionGroup(entry.section),
      conceptId: `book:v1.5:${entry.section}:${entry.concept}`, conceptLabel: entry.concept,
      majorConceptLabel: entry.chunk || entry.concept, category: entry.section,
      type: entry.section === '숙어' ? 'idiom' : /\s/.test(entry.word) ? 'phrase' : 'word',
      localBook: true, book: entry });
  }
  // Different original meanings remain ordinary cards, not nested cards or links.
  const remaining = original.filter(item => !consumed.has(item.id));
  const entryByWord = new Map(edition.entries.map(entry => [entry.word, entry]));
  const sectionFor = (item: VocabItem) => item.book?.section ?? entryByWord.get(item.w)?.section ?? (item.group === 'APPENDIX' ? '부록' : item.group);
  const sectionAnchors = new Map<string, { source: number; order: number }[]>();
  for (const item of original) {
    const entry = entryByWord.get(item.w);
    if (!entry) continue;
    const section = item.group === 'APPENDIX' ? '부록' : item.group;
    if (entry.section !== section) continue;
    const points = sectionAnchors.get(section) ?? [];
    points.push({ source: item.sourceIndex, order: entry.order }); sectionAnchors.set(section, points);
  }
  for (const points of sectionAnchors.values()) points.sort((a, b) => a.source - b.source);
  const rank = (item: VocabItem) => {
    if (item.book) return item.book.order;
    if (anchors.has(item.w)) return anchors.get(item.w)! + 0.25;
    const points = sectionAnchors.get(sectionFor(item)) ?? [];
    let lo = 0, hi = points.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].source <= item.sourceIndex) lo = mid + 1; else hi = mid; }
    return (points[Math.max(0, lo - 1)]?.order ?? Number.MAX_SAFE_INTEGER - 1) + 0.5;
  };
  const ranked = [...rows, ...remaining].map((item, index) => ({ item, index, rank: rank(item), section: edition.sections.indexOf(sectionFor(item)) }));
  ranked.sort((a, b) => (a.section < 0 ? 99 : a.section) - (b.section < 0 ? 99 : b.section) || a.rank - b.rank || a.index - b.index);
  return ranked.map(row => row.item);
}

let activeEdition: BookEdition | null = null;
export function getActiveBookEdition() { return activeEdition; }
/** Only after complete pinned-file verification. No learner writes. */
export function activateLocalBook(edition: BookEdition) {
  if (activeEdition === edition) return;
  const items = createIntegratedWordbook(WORDBOOK_VOCAB, edition);
  registerStudyItems(items);
  activeEdition = edition;
}
