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
