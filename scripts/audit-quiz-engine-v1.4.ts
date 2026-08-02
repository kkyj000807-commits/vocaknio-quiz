import assert from "node:assert/strict";

import {
  SECTION_RANGES,
  VOCAB,
  VOCAB_META,
  VOCAB_WITH_SYNONYMS,
  getSynonymDetails,
  normalizeWord,
} from "../lib/vocab";
import {
  buildQuizQuestions,
  isChoiceCorrect,
  validateQuestion,
  type QuizQuestion,
} from "../lib/quiz-engine";

function auditQuestions(label: string, questions: QuizQuestion[], expected: number): void {
  assert.equal(questions.length, expected, `${label}: expected ${expected}, got ${questions.length}`);

  for (const question of questions) {
    assert.equal(validateQuestion(question), true, `${label}: invalid question ${question.id}`);
    if (question.choices.length === 0) continue;
    assert.equal(question.choices.length, 4, `${label}: non-four-choice question ${question.id}`);
    assert.equal(
      new Set(question.choices.map((choice) => choice.label)).size,
      4,
      `${label}: duplicate label ${question.id}`,
    );
    assert.equal(
      question.choices.filter((choice) => isChoiceCorrect(question, choice)).length,
      1,
      `${label}: multiple accepted choices ${question.id}`,
    );
  }
}

assert.equal(VOCAB.length, 38163);
assert.equal(VOCAB_META.sourceEntries, 38163);
assert.equal(VOCAB_WITH_SYNONYMS.length, 11318);

let linkedSynonymCount = 0;
for (const item of VOCAB_WITH_SYNONYMS) {
  const details = getSynonymDetails(item);
  assert.equal(details.length, item.s.length, `missing synonym meaning: ${item.id}`);
  assert.equal(
    new Set(details.map((detail) => normalizeWord(detail.word))).size,
    details.length,
    `duplicate synonym detail: ${item.id}`,
  );
  for (const detail of details) {
    assert.ok(detail.meaning.trim(), `empty synonym meaning: ${item.id}/${detail.word}`);
    linkedSynonymCount += 1;
  }
}

const modeCounts: Record<string, number> = {};
const fullAudits = [
  { label: "syn-choice", mode: "syn-choice" as const, expected: 11318 },
  { label: "syn-kor-choice", mode: "syn-kor-choice" as const, expected: 11318 },
  { label: "syn-type", mode: "syn-type" as const, expected: 11318 },
  { label: "kor-choice", mode: "kor-choice" as const, expected: 38163 },
  {
    label: "kor-choice-english",
    mode: "kor-choice" as const,
    choiceLang: "english" as const,
    expected: 11318,
  },
  { label: "flashcard", mode: "flashcard" as const, expected: 38163 },
];

for (const audit of fullAudits) {
  const questions = buildQuizQuestions({
    mode: audit.mode,
    choiceLang: audit.choiceLang,
    rangeId: "all",
    count: VOCAB.length,
  });
  auditQuestions(audit.label, questions, audit.expected);
  modeCounts[audit.label] = questions.length;
}

const sectionAvailability = SECTION_RANGES.map((range) => ({
  id: range.id,
  synonymQuestions: buildQuizQuestions({
    mode: "syn-choice",
    rangeId: range.id,
    count: range.count,
  }).length,
  meaningQuestions: buildQuizQuestions({
    mode: "kor-choice",
    rangeId: range.id,
    count: range.count,
  }).length,
}));

console.log(
  JSON.stringify(
    {
      status: "pass",
      sourceEntries: VOCAB.length,
      synonymEntries: VOCAB_WITH_SYNONYMS.length,
      linkedSynonymCount,
      modeCounts,
      sectionAvailability,
    },
    null,
    2,
  ),
);
