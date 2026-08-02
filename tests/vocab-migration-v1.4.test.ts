import { describe, expect, it } from "vitest";

import { VOCAB_META } from "@/lib/vocab";
import { buildVocabMigrationBackup } from "@/lib/vocab-migration";

describe("legacy vocabulary list migration", () => {
  it("keeps originals and separates unresolved records without deleting them", () => {
    const mappedLegacyNum = Number(Object.keys(VOCAB_META.legacyMigration.numMap)[0]);
    const unresolvedLegacyNum = VOCAB_META.legacyMigration.unresolvedNums[0];
    const result = buildVocabMigrationBackup({
      bookmarks: [mappedLegacyNum, unresolvedLegacyNum, mappedLegacyNum],
      wrongWords: [unresolvedLegacyNum],
      mastered: [],
    });

    expect(result.original.bookmarks).toEqual([mappedLegacyNum, unresolvedLegacyNum]);
    expect(result.lists.bookmarks.mapped).toEqual([
      VOCAB_META.legacyMigration.numMap[String(mappedLegacyNum)],
    ]);
    expect(result.lists.bookmarks.unresolved).toEqual([unresolvedLegacyNum]);
    expect(result.original.wrongWords).toEqual([unresolvedLegacyNum]);
    expect(result.lists.wrongWords.unresolved).toEqual([unresolvedLegacyNum]);
  });
});
