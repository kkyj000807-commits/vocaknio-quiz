import { beforeEach, expect, it, vi } from "vitest";
// Focused I/O fault injection. Real store/queue; content dependencies are mocked
// to avoid loading the 38K corpus. Full integration tests remain required.
vi.mock("@/lib/vocab", () => ({ getVocabItem: () => undefined }));
vi.mock("@/lib/canonical-learning", () => ({ getItemLearningTargets: () => [] }));
vi.mock("@/lib/quiz-session", () => ({
  QUIZ_SESSION_KEY: "vocaknio_problem_session_v1", parseQuizSession: () => null,
  QUIZ_SESSION_ARCHIVE_KEY: "vocaknio_problem_session_archive_v1", parseStoredQuizSession: () => null, parseQuizSessionArchive: () => null,
}));
vi.mock("@/lib/vocab-storage-migration", () => ({
  VOCAB_LIST_STORAGE_KEYS: { bookmarks: "vocaknio_bookmarks", wrongWords: "vocaknio_wrong_words", mastered: "vocaknio_mastered" },
  migrateVocabStorage: async () => undefined,
}));
const disk = vi.hoisted(() => ({ values: new Map<string, string>(), failRead: false, failWrite: false, failKey: null as string | null, partialAfter: -1, writes: 0 }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => {
    if (disk.failRead) throw new Error("storage unavailable");
    return disk.values.get(key) ?? null;
  },
  multiSet: async (entries: [string, string][]) => {
    if (disk.failWrite) throw new Error("write unavailable");
    disk.writes++;
    for (const [index, [key, value]] of entries.entries()) {
      if (index === disk.partialAfter) throw new Error("partial write unavailable");
      if (key === disk.failKey) continue;
      disk.values.set(key, value);
    }
    if (entries.some(([key]) => key === disk.failKey)) throw new Error("one key failed");
  },
  setItem: async (key: string, value: string) => {
    if (disk.failWrite) throw new Error("write unavailable");
    disk.writes++;
    disk.values.set(key, value);
  },
  removeItem: async (key: string) => { disk.values.delete(key); },
} }));
beforeEach(() => { vi.resetModules(); disk.values.clear(); disk.failRead = false; disk.failWrite = false; disk.failKey = null; disk.partialAfter = -1; disk.writes = 0; });

it("voice and choice-language changes merge in the existing queue without dropping legacy fields", async () => {
  const store = await import("@/lib/store");
  disk.values.set("vocaknio_quiz_settings", JSON.stringify({ choiceLang: "korean", legacy: "preserve" }));
  await Promise.all([
    store.saveQuizSettings({ pronunciation: { voiceURI: "aria", preferRecording: false } }),
    store.saveQuizSettings({ choiceLang: "english" }),
  ]);
  expect(JSON.parse(disk.values.get("vocaknio_quiz_settings")!)).toEqual({
    choiceLang: "english", legacy: "preserve", pronunciation: { voiceURI: "aria", preferRecording: false },
  });
  expect((await store.loadQuizSettings()).pronunciation.voiceURI).toBe("aria");
});

it("voice setting read/corruption/write failures preserve original bytes and reject the save", async () => {
  const store = await import("@/lib/store");
  for (const raw of ["broken-json", "[]", "null"]) {
    disk.values.set("vocaknio_quiz_settings", raw);
    await expect(store.saveQuizSettings({ choiceLang: "english" })).rejects.toThrow();
    expect(disk.values.get("vocaknio_quiz_settings")).toBe(raw);
  }
  const raw = '{"choiceLang":"korean"}';
  disk.values.set("vocaknio_quiz_settings", raw);
  disk.failRead = true;
  await store.loadQuizSettings();
  await expect(store.saveQuizSettings({ choiceLang: "english" })).rejects.toThrow();
  disk.failRead = false;
  disk.failWrite = true;
  await expect(store.saveQuizSettings({ choiceLang: "english" })).rejects.toThrow();
  expect(disk.values.get("vocaknio_quiz_settings")).toBe(raw);
  expect(disk.writes).toBe(0);
});

