import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ActiveRecallStudyDetails, DictionaryExamples, EditorialExamples } from "@/components/learning-details";
import { ActiveRecallPrompt, DefinitionRecallPrompt } from "@/components/active-recall-card";
import { ACTIVE_RECALL_SENSES } from "@/lib/active-recall";
const disclosure = vi.hoisted(() => ({ open: false }));
vi.mock("@/components/korean-reveal", async importOriginal => {
  const original = await importOriginal<typeof import("@/components/korean-reveal")>();
  return { KoreanReveal: (props: React.ComponentProps<typeof original.KoreanReveal>) =>
    <original.KoreanReveal {...props} defaultOpen={disclosure.open} /> };
});

it("keeps original editorial examples row-scoped, labeled and Korean optional without changing dictionary quotations", () => {
  const sense = { senseId: "fixture", partOfSpeech: "noun", definition: "Distinct meaning", examples: [],
    editorialExamples: [{ en: "The fixture explains this particular meaning.", ko: "이 예시는 해당 뜻을 설명한다.", cueKo: "특정 뜻",
      sourceRowIds: ["matched-row"], provenance: "FINETUNE original" as const, reviewStatus: "ai-reviewed-editorial-example" as const }] };
  disclosure.open = false;
  const html = renderToStaticMarkup(<EditorialExamples sense={sense} itemId="matched-row" />);
  expect(html).toContain(sense.editorialExamples[0].en);
  expect(html).toContain("FINETUNE 자체 작성");
  expect(html).not.toContain("CC BY 4.0");
  expect(html).not.toContain(sense.editorialExamples[0].ko);
  expect(html).toContain("data-example-speech");
  disclosure.open = true;
  expect(renderToStaticMarkup(<EditorialExamples sense={sense} itemId="matched-row" />)).toContain(sense.editorialExamples[0].ko);
  expect(renderToStaticMarkup(<EditorialExamples sense={sense} itemId="different-meaning-row" />)).toBe("");
  expect(renderToStaticMarkup(<DictionaryExamples sense={sense} />)).toBe("");
  disclosure.open = false;
});

// Component contract only: no 38K corpus, device audio, browser or learner disk.
vi.mock("react-native", () => {
  const element = (tag: string) => function MockNative({ children }: { children?: React.ReactNode }) { return React.createElement(tag, {}, children); };
  return { View: element("div"), Text: element("span"), Pressable: element("button"), ActivityIndicator: element("span"), Linking: { openURL: vi.fn() }, StyleSheet: { create: <T,>(value: T) => value } };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "#222", muted: "#666", primary: "#536", card: "#fff", surface: "#eee", border: "#ccc", error: "#c00" }) }));
vi.mock("@/lib/vocab", () => ({ getSynonymDetails: () => [] }));
vi.mock("@/lib/definition-quiz", () => ({ getDefinitionAnswerRelations: () => ({ synonyms: [], antonyms: [] }), getDefinitionRelationMeanings: () => [] }));
vi.mock("@/lib/vocab-definitions", () => ({ loadVocabDefinition: vi.fn(), VOCAB_DEFINITION_SOURCE: {} }));
vi.mock("@/components/reasoning-practice", () => ({ ReasoningPractice: () => null, LazyReasoningPractice: () => null }));
vi.mock("@/components/pronunciation-button", () => ({ PronunciationButton: ({ text, itemId }: { text: string; itemId?: string }) => React.createElement("button", { "data-example-speech": text, "data-word-id": itemId }) }));

it("every reviewed production example has a sentence playback control and keeps its Korean meaning", () => {
  for (const entry of ACTIVE_RECALL_SENSES.filter(entry => entry.status === "production")) {
    disclosure.open = false;
    const html = renderToStaticMarkup(<ActiveRecallStudyDetails entry={entry} index={0} count={1} />);
    disclosure.open = true;
    const expanded = renderToStaticMarkup(<ActiveRecallStudyDetails entry={entry} index={0} count={1} />);
    disclosure.open = false;
    expect(html.match(/data-example-speech=/g)).toHaveLength(entry.exampleSentences.length);
    for (const example of entry.exampleSentences) {
      const encoded = renderToStaticMarkup(<span>{example.ko}</span>).slice(6, -7);
      expect(html).not.toContain(encoded);
      expect(expanded).toContain(encoded);
    }
    // A sentence must never accidentally play a word's recorded audio.
    expect(html).not.toContain("data-word-id");
  }
});

