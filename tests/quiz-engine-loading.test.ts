import { expect, it, vi } from "vitest";
import * as vocab from "@/lib/vocab";
import * as engine from "@/lib/quiz-engine";

vi.mock("@/lib/vocab", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vocab")>();
  return { ...actual, getSynonymDetails: vi.fn(actual.getSynonymDetails) };
});

it("creates the distractor pool only on first synonym choice generation, then reuses it", () => {
  const details = vi.mocked(vocab.getSynonymDetails);
  expect(details).not.toHaveBeenCalled();

  const item = vocab.VOCAB_WITH_SYNONYMS[0];
  const options = { itemNums: [item.num], count: 1 };
  const [typed] = engine.buildQuizQuestions({ ...options, mode: "syn-type" });
  expect(engine.isTypedAnswerCorrect(typed, item.s[0])).toBe(true);
  expect(details).not.toHaveBeenCalled();

  const first = engine.buildQuizQuestions({ ...options, mode: "syn-choice" });
  expect(first).toHaveLength(1);
  expect(engine.validateQuestion(first[0])).toBe(true);
  const initialCalls = details.mock.calls.length;
  expect(initialCalls).toBe(vocab.VOCAB_WITH_SYNONYMS.length + 1);
  const second = engine.buildQuizQuestions({ ...options, mode: "syn-choice" });
  expect(second).toHaveLength(1);
  expect(engine.validateQuestion(second[0])).toBe(true);
  expect(details.mock.calls.length).toBe(initialCalls + 1);
});