it("a failed fresh read must never overwrite another tab's latest data with this tab's cache", async () => {
  const store = await import("@/lib/store");
  disk.values.set("vocaknio_bookmarks", "[9]");
  expect(await store.loadBookmarks()).toEqual([9]);
  disk.values.set("vocaknio_bookmarks", "[9,10]");
  disk.failRead = true;
  await store.toggleBookmark(1);
  expect(disk.writes).toBe(0);
  expect(disk.values.get("vocaknio_bookmarks")).toBe("[9,10]");
  expect(store.getLearningStorageIssue()).not.toBeNull();
  disk.failRead = false;
  await store.retryLearningStorage();
  expect(disk.values.get("vocaknio_bookmarks")).toBe("[9,10]");
  expect(store.getLearningStorageIssue()).toContain("다른 창");
  expect((await store.exportLearningBackup()).pending.vocaknio_bookmarks).toBe("[9,1]");
});

it("a failed statistics reread preserves newer counts without silently regrading", async () => {
  const store = await import("@/lib/store");
  disk.values.set("vocaknio_stats", JSON.stringify({ totalAnswered: 1, totalCorrect: 1 }));
  expect((await store.loadStats()).totalAnswered).toBe(1);
  const newer = JSON.stringify({ totalAnswered: 9, totalCorrect: 6 });
  disk.values.set("vocaknio_stats", newer);
  disk.failRead = true;
  await store.recordOneAnswer(false);
  expect(disk.values.get("vocaknio_stats")).toBe(newer);
  expect(disk.writes).toBe(0);
  disk.failRead = false;
  await store.retryLearningStorage();
  expect(disk.values.get("vocaknio_stats")).toBe(newer);
  expect(store.getLearningStorageIssue()).toContain("다른 창");
  const pending = (await store.exportLearningBackup()).pending.vocaknio_stats;
  expect(JSON.parse(pending)).toMatchObject({ totalAnswered: 2, totalCorrect: 1 });
});

it("MASTER and wrong-note records survive a failed reread unchanged", async () => {
  const store = await import("@/lib/store");
  disk.values.set("vocaknio_mastered", "[1]");
  disk.values.set("vocaknio_wrong_words", "[2]");
  await store.loadMastered();
  await store.loadWrongWords();
  disk.values.set("vocaknio_mastered", "[1,3]");
  disk.values.set("vocaknio_wrong_words", "[2,4]");
  disk.failRead = true;
  await store.addMastered(5);
  await store.removeWrongWord(2);
  expect(disk.values.get("vocaknio_mastered")).toBe("[1,3]");
  expect(disk.values.get("vocaknio_wrong_words")).toBe("[2,4]");
  expect(disk.writes).toBe(0);
});

it("retry preserves another tab's latest bookmarks and reports a conflict", async () => {
  const store = await import("@/lib/store");
  disk.values.set("vocaknio_bookmarks", "[9]");
  await store.loadBookmarks();
  disk.failWrite = true;
  await store.toggleBookmark(1);
  expect(store.getLearningStorageIssue()).not.toBeNull();
  disk.values.set("vocaknio_bookmarks", "[9,10]");
  disk.failWrite = false;
  await store.retryLearningStorage();
  expect(disk.values.get("vocaknio_bookmarks")).toBe("[9,10]");
  expect(await store.loadBookmarks()).toEqual([9, 1]); // pending is not discarded
  expect(store.getLearningStorageIssue()).toContain("다른 창");
});

it("retry commits unchanged baselines, but preserves corrupt or unreadable disk data", async () => {
  const store = await import("@/lib/store");
  disk.values.set("vocaknio_bookmarks", "[9]");
  disk.failWrite = true;
  await store.toggleBookmark(1);
  disk.failWrite = false;
  disk.failRead = true;
  await store.retryLearningStorage();
  expect(disk.values.get("vocaknio_bookmarks")).toBe("[9]");
  disk.failRead = false;
  disk.values.set("vocaknio_bookmarks", "broken-json");
  await store.retryLearningStorage();
  expect(disk.values.get("vocaknio_bookmarks")).toBe("broken-json");
  disk.values.set("vocaknio_bookmarks", "[9]");
  await store.retryLearningStorage();
  expect(disk.values.get("vocaknio_bookmarks")).toBe("[9,1]");
  expect(store.getLearningStorageIssue()).toBeNull();
});

