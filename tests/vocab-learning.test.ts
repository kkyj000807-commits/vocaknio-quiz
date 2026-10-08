import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import learningIndex from "@/assets/vocab-learning-index-v1.4.json";
import corrections from "@/data/idiom-corrections.json";
import release from "@/release.config.json";
import oewnManifest from "@/data/vocab-learning/oewn-2025-definition-manifest.json";
import { VOCAB } from "@/lib/vocab";
import { getActiveRecallSenses } from "@/lib/active-recall";
import { hasLearningEntry, LEARNING_COVERAGE } from "@/lib/vocab-learning";

describe("깊이 학습 인덱스", () => {
  it("기존 검수 해설과 모든 숙어 보완을 학습 인덱스에 연결한다", () => {
    expect(LEARNING_COVERAGE.senses).toBe(40 + corrections.entries.reduce(
      (sum, entry) => sum + entry.targets.length * ((entry as { senses?: unknown[] }).senses?.length ?? 1),
      0,
    ));
    expect(LEARNING_COVERAGE.rows).toBe(Object.keys(learningIndex.items).length);
    expect(LEARNING_COVERAGE.rows).toBeGreaterThanOrEqual(40);
  });

  it("verified idiom synonyms survive the source-to-public pipeline", async () => {
    const readEntries = (itemId: string) => {
      const pointer = learningIndex.items[itemId as keyof typeof learningIndex.items];
      const payload = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), "public", "data", "vocab-learning", release.version, `${pointer.group.toLowerCase()}.json`),
        "utf8",
      )) as { entries: { senseId: string; itemIds: string[]; exactSynonyms?: string[]; nearSynonyms?: string[] }[] };
      return payload.entries.filter((entry) => entry.itemIds.includes(itemId));
    };
    const byNoMeans = readEntries("JBKROW014279");
    const inSpite = readEntries("JBKROW004704");
    const lookAfter = readEntries("JBKROW013820");
    const putUpWith = readEntries("JBKROW013824");
    const atStake = readEntries("JBKROW000327");
    const toBoot = readEntries("JBKROW000075");
    const sameToken = readEntries("JBKROW000132");
    const caseInPoint = readEntries("JBKROW000819");
    const clampDownOn = readEntries("JBKROW000039");
    const crackDownOn = readEntries("JBKROW000048");
    const cutGround = readEntries("JBKROW022770");
    const putAtEase = readEntries("JBKROW000069");
    const vergeOf = readEntries("JBKROW013940");
    const pullRug = readEntries("JBKROW022968");
    const releaseHouseArrest = readEntries("JBKROW022992");
    const skinCat = readEntries("JBKROW023090");
    const lawHands = readEntries("JBKROW023078");
    const goodMoneyBad = readEntries("JBKROW023091");
    const benefitDoubt = readEntries("JBKROW022820");
    const newNormal = readEntries("JBKROW023335");
    const executivePrivilege = readEntries("JBKROW023245");
    const juryNullification = readEntries("JBKROW023302");
    const runInto = readEntries("APPROW01880");
    const onBehalf = readEntries("JBKROW014517");
    const getOver = readEntries("APPROW01008");
    const comeToTerms = readEntries("JBKROW018274");
    const inFaceOf = readEntries("JBKROW000555");
    const wakeOf = readEntries("JBKROW013919");
    const makeFor = readEntries("JBKROW001578");
    const accountFor = readEntries("JBKROW004694");
    const priceOut = readEntries("JBKROW023367");
    const abrogate = readEntries("JBKROW004299");

    expect(byNoMeans[0]?.exactSynonyms).toEqual(["in no way", "not at all"]);
    expect(inSpite[0]?.exactSynonyms).toEqual(["despite"]);
    expect(lookAfter[0]?.exactSynonyms).toEqual(["take care of"]);
    expect(lookAfter[0]?.nearSynonyms).toEqual(["care for", "tend"]);
    expect(putUpWith[0]?.exactSynonyms).toEqual(["tolerate"]);
    expect(putUpWith[0]?.nearSynonyms).toEqual(["endure", "bear"]);
    expect(atStake[0]?.exactSynonyms).toEqual([]);
    expect(atStake[0]?.nearSynonyms).toEqual(["at risk"]);
    expect(toBoot[0]?.exactSynonyms).toEqual(["in addition", "as well", "besides"]);
    expect(toBoot[0]?.nearSynonyms).toEqual([]);
    expect(sameToken[0]?.exactSynonyms).toEqual(["for the same reason"]);
    expect(sameToken[0]?.nearSynonyms).toEqual([]);
    expect(caseInPoint[0]?.exactSynonyms).toEqual(["a relevant example", "a pertinent example"]);
    expect(caseInPoint[0]?.nearSynonyms).toEqual([]);
    expect(clampDownOn[0]?.exactSynonyms).toEqual(["crack down on"]);
    expect(clampDownOn[0]?.nearSynonyms).toEqual([]);
    expect(crackDownOn[0]?.exactSynonyms).toEqual(["clamp down on"]);
    expect(crackDownOn[0]?.nearSynonyms).toEqual([]);
    expect(cutGround[0]?.exactSynonyms).toEqual([]);
    expect(cutGround[0]?.nearSynonyms).toEqual(["undermine"]);
    expect(putAtEase[0]?.exactSynonyms).toEqual([]);
    expect(putAtEase[0]?.nearSynonyms).toEqual(["reassure"]);
    expect(vergeOf[0]?.exactSynonyms).toEqual(["on the brink of", "on the point of"]);
    expect(vergeOf[0]?.nearSynonyms).toEqual([]);
    expect(pullRug[0]?.exactSynonyms).toEqual([]);
    expect(pullRug[0]?.nearSynonyms).toEqual(["withdraw support from"]);
    expect(releaseHouseArrest[0]?.exactSynonyms).toEqual(["free from house arrest"]);
    expect(releaseHouseArrest[0]?.nearSynonyms).toEqual([]);
    expect(skinCat[0]?.exactSynonyms).toEqual(["there are several ways to achieve something"]);
    expect(skinCat[0]?.nearSynonyms).toEqual([]);
    expect(lawHands[0]?.exactSynonyms).toEqual(["punish someone without legal authorities"]);
    expect(lawHands[0]?.nearSynonyms).toEqual([]);
    expect(goodMoneyBad[0]?.exactSynonyms).toEqual(["waste more money on something already failing"]);
    expect(goodMoneyBad[0]?.nearSynonyms).toEqual([]);
    expect(benefitDoubt[0]?.exactSynonyms).toEqual(["accept someone's account despite uncertainty"]);
    expect(benefitDoubt[0]?.nearSynonyms).toEqual([]);
    expect(newNormal[0]?.exactSynonyms).toEqual(["an unusual condition that has become standard"]);
    expect(newNormal[0]?.nearSynonyms).toEqual([]);
    expect(executivePrivilege[0]?.exactSynonyms).toEqual(["authority to withhold confidential executive communications"]);
    expect(executivePrivilege[0]?.nearSynonyms).toEqual([]);
    expect(juryNullification[0]?.exactSynonyms).toEqual(["a jury's deliberate refusal to apply the law"]);
    expect(juryNullification[0]?.nearSynonyms).toEqual([]);
    expect(runInto[0]?.exactSynonyms).toEqual(["bump into", "run across"]);
    expect(runInto[0]?.nearSynonyms).toEqual([]);
    expect(onBehalf[0]?.exactSynonyms).toEqual(["as a representative of"]);
    expect(onBehalf[0]?.nearSynonyms).toEqual([]);
    expect(getOver.find((entry) => entry.senseId === "get-over:recover-from-illness-or-upset")?.exactSynonyms)
      .toEqual(["recover from"]);
    expect(getOver.find((entry) => entry.senseId === "get-over:overcome-difficulty")?.exactSynonyms)
      .toEqual(["overcome"]);
    expect(comeToTerms.find((entry) => entry.senseId === "come-to-terms:accept-unpleasant-reality")?.exactSynonyms)
      .toEqual(["come to accept"]);
    expect(comeToTerms.find((entry) => entry.senseId === "come-to-terms:reach-agreement-with-party")?.exactSynonyms)
      .toEqual(["reach an agreement"]);
    expect(inFaceOf[0]?.exactSynonyms).toEqual(["despite", "in spite of"]);
    expect(wakeOf[0]?.exactSynonyms).toEqual(["in the aftermath of"]);
    expect(wakeOf[0]?.nearSynonyms).toEqual(["following", "as a result of"]);
    expect(makeFor[0]?.exactSynonyms).toEqual(["lead to"]);
    expect(makeFor[0]?.nearSynonyms).toEqual(["contribute to"]);
    expect(accountFor.find((entry) => entry.senseId === "account-for:be-explanation-or-cause")?.exactSynonyms)
      .toEqual(["explain"]);
    expect(accountFor.find((entry) => entry.senseId === "account-for:give-explanation")?.exactSynonyms)
      .toEqual(["explain"]);
    expect(accountFor.find((entry) => entry.senseId === "account-for:form-part-of-total")?.exactSynonyms)
      .toEqual(["constitute", "make up"]);
    expect(priceOut[0]?.exactSynonyms).toEqual(["become uncompetitive by overpricing"]);
    expect(abrogate[0]?.exactSynonyms).toEqual([]);
    expect(abrogate[0]?.nearSynonyms).toEqual(["revoke", "repeal", "annul", "rescind"]);
  });

  it("teem with 두 행은 같은 active 해설을 재사용하고 기존 공개 호환 데이터는 유지한다", () => {
    const [source] = getActiveRecallSenses("JBKROW000005");
    expect(getActiveRecallSenses("JBKROW003863")[0]).toBe(source);
    expect(Object.keys(source.relationMeaningsKo!)).toHaveLength(6);
    const payload = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "vocab-learning", release.version, "v101.json"), "utf8"));
    for (const id of source.itemIds) {
      const pointer = learningIndex.items[id as keyof typeof learningIndex.items];
      expect(pointer).toEqual({ group: "V101", entryIds: [`learn:correction:${id}`] });
      const matches = payload.entries.filter((entry: { id: string }) => pointer.entryIds.includes(entry.id));
      expect(matches).toHaveLength(1);
      expect(matches[0].itemIds).toEqual([id]);
      expect(matches[0].senseId).toBe("teem-with:primary");
      expect(matches[0].definitionEn).toBe("To contain very many people, animals, or other things, often giving an impression of active abundance.");
      expect(matches[0].example.en).toBe("The shallow pools were teeming with tiny fish.");
    }
  });

  it("wrap up 두 출현 행은 한 active 해설을 공유하고 기존 호환 학습 자료를 그대로 유지한다", () => {
    const [source] = getActiveRecallSenses("JBKROW000016");
    expect(getActiveRecallSenses("JBKROW004042")[0]).toBe(source);
    expect(Object.keys(source.relationMeaningsKo!)).toHaveLength(6);
    const payload = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "vocab-learning", release.version, "v101.json"), "utf8"));
    for (const id of source.itemIds) {
      const pointer = learningIndex.items[id as keyof typeof learningIndex.items];
      expect(pointer).toEqual({ group: "V101", entryIds: [`learn:correction:${id}`] });
      const matches = payload.entries.filter((entry: { id: string }) => pointer.entryIds.includes(entry.id));
      expect(matches).toHaveLength(1);
      expect(matches[0].itemIds).toEqual([id]);
      expect(matches[0].senseId).toBe("wrap-up:primary");
      expect(matches[0].definitionEn).toBe("To bring an activity, discussion, or arrangement to a satisfactory close.");
      expect(matches[0].example.en).toBe("Let's wrap up the meeting by agreeing on one next step.");
    }
  });

  it("부록 take for granted의 두 active 뜻을 유지하고 한 기존 호환 해설만 재사용한다", () => {
    const senses = getActiveRecallSenses("APPROW02128");
    expect(senses).toHaveLength(2);
    expect(senses[0].senseId).toBe("take-for-granted:assume-without-checking");
    expect(Object.keys(senses[0].relationMeaningsKo!)).toHaveLength(5);
    expect(senses[1].senseId).toBe("take-for-granted:fail-to-appreciate");
    expect(Object.keys(senses[1].relationMeaningsKo!)).toHaveLength(5);
    const pointer = learningIndex.items.APPROW02128;
    expect(pointer).toEqual({ group: "APPENDIX", entryIds: ["learn:correction:APPROW02128"] });
    const payload = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "vocab-learning", release.version, "appendix.json"), "utf8"));
    const matches = payload.entries.filter((entry: { id: string }) => pointer.entryIds.includes(entry.id));
    expect(matches).toHaveLength(1);
    expect(matches[0].itemIds).toEqual(["APPROW02128"]);
    expect(matches[0].senseId).toBe("take-for-granted:primary");
    expect(matches[0].definitionEn).toBe("To assume something is true or available without checking, or to overlook the value of someone or something because it seems reliably present.");
    expect(matches[0].example.en).toBe("I had taken her help for granted until I had to do the work alone.");
  });

  it("가치 간과 관계어 보강은 공유 sense 하나에만 붙고 부록 정본·기존 예문을 재사용한다", () => {
    const linkedRows = VOCAB.filter(item => item.w === "take for granted");
    expect(linkedRows.map(item => [item.id, item.num, item.group])).toEqual([["APPROW02128", 37941, "APPENDIX"]]);
    const [assumption, appreciation] = getActiveRecallSenses(linkedRows[0].id);
    expect(assumption.relationMeaningsKo).not.toHaveProperty("appreciate");
    expect(appreciation.relationMeaningsKo).not.toHaveProperty("verify");
    expect(appreciation.exactSynonyms).toEqual([]);
    expect(appreciation.nearSynonyms).toEqual(["fail to appreciate", "undervalue familiar support"]);
    expect(appreciation.exampleSentences).toHaveLength(1);
    expect(appreciation.exampleSentences[0].type).toBe("editorial");
    expect(appreciation.exampleSentences[0].cueKo).toContain("서비스가 멈춘 뒤");
    expect(VOCAB).toHaveLength(38163);
  });

  it("work out4출현은 같은 보강을 공유하고 기존 호환 해설·수치·성과·운동 의미를 보존한다", () => {
    const rows = VOCAB.filter(item => item.w === "work out");
    expect(rows.map(item => [item.id, item.num, item.group])).toEqual([
      ["JBKROW000044", 42, "V101"], ["JBKROW004038", 3973, "V101"],
      ["JBKROW006121", 6012, "V201"], ["JBKROW008146", 8012, "V201"],
    ]);
    const first = getActiveRecallSenses(rows[0].id);
    for (const row of rows) {
      const active = getActiveRecallSenses(row.id);
      expect(active).toHaveLength(4);
      expect(active[0]).toBe(first[0]);
      expect(Object.keys(active[0].relationMeaningsKo!)).toHaveLength(3);
      expect(active.slice(1).every(sense => !sense.relationMeaningsKo)).toBe(true);
      const pointer = learningIndex.items[row.id as keyof typeof learningIndex.items];
      const payload = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "vocab-learning", release.version, `${pointer.group.toLowerCase()}.json`), "utf8"));
      const matches = payload.entries.filter((entry: { id: string }) => pointer.entryIds.includes(entry.id));
      expect(matches).toHaveLength(pointer.entryIds.length);
      expect(matches.every((entry: { itemIds: string[] }) => entry.itemIds.includes(row.id))).toBe(true);
      expect(matches.some((entry: { senseId: string }) => entry.senseId === "work-out:solve-problem")).toBe(false);
    }
    expect(first[0].exampleSentences[0].type).toBe("editorial");
    expect(first[0].exampleSentences[0].cueKo).toContain("why");
    expect(VOCAB).toHaveLength(38163);
  });

  it("Open English WordNet의 같은 synset 동의어만 공개 데이터에 전달한다", () => {
    const publicEntries = ["v101", "v201", "v301", "v401", "v501", "v502", "v601", "appendix"]
      .flatMap((group) => (JSON.parse(fs.readFileSync(
        path.join(process.cwd(), "public", "data", "vocab-learning", release.version, `${group}.json`),
        "utf8",
      )) as { entries: { senseId: string; headword: string; definitionKind?: string; exactSynonyms?: string[] }[] }).entries);
    const licensed = publicEntries.filter((entry) => entry.definitionKind === "verbatim-licensed");

    expect(licensed).toHaveLength(40);
    for (const entry of licensed) {
      const source = oewnManifest.definitions[entry.senseId as keyof typeof oewnManifest.definitions];
      const expected = source.members.filter((member) => member.toLowerCase() !== entry.headword.toLowerCase());
      expect(entry.exactSynonyms).toEqual(expected);
    }
    expect(licensed.filter((entry) => entry.exactSynonyms?.length)).toHaveLength(27);
  });

  it("쪽수로 남아 있던 숙어에 실제 해설이 연결된다", () => {
    expect(hasLearningEntry("JBKROW022984")).toBe(true);
    expect(learningIndex.version).toBe(release.version);
  });

  it("모든 숙어 보완에 실제 뜻, 한영 해설, 예문과 독립 근거가 있다", () => {
    const byId = new Map(VOCAB.map((item) => [item.id, item]));
    for (const entry of corrections.entries) {
      for (const value of [entry.meaningKo, entry.definitionEn, entry.definitionKo, entry.memoryKo, entry.usageKo, entry.examTrapKo, entry.example.en, entry.example.ko]) {
        expect(value.trim().length).toBeGreaterThan(3);
        expect(value).not.toMatch(/^p\s*\.?\s*\d+$/i);
      }
      expect(new Set(entry.sources.map((source) => source.independenceGroup)).size).toBeGreaterThanOrEqual(2);
      for (const target of entry.targets) {
        expect(byId.get(target.id)).toMatchObject({ w: target.headword, k: entry.meaningKo });
        expect(hasLearningEntry(target.id)).toBe(true);
      }
    }
  });

  it("존재하는 항목만 동기적으로 노출한다", () => {
    const firstItemId = Object.keys(learningIndex.items)[0];
    expect(hasLearningEntry(firstItemId)).toBe(true);
    expect(hasLearningEntry("missing-item")).toBe(false);
  });

  it("비슷한 숙어를 임의로 다른 정답으로 나누지 않고 다의어의 문맥을 보존한다", () => {
    const byKey = new Map(corrections.entries.map((entry) => [entry.key, entry]));
    expect(byKey.get("clamp-down-on")?.meaningKo).toBe(byKey.get("crack-down-on")?.meaningKo);
    expect(byKey.get("in-face-of")?.meaningKo).toBe("A라는 곤란·반대에도 불구하고");
    expect(byKey.get("work-out")?.targets).toHaveLength(4);
    expect(byKey.get("work-out")?.meaningKo).toContain("운동하다");
    expect(byKey.get("work-out")?.meaningKo).toContain("계산하다");
  });

  it("all but의 거의/예외 sense를 같은 항목 안에서 분리한다", () => {
    const entryIds = learningIndex.items.JBKROW000287.entryIds;
    expect(entryIds).toContain("learn:correction:JBKROW000287:almost");
    expect(entryIds).toContain("learn:correction:JBKROW000287:all-except");
  });
});
