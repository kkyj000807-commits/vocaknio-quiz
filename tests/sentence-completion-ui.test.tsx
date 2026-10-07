import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SentenceCompletionPrompt, SentenceCompletionAnswer } from "@/components/sentence-completion-card";
import { AdaptiveStatistics } from "@/components/adaptive-statistics";
import { SENTENCE_COMPLETION_QUESTIONS, sentenceCompletionKey, sentenceCompletionMetadata } from "@/lib/sentence-completion";
import { buildLearningStatistics } from "@/lib/learning-statistics";
import { createEmptyAdaptiveHistory, recordAdaptiveAnswer } from "@/lib/adaptive-quiz";
import { createEmptySenseLearningState, applyLearningEvent } from "@/lib/learning-state";
import { VOCAB_BY_ID } from "@/lib/vocab";
import { getItemLearningTargets } from "@/lib/canonical-learning";
const controls = vi.hoisted(() => ({ buttons: [] as { label: string; press: () => void }[] }));
vi.mock("react-native", () => {
  const component = (tag: string) => function Mock({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
    if (tag === "button") controls.buttons.push({ label: String(props.accessibilityLabel), press: props.onPress as () => void });
    return React.createElement(tag, { "aria-label": props.accessibilityLabel }, children);
  };
  return { View: component("div"), Text: component("span"), Pressable: component("button"), TextInput: component("input"), StyleSheet: { create: <T,>(style: T) => style } };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "text", muted: "muted", metadata: "metadata", primary: "brand", border: "border", error: "error" }) }));
describe("Sentence Completion answer-only explanation and real statistics", () => {
  beforeEach(() => { controls.buttons.length = 0; });
  it("keeps answer clues out of the unanswered prompt and renders all five explanation steps", () => {
    for (const q of SENTENCE_COMPLETION_QUESTIONS) {
      const prompt = renderToStaticMarkup(<SentenceCompletionPrompt question={q} />);
      expect(prompt).toContain("____"); expect(prompt).not.toMatch(/[가-힣]/u);
      expect(prompt).not.toContain(q.requiredMeaningKo); expect(prompt).not.toContain(q.choices.find(c => c.id === q.correctChoiceId)!.text);
      const answer = renderToStaticMarkup(<SentenceCompletionAnswer question={q} selectedId={`${q.id}:${q.choices.find(c => c.errorType !== "supported")!.id}`} />);
      for (const step of ["문맥 방향", "결정적 단서", "빈칸에 필요한 의미", "정답 연결", "오답 배제", "선택한 오답", "문장 해석", "연결 어휘", "실제 기출 아님"]) expect(answer).toContain(step);
      for (const c of q.choices) expect(answer).toContain(c.explanationKo);
      expect(answer).toContain(VOCAB_BY_ID.get(q.itemId)!.w);
    }
  });
  it("renders 70%/20% logic scores with samples and one-action exact review", () => {
    let history = createEmptyAdaptiveHistory(); let learning = createEmptySenseLearningState();
    const sources = SENTENCE_COMPLETION_QUESTIONS.slice(0, 2);
    for (const [index, correct] of [[0, 7], [1, 2]]) for (let i = 0; i < 10; i++) {
      const q = sources[index]; const item = VOCAB_BY_ID.get(q.itemId)!; const outcome = i < correct ? "correct" : "skip";
      history = recordAdaptiveAnswer(history, { sessionId: `${q.id}-${i}`, mode: "sentence-completion", itemNum: item.num, targetKey: sentenceCompletionKey(q), sourceId: item.id, groupId: item.group, outcome, answeredAt: Date.now(), responseMs: 4200 });
      learning = applyLearningEvent(learning, { targetKey: sentenceCompletionKey(q), type: outcome === "skip" ? "unknown" : "correct" });
    }
    const model = buildLearningStatistics(history, learning, sentenceCompletionMetadata());
    const review = vi.fn();
    const html = renderToStaticMarkup(<AdaptiveStatistics detailsInitiallyOpen model={model} lifetime={{ totalAnswered: 20, totalCorrect: 9 }} groupId="" mode="" period="lifetime" onGroup={() => {}} onMode={() => {}} onPeriod={() => {}} onReview={review} />);
    expect(html).toContain("순접·부연 · 70%"); expect(html).toContain("역접·양보 · 20%");
    expect(html).toContain("7/10 정답"); expect(html).toContain("2/10 정답"); expect(html).toContain("4.2초");
    controls.buttons.find(b => b.label === "역접·양보 복습")!.press();
    expect(review.mock.calls[0][1].key).toBe(sentenceCompletionKey(sources[1]));
  });
  it("counts the linked word once while keeping logic and word performance separate", () => {
    const q = SENTENCE_COMPLETION_QUESTIONS[0]; const item = VOCAB_BY_ID.get(q.itemId)!;
    let history = createEmptyAdaptiveHistory();
    for (const [mode, targetKey, outcome] of [
      ["sentence-completion", sentenceCompletionKey(q), "wrong"],
      ["kor-choice", getItemLearningTargets(item)[0].key, "correct"],
    ] as const) history = recordAdaptiveAnswer(history, { sessionId: mode, mode, itemNum: item.num, targetKey, sourceId: item.id, groupId: item.group, outcome, answeredAt: Date.now(), responseMs: 5000 });
    const metadata = [...sentenceCompletionMetadata(), { num: item.num, word: item.w, sourceId: item.id, groupId: item.group, learningKey: getItemLearningTargets(item)[0].key }];
    const model = buildLearningStatistics(history, createEmptySenseLearningState(), metadata);
    expect(model.uniqueWords).toBe(1); expect(model.performance.attempts).toBe(2);
    expect(model.words).toHaveLength(2); expect(model.logicPerformance[0].accuracy).toBe(0);
    expect(model.modes.find(row => row.id === "kor-choice")?.accuracy).toBe(100);
    const typed = buildLearningStatistics(history, createEmptySenseLearningState(), metadata, { mode: "sentence-completion", period: "today" });
    expect(typed.performance.attempts).toBe(1); expect(typed.logicPerformance[0].wrong).toBe(1);
    expect(typed.difficultyPerformance[0].label).toBe("난도 하");
  });
});
