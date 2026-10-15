import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QUIZ_MODES, RANGES } from "@/lib/vocab";

// Exercise the actual setup component without mounting native modules, loading
// learner storage, or navigating a real session. The PNG is an inert fixture.
function renderSetup() {
  const buttons: { label: string; selected?: boolean; press: () => void }[] = [];
  const push = vi.fn();
  const save = vi.fn();
  const label = (node: React.ReactNode): string => React.Children.toArray(node).map(child => {
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return label(child.props.children);
    return typeof child === "string" || typeof child === "number" ? String(child) : "";
  }).join("");
  const element = (tag: string) => function Host(props: {
    children?: React.ReactNode; onPress?: () => void; accessibilityState?: { selected?: boolean };
  }) {
    if (props.onPress) buttons.push({ label: label(props.children), selected: props.accessibilityState?.selected, press: props.onPress });
    return React.createElement(tag, {}, props.children);
  };
  const dependencies: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsx,
    "react-native": { View: element("div"), Text: element("span"), ScrollView: element("div"), Pressable: element("button"),
      Image: () => null, StyleSheet: { create: (value: unknown) => value }, Platform: { OS: "web" }, Alert: { alert: vi.fn() } },
    "expo-router": { useRouter: () => ({ push }) }, "expo-haptics": {},
    "react-native-reanimated": { __esModule: true, default: { View: element("div") }, FadeIn: { duration: () => ({}) } },
    "@/components/screen-container": { ScreenContainer: element("div") },
    "@/lib/layout": { SCROLL_END_PADDING: 16, STUDY_PAGE_GUTTER: 12, STUDY_CARD_PADDING: 12, MIN_TOUCH_TARGET: 44 },
    "@/lib/vocab": { QUIZ_MODES, RANGES, COUNTS: [5, 10, 20, 30] },
    "@/hooks/use-colors": { useColors: () => ({ primary: "#456", foreground: "#222", muted: "#666", card: "#fff", border: "#ddd" }) },
    "@/constants/brand": { PRODUCT_NAME: "FINETUNE", PRODUCT_PHILOSOPHY: "Study" },
    "@/lib/quiz-engine": { getQuizCandidateItems: () => [] },
    "@/lib/store": { loadQuizSettings: async () => ({ choiceLang: "korean" }), saveQuizSettings: save },
    "@/assets/images/finetune-home-v2.png": "image-fixture",
  };
  const source = fs.readFileSync(new URL("../app/(tabs)/index.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const exports: { default?: React.ComponentType } = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected setup dependency: ${name}`);
    return dependencies[name];
  } });
  const html = renderToStaticMarkup(React.createElement(exports.default!));
  return { html, buttons, push, save };
}

describe("study setup starts with English synonyms and the entire vocabulary", () => {
  it("orders primary modes as synonyms, definitions, logic while retaining all existing modes", () => {
    expect(QUIZ_MODES.slice(0, 3).map(mode => mode.id)).toEqual(["syn-choice", "definition-choice", "sentence-completion"]);
    expect(QUIZ_MODES.map(mode => mode.id).sort()).toEqual([
      "definition-choice", "flashcard", "kor-choice", "sentence-completion", "syn-choice", "syn-kor-choice", "syn-type",
    ]);
    const { html, buttons } = renderSetup();
    expect(html.indexOf("영어 동의어")).toBeLessThan(html.indexOf("영영 정의"));
    expect(html.indexOf("영영 정의")).toBeLessThan(html.indexOf("Sentence Completion"));
    expect(buttons.find(button => button.label.includes("같은 sense의 동의어 찾기"))?.selected).toBe(true);
    expect(html).toContain("보조 학습 · 플래시카드/직접 입력");
  });

  it("shows every section immediately and starts all-range practice without overwriting saved settings", () => {
    const { html, buttons, push, save } = renderSetup();
    expect(html).not.toContain("전체 구간");
    expect(buttons.some(button => button.label === "핵심")).toBe(false);
    const ranges = buttons.filter(button => RANGES.some(range => range.label === button.label));
    expect(ranges[0]).toMatchObject({ label: "전체", selected: true });
    expect(ranges).toHaveLength(RANGES.length);
    for (const range of RANGES) expect(ranges.some(button => button.label === range.label)).toBe(true);
    buttons.find(button => button.label === "문제 풀기→")!.press();
    const all = RANGES.find(range => range.id === "all")!;
    expect(push).toHaveBeenCalledWith({ pathname: "/quiz", params: {
      mode: "syn-choice", rangeStart: all.start, rangeEnd: all.end, count: 10, rangeId: "all", choiceLang: "korean",
    } });
    expect(save).not.toHaveBeenCalled();
  });
});
import { URL } from "node:url";