it("answer-side examples and audio never leak into the prompt", () => {
  const entry = ACTIVE_RECALL_SENSES.find(entry => entry.status === "production")!;
  const html = renderToStaticMarkup(<ActiveRecallPrompt recall={entry} />);
  expect(html).not.toContain("data-example-speech");
  expect(html).not.toContain(entry.koreanMeaning);
  expect(renderToStaticMarkup(<DefinitionRecallPrompt definition="An English definition." />)).not.toContain("data-example-speech");
});

it("dictionary reference examples are available without quiz eligibility and keep Korean optional", () => {
  const sense = { senseId: "reference-only", partOfSpeech: "verb", definition: "A distinct meaning.",
    examples: ["They abandoned the plan.", "She abandoned the search.", "He abandoned the project."],
    reviewedExamples: [{ en: "They abandoned the plan.", ko: "그들은 그 계획을 포기했다.", cueKo: "계획을 더 추진하지 않았다." }] };
  disclosure.open = false;
  const html = renderToStaticMarkup(<DictionaryExamples sense={sense} />);
  expect(html).toContain("They abandoned the plan.");
  expect(html).not.toContain("그들은 그 계획을 포기했다.");
  expect(html.match(/data-example-speech=/g)).toHaveLength(2);
  expect(html).toContain("모두 보기");
  disclosure.open = true;
  expect(renderToStaticMarkup(<DictionaryExamples sense={sense} />)).toContain("그들은 그 계획을 포기했다.");
  disclosure.open = false;
});

it("does not borrow a translation from a different example or synthesize missing examples", () => {
  disclosure.open = true;
  const sense = { senseId: "different-sense", partOfSpeech: "noun", definition: "Another meaning.", examples: ["A source phrase"],
    reviewedExamples: [{ en: "Not this example", ko: "다른 뜻의 번역", cueKo: "다른 문맥" }] };
  expect(renderToStaticMarkup(<DictionaryExamples sense={sense} />)).not.toContain("다른 뜻의 번역");
  expect(renderToStaticMarkup(<DictionaryExamples sense={{ ...sense, examples: [] }} />)).toBe("");
  disclosure.open = false;
});

it("surfaces an existing same-sense translated example without requiring all examples first", () => {
  // Actual OEWN adroit ordering: its reviewed sentence follows two unreviewed examples.
  const reviewed = "his adroit replies to hecklers won him many followers";
  const sense = { senseId: "adroit%3:00:00::", partOfSpeech: "adjective", definition: "quick or skillful or adept in action or thought",
    examples: ["an exceptionally adroit pianist", "an adroit technician", reviewed, "an adroit negotiator"],
    reviewedExamples: [{ en: reviewed, ko: "야유하는 사람들에게 능숙하게 응수한 덕분에 그는 많은 지지자를 얻었다.", cueKo: "replies와 won him many followers가 말로 상황에 잘 대처했다는 단서다. 신체 동작뿐 아니라 응답·판단에도 adroit를 쓴다." }] };
  const original = [...sense.examples];
  disclosure.open = false;
  const closed = renderToStaticMarkup(<DictionaryExamples sense={sense} />);
  expect(closed).toContain(reviewed);
  expect(closed.indexOf(reviewed)).toBeLessThan(closed.indexOf(original[0]));
  expect(closed).not.toContain(sense.reviewedExamples[0].ko);
  expect(closed.match(/data-example-speech=/g)).toHaveLength(2);
  expect(closed).toContain("용례 4개");
  disclosure.open = true;
  const expanded = renderToStaticMarkup(<DictionaryExamples sense={sense} />);
  expect(expanded).toContain(sense.reviewedExamples[0].ko);
  expect(expanded).toContain(sense.reviewedExamples[0].cueKo);
  expect(sense.examples).toEqual(original);
  disclosure.open = false;
});

it("retains source order when no matching translation exists and supports the same-sense fallback", () => {
  const sense = { senseId: "fixture", partOfSpeech: "noun", definition: "A distinct meaning.",
    reviewedExamples: [{ en: "Outside this sense's example list", ko: "무관한 번역", cueKo: "다른 문맥" }] };
  const fallback = ["First source example", "Second source example", "Third source example"];
  disclosure.open = true;
  const html = renderToStaticMarkup(<DictionaryExamples sense={sense} fallback={fallback} />);
  expect(html.indexOf(fallback[0])).toBeLessThan(html.indexOf(fallback[1]));
  expect(html).not.toContain("Outside this sense");
  expect(html).not.toContain("무관한 번역");
  expect(html).toContain("용례 3개");
  expect(renderToStaticMarkup(<DictionaryExamples sense={{ ...sense, examples: [] }} fallback={fallback} />)).toBe("");
  disclosure.open = false;
});
