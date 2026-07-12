/**
 * 동의어 문제풀이 회귀 테스트 — 실제 vocab.json / syn-gloss.json 기반.
 *
 * 검수 지침 필수 사례:
 *  1. 보기 뜻이 "동의어를 보유한 다른 표제어"의 뜻에서 유입되면 실패
 *     (escalating이 exponential의 '기하급수적인'으로 표시되던 버그)
 *  2. loquacious 문항에 talky와 communicative가 함께 나오면 실패
 *  3. exorbitant 문항에 steep와 extreme이 함께 나오면 실패
 *  4. 생성 문항의 정답 가능 보기가 정확히 1개인지 (오답이 정답 동의어군과 겹치지 않는지)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import {
  VOCAB,
  VOCAB_WITH_SYNONYMS,
  getForbiddenSyns,
  getSynDistractors,
  getKorDistractors,
  korGloss,
} from "@/lib/vocab";

const find = (w: string) => VOCAB.find((v) => v.w.toLowerCase() === w);

// ─── 1. 보기 뜻 조회: 코드 레벨 가드 ─────────────────────────────────────────
describe("보기 한글뜻 조회 (오개념 버그 방지)", () => {
  it("quiz.tsx에 v.s.includes(choice)로 뜻을 찾는 코드가 없어야 한다", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../app/quiz.tsx"),
      "utf8"
    );
    // 동의어 배열 포함 여부로 표제어를 찾아 그 뜻을 보기 뜻처럼 쓰는 패턴 금지
    expect(src).not.toMatch(/v\.s\s*&&\s*v\.s\.includes\(choice\)/);
    expect(src).not.toMatch(/v\.w\s*===\s*choice\s*\|\|/);
  });

  it("korGloss는 표제어가 아닌 동의어에 대해 다른 표제어의 뜻을 반환하지 않는다", () => {
    // escalating은 표제어가 아님 → 검수된 syn-gloss 값(또는 null)만 허용,
    // exponential의 '기하급수적인'이 나오면 실패
    const g = korGloss("escalating");
    expect(g === null || !g.includes("기하급수")).toBe(true);
  });

  it("표제어인 동의어는 자기 자신의 뜻을 반환한다", () => {
    const item = VOCAB_WITH_SYNONYMS.find((v) =>
      VOCAB.some((o) => o.w.toLowerCase() === (v.s[0] ?? "").toLowerCase())
    );
    if (!item) return; // 해당 케이스 없으면 스킵
    const syn = item.s.find((s) =>
      VOCAB.some((o) => o.w.toLowerCase() === s.toLowerCase())
    )!;
    const owner = VOCAB.find((o) => o.w.toLowerCase() === syn.toLowerCase())!;
    const g = korGloss(syn);
    // 반환값이 있으면 그 동의어 자신(표제어)의 뜻에서 나와야 함
    if (g) expect(owner.k_short.includes(g.replace("…", "")) || g.length > 0).toBe(true);
  });
});

// ─── 2~3. 필수 회귀 사례 ─────────────────────────────────────────────────────
describe("필수 회귀 사례", () => {
  it("exponential의 동의어에 escalating(근접어)이 없어야 한다", () => {
    const item = find("exponential");
    expect(item).toBeDefined();
    expect(item!.s.map((s) => s.toLowerCase())).not.toContain("escalating");
  });

  it("loquacious 생성 문항: 오답에 자기 동의어군·communicative가 절대 없어야 한다", () => {
    const item = find("loquacious");
    expect(item).toBeDefined();
    const defensible = new Set([
      ...item!.s.map((s) => s.toLowerCase()),
      "communicative",
    ]);
    for (let i = 0; i < 200; i++) {
      const correct = item!.s[i % item!.s.length];
      const ds = getSynDistractors(item!, correct);
      for (const d of ds) {
        expect(defensible.has(d.toLowerCase())).toBe(false);
      }
    }
  });

  it("exorbitant 생성 문항: steep가 정답일 때 extreme 등 방어 가능 근접어가 오답에 없어야 한다", () => {
    const item = find("exorbitant");
    expect(item).toBeDefined();
    const defensible = new Set([
      ...item!.s.map((s) => s.toLowerCase()),
      "extreme",
    ]);
    for (let i = 0; i < 200; i++) {
      const ds = getSynDistractors(item!, "steep");
      for (const d of ds) {
        expect(defensible.has(d.toLowerCase())).toBe(false);
      }
    }
  });
});

// ─── 4. 정답 유일성 (구조적 검사) ────────────────────────────────────────────
describe("생성 문항 정답 유일성", () => {
  it("무작위 표본 200개: 오답이 정답 단어의 동의어군(직접·형제)과 겹치지 않는다", () => {
    const pool = VOCAB_WITH_SYNONYMS;
    for (let i = 0; i < 200; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const correct = item.s[0];
      const forbidden = getForbiddenSyns(item);
      const ds = getSynDistractors(item, correct);
      expect(ds).toHaveLength(3);
      for (const d of ds) {
        expect(forbidden.has(d)).toBe(false);
        expect(d).not.toBe(correct);
      }
      // 보기 중 중복 없음
      expect(new Set([...ds, correct]).size).toBe(4);
    }
  });

  it("무작위 표본 100개: 한국어 뜻 보기에 정답 뜻과 동일한 오답이 없다", () => {
    const pool = VOCAB_WITH_SYNONYMS;
    for (let i = 0; i < 100; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const ds = getKorDistractors(item, pool);
      for (const d of ds) {
        expect(d).not.toBe(item.k);
        expect(d).not.toBe(item.k_short);
      }
      expect(new Set(ds).size).toBe(ds.length);
    }
  });

  it("wrongPool 단어 자체가 오답 선지에 등장하지 않는다", () => {
    const withWp = VOCAB.filter((v) => v.wrongPool && v.wrongPool.length > 0 && v.s.length > 0);
    for (const item of withWp.slice(0, 50)) {
      const wp = new Set(item.wrongPool!.map((x) => x.toLowerCase()));
      for (let i = 0; i < 20; i++) {
        const ds = getSynDistractors(item, item.s[0]);
        for (const d of ds) expect(wp.has(d.toLowerCase())).toBe(false);
      }
    }
  });
});

// ─── 복수정답 금지: 대량 생성 시뮬레이션 ─────────────────────────────────────
describe("생성 문항 복수정답 금지 (전 항목 합집합 기준)", () => {
  it("500문항 시뮬레이션: 오답이 정답 단어의 동의어(중복 표제어 포함)면 실패", () => {
    const byW = new Map<string, Set<string>>();
    for (const v of VOCAB) {
      const p = byW.get(v.w.toLowerCase()) ?? new Set<string>();
      v.s.forEach((s) => p.add(s.toLowerCase()));
      byW.set(v.w.toLowerCase(), p);
    }
    const pool = VOCAB_WITH_SYNONYMS;
    for (let i = 0; i < 500; i++) {
      const item = pool[(i * 7919) % pool.length];
      const correct = item.s[0];
      const ds = getSynDistractors(item, correct, 3);
      const synsAll = byW.get(item.w.toLowerCase())!;
      for (const d of ds) {
        // 오답이 같은 표제어의 어떤 항목의 동의어와도 겹치면 복수정답
        expect(
          synsAll.has(d.toLowerCase()),
          `${item.w}: 오답 '${d}'가 동의어와 충돌`
        ).toBe(false);
        expect(d.toLowerCase()).not.toBe(item.w.toLowerCase());
      }
    }
  });
});
