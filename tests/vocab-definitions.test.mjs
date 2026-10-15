import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const groups = ["v101", "v201", "v301", "v401", "v501", "v502", "v601", "appendix"];
const files = groups.map((group) =>
  JSON.parse(
    fs.readFileSync(
      path.join(root, "public", "data", "vocab-definitions", "oewn-2025", `${group}.json`),
      "utf8",
    ),
  ),
);
const meta = JSON.parse(
  fs.readFileSync(path.join(root, "assets", "vocab-definitions-oewn-2025.json"), "utf8"),
);

function recordsForHeadword(headword) {
  const key = headword.toLowerCase();
  return files.flatMap((file) => (file.headwords[key] ? [file.headwords[key]] : []));
}

describe("OEWN definition aliases", () => {
  it("exports original editorial examples only on approved rows and never adds them to dictionary or quiz quotations", () => {
    const source = JSON.parse(fs.readFileSync(path.join(root, "data/vocab-learning/editorial-examples-20261015.json"), "utf8"));
    const vocab = JSON.parse(fs.readFileSync(path.join(root, "assets/vocab-v1.4.json"), "utf8"));
    const quiz = JSON.parse(fs.readFileSync(path.join(root, "assets/vocab-definition-quiz-oewn-2025.json"), "utf8"));
    expect(source.entries.length).toBeGreaterThan(0);
    expect(meta.coverage.editorialExampleSenses).toBe(source.entries.length);
    for (const entry of source.entries) {
      const records = recordsForHeadword(entry.headword);
      expect(records.length).toBeGreaterThan(0);
      for (const record of records) {
        const sense = record.senses.find(s => s.senseId === entry.senseId);
        expect(sense.synsetId).toBe(entry.synsetId);
        expect(sense.partOfSpeech).toBe(entry.pos);
        expect(sense.definition).toBe(entry.matchEvidence.sourceDefinition);
        expect(sense.editorialExamples).toContainEqual({ en: entry.en, ko: entry.ko, cueKo: entry.cueKo,
          sourceRowIds: entry.sourceRowIds, provenance: "FINETUNE original", reviewStatus: "ai-reviewed-editorial-example" });
        expect(sense.examples).not.toContain(entry.en);
        expect(sense.reviewedExamples.some(example => example.en === entry.en)).toBe(false);
        expect(record.senses.filter(s => s.senseId !== entry.senseId).every(s => !s.editorialExamples?.some(example => example.en === entry.en))).toBe(true);
      }
      for (const id of entry.sourceRowIds) {
        const row = vocab.find(row => row.id === id);
        expect(row.w.toLowerCase().trim()).toBe(entry.headword.toLowerCase().trim());
        expect(row.k).toBe(entry.sourceMeaningKo);
        expect(quiz.entries[quiz.items[id]]?.examples ?? []).not.toContain(entry.en);
      }
    }
  });
  it("delivers all 152 reviewed translations to their exact source senses without changing answer eligibility", () => {
    const source = JSON.parse(fs.readFileSync(path.join(root, "data/vocab-learning/reviewed-examples-20261014.json"), "utf8"));
    expect(source.entries).toHaveLength(152);
    expect(new Set(source.entries.map(e => `${e.senseId}|${e.en}`)).size).toBe(152);
    expect(meta.coverage.reviewedExampleTranslations).toBe(152);
    for (const entry of source.entries) {
      const records = recordsForHeadword(entry.headword);
      expect(records.length).toBeGreaterThan(0);
      for (const record of records) {
        const sense = record.senses.find(s => s.senseId === entry.senseId);
        expect(sense.synsetId).toBe(entry.synsetId);
        expect(sense.partOfSpeech).toBe(entry.pos);
        expect(sense.definition).toBe(entry.matchEvidence.sourceDefinition);
        expect(sense.reviewedExamples).toContainEqual({ en: entry.en, ko: entry.ko, cueKo: entry.cueKo });
        for (const other of record.senses.filter(s => s.senseId !== entry.senseId)) {
          expect(other.reviewedExamples).not.toContainEqual({ en: entry.en, ko: entry.ko, cueKo: entry.cueKo });
        }
      }
    }
    expect(meta.quizEligibility.dictionary_primary_unreviewed).toBe(false);
    expect(meta.quizEligibility.dictionary_alias_unreviewed).toBe(false);
    expect(source.held.length).toBeGreaterThan(0);
  });
  it("delivers licensed sense-specific examples independently of quiz eligibility", () => {
    const unique = new Map(files.flatMap(file => Object.entries(file.headwords)));
    const withExamples = [...unique.values()].filter(entry => entry.senses.some(sense => sense.examples?.length));
    expect(withExamples.length).toBe(meta.coverage.referenceExampleHeadwords);
    expect(withExamples.length).toBeGreaterThan(7900);
    const abandon = unique.get("abandon");
    expect(abandon.status).toBe("dictionary_primary_unreviewed");
    expect(abandon.senses.find(s => s.senseId === "abandon%1:07:00::").examples).toContain("she danced with abandon");
    expect(abandon.senses.filter(s => s.partOfSpeech === "verb").every(s => !s.examples.includes("she danced with abandon"))).toBe(true);
    for (const entry of unique.values()) for (const sense of entry.senses) {
      expect(new Set(sense.examples).size).toBe(sense.examples.length);
      expect(sense.examples.every(en => typeof en === "string" && en.trim() && !en.startsWith("{'"))).toBe(true);
      for (const example of sense.reviewedExamples) {
        expect(sense.examples).toContain(example.en);
        expect(example.ko.trim()).not.toBe("");
      }
    }
  });
  it("exposes reviewed punctuation variants as non-quiz dictionary candidates", () => {
    const records = recordsForHeadword("gung-ho");
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.status === "dictionary_alias_unreviewed")).toBe(true);
    expect(records.every((record) => record.matches.some(
      (match) => match.headword === "gung ho" && match.matchType === "reviewed_hyphenation_variant",
    ))).toBe(true);
    expect(records.every((record) => record.senses.some(
      (sense) => sense.definition === "very enthusiastic and dedicated",
    ))).toBe(true);
    expect(meta.quizEligibility.dictionary_alias_unreviewed).toBe(false);
  });

  it("does not use automatic punctuation cleanup when it changes the lexical sense", () => {
    for (const headword of ["run-off", "burn-out", "bale(보석금)", "turn (to)"]) {
      const records = recordsForHeadword(headword);
      expect(records.length).toBeGreaterThan(0);
      expect(records.every((record) => record.status === "source_not_found")).toBe(true);
      expect(records.every((record) => record.senses.length === 0)).toBe(true);
    }
  });

  it("uses only reviewed editorial variants for optional phrase notation", () => {
    const records = recordsForHeadword("in the (very) nick of time");
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.status === "dictionary_alias_unreviewed")).toBe(true);
    expect(records.every((record) => record.matches.some(
      (match) => match.headword === "in the nick of time" && match.matchType === "reviewed_editorial_variant",
    ))).toBe(true);
    expect(records.every((record) => record.senses.some(
      (sense) => sense.definition === "at the last possible moment",
    ))).toBe(true);
  });

  it.each([
    ["boiler-plate(d)", "boilerplate", "standard formulations uniformly found in certain types of legal documents or news stories"],
    ["double(-)bind", "double bind", "(psychology) an unresolvable dilemma; situation in which a person receives contradictory messages from a person who is very powerful"],
    ["life span", "lifespan", "the period during which something is functional (as between birth and death)"],
    ["the killing fields", "killing field", "(usually plural) an area where many people have died (usually by massacre or genocide during war or violent civil disturbance)"],
    ["the senate", "senate", "the upper house of the United States Congress"],
    ["the sword of damocles", "sword of damocles", "a constant and imminent peril"],
  ])("maps the reviewed source notation for %s", (sourceHeadword, dictionaryHeadword, definition) => {
    const records = recordsForHeadword(sourceHeadword);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.status === "dictionary_alias_unreviewed")).toBe(true);
    expect(records.every((record) => record.matches.some(
      (match) => match.headword === dictionaryHeadword
        && match.matchType === "reviewed_editorial_variant",
    ))).toBe(true);
    expect(records.every((record) => record.senses.some(
      (sense) => sense.definition === definition,
    ))).toBe(true);
  });

  it("rejects a spelling-near dictionary entry when its part of speech or sense differs", () => {
    for (const headword of ["high-profile", "count (on)"]) {
      const records = recordsForHeadword(headword);
      expect(records.length).toBeGreaterThan(0);
      expect(records.every((record) => record.status === "source_not_found")).toBe(true);
      expect(records.every((record) => record.senses.length === 0)).toBe(true);
    }
  });

  it("keeps every vocabulary row covered after alias enrichment", () => {
    const totalRows = files.reduce((sum, file) => sum + Object.keys(file.items).length, 0);
    expect(totalRows).toBe(meta.coverage.totalRows);
    expect(meta.coverage.matchedRows + meta.coverage.sourceNotFoundRows).toBe(totalRows);
    expect(meta.coverage.aliasMatchedRows).toBeGreaterThan(0);
  });
});
