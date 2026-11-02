import fs from "node:fs";
import { URL } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_QUIZ_MODE, QUIZ_MODES, RANGES } from "@/lib/vocab";
import { buildWordbookPracticeHref, type WordbookPracticeScope } from "@/lib/wordbook-practice";

// Exercise the actual setup component without mounting native modules, loading
// learner storage, or navigating a real session. The PNG is an inert fixture.
function renderSetup(localContent = false, wordbook?: { scope: WordbookPracticeScope; label: string; availableCount: number; hasLocalContent: boolean }) {
  const buttons: { label: string; selected?: boolean; press: () => void }[] = [];
  const push = vi.fn();
  const save = vi.fn();
  const load = vi.fn(async () => ({ choiceLang: "english" }));
  const state: unknown[] = []; let cursor = 0;
  const effects: (() => void)[] = [];
  const testReact = { ...React,
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useEffect: (effect: () => void) => { effects.push(effect); },
  };
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
    react: testReact, "react/jsx-runtime": jsx,
    "react-native": { View: element("div"), Text: element("span"), ScrollView: element("div"), Pressable: element("button"),
      Image: () => null, StyleSheet: { create: (value: unknown) => value }, Platform: { OS: "web" }, Alert: { alert: vi.fn() } },
    "expo-router": { useRouter: () => ({ push }) }, "expo-haptics": {},
    "react-native-reanimated": { __esModule: true, default: { View: element("div") }, FadeIn: { duration: () => ({}) } },
    "@/components/screen-container": { ScreenContainer: element("div") },
    "@/lib/layout": { SCROLL_END_PADDING: 16, STUDY_PAGE_GUTTER: 12, STUDY_CARD_PADDING: 12, MIN_TOUCH_TARGET: 44 },
    "@/lib/vocab": { DEFAULT_QUIZ_MODE, QUIZ_MODES, RANGES, COUNTS: [5, 10, 20, 30] },
    "@/hooks/use-colors": { useColors: () => ({ primary: "#456", foreground: "#222", muted: "#666", card: "#fff", border: "#ddd" }) },
    "@/hooks/use-study-vocab": { useStudyVocab: () => localContent ? [{ localBook: true }] : [] },
    "@/constants/brand": { PRODUCT_NAME: "FINETUNE", PRODUCT_PHILOSOPHY: "Study" },
    "@/lib/quiz-engine": { getQuizCandidateItems: () => [] },
    "@/lib/store": { loadQuizSettings: load, saveQuizSettings: save },
    "@/lib/wordbook-practice": { buildWordbookPracticeHref },
    "@/assets/images/finetune-home-v2.png": "image-fixture",
  };
  const source = fs.readFileSync(new URL(wordbook ? "../components/wordbook-practice.tsx" : "../app/(tabs)/index.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const exports: { default?: React.ComponentType; WordbookPractice?: React.ComponentType<NonNullable<typeof wordbook>> } = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected setup dependency: ${name}`);
    return dependencies[name];
  } });
  const render = () => { cursor = 0; buttons.length = 0; return renderToStaticMarkup(wordbook
    ? React.createElement(exports.WordbookPractice!, wordbook) : React.createElement(exports.default!)); };
  const html = render();
  return { html, buttons, push, save, load, effects, render };
}

