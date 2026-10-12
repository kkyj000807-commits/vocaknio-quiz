import provenance from "../assets/exam-provenance.json";
import catalog from "../assets/exam-release-catalog.json";
import type { ExamQuestion } from "./exam-runtime";

export const RETAINED_EXAM_COUNT = catalog.retainedCount;

// Reuses the historical provenance overlay, but never promotes its old
// "verified" labels without current source/key/rights evidence.
export interface ExamReview {
  status: "verified" | "unverified" | "blocked";
  answerVersion: string;
  contentSnapshot: string;
  questionSource: string;
  answerSource: string;
  sourceLocation: string;
  checkedAt: string;
  rights: "cleared" | "unverified";
  authorship: "past-exam" | "adapted" | "generated";
  correctOriginalIndex: number;
  choiceReasons: string[];
}
const reviews = provenance.reviews as Record<string, ExamReview>;
const historicalBlocked = new Set(provenance.blockedIds);

/** Exact source contract, independent of display order; not a correctness proof. */
export function examContentSnapshot(q: ExamQuestion): string {
  const order = q.originalChoiceIndices ?? q.choices.map((_, i) => i);
  const choices = [...q.choices];
  order.forEach((originalIndex, displayIndex) => { choices[originalIndex] = q.choices[displayIndex]; });
  return JSON.stringify([q.id, q.school ?? null, q.year, q.qNum, q.type,
    q.passage ?? null, q.question, q.underlined ?? null, choices,
    order[q.answer], q.explanation, q.points]);
}

export function examStructuralIssues(q: ExamQuestion): string[] {
  const issues: string[] = [];
  if (!q.id.trim() || !q.question.trim() || !q.explanation.trim()) issues.push("missing-required-field");
  if (q.choices.length < 4 || q.choices.length > 5 || q.choices.some(c => !c.trim())) issues.push("invalid-choices");
  if (new Set(q.choices.map(c => c.trim().replace(/\s+/g, " ").toLowerCase())).size !== q.choices.length)
    issues.push("duplicate-choice");
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) issues.push("invalid-answer");
  if (q.originalChoiceIndices && (q.originalChoiceIndices.length !== q.choices.length ||
    new Set(q.originalChoiceIndices).size !== q.choices.length ||
    q.originalChoiceIndices.some(i => !Number.isInteger(i) || i < 0 || i >= q.choices.length)))
    issues.push("invalid-choice-order");
  // A word such as "blank" in instructions is not an actual blank location.
  if (q.type.includes("blank") && !/_{2,}|\(\s*\)|（\s*）/.test(q.question + (q.passage ?? "")))
    issues.push("missing-blank-marker");
  return issues;
}

export function examDisposition(q: ExamQuestion, review: ExamReview | undefined = reviews[q.id]) {
  const issues = examStructuralIssues(q);
  if (issues.length) return { status: "blocked" as const, issues };
  if (!review || review.status !== "verified") {
    return { status: historicalBlocked.has(q.id) || review?.status === "blocked"
      ? "blocked" as const : "unverified" as const, issues: ["source-key-review-required"] };
  }
  const originalAnswer = (q.originalChoiceIndices ?? q.choices.map((_, i) => i))[q.answer];
  if (review.contentSnapshot !== examContentSnapshot(q) || review.correctOriginalIndex !== originalAnswer)
    return { status: "unverified" as const, issues: ["stale-review"] };
  if (![review.answerVersion, review.questionSource, review.answerSource, review.sourceLocation].every(v => typeof v === "string" && !!v.trim()) ||
    !Number.isFinite(Date.parse(review.checkedAt)) || review.rights !== "cleared" ||
    !["past-exam", "adapted", "generated"].includes(review.authorship) ||
    review.choiceReasons.length !== q.choices.length || review.choiceReasons.some(v => !v.trim()))
    return { status: "unverified" as const, issues: ["incomplete-evidence-or-rights"] };
  return { status: "verified" as const, issues: [] };
}

export function getPracticeExamQuestions(): ExamQuestion[] {
  return (catalog.questions as ExamQuestion[]).filter(q => examDisposition(q).status === "verified");
}

/** Null means do not grade or update learning statistics. Never regrade history. */
export function gradeExamChoice(q: ExamQuestion, displayIndex: number, review: ExamReview | undefined = reviews[q.id]) {
  if (examDisposition(q, review).status !== "verified" || !Number.isInteger(displayIndex) ||
    displayIndex < 0 || displayIndex >= q.choices.length || !review) return null;
  const order = q.originalChoiceIndices ?? q.choices.map((_, i) => i);
  return {
    questionId: q.id,
    answerVersion: review.answerVersion,
    contentSnapshot: review.contentSnapshot,
    selectedOriginalIndex: order[displayIndex],
    correctOriginalIndex: order[q.answer],
    displayOrder: [...order],
    correct: displayIndex === q.answer,
  };
}
