import { describe, expect, it } from "vitest";

import learningIndex from "@/assets/vocab-learning-index-v1.4.json";
import { hasLearningEntry, LEARNING_COVERAGE } from "@/lib/vocab-learning";

describe("깊이 학습 인덱스", () => {
  it("검수된 해설과 20개 오류 보완을 8개 구간에 연결한다", () => {
    expect(LEARNING_COVERAGE.senses).toBe(60);
    expect(LEARNING_COVERAGE.rows).toBe(Object.keys(learningIndex.items).length);
    expect(LEARNING_COVERAGE.rows).toBeGreaterThanOrEqual(40);
  });

  it("쪽수로 남아 있던 숙어에 실제 해설이 연결된다", () => {
    expect(hasLearningEntry("JBKROW022984")).toBe(true);
    expect(learningIndex.version).toBe("1.5");
  });

  it("존재하는 항목만 동기적으로 노출한다", () => {
    const firstItemId = Object.keys(learningIndex.items)[0];
    expect(hasLearningEntry(firstItemId)).toBe(true);
    expect(hasLearningEntry("missing-item")).toBe(false);
  });
});
