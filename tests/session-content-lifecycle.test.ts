import { beforeEach, expect, it, vi } from "vitest";
import type { QuizSession } from "@/lib/quiz-session";
import { z } from "zod";

const fixture = vi.hoisted(() => ({ current: true, failAfter: -1, disk: new Map<string, string>(), item: {
  num: 1, id: "row-1", w: "plain", k: "분명한", s: ["clear"], k_short: "분명한", category: "word", type: "word",
  sourceIndex: 0, sourceNumber: 1, p: "", group: "V101", conceptId: "", conceptLabel: "", majorConceptLabel: "",
} }));
// Keep the real parser/store/journal, replacing only large content registries.
vi.mock("@/lib/vocab", () => ({ getVocabItem: () => fixture.item, normalizeWord: (s: string) => s.trim().toLowerCase(),
  isAcceptedSynonym: (item: { s: string[] }, value: string) => item.s.includes(value) }));
vi.mock("@/lib/sense-questions", () => ({ senseQuestionSchema: z.never() }));
vi.mock("@/lib/active-recall", () => ({ activeRecallSenseSchema: z.never() }));
vi.mock("@/lib/definition-quiz", () => ({ definitionQuizEntrySchema: z.never(), getDefinitionAnswerRelations: () => ({ synonyms: [] }) }));
vi.mock("@/lib/sentence-completion", () => ({ sentenceCompletionSchema: z.never() }));
vi.mock("@/lib/quiz-engine", () => ({ validateQuestion: () => fixture.current,
  isTypedAnswerCorrect: () => false, isChoiceCorrect: () => false }));
