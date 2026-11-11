import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyVocab } from '../hooks/use-study-vocab';
const fixture = vi.hoisted(() => ({ current: [{ id: 'legacy' }], subscribe: vi.fn(), read: vi.fn(), sync: vi.fn() }));
vi.mock('react', () => ({ useSyncExternalStore: fixture.sync }));
vi.mock('@/lib/vocab', () => ({ getStudyVocab: fixture.read, subscribeStudyVocab: fixture.subscribe, getStudyRevision: () => 0 }));

describe('book activation subscription snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.current = [{ id: 'legacy' }];
    fixture.read.mockImplementation(() => fixture.current);
    fixture.sync.mockImplementation((_subscribe, getSnapshot) => getSnapshot());
  });
  it('subscribes to the actual content array, not an ignored numeric revision', () => {
    expect(useStudyVocab()).toBe(fixture.current);
    expect(fixture.sync).toHaveBeenCalledWith(fixture.subscribe, fixture.read, fixture.read);
  });
  it('returns the snapshot chosen by React without a second independently memoized getter', () => {
    const snapshot = [{ id: 'approved-book' }];
    fixture.sync.mockReturnValue(snapshot);
    expect(useStudyVocab()).toBe(snapshot);
    expect(fixture.read).not.toHaveBeenCalled();
  });
});
