import { beforeEach, describe, expect, it, vi } from "vitest";
const memory = vi.hoisted(() => new Map<string, string>());
const fail = vi.hoisted(() => ({ read: false, write: false }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => { if (fail.read) throw new Error("read failed"); return memory.get(key) ?? null; },
  setItem: async (key: string, value: string) => { if (fail.write) throw new Error("write failed"); memory.set(key, value); },
} }));
import data from "@/data/reasoning-lessons.json";
import { isPracticeAnswerCorrect, readPracticeAttempt, savePracticeAttempt } from "@/lib/reasoning-practice";

describe("문맥 연습 응답", () => {
  const q = data.lessons[0].questions[0];
  beforeEach(() => { memory.clear(); fail.read = false; fail.write = false; });
  it("정답 ID로 판정하며 표시 순서가 바뀌어도 안정적이다", () => {
    expect(isPracticeAnswerCorrect(q, q.correctChoiceId)).toBe(true);
    expect(isPracticeAnswerCorrect({ ...q, choices: [...q.choices].reverse() }, q.correctChoiceId)).toBe(true);
    expect(isPracticeAnswerCorrect(q, "unknown")).toBe(false);
    expect(isPracticeAnswerCorrect(q, "a")).toBe(false);
  });
  it("새 항목은 미응답이고 저장한 응답을 다시 불러온다", async () => {
    expect(await readPracticeAttempt(q)).toBeNull();
    await savePracticeAttempt(q, "a", 4200);
    expect(await readPracticeAttempt(q)).toMatchObject({ questionId: q.id, choiceId: "a", elapsedMs: 4200 });
    expect([...memory.keys()].every((key) => key.startsWith("vocanexus:context-practice:"))).toBe(true);
    expect(await readPracticeAttempt(data.lessons[0].questions[1])).toBeNull();
  });
  it("없는 선택지와 잘못된 응답 시간을 기록하지 않는다", async () => {
    await expect(savePracticeAttempt(q, "missing", 1000)).rejects.toThrow();
    await expect(savePracticeAttempt(q, "a", Number.NaN)).rejects.toThrow();
    expect(memory.size).toBe(0);
  });
  it("저장/읽기 실패를 성공으로 숨기지 않는다", async () => {
    fail.write = true;
    await expect(savePracticeAttempt(q, "b", 2000)).rejects.toThrow(/write/);
    fail.read = true;
    await expect(readPracticeAttempt(q)).rejects.toThrow(/read/);
  });
  it("깨진 저장값은 기존 자료를 지우지 않고 오류로 남긴다", async () => {
    await savePracticeAttempt(q, "a", 4200);
    const key = [...memory.keys()][0]; memory.set(key, "not-json");
    await expect(readPracticeAttempt(q)).rejects.toThrow();
    expect(memory.get(key)).toBe("not-json");
  });
});