it("reload completes a partially saved answer without replaying or counting it twice", async () => {
  let store = await import("@/lib/store");
  disk.partialAfter = 1;
  await store.recordOneAnswer(false, 7);
  expect(JSON.parse(disk.values.get("vocaknio_stats")!).totalAnswered).toBe(1);
  expect(disk.values.get("vocaknio_wrong_words")).toBeUndefined();
  expect(disk.values.has("vocaknio_learning_write_journal_v1")).toBe(true);
  vi.resetModules(); // New tab/reload: no optimistic state survives.
  disk.partialAfter = -1;
  store = await import("@/lib/store");
  expect(await store.loadWrongWords()).toEqual([7]);
  expect((await store.loadStats()).totalAnswered).toBe(1);
  expect(disk.values.has("vocaknio_learning_write_journal_v1")).toBe(false);
  await store.retryLearningStorage();
  expect((await store.loadStats()).totalAnswered).toBe(1);
});

it("reload never repairs a partial write over a different external answer", async () => {
  let store = await import("@/lib/store");
  disk.partialAfter = 1;
  await store.recordOneAnswer(false, 7);
  const journal = disk.values.get("vocaknio_learning_write_journal_v1");
  disk.values.set("vocaknio_wrong_words", "[8]");
  vi.resetModules();
  disk.partialAfter = -1;
  store = await import("@/lib/store");
  await store.retryLearningStorage();
  expect(disk.values.get("vocaknio_wrong_words")).toBe("[8]");
  expect(disk.values.get("vocaknio_learning_write_journal_v1")).toBe(journal);
  expect(store.getLearningStorageIssue()).toContain("충돌");
});

it("new answers remain pending when journal replay keeps failing", async () => {
  const store = await import("@/lib/store");
  disk.partialAfter = 1;
  await store.recordOneAnswer(false, 7);
  disk.partialAfter = 0;
  await store.recordOneAnswer(false, 8);
  const backup = await store.exportLearningBackup();
  expect(JSON.parse(backup.pending.vocaknio_stats).totalAnswered).toBe(2);
  expect(JSON.parse(backup.pending.vocaknio_wrong_words)).toEqual([7, 8]);
  disk.partialAfter = -1;
  await store.retryLearningStorage();
  expect((await store.loadStats()).totalAnswered).toBe(2);
  expect(await store.loadWrongWords()).toEqual([7, 8]);
});

it("a broken theme and failed theme replacement never poison the learning journal", async () => {
  const store = await import("@/lib/store");
  disk.values.set("vocaknio_theme_mode_v3", "broken-json");
  disk.failWrite = true;
  await expect(store.saveThemePreference("dark")).rejects.toThrow();
  expect(disk.values.has("vocaknio_learning_write_journal_v1")).toBe(false);
  disk.failWrite = false;
  await store.recordOneAnswer(true);
  expect((await store.loadStats()).totalAnswered).toBe(1);
  expect(store.getLearningStorageIssue()).toBeNull();
});

it("export preserves original and pending bytes without exporting authentication keys", async () => {
  const store = await import("@/lib/store");
  disk.values.set("app_session_token", "test-only-secret");
  disk.values.set("vocaknio_bookmarks", "broken-json");
  const backup = await store.exportLearningBackup();
  expect(backup.records.vocaknio_bookmarks).toBe("broken-json");
  expect(JSON.stringify(backup)).not.toContain("test-only-secret");
  await expect(store.inspectLearningBackup(JSON.stringify(backup))).rejects.toThrow();
  expect(disk.values.get("vocaknio_bookmarks")).toBe("broken-json");
});

