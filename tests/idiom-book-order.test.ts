import { describe, expect, it } from 'vitest';
import { applyIdiomBookOrder, getIdiomBookPlacement, getIdiomBookRevisionCount, installIdiomBookOrder, orderInstalledIdiomSubset, resolveIdiomBookOrder } from '../lib/idiom-book-order';
import type { VocabItem } from '../lib/vocab';

const row = (id: string, num: number) => ({ id: `legacy-${id}`, num, book: { id, section: '숙어' } }) as VocabItem;

describe('revised idiom placement', () => {
  it('orders representatives without modifying or combining historical records', () => {
    const originals = [row('a', 1), row('b', 2), row('c', 3), row('d', 4)];
    const before = JSON.stringify(originals);
    const view = resolveIdiomBookOrder(originals, [
      { id: 'c', displayNumber: 1, section: 'V101', sourceIds: ['c', 'b'] },
      { id: 'a', displayNumber: 2, section: '추가 숙어', sourceIds: ['a'] },
    ]);
    expect(view.ordered.map(entry => [entry.item.id, entry.item.num])).toEqual([['legacy-c', 3], ['legacy-a', 1]]);
    expect(view.historical.map(item => item.num)).toEqual([2, 4]);
    expect(JSON.stringify(originals)).toBe(before);
  });
  it('rejects unknown, repeated, conflicting, and out-of-order identities', () => {
    const originals = [row('a', 1), row('b', 2)];
    expect(() => resolveIdiomBookOrder(originals, [{ id: 'x', displayNumber: 1, section: 'V101', sourceIds: ['x'] }])).toThrow();
    expect(() => resolveIdiomBookOrder(originals, [{ id: 'a', displayNumber: 2, section: 'V101', sourceIds: ['a'] }])).toThrow();
    expect(() => resolveIdiomBookOrder(originals, [
      { id: 'a', displayNumber: 1, section: 'V101', sourceIds: ['a', 'b'] },
      { id: 'b', displayNumber: 2, section: 'V101', sourceIds: ['b'] },
    ])).toThrow();
  });
  it('keeps volume one and retained historical items unchanged and ordered separately', () => {
    const volumeOne = { id: 'v101', num: 88, book: { id: 'word', section: 'V101' } } as VocabItem;
    const original = [volumeOne, row('a', 1), row('b', 2), row('c', 3)];
    const placements = [{ id: 'c', displayNumber: 1, section: 'V101', sourceIds: ['c', 'b'] },
      { id: 'a', displayNumber: 2, section: '추가 숙어', sourceIds: ['a'] }];
    const before = JSON.stringify(original);
    expect(applyIdiomBookOrder(original, placements).map(item => item.id)).toEqual(['v101', 'legacy-c', 'legacy-a']);
    expect(applyIdiomBookOrder(original, placements, true).map(item => item.id)).toEqual(['v101', 'legacy-c', 'legacy-a', 'legacy-b']);
    expect(JSON.stringify(original)).toBe(before);
  });
  it('uses a complete installed revision for display while keeping historic IDs independently reachable', () => {
    const originals = Array.from({ length: 5873 }, (_, i) => row(`i${i + 1}`, i + 1));
    const placements = Array.from({ length: 5789 }, (_, i) => ({ id: `i${5789 - i}`,
      displayNumber: i + 1, section: 'V101', sourceIds: [`i${5789 - i}`] }));
    const before = JSON.stringify(originals);
    installIdiomBookOrder(originals, placements);
    expect(getIdiomBookRevisionCount()).toBe(5789);
    expect(getIdiomBookPlacement('i5789')?.displayNumber).toBe(1);
    const ordered = orderInstalledIdiomSubset(originals, false);
    expect(ordered).toHaveLength(5789);
    expect(ordered[0].id).toBe('legacy-i5789');
    expect(orderInstalledIdiomSubset(originals, true)).toHaveLength(5873);
    expect(JSON.stringify(originals)).toBe(before);
  });
});
