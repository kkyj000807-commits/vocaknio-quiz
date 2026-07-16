/**
 * 기출 문항 무결성 회귀 테스트.
 *
 * 사용자 필수 요구:
 *  - 정답 제출 전 한국어 번역/해설/예문이 노출되면 안 된다 (question은 영어 원문만).
 *  - 빈칸 유형인데 빈칸 표시가 없는 문항은 출제되면 안 된다.
 *  - 차단(blocked) 문항은 출제 풀에서 제외돼야 한다.
 *  - 정답 인덱스는 항상 유효 범위 안에 있어야 한다.
 *  - 출처 없는 문장을 '기출 원문(verified)'으로 표시하면 안 된다.
 */
import { describe, it, expect } from "vitest";

import { examQuestions, sectionOf } from "@/lib/exam-questions";
import { provenanceOf } from "@/lib/exam-stats";

// 실제 출제되는 문항 = 차단되지 않은 문항
const served = examQuestions.filter((q) => provenanceOf(q.id) !== "blocked");

describe("기출 문항 무결성", () => {
  // 정상 지시문(번역이 아님) — 문항 앞/뒤에 붙는 한국어 발문
  const INSTRUCTION = /(밑줄 친|빈칸에 들어갈|어법상|윗글의|다음 글|문맥상|가장 (가까운|적절한|알맞은)|일치(하지 않)?는|낱말의 쓰임|것은\?)/;

  it("출제 문항의 question(영어 원문)에 한국어 '번역'이 섞여 있으면 안 된다", () => {
    // 지시문 문장을 제거한 뒤에도 한국어(=본문 번역)가 남으면 유출로 판정.
    const leaked = served.filter((q) => {
      const stripped = q.question
        .split(/(?<=[.?!])\s+|\n/)
        .filter((seg) => !INSTRUCTION.test(seg))
        .join(" ");
      return /[가-힣]/.test(stripped);
    });
    expect(leaked.map((q) => q.id)).toEqual([]);
  });

  it("빈칸 유형인데 빈칸 표시가 없는 문항은 출제되면 안 된다", () => {
    const bad = served.filter((q) => {
      const isBlank = q.type.includes("blank") || q.type.includes("logic");
      if (!isBlank) return false;
      // 독해빈칸은 지문(passage)에 빈칸이 있을 수 있으므로 지문 포함해 검사
      const hay = `${q.question} ${q.passage ?? ""}`;
      return !/_{2,}|\(\s*\)|（\s*）|\bblank\b|빈칸/i.test(hay);
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("모든 문항의 정답 인덱스가 선택지 범위 안에 있어야 한다", () => {
    const bad = examQuestions.filter(
      (q) => q.answer < 0 || q.answer >= q.choices.length
    );
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("정답 확인 후 해석은 translationKo 또는 해설 라벨로만 제공되어야 한다 (question 필드에는 없음)", () => {
    // question에 '해석:' 같은 해설 라벨이 들어가면 사전 노출이므로 금지
    const bad = served.filter((q) => /해석\s*[:：]|해설\s*[:：]/.test(q.question));
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("evidence.needsSourceCheck 문항은 verified가 아니어야 한다 (원문 미확보를 기출로 표기 금지)", () => {
    const bad = examQuestions.filter(
      (q) => q.evidence?.needsSourceCheck && provenanceOf(q.id) === "verified"
    );
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("near-synonym·contextual-equivalent 정답은 원문 또는 원문확인필요 표시가 있어야 한다", () => {
    const bad = served.filter((q) => {
      const rel = q.evidence?.relation;
      if (rel !== "near-synonym" && rel !== "contextual-equivalent") return false;
      // 원문(originalSentenceEn)이 있거나, 원문 확인 필요 플래그가 있어야 함
      return !q.evidence?.originalSentenceEn && !q.evidence?.needsSourceCheck;
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("출제 문항 수가 0이 아니어야 한다 (차단이 전량을 삼키지 않았는지)", () => {
    expect(served.length).toBeGreaterThan(50);
  });

  it("정답 번호는 항상 실제 선지 텍스트와 연결되어야 한다 (해설의 정답 단어 = choices[answer])", () => {
    // 구조화 해설('정답: ① word(뜻)')이 있는 문항: 해설이 지목한 단어가 실제 정답 선지와 일치해야 함
    const bad = served.filter((q) => {
      const m = q.explanation.match(/(?:^|\n)정답\s*[:：]\s*[①②③④⑤]?\s*([A-Za-z][A-Za-z '-]*)/);
      if (!m) return false; // 구조화 해설 없으면 검사 대상 아님
      const claimed = m[1].trim().toLowerCase();
      // 선지에 번호 기호(① 등)가 붙은 경우 제거 후 비교
      const actual = (q.choices[q.answer]?.text ?? "")
        .replace(/^[①②③④⑤]\s*/, "")
        .toLowerCase();
      return !actual.startsWith(claimed) && !claimed.startsWith(actual);
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("모든 출제 문항이 5개 섹션 중 하나로 분류되어야 한다", () => {
    const valid = ["vocabulary", "sentence_completion", "reading", "grammar", "discourse"];
    const bad = served.filter((q) => !valid.includes(sectionOf(q)));
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("모든 선지는 text 필드를 가진 객체다 (정답 번호-선지 텍스트 연결 보장)", () => {
    for (const q of examQuestions) {
      for (const c of q.choices) {
        expect(typeof c.text).toBe("string");
        expect(c.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("정답 제출 후 공개용 선지 뜻은 데이터에 존재하거나 undefined(검수 필요 표시)여야 하며 빈 문자열 금지", () => {
    const bad = served.filter((q) =>
      q.choices.some((c) => c.koreanGloss !== undefined && c.koreanGloss.trim() === "")
    );
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("골드 verified 문항은 references가 1건 이상이어야 한다 (무근거 verified 금지)", () => {
    const bad = examQuestions.filter((q) => {
      if (q.verification?.status !== "verified") return false;
      const refs = (q.choiceAnalysis ?? []).reduce(
        (n, c) => n + (c.references?.length ?? 0), 0
      );
      return refs === 0;
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });
});
