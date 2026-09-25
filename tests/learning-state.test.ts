import { describe, expect, it } from "vitest";
import {
  applyLearningEvent,
  createEmptySenseLearningState,
  getLearningTargetState,
  learningPriority,
} from "@/lib/learning-state";
import {
  canonicalSenseKey,
  getItemLearningTargets,
} from "@/lib/canonical-learning";
import { getVocabItem } from "@/lib/vocab";
import { buildQuizQuestions, getQuizCandidateItems } from "@/lib/quiz-engine";

describe("canonical sense learning state", () => {
  it("shares one target across duplicate chapter occurrences", () => {
    const first = getVocabItem(18434)!;
    const duplicate = getVocabItem(22498)!;
    expect(first.w).toBe("jury foreman");
    expect(getItemLearningTargets(first).map(target => target.key)).toEqual(
      getItemLearningTargets(duplicate).map(target => target.key),
    );
  });

  it("keeps distinct reviewed senses separate", () => {
    const item = getVocabItem(37941)!;
    const keys = getItemLearningTargets(item).map(target => target.key);
    expect(keys).toContain(canonicalSenseKey("take-for-granted:assume-without-checking"));
    expect(keys).toContain(canonicalSenseKey("take-for-granted:fail-to-appreciate"));
    expect(new Set(keys).size).toBe(2);
  });

  it("moves failure to WEAK, explicit mastery to MASTERED, and later failure to RELEARNING", () => {
    const key = canonicalSenseKey("jury-foreman:leader-of-jury");
    let state = createEmptySenseLearningState();
    state = applyLearningEvent(state, { targetKey: key, type: "wrong" });
    expect(getLearningTargetState(state, key).status).toBe("WEAK");
    const weakPriority = learningPriority(getLearningTargetState(state, key));
    state = applyLearningEvent(state, { targetKey: key, type: "mastered" });
    expect(getLearningTargetState(state, key).status).toBe("MASTERED");
    state = applyLearningEvent(state, { targetKey: key, type: "wrong" });
    expect(getLearningTargetState(state, key).status).toBe("RELEARNING");
    expect(learningPriority(getLearningTargetState(state, key))).toBeGreaterThan(weakPriority);
  });

  it("excludes a mastered sense from every target mode but keeps another sense of the headword", () => {
    const item = getVocabItem(37941)!;
    const mastered = canonicalSenseKey("take-for-granted:assume-without-checking");
    const candidates = getQuizCandidateItems({
      mode: "syn-choice",
      itemNums: [item.num],
      count: 1,
      allowMeaningFallback: true,
      masteredTargetKeys: [mastered],
    });
    expect(candidates.map(candidate => candidate.num)).toEqual([item.num]);
    const question = buildQuizQuestions({
      mode: "syn-choice",
      itemNums: [item.num],
      count: 1,
      allowMeaningFallback: true,
      preserveItemOrder: true,
      masteredTargetKeys: [mastered],
    })[0];
    expect(question.recall?.senseId).toBe("take-for-granted:fail-to-appreciate");
    expect(getQuizCandidateItems({
      mode: "flashcard",
      itemNums: [item.num],
      count: 1,
      masteredNums: [item.num],
      masteredTargetKeys: [mastered],
    }).map(candidate => candidate.num)).toEqual([item.num]);
  });

  it("removes a fully mastered real sense from all ordinary target pools", () => {
    const item = getVocabItem(18434)!;
    const mastered = canonicalSenseKey("jury-foreman:leader-of-jury");
    for (const mode of ["syn-choice", "kor-choice", "flashcard"] as const) {
      expect(getQuizCandidateItems({
        mode,
        itemNums: [item.num],
        count: 1,
        allowMeaningFallback: true,
        masteredTargetKeys: [mastered],
      })).toEqual([]);
    }
  });
});
