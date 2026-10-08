import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveRecallAnswer, ActiveRecallPrompt } from "@/components/active-recall-card";
import { ActiveRecallStudyDetails, LearningDetails } from "@/components/learning-details";
import { LearningEvidence } from "@/components/learning-evidence";
import { SemanticRelationCluster } from "@/components/semantic-relation-cluster";
import { ACTIVE_RECALL_SENSES } from "@/lib/active-recall";

const native = vi.hoisted(() => ({ openURL: vi.fn(), links: [] as { label: string; press: () => void }[] }));
vi.mock("react-native", () => {
  const component = (tag: string) => function MockComponent({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
    if (props.accessibilityRole === "link") native.links.push({ label: String(props.accessibilityLabel), press: props.onPress as () => void });
    return React.createElement(tag, { "aria-label": props.accessibilityLabel, role: props.accessibilityRole }, children);
  };
  return { View: component("div"), Text: component("span"), Pressable: component("button"), ActivityIndicator: component("span"), StyleSheet: { create: <T,>(styles: T) => styles }, Linking: { openURL: native.openURL } };
});
vi.mock("@/components/reasoning-practice", () => ({ ReasoningPractice: () => null, LazyReasoningPractice: () => null }));
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "#222", muted: "#666", primary: "#5046e5", success: "#187", error: "#c33", surface: "#fff", card: "#eee", border: "#ccc" }) }));

const entry = ACTIVE_RECALL_SENSES.find(sense => sense.senseId === "take-into-account:consider-factor")!;
const render = (element: React.ReactElement) => renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
const occurrences = (text: string, value: string) => text.split(value).length - 1;

