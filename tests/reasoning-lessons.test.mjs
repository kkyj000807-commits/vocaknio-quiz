import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateReasoningLessons } from "../scripts/lib/reasoning-lessons.mjs";

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const bank = read("data/reasoning-lessons.json");
const release = read("release.config.json");
const index = read("assets/vocab-learning-index-v1.4.json");
const entries = [...new Set(Object.values(index.items).map((p) => p.group))].flatMap((group) => read(`public/data/vocab-learning/${release.version}/${group.toLowerCase()}.json`).entries);
const clone = () => structuredClone(bank);

describe("문맥 출제 계약", () => {
  it("구성 요소 해설 14개를 모든 대상 행의 실제 배포 JSON에 연결한다", () => {
    const compositions = read("data/expression-composition.json");
    const corrections = read("data/idiom-corrections.json");
    expect(compositions.entries).toHaveLength(14);
    for (const composition of compositions.entries) {
      const correction = corrections.entries.find((e) => e.key === composition.key);
      expect(correction?.targets.length).toBeGreaterThan(0);
      for (const target of correction.targets) {
        const published = entries.find((e) => e.id === `learn:correction:${target.id}`);
        expect(published?.composition).toEqual({ ...composition, checkedAtKst: compositions.checkedAtKst, policy: compositions.policy });
        expect(index.items[target.id]?.entryIds).toContain(published.id);
      }
    }
  });
  it("숙어 6개/13개 고유 문맥과 모든 반복 목록을 실제 배포 데이터에 연결한다", () => {
    expect(validateReasoningLessons(bank, entries)).toBe(bank);
    expect(bank.lessons).toHaveLength(6);
    expect(bank.lessons.flatMap((l) => l.questions)).toHaveLength(13);
    const mapped = entries.filter((e) => e.reasoning);
    expect(mapped).toHaveLength(17);
    for (const lesson of bank.lessons) {
      for (const entryId of lesson.entryIds) expect(mapped.find((e) => e.id === entryId)?.reasoning.questions).toEqual(lesson.questions);
    }
  });
  it("의미핵 실제 데이터·대조 예문·새 문항을 두 목록 행 모두에 연결한다", () => {
    const lesson = bank.lessons.find((l) => l.id === "all-but");
    expect(lesson.coreMeaning.kind).toBe("conceptual");
    expect(lesson.coreMeaning.extensions).toHaveLength(2);
    expect(lesson.coreMeaning.limitsKo).toContain("반드시 적은 것은 아니다");
    expect(lesson.questions.find(q => q.id === "allbut-core-transfer-1")?.correctChoiceId).toBe("b");
    for (const id of lesson.entryIds) {
      expect(entries.find(e => e.id === id)?.reasoning.coreMeaning).toEqual(lesson.coreMeaning);
    }
  });
  it("누락된 의미 경로·같은 편집 출처·근거 없는 어원 승격을 막는다", () => {
    const a = clone(); a.lessons.find(l => l.id === "all-but").coreMeaning.extensions[0].stepsKo = [];
    expect(() => validateReasoningLessons(a, entries)).toThrow(/meaning path/);
    const b = clone(); const core = b.lessons.find(l => l.id === "all-but").coreMeaning;
    core.sources[1].independenceGroup = core.sources[0].independenceGroup;
    expect(() => validateReasoningLessons(b, entries)).toThrow(/independent sources/);
    const c = clone(); c.lessons.find(l => l.id === "all-but").coreMeaning.kind = "historical";
    expect(() => validateReasoningLessons(c, entries)).toThrow(/historical evidence/);
  });
  it("정답을 두 개로 표시하거나 정답 ID를 바꾸면 출판을 막는다", () => {
    const a = clone(); a.lessons[0].questions[0].choices[0].errorType = "supported";
    expect(() => validateReasoningLessons(a, entries)).toThrow(/answer mismatch/);
    const b = clone(); b.lessons[0].questions[0].correctChoiceId = "missing";
    expect(() => validateReasoningLessons(b, entries)).toThrow(/answer mismatch/);
  });
  it("없는 근거·다른 표제어 연결·중복 선택지를 거부한다", () => {
    const a = clone(); a.lessons[0].questions[0].evidence = ["invented evidence"];
    expect(() => validateReasoningLessons(a, entries)).toThrow(/evidence/);
    const b = clone(); b.lessons[0].entryIds = ["unknown"];
    expect(() => validateReasoningLessons(b, entries)).toThrow(/entry/);
    const c = clone(); c.lessons[0].questions[0].choices[1].text = c.lessons[0].questions[0].choices[0].text;
    expect(() => validateReasoningLessons(c, entries)).toThrow(/duplicate choice/);
  });
  it("오답 이유나 의미 이웃의 교체 조건이 없으면 거부한다", () => {
    const a = clone(); a.lessons[0].questions[0].choices[0].explanationKo = "";
    expect(() => validateReasoningLessons(a, entries)).toThrow(/explanationKo/);
    const b = clone(); b.lessons[0].neighbors[0].noteKo = "";
    expect(() => validateReasoningLessons(b, entries)).toThrow(/neighbor constraint/);
  });
  it("학습 이미지를 검증된 역사적 어원으로 바꿔 표시하지 못한다", () => {
    const a = clone(); a.lessons[0].originStatus = "documented";
    expect(() => validateReasoningLessons(a, entries)).toThrow(/origin evidence/);
  });
  it("대표 반례의 정답 계약을 유지한다: 불확실≠불가능, 이후≠인과, 거의≠전부", () => {
    const questions = bank.lessons.flatMap((l) => l.questions);
    const answer = (id) => { const q = questions.find((q) => q.id === id); return q.choices.find((c) => c.id === q.correctChoiceId).text; };
    expect(answer("nomeans-certain-1")).toBe("Success remains possible, but is not assured.");
    expect(answer("wake-reform-1")).toBe("Employment rose after the reform; causation is unresolved.");
    expect(answer("allbut-members-1")).toBe("Ten members.");
    expect(answer("allbut-project-1")).toBe("Nearly all of the restoration has been completed.");
  });
});