describe("study setup starts with Korean meaning and keeps other modes available", () => {
  it('explains the device-book self-assessment boundary with the meaning default', () => {
    const { html, buttons } = renderSetup(true);
    expect(html).not.toContain('v1.5 단권화 전체 구성');
    expect(html).toContain('신규 뜻은 빠른 암기(자기평가)로 학습');
    expect(buttons.find(button => button.label.includes('정확한 뜻 4택'))?.selected).toBe(true);
  });
  it("orders meaning, synonyms, definitions before the other retained modes", () => {
    expect(QUIZ_MODES.slice(0, 3).map(mode => mode.id)).toEqual(["kor-choice", "syn-choice", "definition-choice"]);
    expect(QUIZ_MODES.map(mode => mode.id).sort()).toEqual([
      "definition-choice", "flashcard", "kor-choice", "sentence-completion", "syn-choice", "syn-kor-choice", "syn-type",
    ]);
    const { html, buttons } = renderSetup();
    expect(html.indexOf("뜻찾기")).toBeLessThan(html.indexOf("동의어"));
    expect(html.indexOf("동의어")).toBeLessThan(html.indexOf("영영정의"));
    expect(html.indexOf("영영정의")).toBeLessThan(html.indexOf("그 외"));
    expect(html).not.toContain("Sentence Completion");
    expect(buttons.find(button => button.label.includes("정확한 뜻 4택"))?.selected).toBe(true);
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
      mode: "kor-choice", rangeStart: all.start, rangeEnd: all.end, count: 10, rangeId: "all", choiceLang: "korean",
    } });
    expect(save).not.toHaveBeenCalled();
  });
  it('does not use or overwrite old English-choice preferences for the new meaning default', async () => {
    const view = renderSetup();
    view.effects.forEach(effect => effect()); await Promise.resolve(); view.render();
    view.buttons.find(button => button.label === '문제 풀기→')!.press();
    expect(view.push.mock.calls[0][0].params).toMatchObject({ mode: 'kor-choice', choiceLang: 'korean' });
    expect(view.save).not.toHaveBeenCalled();
  });
  it.each(QUIZ_MODES.map(mode => [mode.id, mode.desc]))('can select and start retained mode %s', (id, description) => {
    const view = renderSetup();
    view.buttons.find(button => button.label.startsWith('그 외'))!.press(); view.render();
    view.buttons.find(button => button.label.includes(description))!.press(); view.render();
    view.buttons.find(button => button.label === '문제 풀기→')!.press();
    expect(view.push.mock.calls[0][0].params.mode).toBe(id);
  });
  it('returns to meaning when collapsing a selected other mode', () => {
    const view = renderSetup();
    view.buttons.find(button => button.label.startsWith('그 외'))!.press(); view.render();
    view.buttons.find(button => button.label.includes('문맥과 논리로 빈칸 추론'))!.press(); view.render();
    view.buttons.find(button => button.label.startsWith('그 외'))!.press();
    const html = view.render();
    expect(html).not.toContain('Sentence Completion');
    expect(view.buttons.find(button => button.label.includes('정확한 뜻 4택'))?.selected).toBe(true);
    expect(view.save).not.toHaveBeenCalled();
  });
});

describe('wordbook section practice setup', () => {
  const scope: WordbookPracticeScope = { rangeId: RANGES.find(range => range.group === 'V301')!.id,
    concept: '선택 개념', query: 'selected', bookmarksOnly: true, includeMastered: false };
  const setup = (availableCount = 250) => renderSetup(true, { scope, label: 'V301', availableCount, hasLocalContent: true });
  it('stays collapsed until opened and defaults to ten meaning questions', () => {
    const view = setup();
    expect(view.html).not.toContain('문제 수');
    view.buttons.find(button => button.label.startsWith('이 범위 학습'))!.press();
    const html = view.render();
    expect(html).toContain('V301'); expect(html).toContain('선택 개념');
    expect(html).toContain('유형 선택 · 뜻찾기');
    expect(html).toContain('자동채점은 검수된 단어만');
    view.buttons.find(button => button.label === '학습 시작 · 10문제')!.press();
    expect(view.push).toHaveBeenCalledWith(buildWordbookPracticeHref(scope, 'kor-choice', 10));
    expect(view.save).not.toHaveBeenCalled();
  });
  it.each([5, 10, 20, 30])('lets the learner choose %s questions', count => {
    const view = setup(); view.buttons[0].press(); view.render();
    view.buttons.find(button => button.label === `${count}개`)!.press(); view.render();
    view.buttons.find(button => button.label === `학습 시작 · ${count}문제`)!.press();
    expect(JSON.parse(decodeURIComponent(new URL(view.push.mock.calls[0][0], 'https://fixture.invalid').hash.slice(1)).slice('wordbook:'.length)).count).toBe(count);
  });
  it.each(QUIZ_MODES.map(option => [option.id, option.title]))('starts explicit type %s without dropping section filters', (mode, title) => {
    const view = setup(); view.buttons[0].press(); view.render();
    view.buttons.find(button => button.label.startsWith('유형 선택'))!.press(); view.render();
    view.buttons.find(button => button.label.startsWith('그 외'))!.press(); view.render();
    view.buttons.find(button => button.label === title)!.press(); view.render();
    view.buttons.find(button => button.label.startsWith('학습 시작'))!.press();
    expect(view.push).toHaveBeenCalledWith(buildWordbookPracticeHref(scope, mode as typeof DEFAULT_QUIZ_MODE, 10));
  });
  it('bounds a short selection and does not navigate an empty one', () => {
    const short = setup(2); short.buttons[0].press(); short.render();
    short.buttons.find(button => button.label === '학습 시작 · 2문제')!.press();
    expect(JSON.parse(decodeURIComponent(new URL(short.push.mock.calls[0][0], 'https://fixture.invalid').hash.slice(1)).slice('wordbook:'.length)).count).toBe(2);
    const empty = setup(0); empty.buttons[0].press(); empty.render();
    empty.buttons.find(button => button.label === '학습할 단어가 없어요')!.press();
    expect(empty.push).not.toHaveBeenCalled();
  });
});
