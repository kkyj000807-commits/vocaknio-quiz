import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  failWrite: false,
  failRead: false,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    async getItem(key: string) {
      await Promise.resolve();
      if (storage.failRead) throw new Error("read unavailable");
      return storage.values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      await Promise.resolve();
      if (storage.failWrite) throw new Error("quota exceeded");
      storage.values.set(key, value);
    },
    async multiSet(entries: [string, string][]) {
      await Promise.resolve();
      if (storage.failWrite) throw new Error("quota exceeded");
      for (const [key, value] of entries) storage.values.set(key, value);
    },
  },
}));

let store: typeof import("@/lib/store");
beforeEach(async () => {
  vi.resetModules();
  storage.values.clear();
  storage.failWrite = false;
  storage.failRead = false;
  store = await import("@/lib/store");
});

describe("학습 기록의 공통 저장 경로", () => {
  it("빠르게 북마크·마스터를 추가해도 모든 항목을 보존한다", async () => {
    const nums = Array.from({ length: 12 }, (_, i) => i + 1);
    await Promise.all(
      nums.flatMap((num) => [
        store.toggleBookmark(num),
        store.addMastered(num),
      ]),
    );
    expect(await store.loadBookmarks()).toEqual(nums);
    expect(await store.loadMastered()).toEqual(nums);
  });

  it("저장 실패 중 지운 오답이 다음 재시도에 되살아나지 않는다", async () => {
    storage.failWrite = true;
    await store.recordOneAnswer(false, 42);
    await store.removeWrongWord(42);
    storage.failWrite = false;
    await store.retryLearningStorage();
    expect(await store.loadWrongWords()).toEqual([]);
    expect(JSON.parse(storage.values.get("vocaknio_wrong_words")!)).toEqual([]);
    expect((await store.loadStats()).totalAnswered).toBe(1);
  });

  it("저장 실패 중 북마크를 계속 편집해도 재시도·새 모듈에서 복원한다", async () => {
    storage.failWrite = true;
    await store.toggleBookmark(1);
    await store.toggleBookmark(2);
    await store.toggleBookmark(1);
    expect(store.getLearningStorageIssue()).not.toBeNull();
    storage.failWrite = false;
    await store.retryLearningStorage();
    expect(store.getLearningStorageIssue()).toBeNull();
    vi.resetModules();
    const reopened = await import("@/lib/store");
    expect(await reopened.loadBookmarks()).toEqual([2]);
  });

  it.each(["{broken", '{"totalAnswered":"bad"}', "null"])(
    "깨진 통계 %s를 빈 기록으로 덮지 않는다",
    async (raw) => {
      storage.values.set("vocaknio_stats", raw);
      await store.recordOneAnswer(true);
      expect(storage.values.get("vocaknio_stats")).toBe(raw);
      expect(store.getLearningStorageIssue()).not.toBeNull();
      await store.retryLearningStorage();
      expect(store.getLearningStorageIssue()).not.toBeNull();
      storage.values.set(
        "vocaknio_stats",
        JSON.stringify({ totalAnswered: 100, totalCorrect: 80 }),
      );
      await store.retryLearningStorage();
      expect(store.getLearningStorageIssue()).toBeNull();
      await store.recordOneAnswer(true);
      expect(await store.loadStats()).toMatchObject({
        totalAnswered: 101,
        totalCorrect: 81,
      });
    },
  );

  it("처음 읽기 실패 시 북마크와 마스터 원본을 보존한다", async () => {
    storage.values.set("vocaknio_bookmarks", "[9]");
    storage.values.set("vocaknio_mastered", "[8]");
    storage.failRead = true;
    await store.toggleBookmark(1);
    await store.addMastered(2);
    expect(storage.values.get("vocaknio_bookmarks")).toBe("[9]");
    expect(storage.values.get("vocaknio_mastered")).toBe("[8]");
    expect(store.getLearningStorageIssue()).not.toBeNull();
    storage.failRead = false;
    await store.retryLearningStorage();
    expect(await store.loadBookmarks()).toEqual([9]);
    expect(await store.loadMastered()).toEqual([8]);
  });

  it("학습 시간 누적도 같은 큐에서 처리한다", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () => store.addStudySeconds(5)),
    );
    expect((await store.loadStudyTime()).totalSeconds).toBe(50);
  });
});
