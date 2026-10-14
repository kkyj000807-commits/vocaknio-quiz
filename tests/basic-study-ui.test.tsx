import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildExplicitMeaningStudyRoute, QuizEmptyState, QuizSessionHold } from "@/components/quiz-empty-state";

// Isolated presentation and route contracts: no corpus, learner disk or browser.
const native = vi.hoisted(() => ({ buttons: [] as { label: string; press: () => void }[] }));
vi.mock("react-native", () => {
  const component = (tag: string) => function MockNative({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
    if (tag === "button") native.buttons.push({ label: String(props.accessibilityLabel), press: props.onPress as () => void });
    return React.createElement(tag, { "aria-label": props.accessibilityLabel }, children);
  };
  return { View: component("div"), ScrollView: component("div"), Text: component("span"), Pressable: component("button"), StyleSheet: { create: <T,>(value: T) => value } };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "#222", dim: "#666", primary: "#536" }) }));

const request = { mode: "definition-choice" as const, choiceLang: "korean" as const, rangeId: "v501", rangeStart: 18000, rangeEnd: 19000, count: 10 };

it("keeps problem navigation outside long scrolling explanations and uses automatic archival", () => {
  const source = fs.readFileSync(path.resolve("app/quiz.tsx"), "utf8");
  expect(source.indexOf("style={s.questionNavRow}")).toBeGreaterThan(source.lastIndexOf("</ScrollView>"));
  expect(source).toContain("loadQuizSessionForStudy(requestKey)");
  expect(source).not.toContain("acknowledgedStaleSession");
  expect(source).not.toContain("이번 진행은 복원되지 않을 수 있어요.\");\n      const");
});

it("offers retry, backup and a way back only for failed session preparation", () => {
  native.buttons.length = 0;
  const onStart = vi.fn(); const onBackup = vi.fn(); const onSettings = vi.fn();
  const html = renderToStaticMarkup(<QuizSessionHold onStart={onStart} onBackup={onBackup} onSettings={onSettings} />);
  expect(html).toContain("다시 채점하거나 삭제하지 않습니다");
  expect(onStart).not.toHaveBeenCalled(); expect(onBackup).not.toHaveBeenCalled();
  native.buttons.find(button => button.label === "학습 기록 백업 설정 열기")!.press();
  expect(onBackup).toHaveBeenCalledOnce(); expect(onStart).not.toHaveBeenCalled();
  expect(html).not.toContain("이전 문제는 다시 검토 중입니다");
  native.buttons.find(button => button.label === "저장 확인 후 다시 시도")!.press();
  expect(onStart).toHaveBeenCalledOnce();
  native.buttons.find(button => button.label === "문제 풀이 설정으로 돌아가기")!.press();
  expect(onSettings).toHaveBeenCalledOnce();
});

describe("explicit basic-meaning study from an empty ordinary session", () => {
  beforeEach(() => { native.buttons.length = 0; });

  it.each([5, 10, 20, 30])("preserves the selected range and requested %i questions", count => {
    expect(buildExplicitMeaningStudyRoute({ ...request, count })).toEqual({
      pathname: "/quiz",
      params: { ...request, count, mode: "kor-choice", choiceLang: "korean" },
    });
  });

  it("does not navigate or create replacement answers until the user presses the action", () => {
    const onMeaningStudy = vi.fn();
    const onSettings = vi.fn();
    const html = renderToStaticMarkup(<QuizEmptyState ready request={request} onMeaningStudy={onMeaningStudy} onSettings={onSettings} />);
    expect(html).toContain("원자료 한국어 뜻");
    expect(html).toContain("정답을 대체하지 않습니다");
    expect(onMeaningStudy).not.toHaveBeenCalled();
    native.buttons.find(button => button.label === "같은 범위의 한국어 뜻 문제로 전환")!.press();
    expect(onMeaningStudy).toHaveBeenCalledTimes(1);
    expect(onMeaningStudy).toHaveBeenCalledWith(buildExplicitMeaningStudyRoute(request));
    expect(onSettings).not.toHaveBeenCalled();
  });

  it.each([
    { reviewKeys: '["sense:fixture"]' },
    { reviewKeys: "unknown-or-malformed-review-key" },
    { bookmarkNums: "18,19" },
  ])("never downgrades targeted review requests: %j", target => {
    const targetedRequest = { ...request, ...target };
    expect(buildExplicitMeaningStudyRoute(targetedRequest)).toBeNull();
    const onSettings = vi.fn();
    const html = renderToStaticMarkup(<QuizEmptyState ready request={targetedRequest} onMeaningStudy={vi.fn()} onSettings={onSettings} />);
    expect(html).not.toContain("한국어 뜻 문제로 전환");
    native.buttons.find(button => button.label === "문제 풀이 설정으로 돌아가기")!.press();
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it("does not offer a switch while loading, in logic/flashcard mode, or in an already Korean meaning session", () => {
    for (const mode of ["sentence-completion", "flashcard", "kor-choice"] as const) {
      expect(buildExplicitMeaningStudyRoute({ ...request, mode })).toBeNull();
    }
    const html = renderToStaticMarkup(<QuizEmptyState ready={false} request={request} onMeaningStudy={vi.fn()} onSettings={vi.fn()} />);
    expect(html).toContain("문제를 준비하고 있습니다");
    expect(native.buttons).toHaveLength(0);
  });

  it("can explicitly change English choices to Korean without changing the range", () => {
    const route = buildExplicitMeaningStudyRoute({ ...request, mode: "kor-choice", choiceLang: "english" });
    expect(route?.params).toEqual({ ...request, mode: "kor-choice", choiceLang: "korean" });
  });

  it("rejects malformed request counts and ranges instead of constructing an unsafe new session", () => {
    for (const change of [{ count: 0 }, { count: 201 }, { count: Number.NaN }, { rangeStart: -1 }, { rangeEnd: 17999 }]) {
      expect(buildExplicitMeaningStudyRoute({ ...request, ...change })).toBeNull();
    }
  });
});

it("keeps the original Korean wordbook meaning unclamped even without a synonym expansion control (source contract)", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/(tabs)/wordbook.tsx"), "utf8");
  expect(source).toMatch(/<Text style=\{s\.korText\}>\s*\{item\.k_short\}/);
  expect(source).not.toMatch(/<Text[^>]*numberOfLines[^>]*>\s*\{item\.k_short\}/);
});

it("does not advertise an automatic mode fallback that the engine deliberately disallows (source contract)", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  expect(source).toContain("다른 유형을 직접 선택할 수 있습니다");
  expect(source).not.toContain("안전한 기존 문제로 전환합니다");
});