it("backup restore previews first, rejects stale/conflicting records and restores an empty device only", async () => {
  let store = await import("@/lib/store");
  disk.values.set("vocaknio_vocab_storage_version", "v1.4");
  await store.recordOneAnswer(false, 7);
  const backup = JSON.stringify(await store.exportLearningBackup());
  disk.values.clear(); vi.resetModules();
  store = await import("@/lib/store");
  const preview = await store.inspectLearningBackup(backup);
  expect(preview.conflicts).toEqual([]);
  expect(preview.entries.length).toBe(2);
  expect(disk.values.size).toBe(0);
  disk.values.set("vocaknio_bookmarks", "[8]");
  await expect(store.restoreLearningBackup(preview)).rejects.toThrow("stale");
  expect((await store.inspectLearningBackup(backup)).conflicts.length).toBeGreaterThan(0);
  disk.values.delete("vocaknio_bookmarks");
  await store.restoreLearningBackup(await store.inspectLearningBackup(backup));
  expect((await store.loadStats()).totalAnswered).toBe(1);
  expect(await store.loadWrongWords()).toEqual([7]);
  expect(disk.values.get("vocaknio_vocab_storage_version")).toBe("v1.4");
});

it("a restore write failure is not reported as success, and its journal recovers on reopen", async () => {
  let store = await import("@/lib/store");
  disk.values.set("vocaknio_vocab_storage_version", "v1.4");
  await store.recordOneAnswer(false, 7);
  const backup = JSON.stringify(await store.exportLearningBackup());
  disk.values.clear(); vi.resetModules(); store = await import("@/lib/store");
  const preview = await store.inspectLearningBackup(backup);
  disk.partialAfter = 1;
  await expect(store.restoreLearningBackup(preview)).rejects.toThrow("not completed");
  disk.partialAfter = -1; vi.resetModules(); store = await import("@/lib/store");
  expect(await store.loadWrongWords()).toEqual([7]);
  expect((await store.loadStats()).totalAnswered).toBe(1);
});

it("30 observed responses and duplicate submissions keep exact answer totals after reopen", async () => {
  let store = await import("@/lib/store");
  const answers = Array.from({ length: 30 }, (_, index) => ({
    sessionId: "fixture-30", itemNum: index + 1, mode: "kor-choice" as const,
    outcome: index % 2 ? "wrong" as const : "correct" as const,
    answeredAt: 1791819000000 + index * 1000, responseMs: 2200,
  }));
  for (const answer of answers) {
    await store.recordOneAnswer(answer.outcome === "correct", answer.itemNum, answer);
    await store.recordOneAnswer(answer.outcome === "correct", answer.itemNum, answer);
  }
  vi.resetModules(); store = await import("@/lib/store");
  expect(await store.loadStats()).toMatchObject({ totalAnswered: 30, totalCorrect: 15 });
  expect((await store.loadWrongWords()).length).toBe(15);
  expect((await store.loadAdaptiveQuizHistory()).events?.length).toBe(30);
});

it("history-first partial success recovers missing totals before duplicate-answer rejection", async () => {
  let store = await import("@/lib/store");
  const answer = { sessionId: "history-first", itemNum: 7, mode: "kor-choice" as const, outcome: "wrong" as const, answeredAt: 1791819000000 };
  disk.failKey = "vocaknio_stats";
  await store.recordOneAnswer(false, 7, answer);
  expect(disk.values.has("vocaknio_stats")).toBe(false);
  expect(disk.values.has("vocaknio_adaptive_quiz_history_v1")).toBe(true);
  disk.failKey = null; vi.resetModules(); store = await import("@/lib/store");
  await store.recordOneAnswer(false, 7, answer);
  expect((await store.loadStats()).totalAnswered).toBe(1);
  expect((await store.loadAdaptiveQuizHistory()).events?.length).toBe(1);
});

it("a fresh app's initialized empty sense state does not block restoring genuine records", async () => {
  let store = await import("@/lib/store");
  disk.values.set("vocaknio_vocab_storage_version", "v1.4");
  await store.recordOneAnswer(false, 7);
  const backup = JSON.stringify(await store.exportLearningBackup());
  disk.values.clear(); vi.resetModules(); store = await import("@/lib/store");
  expect((await store.loadSenseLearningState()).targets).toEqual({});
  const preview = await store.inspectLearningBackup(backup);
  expect(preview.conflicts).toEqual([]);
  await store.restoreLearningBackup(preview);
  expect(await store.loadWrongWords()).toEqual([7]);
});
