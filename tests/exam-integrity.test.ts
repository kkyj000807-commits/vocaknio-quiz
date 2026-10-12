import { describe, it, expect } from "vitest";
import { examQuestions, getQuestionsBySchool, shuffleChoices, type ExamQuestion } from "../lib/exam-questions";
import { examContentSnapshot, examDisposition, examStructuralIssues, getPracticeExamQuestions, gradeExamChoice, type ExamReview } from "../lib/exam-integrity";
import { build } from "esbuild";

// Synthetic fixture only. Never register this as a past exam.
const fixture: ExamQuestion = {
  id: "test-only", school: "한양대", year: 2024, qNum: 1, type: "logic-blank",
  question: "Test-only ____.", choices: ["alpha", "beta", "gamma", "delta"], answer: 2,
  explanation: "Synthetic contract test, not semantic validation.", points: 2,
};
const reviewFor = (q: ExamQuestion): ExamReview => ({
  status: "verified", answerVersion: "test-v1", contentSnapshot: examContentSnapshot(q),
  questionSource: "test-only", answerSource: "test-only", sourceLocation: "fixture",
  checkedAt: "2026-10-11", rights: "cleared", authorship: "generated",
  correctOriginalIndex: q.answer, choiceReasons: q.choices.map(() => "test-only"),
});

describe("기출 검증 경계와 표시 순서", () => {
  it("브라우저 계약 번들은 원문과 권리 미검증 보류 지문을 내장하지 않는다", async () => {
    const result = await build({ entryPoints: ["lib/exam-integrity.ts", "lib/exam-runtime.ts"],
      outdir: "unused-test-output", bundle: true, platform: "browser", format: "esm", write: false });
    const bundle = result.outputFiles.map(file => file.text).join("\n");
    for (const q of examQuestions.filter(q => examDisposition(q).status !== "verified")) {
      const excerpt = (q.passage ?? q.question).slice(0, 64);
      expect(excerpt.length).toBeGreaterThan(20);
      expect(bundle).not.toContain(excerpt);
    }
    expect(getPracticeExamQuestions()).toEqual([]);
  });
  it("원본 268행과 logic-top 165개 정답을 임의 변경하지 않고 모두 출제 보류한다", () => {
    expect(examQuestions).toHaveLength(268);
    const logic = examQuestions.filter(q => q.id.startsWith("logic-top"));
    expect(logic).toHaveLength(165);
    expect(logic.every(q => q.answer === 2)).toBe(true); // anomaly retained, not endorsed
    expect(getPracticeExamQuestions()).toEqual([]);
    for (const q of examQuestions) expect(gradeExamChoice(q, q.answer)).toBeNull();
  });
  it.each(["13", "14", "15", "19"])("우선 의심 사례 %s는 실전/통계로 넘기지 않는다", suffix => {
    const q = examQuestions.find(q => q.id === "logic-top36강-" + suffix)!;
    expect(examDisposition(q).status).not.toBe("verified");
    expect(gradeExamChoice(shuffleChoices(q), 2)).toBeNull();
  });
  it("원본 근거 없이 누락 학교를 한양대로 배정하지 않는다", () => {
    expect(examQuestions.filter(q => !q.school)).toHaveLength(91);
    expect(getQuestionsBySchool("hanyang")).toEqual(getQuestionsBySchool("한양대"));
    expect(getQuestionsBySchool("hanyang")).toHaveLength(2);
    expect(getQuestionsBySchool("sungkyunkwan")).toHaveLength(10);
    expect(getQuestionsBySchool("unknown")).toEqual([]);
  });
  it("정답 중복과 실제 빈칸 유실을 검출한다", () => {
    expect(examStructuralIssues(examQuestions.find(q => q.id === "logic-top31강-25")!)).toContain("duplicate-choice");
    expect(examStructuralIssues({ ...fixture, question: "Choose the blank." })).toContain("missing-blank-marker");
    expect(examDisposition({ ...fixture, choices: ["a", " a ", "c", "d"] }, reviewFor(fixture)).status).toBe("blocked");
  });
  it("출처/권한/오답 근거/최신 snapshot 누락 시 자동 승격하지 않는다", () => {
    expect(examDisposition(fixture, reviewFor(fixture)).status).toBe("verified");
    for (const patch of [{ answerSource: "" }, { rights: "unverified" as const }, { choiceReasons: [] },
      { contentSnapshot: "stale" }, { correctOriginalIndex: 1 }, { status: "blocked" as const }])
      expect(examDisposition(fixture, { ...reviewFor(fixture), ...patch }).status).not.toBe("verified");
    expect(examDisposition({ ...fixture, explanation: "changed" }, reviewFor(fixture)).issues).toContain("stale-review");
  });
  it.each([4, 5])("%i개 선지의 모든 순열에서 정답 원본 ID를 유지하고 각 위치를 균등하게 사용한다", n => {
    const q = { ...fixture, choices: ["a", "b", "c", "d", "e"].slice(0, n) };
    const counts = Array(n).fill(0) as number[];
    const permutations = new Set<string>();
    const original = JSON.stringify(q);
    const visit = (i: number, samples: number[]) => {
      if (i > 0) {
        for (let j = 0; j <= i; j++) visit(i - 1, [...samples, (j + 0.5) / (i + 1)]);
        return;
      }
      let cursor = 0;
      const shuffled = shuffleChoices(q, () => samples[cursor++]);
      permutations.add(shuffled.choices.join("|"));
      counts[shuffled.answer]++;
      expect(shuffled.choices[shuffled.answer]).toBe(q.choices[q.answer]);
      expect(examContentSnapshot(shuffled)).toBe(examContentSnapshot(q));
      const graded = gradeExamChoice(shuffled, shuffled.answer, reviewFor(q))!;
      expect(graded).toMatchObject({ correct: true, selectedOriginalIndex: 2, correctOriginalIndex: 2, answerVersion: "test-v1" });
      expect(gradeExamChoice(shuffled, (shuffled.answer + 1) % n, reviewFor(q))?.correct).toBe(false);
      expect(JSON.parse(JSON.stringify(shuffled))).toEqual(shuffled); // persisted order
    };
    visit(n - 1, []);
    expect(permutations.size).toBe(n === 4 ? 24 : 120);
    expect(new Set(counts).size).toBe(1);
    expect(counts.every(c => c > 0)).toBe(true);
    expect(JSON.stringify(q)).toBe(original);
  });
  it("재셔플과 잘못된 순서/정답 참조에도 안전하다", () => {
    const q = shuffleChoices(shuffleChoices(fixture, () => 0), () => 0.9);
    expect(examContentSnapshot(q)).toBe(examContentSnapshot(fixture));
    expect(gradeExamChoice(q, q.answer, reviewFor(fixture))?.correct).toBe(true);
    expect(gradeExamChoice(q, -1, reviewFor(fixture))).toBeNull();
    expect(gradeExamChoice({ ...q, originalChoiceIndices: [0, 0, 2, 3] }, q.answer, reviewFor(fixture))).toBeNull();
    expect(gradeExamChoice({ ...q, answer: 50 }, 0, reviewFor(fixture))).toBeNull();
  });
});
