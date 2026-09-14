import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuizQuestions } from "@/lib/quiz-engine";
import {
  createEmptyQuestionViewState,
  parseQuizSession,
  QUIZ_SESSION_KEY,
  resumableQuizSession,
  summarizeQuizSession,
  type QuizSession,
} from "@/lib/quiz-session";
import type { QuizMode } from "@/lib/vocab";

const disk = vi.hoisted(() => ({
  values: new Map<string, string>(),
  fail: false,
  readFail: false,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    async getItem(key: string) {
      if (disk.readFail) throw Error("read failure");
      return disk.values.get(key) ?? null;
    },
    async multiSet(entries: [string, string][]) {
      if (disk.fail) throw Error("full");
      for (const [k, v] of entries) disk.values.set(k, v);
    },
  },
}));
let store: typeof import("@/lib/store");
beforeEach(async () => {
  vi.resetModules();
  disk.values.clear();
  disk.fail = false;
  disk.readFail = false;
  store = await import("@/lib/store");
});

function session(mode: QuizMode = "kor-choice"): QuizSession {
  const questions = buildQuizQuestions({ mode, rangeId: "v101", count: 3 });
  expect(questions).toHaveLength(3);
  return {
    schema: 1,
    requestKey: `v101/${mode}`,
    sessionId: "resume-test",
    questions,
    states: questions.map(() => createEmptyQuestionViewState()),
    currentIndex: 0,
    completed: false,
  };
}

