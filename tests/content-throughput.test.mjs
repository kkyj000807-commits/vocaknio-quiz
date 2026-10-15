import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkpointUnchanged, contentStratum, measureContent, privateMeasurementOutput, selectContentBatch } from "../scripts/measure-content-throughput.mjs";

const dictionarySense = id => ({ senseId: id, definition: "Fixture definition", partOfSpeech: "n" });

describe("bounded private content measurement", () => {
  it("counts editorial delivery only for the exact linked row without promoting semantic review", () => {
    const input = {
      vocab: [{ id: "r1", w: "fixture", k: "뜻1", group: "V101" }, { id: "r2", w: "fixture", k: "뜻2", group: "V601" }],
      definitionGroups: [{ items: { r1: "fixture", r2: "fixture" }, headwords: { fixture: { status: "single_sense",
        senses: [{ ...dictionarySense("one"), editorialExamples: [{ en: "A new example.", ko: "새 예문", cueKo: "단서",
          sourceRowIds: ["r1"], provenance: "FINETUNE original", reviewStatus: "ai-reviewed-editorial-example" }] }] } } }],
      definitionQuiz: { items: {}, entries: {} }, canonical: [], activeRecall: [], learningEntries: [], learningIndexItems: {},
    };
    const result = measureContent(input);
    expect(result.coverage.headwordsWithAnyEnglishExample).toBe(1);
    expect(result.coverage.headwordsWithAnyBilingualCueTuple).toBe(1);
    expect(result.coverage.bySection.V101.englishExampleRows).toBe(1);
    expect(result.coverage.bySection.V601.englishExampleRows).toBe(0);
    expect(result.batch.newSemanticReviewPass).toBe(0);
    input.definitionGroups[0].headwords.fixture.senses[0].editorialExamples[0].reviewStatus = "candidate";
    expect(measureContent(input).coverage.headwordsWithAnyEnglishExample).toBe(0);
  });
  it("keeps source occurrences separate from normalized headwords and unresolved mappings", () => {
    const row = (id, w, group) => ({ id, w, k: "원자료 뜻", group });
    const canonical = { senseId: "phrase:one", itemIds: ["r4"], definitionStatus: "COMPLETE", englishDefinition: "Fixture definition",
      koreanMeaning: "시험용 뜻", contextExplanation: "시험용 문맥", exampleSentence: "Fixture example.", exampleTranslation: "시험용 번역",
      exampleExplanation: "시험용 단서", synonyms: ["fixture-alternative"], distinctionNote: "시험용 구별", sourceIds: ["https://example.test"] };
    const result = measureContent({
      vocab: [row("r1", " Single ", "V101"), row("r2", "single", "V601"), row("r3", "poly", "V101"), row("r4", "fixture phrase", "APPENDIX"), row("r5", "unmapped", "V101")],
      definitionGroups: [{ items: { r1: "single", r2: "single", r3: "poly", r4: "phrase", r5: "unmapped" }, headwords: {
        single: { status: "single_sense", senses: [dictionarySense("single:one")] },
        poly: { status: "dictionary_primary_unreviewed", senses: [dictionarySense("poly:one"), dictionarySense("poly:two")] },
        phrase: { status: "source_not_found", senses: [] }, unmapped: { status: "source_not_found", senses: [] },
      } }],
      definitionQuiz: { items: { r1: "single", r2: "single" }, entries: { single: { examples: ["Fixture English example."] } } },
      canonical: [canonical], learningEntries: [], learningIndexItems: {},
      activeRecall: [{ senseId: "phrase:one", itemIds: ["r4"], status: "production", exampleSentences: [{ en: "Fixture example.", ko: "시험용 번역", cueKo: "시험용 단서" }] }],
    });
    expect(result.coverage.normalizedHeadwords).toBe(4);
    expect(result.coverage.sourceOccurrences).toBe(5);
    expect(result.coverage.bySection.V101.sourceRows).toBe(3);
    expect(result.coverage.bySection.V601.sourceRows).toBe(1);
    expect(result.coverage.canonicalSenseIds).toBe(1);
    expect(result.fullHeldQueue.some(entry => entry.headword === "unmapped")).toBe(true);
    expect(result.coverage.byStratum).toEqual({ "single-sense-candidate": 1, "polysemous-candidate": 1, "idiom-or-phrase": 1, "unresolved-mapping": 1 });
    expect(result.coverage.headwordsWithAnyEnglishExample).toBe(2);
    expect(result.coverage.headwordsWithAnyBilingualCueTuple).toBe(1);
    expect(result.batch.selectedHeadwords).toBe(3);
    expect(result.batch.structuralPass).toBe(1);
    expect(result.batch.newSemanticReviewPass).toBe(0);
    expect(result.batch.heldQueue).toHaveLength(3);
    expect(result.batch.candidates.every(candidate => candidate.newSemanticReviews === 0 && candidate.runtimeDelivery === "NOT_VERIFIED")).toBe(true);
    expect(result.batch.candidates.find(candidate => candidate.headword === "single").occurrenceIds).toEqual(["r1", "r2"]);
  });

  it("does not promote an alias or unmatched headword to single-sense verified content", () => {
    expect(contentStratum("fixture", [{ status: "dictionary_alias_unreviewed", senses: [dictionarySense("one")] }])).toBe("unresolved-mapping");
    expect(contentStratum("fixture", [undefined])).toBe("unresolved-mapping");
    expect(contentStratum("fixture", [{ status: "single_sense", senses: [dictionarySense("one")] }, { status: "single_sense", senses: [dictionarySense("two")] }])).toBe("polysemous-candidate");
    expect(contentStratum("fixture phrase", [])).toBe("idiom-or-phrase");
  });

  it("samples 100 deterministic distinct headwords in 34/33/33 strata without padding", () => {
    const layers = ["single-sense-candidate", "polysemous-candidate", "idiom-or-phrase"];
    const candidates = layers.flatMap(stratum => Array.from({ length: 80 }, (_, index) => ({ headword: `${stratum}-${index}`, stratum })));
    const first = selectContentBatch(candidates);
    expect(first).toHaveLength(100);
    expect(layers.map(stratum => first.filter(entry => entry.stratum === stratum).length)).toEqual([34, 33, 33]);
    expect(selectContentBatch([...candidates].reverse())).toEqual(first);
    const next = selectContentBatch(candidates, 1);
    expect(next.every(entry => !first.some(previous => previous.headword === entry.headword))).toBe(true);
    expect(selectContentBatch(candidates.slice(0, 2))).toHaveLength(2);
    expect(() => selectContentBatch(candidates, -1)).toThrow();
  });

  it("counts broken learning-index pointers instead of pretending an orphan export reaches the UI", () => {
    const result = measureContent({ vocab: [{ id: "r1", w: "fixture", k: "뜻", group: "V101" }], definitionGroups: [],
      definitionQuiz: { items: {}, entries: {} }, canonical: [], activeRecall: [],
      learningEntries: [{ id: "entry", senseId: "fixture:one", headword: "fixture", itemIds: ["r1"], exportGroup: "V601",
        definitionEn: "Fixture", definitionKo: "뜻", contextExplanationKo: "문맥", definitionStatus: "production",
        verification: { status: "cross-agreed" }, sources: [], example: { en: "Example", ko: "번역", cueKo: "단서" } }],
      learningIndexItems: { r1: { group: "V101", entryIds: ["entry"] } } });
    expect(result.coverage.brokenLearningPointers).toBe(1);
    expect(result.coverage.headwordsWithAnyEnglishExample).toBe(0);
    expect(result.coverage.rejectedLearningExportEntries).toBe(0);
  });

  it("does not count a rejected learning export or C quality as delivered content", () => {
    const result = measureContent({ vocab: [{ id: "r1", w: "fixture", k: "뜻", group: "V101" }], definitionGroups: [],
      definitionQuiz: { items: {}, entries: {} }, canonical: [],
      activeRecall: [{ senseId: "fixture:one", itemIds: ["r1"], status: "production", quality: "C", exampleSentences: [{ en: "Example", ko: "번역", cueKo: "단서" }] }],
      learningEntries: [{ id: "entry", itemIds: ["r1"], exportGroup: "V101", example: { en: "Example", ko: "번역", cueKo: "단서" } }],
      learningIndexItems: { r1: { group: "V101", entryIds: ["entry"] } } });
    expect(result.coverage.rejectedLearningExportEntries).toBe(1);
    expect(result.coverage.brokenLearningPointers).toBe(1);
    expect(result.coverage.headwordsWithAnyEnglishExample).toBe(0);
  });

  it("skips only a successful checkpoint with identical input and batch", () => {
    const checkpoint = { schema: 1, status: "MEASURED", inputHash: "same", batchIndex: 0 };
    expect(checkpointUnchanged(checkpoint, "same", 0)).toBe(true);
    expect(checkpointUnchanged(checkpoint, "changed", 0)).toBe(false);
    expect(checkpointUnchanged(checkpoint, "same", 1)).toBe(false);
    expect(checkpointUnchanged({ ...checkpoint, status: "FAILED" }, "same", 0)).toBe(false);
  });

  it("requires an explicit non-public analysis/qa JSON output path", () => {
    const root = process.cwd();
    expect(privateMeasurementOutput(root, "analysis/qa/throughput.json")).toBe(path.join(root, "analysis", "qa", "throughput.json"));
    for (const output of [undefined, "public/data/report.json", "assets/report.json", "../report.json", "analysis/qa/../report.json", "analysis/qa/report.txt"]) {
      expect(() => privateMeasurementOutput(root, output)).toThrow();
    }
  });
});
