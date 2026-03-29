import { describe, it, expect } from "vitest";
import {
  examQuestions,
  getQuestionsByYear,
  getQuestionsByType,
  shuffleQuestions,
  shuffleChoices,
} from "../lib/exam-questions";

describe("exam-questions 데이터 무결성", () => {
  it("문항이 1개 이상 존재한다", () => {
    expect(examQuestions.length).toBeGreaterThan(0);
  });

  it("모든 문항에 id, year, choices, answer가 있다", () => {
    for (const q of examQuestions) {
      expect(q.id).toBeTruthy();
      expect([2024, 2025, 2026]).toContain(q.year);
      expect(q.choices.length).toBeGreaterThanOrEqual(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
    }
  });

  it("answer 인덱스가 choices 범위 내에 있다", () => {
    for (const q of examQuestions) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
    }
  });

  it("연도별 필터링이 정확하다", () => {
    const q2024 = getQuestionsByYear(2024);
    const q2025 = getQuestionsByYear(2025);
    const q2026 = getQuestionsByYear(2026);
    expect(q2024.every((q) => q.year === 2024)).toBe(true);
    expect(q2025.every((q) => q.year === 2025)).toBe(true);
    expect(q2026.every((q) => q.year === 2026)).toBe(true);
  });

  it("유형별 필터링이 정확하다", () => {
    const vocabSyn = getQuestionsByType("vocab-synonym");
    expect(vocabSyn.every((q) => q.type === "vocab-synonym")).toBe(true);
  });

  it("shuffleQuestions는 같은 문항 수를 반환한다", () => {
    const shuffled = shuffleQuestions(examQuestions);
    expect(shuffled.length).toBe(examQuestions.length);
  });

  it("shuffleChoices는 정답을 유지한다", () => {
    for (const q of examQuestions) {
      const originalAnswer = q.choices[q.answer];
      const shuffled = shuffleChoices(q);
      expect(shuffled.choices[shuffled.answer]).toBe(originalAnswer);
    }
  });

  it("해설(explanation)이 모든 문항에 있다", () => {
    for (const q of examQuestions) {
      expect(q.explanation.length).toBeGreaterThan(0);
    }
  });

  it("배점(points)이 유효한 값이다", () => {
    for (const q of examQuestions) {
      expect([2, 3, 4]).toContain(q.points);
    }
  });
});
