import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WordPronunciation } from "@/components/word-pronunciation";
import { ActiveRecallAnswer, ActiveRecallPrompt, DefinitionRecallAnswer, DefinitionRecallPrompt, SynonymRecallAnswer } from "@/components/active-recall-card";
import type { ActiveRecallSense } from "@/lib/active-recall";
import type { VocabItem } from "@/lib/vocab";
import type { DefinitionQuizEntry } from "@/lib/definition-quiz";

const pronunciation = vi.hoisted(() => ({ get: vi.fn((): string | null => "커프리셔스") }));
vi.mock("@/lib/korean-pronunciation-data", () => ({ getKoreanPronunciation: pronunciation.get }));
vi.mock("react-native", () => {
  const host = (tag: string) => function Host({ children, accessibilityLabel, testID }: {
    children?: React.ReactNode; accessibilityLabel?: string; testID?: string;
  }) { return React.createElement(tag, { "aria-label": accessibilityLabel, "data-testid": testID }, children); };
  return { View: host("div"), Text: host("span"), Pressable: host("button"), Platform: { OS: "web" }, StyleSheet: { create: <T,>(value: T) => value } };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ primary: "#456", muted: "#666", foreground: "#222", card: "#fff", border: "#ddd" }) }));
vi.mock("@/components/semantic-relation-cluster", () => ({ SemanticRelationCluster: () => null }));
vi.mock("@/components/learning-evidence", () => ({ LearningEvidence: () => null }));
vi.mock("@/components/pronunciation-button", () => ({ PronunciationButton: () => null }));
vi.mock("@/components/reasoning-practice", () => ({ LazyReasoningPractice: () => null }));
vi.mock("@/lib/definition-quiz", () => ({
  getDefinitionAnswerRelations: () => ({ synonyms: ["impulsive"], antonyms: [] }),
  getDefinitionRelationMeanings: () => [],
}));

const item = { id: "test-row", w: "capricious", p: "/kəˈprɪʃəs/" } as VocabItem;
const definition = { headword: item.w, definition: "Changing suddenly without reason.", examples: [] } as unknown as DefinitionQuizEntry;
const recall = {
  headword: item.w, koreanMeaning: "변덕스러운", conciseEnglishDefinition: definition.definition,
  relationMeaningsKo: {}, exactSynonyms: [], nearSynonyms: [], antonyms: [], variants: [], relatedWords: [],
  exampleSentences: [], contextExplanationKo: "", itemIds: [item.id],
  prompts: [{ id: "prompt", kind: "definition-recall", text: definition.definition }],
} as unknown as ActiveRecallSense;

beforeEach(() => { pronunciation.get.mockReset().mockReturnValue("커프리셔스"); });

describe("pronunciation study aid stays out of unanswered recall prompts", () => {
  it("shows IPA and the small approximation in study/answer contexts but skips Korean lookup for questions", () => {
    for (const context of ["study", "answer"] as const) {
      const html = renderToStaticMarkup(<WordPronunciation item={item} context={context} />);
      expect(html).toContain(item.p);
      expect(html).toContain("커프리셔스");
      expect(html).toContain("한글 발음 근사치");
    }
    pronunciation.get.mockClear();
    const question = renderToStaticMarkup(<WordPronunciation item={item} context="question" />);
    expect(question).toContain(item.p);
    expect(question).not.toContain("커프리셔스");
    expect(pronunciation.get).not.toHaveBeenCalled();
  });

  it("preserves IPA-only output for unaudited items and emits nothing when IPA is missing", () => {
    pronunciation.get.mockReturnValue(null);
    const html = renderToStaticMarkup(<WordPronunciation item={item} context="study" />);
    expect(html).toContain(item.p);
    expect(html).not.toContain("korean-pronunciation");
    pronunciation.get.mockClear();
    expect(renderToStaticMarkup(<WordPronunciation item={{ ...item, p: "" }} context="answer" />)).toBe("");
    expect(pronunciation.get).not.toHaveBeenCalled();
  });

  it("reaches all three primary answer renderers without modifying their prompt contracts", () => {
    for (const component of [
      <DefinitionRecallAnswer key="definition" recall={definition} koreanMeaning="변덕스러운" item={item} />,
      <SynonymRecallAnswer key="synonym" recall={definition} koreanMeaning="변덕스러운" choices={[]} item={item} />,
      <ActiveRecallAnswer key="active" recall={recall} item={item} />,
    ]) {
      const html = renderToStaticMarkup(component);
      expect(html).toContain("커프리셔스");
      expect(html).toContain(item.p);
    }
    pronunciation.get.mockClear();
    expect(renderToStaticMarkup(<ActiveRecallPrompt recall={recall} />)).not.toContain("커프리셔스");
    expect(renderToStaticMarkup(<DefinitionRecallPrompt definition={definition.definition} />)).not.toContain("커프리셔스");
    expect(pronunciation.get).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(<DefinitionRecallAnswer recall={definition} koreanMeaning="변덕스러운" />)).not.toContain("커프리셔스");
  });
});
