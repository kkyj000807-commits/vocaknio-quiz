import assert from "node:assert/strict";

import {
  SECTION_RANGES,
  VOCAB,
  VOCAB_META,
  VOCAB_WITH_SYNONYMS,
  getSynonymDetails,
  getVocabItem,
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
assert.equal(VOCAB_WITH_SYNONYMS.length, 11277);
assert.equal(VOCAB_META.synonymEntryCount, 11277);
assert.equal(VOCAB_META.semanticGuard.ruleCount, 8);
assert.equal(VOCAB_META.semanticGuard.rawSynonymEntryCount, 11318);
assert.equal(VOCAB_META.semanticGuard.rawLinkedSynonymCount, 65589);
assert.equal(VOCAB_META.semanticGuard.blockedEntryCount, 41);
assert.equal(VOCAB_META.semanticGuard.removedLinkCount, 370);
assert.equal(VOCAB_META.semanticGuard.linkedSynonymCount, 65219);

const blockedSenseCases = [198, 1023, 9270, 1784, 380, 1881, 26006];
for (const num of blockedSenseCases) {
  const item = getVocabItem(num);
  assert.ok(item, `missing guarded row: ${num}`);
  assert.deepEqual(item.s, [], `unsafe synonyms remain: ${item.id}`);
  assert.deepEqual(
    buildQuizQuestions({ mode: "syn-choice", itemNums: [num], count: 1 }),
    [],
    `unsafe choice question remains: ${item.id}`,
  );
  assert.deepEqual(
    buildQuizQuestions({ mode: "syn-type", itemNums: [num], count: 1 }),
    [],
    `unsafe typed question remains: ${item.id}`,
  );
}

const carnage = getVocabItem(347);
assert.ok(carnage, "missing carnage regression row");
assert.deepEqual(carnage.s, ["holocaust", "massacre"]);

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
  { label: "syn-choice", mode: "syn-choice" as const, expected: 11277 },
  { label: "syn-kor-choice", mode: "syn-kor-choice" as const, expected: 11277 },
  { label: "syn-type", mode: "syn-type" as const, expected: 11277 },
  { label: "kor-choice", mode: "kor-choice" as const, expected: 38163 },
  {
    label: "kor-choice-english",
    mode: "kor-choice" as const,
    choiceLang: "english" as const,
    expected: 11277,
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
      semanticGuard: VOCAB_META.semanticGuard,
      modeCounts,
      sectionAvailability,
    },
    null,
    2,
  ),
);