describe("문제 풀이 중단 복원", () => {
  it.each<QuizMode>([
    "kor-choice",
    "syn-choice",
    "syn-kor-choice",
    "flashcard",
    "syn-type",
  ])("%s 문제·선택지 순서를 새 앱 실행에서 그대로 복원한다", async (mode) => {
    const original = session(mode);
    await store.saveQuizSession(original);
    vi.resetModules();
    const reopened = await import("@/lib/store");
    const saved = await reopened.loadQuizSession();
    expect(resumableQuizSession(saved, original.requestKey)).toEqual(original);
  });

  it("선택·패스·이전 위치 복원은 누적 통계와 노출을 다시 늘리지 않는다", async () => {
    const s = session();
    await store.prepareAdaptiveQuizSession({
      sessionId: s.sessionId,
      rangeId: "v101",
      mode: "kor-choice",
      count: 3,
      candidates: s.questions.map((q) => ({ num: q.item.num })),
    });
    const first = s.questions[0];
    s.states[0] = {
      ...s.states[0],
      answered: true,
      selectedChoice: first.choices.findIndex((c) => c.isCorrect),
    };
    const answer = {
      sessionId: s.sessionId,
      itemNum: first.item.num,
      mode: "kor-choice",
      outcome: "correct" as const,
    };
    await store.recordOneAnswer(true, undefined, answer, s);
    s.states[1] = { ...s.states[1], answered: true, skipped: true };
    s.currentIndex = 1;
    await store.recordOneAnswer(
      false,
      s.questions[1].item.num,
      { ...answer, itemNum: s.questions[1].item.num, outcome: "skip" },
      s,
    );
    const before = await store.loadAdaptiveQuizHistory();
    vi.resetModules();
    const reopened = await import("@/lib/store");
    const restored = (await reopened.loadQuizSession())!;
    expect(restored).toEqual(s);
    expect(summarizeQuizSession(restored)).toMatchObject({
      correctCount: 1,
      wrongCount: 1,
    });
    await reopened.recordOneAnswer(true, undefined, answer, restored);
    expect(await reopened.loadStats()).toMatchObject({
      totalAnswered: 2,
      totalCorrect: 1,
    });
    expect(await reopened.loadAdaptiveQuizHistory()).toEqual(before);
  });

  it("직접 입력 초안·힌트와 플래시카드 공개/평가 상태를 보존한다", async () => {
    const typed = session("syn-type");
    typed.states[0].typedAnswer = "draft";
    typed.states[0].hintLevel = 2;
    await store.saveQuizSession(typed);
    expect(await store.loadQuizSession()).toEqual(typed);
    const flash = session("flashcard");
    flash.states[0].revealed = true;
    flash.states[1] = {
      ...flash.states[1],
      revealed: true,
      answered: true,
      flashGrade: "wrong",
    };
    flash.states[2] = {
      ...flash.states[2],
      revealed: true,
      answered: true,
      mastered: true,
    };
    await store.saveQuizSession(flash);
    expect(
      summarizeQuizSession((await store.loadQuizSession())!),
    ).toMatchObject({ correctCount: 1, wrongCount: 1 });
  });

  it("완료·다른 범위·갱신된 뜻은 중단 문제로 복원하지 않는다", () => {
    const s = session();
    expect(resumableQuizSession(s, "another-range")).toBeNull();
    expect(
      resumableQuizSession({ ...s, completed: true }, s.requestKey),
    ).toBeNull();
    s.questions = structuredClone(s.questions);
    s.questions[0].item.k = "outdated";
    expect(resumableQuizSession(s, s.requestKey)).toBeNull();
  });

  it("늦게 도착한 진행 저장이 완료 표시를 되돌리지 않는다", async () => {
    const s = session();
    await Promise.all([
      store.saveQuizSession({ ...s, completed: true }),
      store.saveQuizSession(s),
    ]);
    expect((await store.loadQuizSession())?.completed).toBe(true);
  });

  it("저장 실패 후 최신 위치를 재시도하고 새 앱 실행에서 복원한다", async () => {
    const s = session();
    disk.fail = true;
    await store.saveQuizSession(s);
    s.currentIndex = 2;
    await store.saveQuizSession(s);
    expect(store.getLearningStorageIssue()).not.toBeNull();
    disk.fail = false;
    await store.retryLearningStorage();
    vi.resetModules();
    const reopened = await import("@/lib/store");
    expect(await reopened.loadQuizSession()).toEqual(s);
  });

  it("깨진 중단 기록은 덮어쓰지 않고 경고한다", async () => {
    disk.values.set(QUIZ_SESSION_KEY, "{broken");
    expect(await store.loadQuizSession()).toBeNull();
    await store.saveQuizSession(session());
    expect(disk.values.get(QUIZ_SESSION_KEY)).toBe("{broken");
    expect(store.getLearningStorageIssue()).not.toBeNull();
  });

  it.each<QuizMode>(["kor-choice", "syn-choice"])("%s 잘못된 정답 키도 원본을 보존하며 복원을 거절한다", async (mode) => {
    const corrupt = session(mode);
    const q = corrupt.questions[0];
    const wrong = q.choices.find(c => !c.isCorrect)!;
    q.choices.forEach(c => { c.isCorrect = c.id === wrong.id; });
    q.correct = wrong.label;
    const raw = JSON.stringify(corrupt);
    disk.values.set(QUIZ_SESSION_KEY, raw);
    expect(await store.loadQuizSession()).toBeNull();
    await store.saveQuizSession(session(mode));
    expect(disk.values.get(QUIZ_SESSION_KEY)).toBe(raw);
    expect(store.getLearningStorageIssue()).not.toBeNull();
  });

  it("중복 선택지·정답 누락·범위 밖 위치·모순된 응답은 거절한다", () => {
    const s = session();
    expect(parseQuizSession({ ...s, currentIndex: 3 })).toBeNull();
    const duplicate = structuredClone(s);
    duplicate.questions[0].choices[1] = duplicate.questions[0].choices[0];
    expect(parseQuizSession(duplicate)).toBeNull();
    const missing = structuredClone(s);
    missing.questions[0].choices.forEach((c) => (c.isCorrect = false));
    expect(parseQuizSession(missing)).toBeNull();
    s.states[0].answered = true;
    expect(parseQuizSession(s)).toBeNull();
  });
});