describe("reviewed learning evidence and explanation boundaries", () => {
  beforeEach(() => { native.links.length = 0; native.openURL.mockReset().mockResolvedValue(undefined); });

  it("fall short of는 정답 후 한국어 풀이·관계어 뜻을 열고 정답 전에는 감춘다", () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "fall-short-of:below-required-standard")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    expect(prompt).toContain(sense.conciseEnglishDefinition);
    expect(prompt).not.toContain(sense.koreanMeaning);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).toContain("아무 성과도 없었다는 뜻은 아니다");
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) expect(detail).toContain(meaning);
    for (const example of sense.exampleSentences) expect(detail).toContain(example.ko);
    expect(detail).toContain("Collins ↗");
  });

  it("shows actual dictionary provenance, check date and editorial distinction", () => {
    expect(entry).toBeDefined();
    const html = render(<LearningEvidence entry={entry} />);
    expect(html).toContain("사전 근거 · 편집 노트");
    expect(html).toContain(`확인 ${entry.sourceCheckedAt}`);
    expect(html).toContain("Oxford ↗");
    expect(html).toContain("Webster’s · Collins ↗");
    expect(html).toContain("정의는 학습용 자체 편집");
    expect(html).toContain("예문은 학습용 창작");
    expect(html).not.toContain("원문 유지");
    expect(html).not.toContain("전체 검수 완료");
    expect(native.links.map(link => link.label)).toEqual(entry.sources.map(source => `${source.publisher} 사전 근거 열기`));
  });

  it("opens the stored direct source URLs instead of a search or invented citation", async () => {
    render(<LearningEvidence entry={entry} />);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(entry.sources.map(source => source.url));
  });

  it("추가 사전 페이지가 있어도 첫 화면에는 독립 사전별 직접 링크만 한 번 보여준다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "without-fail:every-time-no-exception")!;
    expect(sense.sources).toHaveLength(8);
    const html = render(<LearningEvidence entry={sense} />);
    expect(native.links).toHaveLength(2);
    expect(occurrences(html, "Oxford ↗")).toBe(1);
    expect(occurrences(html, "Collins ↗")).toBe(1);
    expect(html).not.toContain("· clockwork");
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 2).map(source => source.url));
  });

  it("without fail 정답 후·단어장에는 개별 뜻을 표시하고 영영 문제에는 노출하지 않는다", () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "without-fail:every-time-no-exception")!;
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={1} count={2} />);
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(detail).toContain(meaning);
      expect(prompt).not.toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
    }
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(detail).not.toContain("한국어 뜻 검수 중");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).toContain("not always (항상 그런 것은 아니다, 매번 그러지는 않는다)");
    expect(prompt).not.toContain(sense.koreanMeaning);
  });

  it("rule of thumb은 정답 뒤 관계어 4개를 한 번 풀고 TFD 수록 원전별 요약·직접 링크를 제공한다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "rule-of-thumb:practical-approximate-guide")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).toContain("rough guide (정확한 계산 대신 대략 판단하도록 돕는 어림 지침)");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(occurrences(evidence, "TFD · Collins ↗")).toBe(1);
    expect(native.links).toHaveLength(4);
    expect(native.links[0].label).toBe("The Free Dictionary · American Heritage 사전 근거 열기");
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 4).map(source => source.url));
  });

  it("conducive to는 정답 뒤 관계어 6개·구문 차이를 한 번 풀고 TFD 근거를 우선 표시한다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "conducive-to:make-result-more-likely")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).toContain("detrimental to (~에 해로운, ~을 손상시키는)");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(native.links).toHaveLength(3);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 3).map(source => source.url));
  });

  it("a wide range of는 정답 뒤 7개 뜻·치환 조건을 연결하고 정의 문제에는 한국어를 노출하지 않는다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "a-wide-range-of:many-different-kinds")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).toContain("a broad range of (폭넓은 여러 종류의 ~. 같은 범주 안의 종류·선택지 폭을 말할 때 a wide range of와 바꿔 쓸 수 있다)");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(native.links).toHaveLength(3);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 3).map(source => source.url));
  });

  it("zoom in on은 정답 뒤 7개 뜻·구문 차이를 한 번 보여주고 TFD 원전 근거를 구분한다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "zoom-in-on:give-close-attention")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(prompt).not.toContain(sense.koreanMeaning);
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).toContain("focus on (~에 초점을 맞추다, 주의를 집중하다)");
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(occurrences(evidence, "TFD · Farlex ↗")).toBe(1);
    expect(native.links).toHaveLength(4);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 4).map(source => source.url));
  });

  it("cart-before-horse는 정답 뒤 순서·시기 차이를 한 번 보여주고 실제 대조한 출처를 연결한다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "put-the-cart-before-the-horse:reverse-dependent-order")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(prompt).not.toContain(sense.koreanMeaning);
    expect(detail).toContain(sense.exampleSentences[0].ko);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(native.links).toHaveLength(3);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 3).map(source => source.url));
  });

  it("abide by는 정답 후 한국어 정의·관계어 뜻을 한 번 보여주고 실제 검수 원전만 요약한다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "abide-by:follow-governing-rule")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(prompt).not.toContain(sense.koreanMeaning);
    expect(detail).toContain(sense.exampleSentences[0].ko);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(native.links).toHaveLength(3);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 3).map(source => source.url));
  });

  it("teem with 관계어6개의 뜻·치환조건은 정답 후 한 번만 표시하고 두 검수 원전만 요약한다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "teem-with:contain-many-active-things")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(native.links).toHaveLength(2);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 2).map(source => source.url));
  });

  it("wrap up 관계어6개의 뜻·구문은 정답 후 한 번만 표시하고 실제 두 원전으로 요약한다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "wrap-up:finish-activity")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={1} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(native.links).toHaveLength(2);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 2).map(source => source.url));
  });

  it("take for granted 전제 의미의5관계어는 정답 뒤에만 한 번 표시하고 가치 간과 뜻을 섞지 않는다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "take-for-granted:assume-without-checking")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={2} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).not.toContain("익숙해서 소중함·고마움을 모르다");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · Kernerman ↗")).toBe(1);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(evidence).toContain("2026.10.08");
    expect(native.links).toHaveLength(3);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 3).map(source => source.url));
  });

  it("가치 간과의5관계어는 정답 뒤에만 표시하고 사실 전제 해설과 출처를 섞지 않는다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "take-for-granted:fail-to-appreciate")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={1} count={2} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).not.toContain("확인 없이 사실로 전제하다");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(occurrences(evidence, "Collins ↗")).toBe(1);
    expect(evidence).toContain("2026.10.09");
    expect(native.links).toHaveLength(2);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 2).map(source => source.url));
  });

  it("work out 해결의3관계어는 정답 뒤에만 한 번 열고 계산·운동 뜻과 검수 범위를 섞지 않는다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "work-out:solve-problem")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={4} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).toContain(sense.koreanMeaning);
    expect(prompt).not.toContain(sense.koreanMeaning);
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).not.toContain("수치·답을 계산해 내다");
    expect(detail).not.toContain("운동하다");
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(occurrences(evidence, "Collins ↗")).toBe(1);
    expect(evidence).toContain("2026.10.09");
    expect(evidence).toContain("예문은 학습용 창작");
    expect(native.links).toHaveLength(2);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 2).map(source => source.url));
  });

  it("work out 계산4관계어는 정답 뒤 표시하고 편집 대비를 반의어로 포장하지 않는다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "work-out:calculate-value")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={1} count={4} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("검증된 반의어 관계 없음");
    expect(answer).toContain("사전에 확인된 고정 반의어가 아니다");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).not.toContain("문제·이유·해결책을 생각해 찾아내다");
    expect(detail).not.toContain("운동하다·몸을 단련하다");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    expect(occurrences(evidence, "TFD · American Heritage ↗")).toBe(1);
    expect(occurrences(evidence, "Collins ↗")).toBe(1);
    expect(evidence).toContain("2026.10.09");
    expect(evidence).toContain("예문은 학습용 창작");
    expect(native.links).toHaveLength(2);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 2).map(source => source.url));
  });

  it("결과 뜻의5관계어·영한예문·3원전은 정답 후에만 보이며 상세 해설에서 중복하지 않는다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "work-out:end-successfully")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={2} count={4} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).not.toContain("수치·양·금액을 계산해 구하다");
    expect(detail).not.toContain("운동하다·몸을 단련하다");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    for (const label of ["TFD · American Heritage ↗", "Collins ↗", "Oxford ↗"]) expect(occurrences(evidence, label)).toBe(1);
    expect(evidence).toContain("2026.10.09");
    expect(evidence).toContain("예문은 학습용 창작");
    expect(native.links).toHaveLength(3);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual([sense.sources[0].url, sense.sources[1].url, sense.sources.at(-1)!.url]);
  });

  it("운동의3관계어는 정답 뒤 한 번만 표시하고 명사 workout을 동의 동사로 포장하지 않는다", async () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "work-out:exercise-body")!;
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={3} count={4} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("품사가 달라 관련어로 둔다");
    expect(answer).toContain("검증된 반의어 관계 없음");
    expect(detail).toContain(sense.exampleSentences[0].en);
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(detail).not.toContain("수치·양·금액을 계산해 구하다");
    expect(detail).not.toContain("상황·계획·관계가 결과적으로 잘 풀리다");
    expect(prompt).not.toContain(sense.koreanMeaning);
    native.links.length = 0;
    const evidence = render(<LearningEvidence entry={sense} />);
    for (const label of ["TFD · American Heritage ↗", "Collins ↗"]) expect(occurrences(evidence, label)).toBe(1);
    expect(evidence).toContain("2026.10.09");
    expect(evidence).toContain("예문은 학습용 창작");
    expect(native.links).toHaveLength(2);
    for (const link of native.links) link.press();
    await Promise.resolve();
    expect(native.openURL.mock.calls.map(call => call[0])).toEqual(sense.sources.slice(0, 2).map(source => source.url));
  });

  it("does not describe mixed-source examples as entirely original", () => {
    const html = render(<LearningEvidence entry={{ ...entry, exampleSentences: [{ ...entry.exampleSentences[0], type: "source" }] }} />);
    expect(html).toContain("예문은 항목별 출처·창작 구분");
    expect(html).not.toContain("예문은 학습용 창작");
  });

  it("의무 뜻도 정답 공개 뒤 개별 관계어 뜻·짧은 예문 연결을 보여주고 질문에서는 감춘다", () => {
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.senseId === "without-fail:required-certainty")!;
    const answer = render(<ActiveRecallAnswer recall={sense} />);
    const detail = render(<ActiveRecallStudyDetails entry={sense} index={0} count={2} />);
    const prompt = render(<ActiveRecallPrompt recall={sense} />);
    for (const meaning of Object.values(sense.relationMeaningsKo!)) {
      expect(answer).toContain(meaning);
      expect(detail).toContain(meaning);
      expect(occurrences(detail, meaning)).toBe(1);
      expect(prompt).not.toContain(meaning);
    }
    expect(answer).toContain("영영 정의 · 한국어 해석");
    expect(answer).not.toContain("한국어 뜻 검수 중");
    expect(detail).not.toContain("한국어 뜻 검수 중");
    expect(detail).toContain("perhaps (어쩌면, 아마 그럴 수도 있다)");
    expect(detail).toContain("no matter what (무슨 일이 있어도, 어떤 상황이든)");
    expect(detail).toContain(sense.exampleSentences[0].ko);
    expect(occurrences(detail, "Oxford ↗")).toBe(1);
    expect(occurrences(detail, "Collins ↗")).toBe(1);
    expect(prompt).not.toContain(sense.koreanMeaning);
  });

  it("renders the wordbook context once while retaining English, Korean and example clusters", () => {
    const html = render(<ActiveRecallStudyDetails entry={entry} index={0} count={1} />);
    expect(occurrences(html, entry.contextExplanationKo!)).toBe(1);
    expect(html).toContain(entry.englishDefinition);
    expect(html).toContain(entry.koreanMeaning);
    expect(html).toContain(entry.exampleSentences[0].ko);
    expect(html).toContain(entry.exampleSentences[0].cueKo);
    for (const word of [...entry.exactSynonyms, ...entry.antonyms]) expect(html).toContain(word);
    for (const meaning of Object.values(entry.relationMeaningsKo!)) expect(html).toContain(meaning);
    expect(html).toContain("사전 근거 · 편집 노트");
  });

  it("preserves the immediately visible Korean answer bridge and provenance", () => {
    const html = render(<ActiveRecallAnswer recall={entry} />);
    expect(occurrences(html, entry.contextExplanationKo!)).toBe(1);
    expect(html).toContain("영영 정의 · 한국어 해석");
    expect(html).toContain(entry.koreanMeaning);
    expect(html).toContain("사전 근거 · 편집 노트");
    expect(html).toContain("예문·전체 정의 보기");
  });

  it("does not leak the Korean answer or evidence into the question or closed details", () => {
    const html = render(<ActiveRecallPrompt recall={entry} />);
    const details = render(<LearningDetails itemId={entry.itemIds[0]} />);
    for (const output of [html, details]) {
      expect(output).not.toContain(entry.koreanMeaning);
      expect(output).not.toContain(entry.contextExplanationKo);
      expect(output).not.toContain("사전 근거 · 편집 노트");
      expect(output).not.toContain(entry.sources[0].publisher);
    }
  });

  it("only removes the optional repeated bridge, never individual relation meanings", () => {
    const props = { headword: "sample", coreMeaningKo: "핵심 정의", bridgeKo: "상세 문맥 설명", exactSynonyms: ["equivalent"], antonyms: ["opposite"], choiceMeanings: [{ word: "equivalent", meaning: "개별 동의어 뜻" }, { word: "opposite", meaning: "개별 반의어 뜻" }] };
    const defaultHtml = render(<SemanticRelationCluster {...props} />);
    const deduplicated = render(<SemanticRelationCluster {...props} showDefinitionBridge={false} />);
    expect(defaultHtml).toContain("상세 문맥 설명");
    expect(defaultHtml).toContain("핵심 정의");
    expect(deduplicated).not.toContain("상세 문맥 설명");
    expect(deduplicated).not.toContain("핵심 정의");
    expect(deduplicated).toContain("sample ≒ equivalent");
    expect(deduplicated).toContain("개별 동의어 뜻");
    expect(deduplicated).toContain("개별 반의어 뜻");
  });
});
