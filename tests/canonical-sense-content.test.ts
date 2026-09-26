import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import content from "@/assets/canonical-sense-content.json";
import report from "@/assets/canonical-sense-content-report.json";
import pending from "@/assets/canonical-sense-backfill-pending.json";

const requiredFields = [
  "englishDefinition",
  "koreanMeaning",
  "contextExplanation",
  "exampleSentence",
  "exampleExplanation",
  "synonyms",
  "distinctionNote",
  "sourceIds",
] as const;

describe("canonical sense 공란 backfill", () => {
  it("완료 레코드는 필수값과 출처를 모두 가진다", () => {
    const complete = content.entries.filter((entry) => entry.definitionStatus === "COMPLETE");
    expect(complete.length).toBeGreaterThanOrEqual(17);
    for (const entry of complete) {
      for (const field of requiredFields) {
        const value = entry[field];
        expect(Array.isArray(value) ? value.length : String(value ?? "").trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("수집 실패를 VERIFIED_NO_DATA로 가장하지 않는다", () => {
    expect(report.statusCounts.VERIFIED_NO_DATA).toBe(0);
    expect(report.statusCounts.FAILED).toBe(0);
    expect(content.entries.filter((entry) => entry.definitionStatus === "NEEDS_REVIEW").every(
      (entry) => (entry.missingFields as string[]).includes("synonyms"),
    )).toBe(true);
    expect(pending.categories.verificationPending).toHaveLength(51);
    expect(pending.categories.senseMappingFailure).toHaveLength(37_933);
    expect(pending.categories.actualDataAbsence).toHaveLength(0);
  });

  it("all but 두 sense와 20개 표본의 의미 계약을 보존한다", () => {
    expect(content.entries.find((entry) => entry.senseId === "all-but:almost")?.definitionStatus).toBe("COMPLETE");
    expect(content.entries.find((entry) => entry.senseId === "all-but:all-except")?.definitionStatus).toBe("COMPLETE");
    expect(report.sampleAudit).toHaveLength(20);
    expect(report.sampleAudit.every((sample) => sample.sameSenseContract)).toBe(true);
  });

  it("검수 sense로 대체된 aggregate primary를 canonical sense로 중복 집계하지 않는다", () => {
    const superseded = [
      "abide-by:primary",
      "cart-horse:primary",
      "take-for-granted:primary",
      "teem-with:primary",
      "work-out:primary",
      "wrap-up:primary",
    ];
    expect(report.after.canonicalSenseCount).toBe(97);
    expect(report.supersededAggregates).toHaveLength(superseded.length);
    expect(report.supersededAggregates.map((entry) => entry.senseId).sort()).toEqual([...superseded].sort());
    for (const senseId of superseded) {
      expect(content.entries.some((entry) => entry.senseId === senseId)).toBe(false);
    }
    expect(content.entries.some((entry) => entry.senseId === "abide-by:follow-governing-rule")).toBe(true);
    expect(content.entries.filter((entry) => entry.word === "work out")).toHaveLength(4);
    expect(content.entries.filter((entry) => entry.word === "take for granted")).toHaveLength(2);
  });

  it("앱 자산과 배포 데이터가 동일하다", () => {
    const deployed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/data/canonical-sense-content.json"), "utf8"));
    expect(deployed).toEqual(content);
  });

  it("영영 정의는 원문 허가 출처와 자체 편집 풀이를 구별한다", () => {
    for (const entry of content.entries) {
      expect(entry.definitionProvenance).toBeTruthy();
      expect(["verbatim-licensed", "editorial"]).toContain(entry.definitionProvenance?.kind);
    }

    const licensed = content.entries.filter((entry) => entry.definitionProvenance?.kind === "verbatim-licensed");
    expect(licensed.length).toBeGreaterThan(0);
    for (const entry of licensed) {
      expect(entry.definitionProvenance?.source).toBe("Open English WordNet");
      expect(entry.definitionProvenance?.license).toBe("CC BY 4.0");
      expect(entry.definitionProvenance?.edition).toBe("2025");
      expect(entry.definitionProvenance?.attribution).toBe("Princeton WordNet; Open English WordNet Team");
      expect(entry.definitionProvenance?.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(content.entries.filter((entry) => entry.definitionStatus === "COMPLETE")).toHaveLength(46);
  });
});
