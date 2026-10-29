import { describe, expect, it } from "vitest";
import vocabulary from "../assets/vocab-v1.4.json";
import headings from "../assets/wordbook-concepts.json";
import { formatWordbookConcept, getWordbookConcept } from "../lib/wordbook-concepts";
import fs from "node:fs";
import crypto from "node:crypto";

describe("original 301/502 occurrence headings", () => {
  it("covers each target occurrence without changing original IDs or meanings", () => {
    const items = vocabulary.filter(x => ["V301", "V502"].includes(x.group));
    const held = items.filter(item => !getWordbookConcept(item));
    expect(held.map(x => x.id)).toEqual(headings.unresolvedIds);
    expect(held.map(x => x.id)).toContain("JBKROW009466");
    expect(held.map(x => x.id)).toContain("JBKROW012192");
    expect(Object.keys(headings.entries)).toHaveLength(items.length - held.length);
    expect(crypto.createHash("sha256").update(fs.readFileSync("assets/vocab-v1.4.json")).digest("hex"))
      .toBe(headings.canonicalSha256);
  });
  it("does not borrow the angry sense for bristle meaning full", () => {
    const item = vocabulary.find(x => x.group === "V502" && x.w === "bristle" && x.k === "꽉 차 있다")!;
    expect(formatWordbookConcept(item)).toContain("가득하다");
    expect(formatWordbookConcept(item)).not.toContain("불만");
  });
  it("preserves original 301 major and detailed grouping", () => {
    const item = vocabulary.find(x => x.group === "V301" && x.w === "attract")!;
    expect(formatWordbookConcept(item)).toBe("원문 개념: 01. 유쾌/불쾌 → 매혹시키다");
  });
  it("fails closed for drift and unrelated sections", () => {
    const item = vocabulary.find(x => x.group === "V301")!;
    expect(getWordbookConcept({ ...item, k: "다른 뜻" })).toBeNull();
    expect(getWordbookConcept({ ...item, group: "V101" })).toBeNull();
  });
  it("keeps semantic heading inside meaning-hidden branch only", () => {
    const text = fs.readFileSync("app/(tabs)/wordbook.tsx", "utf8");
    expect(text.indexOf("{formatWordbookConcept(item)}")).toBeGreaterThan(text.indexOf("{item.k_short}"));
    expect(text.indexOf("{formatWordbookConcept(item)}")).toBeLessThan(text.indexOf("<View style={s.metadataRow}>"));
  });
});
