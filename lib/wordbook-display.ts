import bookOrder from "@/assets/wordbook-order.json";
import type { VocabItem } from "@/lib/vocab";

const managed = new Set(["V101", "V201", "V301", "V401", "V501", "V502", "V601"]);
const ranks = new Map(bookOrder.headwords.map((word, index) => [word, index]));
export type DisplayWord = VocabItem & { displaySourceIds?: string[]; displaySourceGroups?: string[]; displayDuplicates?: VocabItem[] };

/** Group only identical headwords for display. All underlying rows remain accessible. */
export function groupWordbookHeadwords(items: readonly DisplayWord[]): DisplayWord[] {
  const seen = new Map<string, DisplayWord>();
  const output: DisplayWord[] = [];
  for (const item of items) {
    const key = item.w.trim().toLowerCase().replace(/\s+/g, ' ');
    const prior = key ? seen.get(key) : undefined;
    if (prior) {
      prior.displayDuplicates!.push(item);
      for (const id of item.displaySourceIds ?? [item.id]) if (!prior.displaySourceIds!.includes(id)) prior.displaySourceIds!.push(id);
      for (const group of item.displaySourceGroups ?? [item.group]) if (!prior.displaySourceGroups!.includes(group)) prior.displaySourceGroups!.push(group);
    } else {
      const copy = { ...item, displaySourceIds: [...(item.displaySourceIds ?? [item.id])],
        displaySourceGroups: [...(item.displaySourceGroups ?? [item.group])], displayDuplicates: [...(item.displayDuplicates ?? [])] };
      output.push(copy);
      if (key) seen.set(key, copy);
    }
  }
  return output;
}

/** Display folding only; never feed representatives back into quiz/store/migration. */
export function arrangeWordbook(
  items: readonly VocabItem[],
  statePartition: (item: VocabItem) => string = () => "",
  preserveOrder = false,
): DisplayWord[] {
  const sorted = items.map((item, index) => ({ item, index })).sort((a, b) => {
    if (preserveOrder) return a.index - b.index;
    const ra = managed.has(a.item.group) ? ranks.get(a.item.w) : undefined;
    const rb = managed.has(b.item.group) ? ranks.get(b.item.w) : undefined;
    return (ra ?? Number.MAX_SAFE_INTEGER) - (rb ?? Number.MAX_SAFE_INTEGER) || a.index - b.index;
  });
  const groups = new Map<string, DisplayWord>();
  const output: DisplayWord[] = [];
  for (const { item } of sorted) {
    // Only fully identical private content within its original section folds.
    // Original row/order/ID remain available, with independent record controls.
    const { id: bookId, order: bookOrderIndex, ...bookContent } = item.book ?? {};
    void bookId; void bookOrderIndex;
    // Exact values only: no case folding, punctuation removal, meaning overlap,
    // empty gloss merging, pronunciation loss or inferred synonym equivalence.
    const key = managed.has(item.group) && item.w.trim() && item.k.trim()
      ? JSON.stringify([item.w, item.k, item.p, item.type, item.referenceOnly ?? false,
        item.conceptLabel, item.majorConceptLabel, item.s, item.localBook ? bookContent : '', statePartition(item)])
      : `unmerged:${item.id}`;
    const prior = groups.get(key);
    if (prior) {
      prior.displaySourceIds!.push(item.id);
      prior.displayDuplicates!.push(item);
      if (!prior.displaySourceGroups!.includes(item.group)) prior.displaySourceGroups!.push(item.group);
    } else {
      const copy = { ...item, displaySourceIds: [item.id], displaySourceGroups: [item.group], displayDuplicates: [] };
      output.push(copy);
      groups.set(key, copy);
    }
  }
  return output;
}
