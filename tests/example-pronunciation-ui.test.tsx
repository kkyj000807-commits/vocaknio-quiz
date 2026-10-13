import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ActiveRecallStudyDetails, DictionaryExamples } from "@/components/learning-details";
import { ActiveRecallPrompt, DefinitionRecallPrompt } from "@/components/active-recall-card";
import { ACTIVE_RECALL_SENSES } from "@/lib/active-recall";
const disclosure = vi.hoisted(() => ({ open: false }));
vi.mock("@/components/korean-reveal", async importOriginal => {
  const original = await importOriginal<typeof import("@/components/korean-reveal")>();
  return { KoreanReveal: (props: React.ComponentProps<typeof original.KoreanReveal>) =>
    <original.KoreanReveal {...props} defaultOpen={disclosure.open} /> };
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
