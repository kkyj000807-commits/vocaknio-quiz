import provenanceRaw from "@/assets/exam-provenance.json";

import { examQuestions } from "@/lib/exam-questions";
import { VOCAB } from "@/lib/vocab";

/**
 * 기출 출처 상태.
 * - verified:      학교·연도·문항번호·원본(업로드된 시험지 원문 대조)까지 확인 완료
 * - unverified:    출처 확인 전 (검수 대기) — '진짜 기출' 집계에 포함하지 않음
 * - reconstructed: AI/강의 자료 기반 재구성 문항 — 기출 집계에 포함하지 않음
 * - blocked:       오류·복수정답으로 출제 금지
 */
export type Provenance = "verified" | "unverified" | "reconstructed" | "blocked";

export const EXAM_PROVENANCE: Record<string, Provenance> =
  provenanceRaw as Record<string, Provenance>;

export function provenanceOf(id: string): Provenance {
  return EXAM_PROVENANCE[id] ?? "unverified";
}

// ─── 문항 검증 상태 (7단계 파이프라인) ───────────────────────────────────────
// verified가 아닌 문항은 앱에서 "확정 정답"처럼 보여주면 안 된다.
export type ValidationStatus =
  | "raw_extracted"           // PDF에서 문항만 추출됨
  | "number_only_unverified"  // 정답 번호만 있음, 선지 미연결
  | "choice_linked"           // 정답 번호와 실제 선지 텍스트 연결됨
  | "explanation_drafted"     // 구조 해설 초안 있음
  | "verified"                // 문항·정답·해설 검수 완료 (골드 파이프라인 통과)
  | "needs_review"            // 추출/해설/정답 확인 필요
  | "blocked";                // 오류·복수정답·OCR 불량 — 학습 노출 금지

/** 구조 해설(문맥 의미/핵심 단서/핵심 논리 라벨) 보유 여부 */
function hasStructuredExplanation(expl: string): boolean {
  return /(?:^|\n)(문맥 의미|핵심 단서|핵심 논리)\s*[:：]/.test(expl);
}

export function validationStatusOf(q: {
  id: string;
  explanation: string;
  verification?: { status: string };
}): ValidationStatus {
  const p = provenanceOf(q.id);
  if (p === "blocked") return "blocked";
  const v = q.verification?.status;
  if (v === "verified") return "verified";
  if (v === "ambiguous" || v === "blocked") return "blocked";
  if (p === "unverified") return "needs_review"; // 출처 미확인 → 검수 필요
  if (hasStructuredExplanation(q.explanation)) return "explanation_drafted";
  return "choice_linked"; // 정답 번호·선지 텍스트는 연결돼 있으나 해설이 간이 수준
}

export const VALIDATION_LABEL: Record<ValidationStatus, string> = {
  raw_extracted: "추출 원본",
  number_only_unverified: "정답 번호만",
  choice_linked: "선지 연결 · 간이 해설",
  explanation_drafted: "해설 초안",
  verified: "검증 완료",
  needs_review: "검수 필요",
  blocked: "차단",
};

// ─── 어휘 데이터의 기출 출처 집계 ────────────────────────────────────────────
// '진짜 기출'로 세는 조건: etym의 기출 노트에 학교명이 확인되는 항목만.
// 학교명이 없는 '기출' 표기는 검수 대기(pending)로 분리한다.
const UNIV_RE =
  /(한양대|중앙대|동국대|서강대|성균관대|건국대|가천대|경희대|이화여대|한국외대|홍익대|숙명여대|국민대|숭실대|인하대|아주대|단국대)/g;

export interface ExamStats {
  /** 원문 대조까지 끝난 기출 문항 수 */
  verifiedQuestions: number;
  /** 출처 확인 대기 문항 수 */
  unverifiedQuestions: number;
  /** 재구성(비기출) 문항 수 */
  reconstructedQuestions: number;
  /** 출제 금지 문항 수 */
  blockedQuestions: number;
  /** 학교 출처가 확인된 기출 단어 고유 수 */
  examWords: number;
  /** 학교 출처가 확인된 기출 숙어·표현 고유 수 */
  examIdioms: number;
  /** 기출 출처 태그(학교·연도 조합) 총 출현 횟수 */
  examOccurrences: number;
  /** '기출' 표기는 있으나 학교 미상 → 검수 대기 단어 수 */
  pendingVocab: number;
}

function computeStats(): ExamStats {
  let verifiedQuestions = 0;
  let unverifiedQuestions = 0;
  let reconstructedQuestions = 0;
  let blockedQuestions = 0;
  for (const q of examQuestions) {
    switch (provenanceOf(q.id)) {
      case "verified": verifiedQuestions++; break;
      case "reconstructed": reconstructedQuestions++; break;
      case "blocked": blockedQuestions++; break;
      default: unverifiedQuestions++;
    }
  }

  const words = new Set<string>();
  const idioms = new Set<string>();
  let examOccurrences = 0;
  let pendingVocab = 0;
  for (const v of VOCAB) {
    const et = v.etym ?? "";
    if (!et.includes("기출")) continue;
    const tags = new Set<string>();
    const re = new RegExp(UNIV_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(et)) !== null) {
      const near = et.slice(Math.max(0, m.index - 25), m.index + m[1].length + 25);
      const year = near.match(/20(\d{2})/);
      tags.add(`${year ? year[1] : "?"}${m[1]}`);
    }
    if (tags.size === 0) {
      pendingVocab++;
      continue;
    }
    examOccurrences += tags.size;
    if (v.type === "idiom" || v.type === "phrase") idioms.add(v.w.toLowerCase());
    else words.add(v.w.toLowerCase());
  }

  return {
    verifiedQuestions,
    unverifiedQuestions,
    reconstructedQuestions,
    blockedQuestions,
    examWords: words.size,
    examIdioms: idioms.size,
    examOccurrences,
    pendingVocab,
  };
}

export const EXAM_STATS: ExamStats = computeStats();
