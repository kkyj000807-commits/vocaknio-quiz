// Read-only evidence probe for the first scheduled-audit trial; never imports learner storage.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { VOCAB, type QuizMode } from "../lib/vocab";
import { buildQuizQuestions, isChoiceCorrect, validateQuestion } from "../lib/quiz-engine";
import { examQuestions } from "../lib/exam-questions";
import { validateSentenceCompletionCatalog } from "../lib/sentence-completion";
import catalog from "../data/sentence-completion.json";

if (!fs.statSync(".git").isFile()) throw new Error("Run only in an isolated Git worktree");
const duplicateCount = (values: string[]) => values.length - new Set(values).size;
const counts = [5, 10, 20, 30];
const countChecks = (["kor-choice", "definition-choice", "syn-choice", "sentence-completion"] as QuizMode[])
  .flatMap(mode => counts.map(requested => {
    const questions = buildQuizQuestions({ mode, count: requested, rangeStart: 1, rangeEnd: 100000, choiceLang: "english" });
    return { mode, requested, actual: questions.length, matches: questions.length === requested,
      duplicateIds: duplicateCount(questions.map(q => q.id)),
      invalid: questions.filter(q => !validateQuestion(q) || q.choices.filter(c => isChoiceCorrect(q, c)).length !== 1).length };
  }));
const targetExams = examQuestions.filter(q => ["vocab-synonym", "vocab-blank", "logic-blank"].includes(q.type));
const bySchoolYearType: Record<string, number> = {};
for (const q of targetExams) {
  const key = `${q.school ?? "school-unspecified"}|${q.year}|${q.type}`;
  bySchoolYearType[key] = (bySchoolYearType[key] ?? 0) + 1;
}
const sc = validateSentenceCompletionCatalog(catalog).questions;
const report = {
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  countChecks,
  vocabulary: {
    occurrences: VOCAB.length,
    uniqueHeadwordStrings: new Set(VOCAB.map(v => v.w)).size,
    duplicateOccurrenceIds: duplicateCount(VOCAB.map(v => v.id)),
    canonicalSha256: createHash("sha256").update(fs.readFileSync("assets/vocab-v1.4.json")).digest("hex"),
    note: "Headword count is not a POS+sense count; repeated source occurrences are preserved.",
  },
  legacyExams: {
    total: examQuestions.length, vocabularyLogicCandidates: targetExams.length, bySchoolYearType,
    duplicateIds: duplicateCount(examQuestions.map(q => q.id)),
    invalidAnswerReferences: targetExams.filter(q => !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length).map(q => q.id),
    duplicateChoices: targetExams.filter(q => duplicateCount(q.choices.map(c => c.trim().toLowerCase())) > 0).map(q => q.id),
    missingExplanations: targetExams.filter(q => !q.explanation.trim()).map(q => q.id),
    note: "Candidate rows, not restored/official-answer-verified past-exam questions. School-unspecified is not inferred.",
  },
  sentenceCompletion: {
    registered: sc.length, generated: sc.filter(q => q.authorship === "generated").length,
    pastExam: sc.filter(q => q.authorship === "past-exam").length,
    note: "Schema and links only, not semantic uniqueness or pedagogical-effect certification.",
  },
};
console.log(JSON.stringify(report, null, 2));
if (countChecks.some(c => !c.matches || c.duplicateIds || c.invalid) ||
    report.vocabulary.duplicateOccurrenceIds || report.legacyExams.duplicateIds ||
    report.legacyExams.invalidAnswerReferences.length || report.legacyExams.duplicateChoices.length ||
    report.legacyExams.missingExplanations.length) process.exitCode = 1;
