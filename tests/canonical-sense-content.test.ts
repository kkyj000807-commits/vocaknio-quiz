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
    expect(pending.categories.verificationPending).toHaveLength(18);
    expect(pending.categories.senseMappingFailure).toHaveLength(37_912);
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
      "gloss-over:primary",
      "take-for-granted:primary",
      "take-into-account:primary",
      "teem-with:primary",
      "work-out:primary",
      "wrap-up:primary",
    ];
    expect(report.after.canonicalSenseCount).toBe(109);
    expect(report.supersededAggregates).toHaveLength(superseded.length);
    expect(report.supersededAggregates.map((entry) => entry.senseId).sort()).toEqual([...superseded].sort());
    for (const senseId of superseded) {
      expect(content.entries.some((entry) => entry.senseId === senseId)).toBe(false);
    }
    expect(content.entries.some((entry) => entry.senseId === "abide-by:follow-governing-rule")).toBe(true);
    expect(content.entries.filter((entry) => entry.word === "work out")).toHaveLength(4);
    expect(content.entries.filter((entry) => entry.word === "take for granted")).toHaveLength(2);
    expect(content.entries.some((entry) => entry.senseId === "get-over:primary")).toBe(false);
    expect(content.entries.some((entry) => entry.senseId === "come-to-terms:primary")).toBe(false);
    expect(content.entries.filter((entry) => entry.word === "get over")).toHaveLength(2);
    expect(content.entries.filter((entry) => entry.word === "come to terms with")).toHaveLength(2);
    expect(content.entries.some((entry) => entry.senseId === "account-for:primary")).toBe(false);
    expect(content.entries.filter((entry) => entry.word === "account for")).toHaveLength(3);
    expect(content.entries.find((entry) => entry.senseId === "conducive-to:make-result-more-likely")).toMatchObject({
      definitionStatus: "COMPLETE",
      itemIds: ["JBKROW001279", "JBKROW002322", "JBKROW004080", "JBKROW018320", "JBKROW021061", "JBKROW023530"],
    });
    expect(content.entries.find((entry) => entry.senseId === "a-wide-range-of:many-different-kinds")).toMatchObject({
      definitionStatus: "COMPLETE",
      itemIds: ["JBKROW000017", "JBKROW002047"],
      synonyms: ["a broad range of", "a wide variety of", "a broad spectrum of"],
    });
    expect(content.entries.find((entry) => entry.senseId === "zoom-in-on:give-close-attention")).toMatchObject({
      definitionStatus: "COMPLETE",
      itemIds: ["JBKROW000093", "JBKROW004059"],
      synonyms: ["focus on", "concentrate on", "zero in on"],
    });
    expect(content.entries.find((entry) => entry.senseId === "gloss-over:avoid-unpleasant-detail")).toMatchObject({
      definitionStatus: "COMPLETE",
      itemIds: ["JBKROW001061", "JBKROW002838", "JBKROW005017", "JBKROW007057", "JBKROW009466", "JBKROW012192", "JBKROW018844", "JBKROW021403"],
      synonyms: ["play down", "skim over", "paper over"],
    });
  });

  it("take into account의 source ID와 고려 sense를 정본 행 하나에 연결한다", () => {
    expect(content.entries.filter(entry => entry.word === "take into account")).toHaveLength(1);
    expect(content.entries.find(entry => entry.senseId === "take-into-account:consider-factor")).toMatchObject({
      definitionStatus: "COMPLETE",
      itemIds: ["APPROW02130"],
      synonyms: ["take into consideration", "take account of", "consider", "allow for", "bear in mind"],
    });
  });

  it("교차 검증한 숙어 동의 표현이 canonical sense에 보존된다", () => {
    const expected = new Map([
      ["capitalize-on:primary", ["take advantage of", "benefit from", "profit from"]],
      ["carry-out:primary", ["perform", "execute", "implement"]],
      ["delve-into:primary", ["investigate", "look into", "explore"]],
      ["look-after:primary", ["take care of", "care for", "tend"]],
      ["put-up-with:primary", ["tolerate", "endure", "bear"]],
      ["at-stake:primary", ["at risk"]],
      ["to-boot:primary", ["in addition", "as well", "besides"]],
      ["same-token:primary", ["for the same reason"]],
      ["case-in-point:primary", ["a relevant example", "a pertinent example"]],
      ["clamp-down-on:primary", ["crack down on"]],
      ["crack-down-on:primary", ["clamp down on"]],
      ["cut-ground:primary", ["undermine"]],
      ["put-at-ease:primary", ["reassure"]],
      ["verge-of:primary", ["on the brink of", "on the point of"]],
      ["pull-rug:primary", ["withdraw support from"]],
      ["release-house-arrest:primary", ["free from house arrest"]],
      ["skin-cat:primary", ["there are several ways to achieve something"]],
      ["law-hands:primary", ["punish someone without legal authorities"]],
      ["good-money-bad:primary", ["waste more money on something already failing"]],
      ["benefit-doubt:primary", ["accept someone's account despite uncertainty"]],
      ["new-normal:primary", ["an unusual condition that has become standard"]],
      ["executive-privilege:primary", ["authority to withhold confidential executive communications"]],
      ["jury-nullification:primary", ["a jury's deliberate refusal to apply the law"]],
      ["run-into:primary", ["bump into", "run across"]],
      ["on-behalf:primary", ["as a representative of"]],
      ["get-over:recover-from-illness-or-upset", ["recover from"]],
      ["get-over:overcome-difficulty", ["overcome"]],
      ["come-to-terms:accept-unpleasant-reality", ["come to accept"]],
      ["come-to-terms:reach-agreement-with-party", ["reach an agreement"]],
      ["in-face-of:primary", ["despite", "in spite of"]],
      ["wake-of:primary", ["in the aftermath of", "following", "as a result of"]],
      ["make-for:primary", ["lead to", "contribute to"]],
      ["account-for:be-explanation-or-cause", ["explain", "be responsible for"]],
      ["account-for:give-explanation", ["explain"]],
      ["account-for:form-part-of-total", ["constitute", "make up"]],
      ["price-market:primary", ["become uncompetitive by overpricing"]],
      ["learn:02484173-v", ["revoke", "repeal", "annul", "rescind"]],
    ]);

    for (const [senseId, synonyms] of expected) {
      const entry = content.entries.find((candidate) => candidate.senseId === senseId);
      expect(entry?.definitionStatus).toBe("COMPLETE");
      expect(entry?.synonyms).toEqual(synonyms);
      expect(entry?.missingFields).toEqual([]);
    }
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
    expect(content.entries.find((entry) => entry.senseId === "run-into:primary")?.englishDefinition)
      .toBe("To meet someone unexpectedly rather than by prior arrangement.");
    expect(content.entries.find((entry) => entry.senseId === "on-behalf:primary")?.englishDefinition)
      .toBe("Acting or speaking as someone's representative or in their place.");
    expect(content.entries.filter((entry) => entry.definitionStatus === "COMPLETE")).toHaveLength(91);
  });
});
