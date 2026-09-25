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
    expect(pending.categories.verificationPending).toHaveLength(84);
    expect(pending.categories.senseMappingFailure).toHaveLength(37_933);
    expect(pending.categories.actualDataAbsence).toHaveLength(0);
  });

  it("all but 두 sense와 20개 표본의 의미 계약을 보존한다", () => {
    expect(content.entries.find((entry) => entry.senseId === "all-but:almost")?.definitionStatus).toBe("COMPLETE");
    expect(content.entries.find((entry) => entry.senseId === "all-but:all-except")?.definitionStatus).toBe("COMPLETE");
    expect(report.sampleAudit).toHaveLength(20);
    expect(report.sampleAudit.every((sample) => sample.sameSenseContract)).toBe(true);
  });

  it("앱 자산과 배포 데이터가 동일하다", () => {
    const deployed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/data/canonical-sense-content.json"), "utf8"));
    expect(deployed).toEqual(content);
  });
});
