import { describe, expect, it } from "vitest";

import learningIndex from "@/assets/vocab-learning-index-v1.4.json";
import corrections from "@/data/idiom-corrections.json";
import release from "@/release.config.json";
import { VOCAB } from "@/lib/vocab";
import { hasLearningEntry, LEARNING_COVERAGE } from "@/lib/vocab-learning";

describe("깊이 학습 인덱스", () => {
  it("기존 검수 해설과 모든 숙어 보완을 학습 인덱스에 연결한다", () => {
    expect(LEARNING_COVERAGE.senses).toBe(40 + corrections.entries.reduce((sum, entry) => sum + entry.targets.length, 0));
    expect(LEARNING_COVERAGE.rows).toBe(Object.keys(learningIndex.items).length);
    expect(LEARNING_COVERAGE.rows).toBeGreaterThanOrEqual(40);
  });

  it("쪽수로 남아 있던 숙어에 실제 해설이 연결된다", () => {
    expect(hasLearningEntry("JBKROW022984")).toBe(true);
    expect(learningIndex.version).toBe(release.version);
  });

  it("모든 숙어 보완에 실제 뜻, 한영 해설, 예문과 독립 근거가 있다", () => {
    const byId = new Map(VOCAB.map((item) => [item.id, item]));
    for (const entry of corrections.entries) {
      for (const value of [entry.meaningKo, entry.definitionEn, entry.definitionKo, entry.memoryKo, entry.usageKo, entry.examTrapKo, entry.example.en, entry.example.ko]) {
        expect(value.trim().length).toBeGreaterThan(3);
        expect(value).not.toMatch(/^p\s*\.?\s*\d+$/i);
      }
      expect(new Set(entry.sources.map((source) => source.independenceGroup)).size).toBeGreaterThanOrEqual(2);
      for (const target of entry.targets) {
        expect(byId.get(target.id)).toMatchObject({ w: target.headword, k: entry.meaningKo });
        expect(hasLearningEntry(target.id)).toBe(true);
      }
    }
  });

  it("존재하는 항목만 동기적으로 노출한다", () => {
    const firstItemId = Object.keys(learningIndex.items)[0];
    expect(hasLearningEntry(firstItemId)).toBe(true);
    expect(hasLearningEntry("missing-item")).toBe(false);
  });

  it("비슷한 숙어를 임의로 다른 정답으로 나누지 않고 다의어의 문맥을 보존한다", () => {
    const byKey = new Map(corrections.entries.map((entry) => [entry.key, entry]));
    expect(byKey.get("clamp-down-on")?.meaningKo).toBe(byKey.get("crack-down-on")?.meaningKo);
    expect(byKey.get("in-face-of")?.meaningKo).toBe("A에 직면하여; A에도 불구하고");
    expect(byKey.get("work-out")?.targets).toHaveLength(4);
    expect(byKey.get("work-out")?.meaningKo).toContain("운동하다");
    expect(byKey.get("work-out")?.meaningKo).toContain("계산하다");
  });
});
