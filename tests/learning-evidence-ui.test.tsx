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
