import { describe, expect, it } from "vitest";

import { buildSemanticCluster } from "@/lib/semantic-cluster";

describe("semantic relation cluster", () => {
  it("keeps exact, near, opposite, variant, and related relations in separate lanes", () => {
    const cluster = buildSemanticCluster({
      exactSynonyms: ["bewilder", "bewilder"],
      nearSynonyms: ["confuse", "bewilder"],
      antonyms: ["clarify"],
      variants: ["bemused"],
      relatedWords: ["perplex"],
    });

    expect(cluster.synonyms).toEqual([
      { word: "bewilder", kind: "exact" },
      { word: "confuse", kind: "near" },
    ]);
    expect(cluster.opposites).toEqual([
      { word: "clarify", kind: "opposite", meaningKo: undefined },
    ]);
    expect(cluster.auxiliaries).toEqual([
      { word: "bemused", kind: "variant" },
      { word: "perplex", kind: "related" },
    ]);
  });

  it("adds a Korean gloss only from the matching stored antonym choice", () => {
    const cluster = buildSemanticCluster({
      antonyms: ["clarify", "understand"],
      choiceMeanings: [
        { word: "clarify", meaning: "반대축 · 명확하게 하다" },
        { word: "unrelated", meaning: "비교선지 · 무관한" },
        { word: "understand", meaning: "뜻 확인" },
      ],
    });

    expect(cluster.opposites).toEqual([
      { word: "clarify", kind: "opposite", meaningKo: "명확하게 하다" },
      { word: "understand", kind: "opposite", meaningKo: undefined },
    ]);
  });

  it("keeps Korean meanings on the same-sense relation lanes after grading", () => {
    const cluster = buildSemanticCluster({
      exactSynonyms: ["bewilder"],
      antonyms: ["clarify"],
      choiceMeanings: [
        { word: "bewilder", meaning: "당황하게 하다" },
        { word: "clarify", meaning: "반대축 · 명확하게 하다" },
      ],
    });

    expect(cluster.synonyms[0]).toEqual({ word: "bewilder", kind: "exact", meaningKo: "당황하게 하다" });
    expect(cluster.opposites[0]).toEqual({
      word: "clarify",
      kind: "opposite",
      meaningKo: "명확하게 하다",
    });
  });
});
