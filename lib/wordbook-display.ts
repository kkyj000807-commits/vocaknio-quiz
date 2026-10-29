import bookOrder from "@/assets/wordbook-order.json";
import type { VocabItem } from "@/lib/vocab";

const managed = new Set(["V101", "V201", "V301", "V401", "V501", "V502", "V601"]);
const ranks = new Map(bookOrder.headwords.map((word, index) => [word, index]));
export type DisplayWord = VocabItem & { displaySourceIds?: string[]; displaySourceGroups?: string[] };

/** Display folding only; never feed representatives back into quiz/store/migration. */
export function arrangeWordbook(
  items: readonly VocabItem[],
  statePartition: (item: VocabItem) => string = () => "",
): DisplayWord[] {
  const sorted = items.map((item, index) => ({ item, index })).sort((a, b) => {
    const ra = managed.has(a.item.group) ? ranks.get(a.item.w) : undefined;
    const rb = managed.has(b.item.group) ? ranks.get(b.item.w) : undefined;
    return (ra ?? Number.MAX_SAFE_INTEGER) - (rb ?? Number.MAX_SAFE_INTEGER) || a.index - b.index;
  });
  const groups = new Map<string, DisplayWord>();
  const output: DisplayWord[] = [];
  for (const { item } of sorted) {
    // Exact values only: no case folding, punctuation removal, meaning overlap,
    // empty gloss merging, pronunciation loss or inferred synonym equivalence.
    const key = managed.has(item.group) && item.w.trim() && item.k.trim()
      ? JSON.stringify([item.w, item.k, item.p, item.type, item.referenceOnly ?? false,
        item.conceptLabel, item.majorConceptLabel, item.s, statePartition(item)])
      : `unmerged:${item.id}`;
    const prior = groups.get(key);
    if (prior) {
      prior.displaySourceIds!.push(item.id);
      if (!prior.displaySourceGroups!.includes(item.group)) prior.displaySourceGroups!.push(item.group);
    } else {
      const copy = { ...item, displaySourceIds: [item.id], displaySourceGroups: [item.group] };
      output.push(copy);
      groups.set(key, copy);
    }
  }
  return output;
}
