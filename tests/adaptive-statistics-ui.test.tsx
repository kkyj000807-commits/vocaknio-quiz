import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdaptiveStatistics } from "@/components/adaptive-statistics";
import { buildLearningStatistics } from "@/lib/learning-statistics";
import { createEmptySenseLearningState } from "@/lib/learning-state";
import { createEmptyAdaptiveHistory, recordAdaptiveAnswer } from "@/lib/adaptive-quiz";
vi.mock("react-native", () => {
  const component = (tag: string) => function MockComponent({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) { return React.createElement(tag, { style: props.style, "aria-label": props.accessibilityLabel }, children); };
  return { View: component("div"), Text: component("span"), Pressable: component("button"), TextInput: component("input") };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "#222", muted: "#666", primary: "#5046e5", surface: "#fff", card: "#eee", border: "#ccc" }) }));

describe("statistics renders real aggregate values", () => {
  it("shows V101=70%, V601=20% and denominators in the actual UI component", () => {
    let history = createEmptyAdaptiveHistory();
    const now = Date.parse("2026-10-05T12:00:00Z");
    const items = [ { num: 1, word: "abate", sourceId: "test101", groupId: "v101", learningKey: "sense:abate" }, { num: 2, word: "gainsay", sourceId: "test601", groupId: "v601", learningKey: "sense:gainsay" } ];
    for (const [num, correct] of [[1, 7], [2, 2]]) for (let i = 0; i < 10; i++) history = recordAdaptiveAnswer(history, { sessionId: `${num}-${i}`, itemNum: num, targetKey: items[num - 1].learningKey, groupId: items[num - 1].groupId, mode: "kor-choice", outcome: i < correct ? "correct" : "wrong", answeredAt: now + i, responseMs: 4200 });
    const model = buildLearningStatistics(history, createEmptySenseLearningState(), items, { now: now + 20 });
    const html = renderToStaticMarkup(<AdaptiveStatistics model={model} lifetime={{ totalAnswered: 20, totalCorrect: 9 }} groupId="" mode="" period="lifetime" onGroup={() => {}} onMode={() => {}} onPeriod={() => {}} />);
    expect(html).toMatch(/V101<\/span><span[^>]*>70%/);
    expect(html).toMatch(/V601<\/span><span[^>]*>20%/);
    expect(html).toContain("7/10 정답"); expect(html).toContain("2/10 정답");
    expect(html).toContain("4.2초"); expect(html).not.toContain("표본 부족");
    // Word detail has at most one historical row per target, not 20 phantom words.
    expect(model.uniqueWords).toBe(2);
  });
  it("explains legacy coverage and never presents missing semantic states as a reset", () => {
    let history = createEmptyAdaptiveHistory();
    const items = [{ num: 1, word: "abate", sourceId: "test101", groupId: "V101", learningKey: "sense:abate" }];
    history = recordAdaptiveAnswer(history, { sessionId: "legacy", itemNum: 1, mode: "kor-choice", outcome: "correct", answeredAt: 1000 });
    const model = buildLearningStatistics(history, createEmptySenseLearningState(), items, { now: 2000 });
    const html = renderToStaticMarkup(<AdaptiveStatistics model={model} lifetime={{ totalAnswered: 4, totalCorrect: 1 }} groupId="" mode="" period="lifetime" onGroup={() => {}} onMode={() => {}} onPeriod={() => {}} />);
    expect(html).toContain("연결 정보 없는 예전 3건");
    expect(html).toContain("상태는 미기록"); expect(model.stateCounts.MASTERED).toBe(0);
  });
});