vi.mock("@/lib/canonical-learning", () => ({ getItemLearningTargets: () => [] }));
vi.mock("@/lib/vocab-storage-migration", () => ({ VOCAB_LIST_STORAGE_KEYS: {
  bookmarks: "vocaknio_bookmarks", wrongWords: "vocaknio_wrong_words", mastered: "vocaknio_mastered",
}, VOCAB_STORAGE_BACKUP_KEY: "vocaknio_vocab_v1_4_migration_backup", migrateVocabStorage: async () => undefined }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => fixture.disk.get(key) ?? null,
  setItem: async (key: string, raw: string) => { fixture.disk.set(key, raw); },
  removeItem: async (key: string) => { fixture.disk.delete(key); },
  multiSet: async (entries: [string, string][]) => {
    for (const [i, [key, raw]] of entries.entries()) {
      if (fixture.failAfter === i) throw new Error("injected partial write");
      fixture.disk.set(key, raw);
    }
  },
} }));
let parser: typeof import("@/lib/quiz-session");
let store: typeof import("@/lib/store");
beforeEach(async () => {
  vi.resetModules(); fixture.current = true; fixture.failAfter = -1; fixture.disk.clear();
  parser = await import("@/lib/quiz-session"); store = await import("@/lib/store");
});
function session(): QuizSession {
  return { schema: 1, requestKey: "v101/kor-choice", sessionId: "old", currentIndex: 0, completed: false,
    questions: [{ id: "1", item: { ...fixture.item } as QuizSession["questions"][number]["item"], mode: "kor-choice", answerKind: "meaning",
      correct: "분명한", acceptedAnswers: ["분명한"], choices: ["분명한", "오래된", "고요한", "빠른"].map((value, i) => ({
        id: `c${i}`, value, label: value, meaning: value, word: value, isCorrect: i === 0,
      })) }], states: [parser.createEmptyQuestionViewState()] };
}
it("reads a historical snapshot but refuses current play without poisoning other learning writes", async () => {
  const s = session(); const raw = JSON.stringify(s); fixture.disk.set(parser.QUIZ_SESSION_KEY, raw); fixture.current = false;
  // The former storage validator used this current-content parser and rejected it.
  expect(parser.parseQuizSession(s)).toBeNull();
  expect(parser.parseStoredQuizSession(s)).toEqual(s);
  expect(await store.loadQuizSession()).toEqual(s);
  expect(parser.resumableQuizSession(s, s.requestKey)).toBeNull();
  await store.recordOneAnswer(true); await store.toggleBookmark(1);
  expect((await store.loadStats()).totalAnswered).toBe(1);
  expect(await store.loadBookmarks()).toEqual([1]);
  expect(store.getLearningStorageIssue()).toBeNull();
  expect(fixture.disk.get(parser.QUIZ_SESSION_KEY)).toBe(raw);
  await expect(store.recordOneAnswer(false, 1, undefined, s)).rejects.toThrow();
  expect((await store.loadStats()).totalAnswered).toBe(1);
});
it("automatically archives an outdated session before continuing without regrading or deleting it", async () => {
  const old = session(); const raw = JSON.stringify(old, null, 2);
  fixture.disk.set(parser.QUIZ_SESSION_KEY, raw); fixture.current = false;
  const before = await store.loadStats();
  expect(await store.loadQuizSessionForStudy(old.requestKey)).toEqual({ session: null, archived: true });
  expect(fixture.disk.get(parser.QUIZ_SESSION_KEY)).toBe(raw);
  expect(JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!).sessions).toEqual([raw]);
  await store.loadQuizSessionForStudy(old.requestKey);
  expect(JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!).sessions).toEqual([raw]);
  expect(await store.loadStats()).toEqual(before);
});
it("restores current sessions unchanged and does not reuse a different request", async () => {
  const old = session(); fixture.disk.set(parser.QUIZ_SESSION_KEY, JSON.stringify(old));
  expect(await store.loadQuizSessionForStudy(old.requestKey)).toEqual({ session: old, archived: false });
  expect(await store.loadQuizSessionForStudy("different")).toEqual({ session: null, archived: false });
  expect(fixture.disk.has(parser.QUIZ_SESSION_ARCHIVE_KEY)).toBe(false);
});
it("does not report automatic recovery success when archiving fails, and safely retries", async () => {
  const raw = JSON.stringify(session()); fixture.disk.set(parser.QUIZ_SESSION_KEY, raw);
  fixture.current = false; fixture.failAfter = 0;
  await expect(store.loadQuizSessionForStudy("v101/kor-choice")).rejects.toThrow();
  expect(fixture.disk.get(parser.QUIZ_SESSION_KEY)).toBe(raw);
  fixture.failAfter = -1;
  await store.retryLearningStorage();
  expect(await store.loadQuizSessionForStudy("v101/kor-choice")).toEqual({ session: null, archived: true });
  expect(JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!).sessions).toEqual([raw]);
});
it("preserves exact historical bytes in backup and a recoverable archive before replacement", async () => {
  const old = session(); old.questions[0].item.k_short = "過去の記録";
  const raw = JSON.stringify(old, null, 2); fixture.disk.set(parser.QUIZ_SESSION_KEY, raw);
  const next = session(); next.sessionId = "new";
  await store.saveQuizSession(next);
  const archive = JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!);
  expect(archive.sessions).toEqual([raw]);
  expect(await store.loadQuizSession()).toEqual(next);
  const backup = await store.exportLearningBackup();
  expect(backup.records[parser.QUIZ_SESSION_ARCHIVE_KEY]).toBe(JSON.stringify(archive));
  await store.saveQuizSession(next);
  expect(JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!).sessions).toHaveLength(1);
});
it("replays an interrupted archive/session transaction without dropping the historical snapshot", async () => {
  const old = session(); old.questions[0].item.k_short = "older";
  const raw = JSON.stringify(old); fixture.disk.set(parser.QUIZ_SESSION_KEY, raw);
  fixture.failAfter = 1;
  const next = session(); next.sessionId = "next";
  await store.saveQuizSession(next);
  expect(fixture.disk.get(parser.QUIZ_SESSION_KEY)).toBe(raw);
  fixture.failAfter = -1; vi.resetModules(); store = await import("@/lib/store");
  expect(await store.loadQuizSession()).toEqual(next);
  expect(JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!).sessions).toEqual([raw]);
});
it("keeps the newer tab's resume slot while recording the other tab's answer exactly once", async () => {
  const a = session(); a.sessionId = "tab-a"; await store.saveQuizSession(a);
  const b = session(); b.sessionId = "tab-b"; await store.saveQuizSession(b);
  a.states[0] = { ...a.states[0], answered: true, selectedChoice: 0 };
  const context = { sessionId: a.sessionId, itemNum: 1, mode: "kor-choice", outcome: "correct" as const };
  await store.recordOneAnswer(true, undefined, context, a);
  await store.recordOneAnswer(true, undefined, context, a);
  expect(await store.loadQuizSession()).toEqual(b);
  const archive = JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!);
  expect(archive.sessions).toContain(JSON.stringify(a));
  expect((await store.loadStats()).totalAnswered).toBe(1);
});
it("accepts an older backup without the additive archive key but not missing core history", async () => {
  fixture.disk.set("vocaknio_vocab_storage_version", "v1.4");
  const backup = await store.exportLearningBackup();
  delete backup.records[parser.QUIZ_SESSION_ARCHIVE_KEY];
  expect((await store.inspectLearningBackup(JSON.stringify(backup))).conflicts).toEqual([]);
  delete backup.records.vocaknio_stats;
  await expect(store.inspectLearningBackup(JSON.stringify(backup))).rejects.toThrow();
});
it("does not erase an answered state when the same session autosaves a stale tab snapshot", async () => {
  const old = session(); const answered = session();
  answered.states[0] = { ...answered.states[0], answered: true, selectedChoice: 0 };
  await store.saveQuizSession(answered); await store.saveQuizSession(old);
  expect((await store.loadQuizSession())?.states[0]).toEqual(answered.states[0]);
  const conflicting = session();
  conflicting.states[0] = { ...conflicting.states[0], answered: true, selectedChoice: 2 };
  await store.saveQuizSession(conflicting);
  expect((await store.loadQuizSession())?.states[0].selectedChoice).toBe(0);
  expect(JSON.parse(fixture.disk.get(parser.QUIZ_SESSION_ARCHIVE_KEY)!).sessions).toContain(JSON.stringify(conflicting));
});
it.each(["save", "answer"])("captures the validated snapshot before queued %s even if the UI object mutates", async operation => {
  const submitted = session();
  if (operation === "answer") submitted.states[0] = { ...submitted.states[0], answered: true, selectedChoice: 0 };
  const expected = JSON.parse(JSON.stringify(submitted));
  const write = operation === "save" ? store.saveQuizSession(submitted)
    : store.recordOneAnswer(true, undefined, { sessionId: submitted.sessionId, itemNum: 1, mode: "kor-choice", outcome: "correct" }, submitted);
  submitted.currentIndex = 999;
  submitted.states[0].selectedChoice = 3;
  await write;
  expect(await store.loadQuizSession()).toEqual(expected);
  expect(store.getLearningStorageIssue()).toBeNull();
});
it.each(["flag", "choice", "index", "answer"])("keeps corrupt snapshot protection: %s", async fault => {
  const s = session();
  if (fault === "flag") { s.questions[0].choices[0].isCorrect = false; s.questions[0].choices[1].isCorrect = true; s.questions[0].correct = s.questions[0].choices[1].label; }
  if (fault === "choice") s.questions[0].choices[1] = s.questions[0].choices[0];
  if (fault === "index") s.currentIndex = 2;
  if (fault === "answer") s.states[0].selectedChoice = 2;
  expect(parser.parseStoredQuizSession(s)).toBeNull();
  const raw = JSON.stringify(s); fixture.disk.set(parser.QUIZ_SESSION_KEY, raw);
  expect(await store.loadQuizSession()).toBeNull(); await store.toggleBookmark(1);
  expect(store.getLearningStorageIssue()).not.toBeNull(); expect(fixture.disk.get(parser.QUIZ_SESSION_KEY)).toBe(raw);
});
