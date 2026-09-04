import { describe, expect, it } from "vitest";

import learningIndex from "@/assets/vocab-learning-index-v1.4.json";
import { hasLearningEntry, LEARNING_COVERAGE } from "@/lib/vocab-learning";

describe("깊이 학습 인덱스", () => {
  it("검수된 40개 뜻을 8개 구간에 연결한다", () => {
    expect(LEARNING_COVERAGE.senses).toBe(40);
    expect(LEARNING_COVERAGE.rows).toBe(Object.keys(learningIndex.items).length);
    expect(LEARNING_COVERAGE.rows).toBeGreaterThanOrEqual(40);
  });

  it("존재하는 항목만 동기적으로 노출한다", () => {
    const firstItemId = Object.keys(learningIndex.items)[0];
    expect(hasLearningEntry(firstItemId)).toBe(true);
    expect(hasLearningEntry("missing-item")).toBe(false);
  });
});
