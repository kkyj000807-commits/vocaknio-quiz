import { describe, expect, it } from "vitest";
import { arrangeWordbook } from "../lib/wordbook-display";
import vocabulary from "../assets/vocab-v1.4.json";
import order from "../assets/wordbook-order.json";
import type { VocabItem } from "../lib/vocab";

const item = (id: string, overrides: Partial<VocabItem> = {}): VocabItem => ({
  id, num: Number(id), sourceIndex: Number(id), sourceNumber: id, w: "capricious", k: "변덕스러운",
  p: "/test/", group: "V101", conceptId: "", conceptLabel: "", majorConceptLabel: "",
  s: [], k_short: "변덕스러운", category: "V101", type: "word", ...overrides,
});

describe("lossless display-only book ordering and exact duplicate folding", () => {
  it("folds identical repeated content across 101-601 while retaining every original ID and section", () => {
    const input = [item("1"), item("2", { group: "V601" })];
    const before = JSON.stringify(input);
    const result = arrangeWordbook(input);
    expect(result).toHaveLength(1);
    expect(result[0].displaySourceIds).toEqual(["1", "2"]);
    expect(result[0].displaySourceGroups).toEqual(["V101", "V601"]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("does not merge distinct meanings, pronunciations, concepts, synonyms or empty glosses", () => {
    const input = [item("1"), item("2", { k: "다른 뜻" }), item("3", { p: "/other/" }),
      item("4", { conceptLabel: "다른 개념" }), item("5", { s: ["other"] }),
      item("6", { k: "" }), item("7", { k: "" })];
    expect(arrangeWordbook(input)).toHaveLength(7);
  });
  it("preserves separately bookmarked and separately learned records", () => {
    expect(arrangeWordbook([item("1"), item("2")], x => x.id === "1" ? "MASTERED" : "NEW")).toHaveLength(2);
    expect(arrangeWordbook([item("1"), item("2")], x => x.id === "1" ? "bookmark" : "")).toHaveLength(2);
    expect(arrangeWordbook([item("2")])[0].id).toBe("2");
    expect(arrangeWordbook([item("1"), item("2")], x => `sense:${x.id}:NEW`)).toHaveLength(2);
  });
  it("uses actual book array order without dropping app-only words", () => {
    const [first, second] = order.headwords;
    const result = arrangeWordbook([item("3", { w: "__app_only__" }), item("2", { w: second }), item("1", { w: first })]);
    expect(result.map(x => x.w)).toEqual([first, second, "__app_only__"]);
  });
  it("accounts for all canonical source rows without mutating quiz input", () => {
    const input = vocabulary.map(x => ({ ...x, k_short: x.k, category: x.group, type: "word" as const })) as VocabItem[];
    const result = arrangeWordbook(input);
    expect(result.flatMap(x => x.displaySourceIds)).toHaveLength(input.length);
    expect(new Set(result.flatMap(x => x.displaySourceIds)).size).toBe(input.length);
    expect(vocabulary).toHaveLength(38163);
  });
});
