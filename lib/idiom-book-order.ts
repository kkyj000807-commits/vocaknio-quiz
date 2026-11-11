import type { VocabItem } from '@/lib/vocab';

export type IdiomPlacement = { id: string; displayNumber: number; section: string; sourceIds: string[] };
export type OrderedIdiom = { item: VocabItem; displayNumber: number; section: string };
let installed: Map<string, IdiomPlacement> | null = null;

/** Build a display-only view. All original rows, numeric IDs, and records remain untouched. */
export function resolveIdiomBookOrder(items: readonly VocabItem[], placements: readonly IdiomPlacement[]) {
  const original = items.filter(item => item.book?.section === '숙어');
  const byBookId = new Map<string, VocabItem>();
  for (const item of original) {
    const id = item.book!.id;
    if (byBookId.has(id)) throw new Error('Duplicate original idiom identity');
    byBookId.set(id, item);
  }
  const used = new Set<string>();
  const representatives = new Set<string>();
  const ordered: OrderedIdiom[] = placements.map((placement, index) => {
    const item = byBookId.get(placement.id);
    if (!item || representatives.has(placement.id) || placement.displayNumber !== index + 1 ||
      !placement.section || !Array.isArray(placement.sourceIds) || !placement.sourceIds.includes(placement.id))
      throw new Error('Invalid idiom placement');
    representatives.add(placement.id);
    for (const id of placement.sourceIds) {
      if (!byBookId.has(id) || used.has(id)) throw new Error('Invalid idiom source identity');
      used.add(id);
    }
    return { item, displayNumber: placement.displayNumber, section: placement.section };
  });
  // Kept as independent rows, never rekeyed or merged into the representative.
  const historical = original.filter(item => !representatives.has(item.book!.id));
  return { ordered, historical };
}

/** In-memory presentation only; no IndexedDB or learner-state migration. */
export function applyIdiomBookOrder(items: readonly VocabItem[], placements: readonly IdiomPlacement[], includeHistorical = false) {
  const { ordered, historical } = resolveIdiomBookOrder(items, placements);
  const nonIdioms = items.filter(item => item.book?.section !== '숙어');
  return [...nonIdioms, ...ordered.map(({ item }) => item), ...(includeHistorical ? historical : [])];
}

/** Install only after the encrypted package and complete old registry are validated. */
export function installIdiomBookOrder(items: readonly VocabItem[], placements: readonly IdiomPlacement[]) {
  if (placements.length !== 5789) throw new Error('Incomplete idiom revision');
  resolveIdiomBookOrder(items, placements);
  installed = new Map(placements.map(placement => [placement.id, placement]));
}
export function getIdiomBookPlacement(id: string) { return installed?.get(id); }
export function getIdiomBookRevisionCount() { return installed?.size; }
export function orderInstalledIdiomSubset(items: readonly VocabItem[], includeHistorical: boolean): VocabItem[] {
  if (!installed) return [...items];
  const nonIdioms = items.filter(item => item.book?.section !== '숙어');
  const idioms = items.filter(item => item.book?.section === '숙어');
  const active = idioms.filter(item => installed!.has(item.book!.id))
    .sort((a, b) => installed!.get(a.book!.id)!.displayNumber - installed!.get(b.book!.id)!.displayNumber);
  return [...nonIdioms, ...active, ...(includeHistorical ? idioms.filter(item => !installed!.has(item.book!.id)) : [])];
}
