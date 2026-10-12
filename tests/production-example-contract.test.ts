import { describe, expect, it } from "vitest";
import { activeRecallSenseSchema, ACTIVE_RECALL_SENSES } from "@/lib/active-recall";

describe("production 예문 계약", () => {
  const source = ACTIVE_RECALL_SENSES.find(entry => entry.status === "production")!;
  it.each(["en", "ko", "cueKo"] as const)("%s 누락 또는 공백을 출고하지 않는다", field => {
    for (const value of [undefined, "   "]) {
      const entry = structuredClone(source);
      entry.exampleSentences[0] = { ...entry.exampleSentences[0], [field]: value };
      expect(activeRecallSenseSchema.safeParse(entry).success).toBe(false);
    }
  });
  it("검수 후보를 완성된 콘텐츠로 강제하지 않는다", () => {
    const entry = structuredClone(source);
    entry.status = "candidate";
    delete entry.exampleSentences[0].ko;
    delete entry.exampleSentences[0].cueKo;
    expect(activeRecallSenseSchema.safeParse(entry).success).toBe(true);
  });
  it("현재 검수 완료 콘텐츠는 전부 계약을 충족한다", () => {
    expect(ACTIVE_RECALL_SENSES.every(entry => activeRecallSenseSchema.safeParse(entry).success)).toBe(true);
  });
});
