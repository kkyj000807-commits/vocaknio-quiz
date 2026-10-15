import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

function loadUi(file: string, store: Record<string, unknown> = {}) {
  const buttons: { text: string; disabled: boolean; press: () => void }[] = [];
  const push = vi.fn();
  const text = (children: React.ReactNode): string => React.Children.toArray(children).map(child =>
    React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : String(child ?? "")).join("");
  const host = (tag: string) => function MockHost({ children, onPress, disabled }: {
    children?: React.ReactNode; onPress?: () => void; disabled?: boolean;
  }) {
    if (onPress) buttons.push({ text: text(children), disabled: Boolean(disabled), press: onPress });
    return React.createElement(tag, {}, children);
  };
  const dependencies: Record<string, unknown> = {
    react: { ...React, useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() },
    "react/jsx-runtime": jsx,
    "react-native": { View: host("div"), Text: host("span"), ScrollView: host("div"), Pressable: host("button"), StyleSheet: { create: (styles: unknown) => styles } },
    "expo-router": { useRouter: () => ({ push }) },
    "@/hooks/use-colors": { useColors: () => ({ foreground: "#111", primary: "#456", border: "#ddd", surface: "#fff" }) },
    "@/lib/store": store,
  };
  const source = fs.readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const exports: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected recovery UI dependency: ${name}`);
    return dependencies[name];
  } });
  return { exports, buttons, push };
}

describe("storage recovery controls preserve safe exits", () => {
  it("keeps backup and setup exits but hides repeated retries for non-retryable recovery", () => {
    const ui = loadUi("quiz-empty-state.tsx");
    const backup = vi.fn(); const settings = vi.fn(); const start = vi.fn();
    const html = renderToStaticMarkup(React.createElement(ui.exports.QuizSessionHold, {
      failure: "STORAGE_RECOVERY", canRetry: false, onBackup: backup, onSettings: settings, onStart: start,
    }));
    expect(html).toContain("STORAGE_RECOVERY");
    expect(ui.buttons.some(button => button.text === "다시 시도")).toBe(false);
    ui.buttons.find(button => button.text === "기록 백업·저장 상태 확인")!.press();
    ui.buttons.find(button => button.text === "문제 풀이 설정으로 돌아가기")!.press();
    expect(backup).toHaveBeenCalledOnce(); expect(settings).toHaveBeenCalledOnce(); expect(start).not.toHaveBeenCalled();
  });

  it("distinguishes content construction failure and disables an in-flight retry", () => {
    const ui = loadUi("quiz-empty-state.tsx");
    const html = renderToStaticMarkup(React.createElement(ui.exports.QuizSessionHold, {
      failure: "CONTENT_PREPARE", busy: true, onBackup: vi.fn(), onSettings: vi.fn(), onStart: vi.fn(),
    }));
    expect(html).toContain("문제를 구성하지 못했습니다");
    expect(html).toContain("CONTENT_PREPARE");
    expect(ui.buttons.find(button => button.text === "저장 상태 확인 중…")?.disabled).toBe(true);
  });

  it("hides a healthy notice and routes conflict recovery to backup without retry", () => {
    let issue: string | null = null;
    const retry = vi.fn();
    const ui = loadUi("learning-storage-notice.tsx", {
      getLearningStorageIssue: () => issue,
      getLearningStorageRecovery: () => ({ canRetry: false, code: "CONFLICT", pending: true }),
      retryLearningStorage: retry, subscribeLearningStorage: () => () => {},
    });
    expect(renderToStaticMarkup(React.createElement(ui.exports.LearningStorageNotice))).toBe("");
    issue = "기록 충돌로 덮어쓰기를 막았습니다.";
    renderToStaticMarkup(React.createElement(ui.exports.LearningStorageNotice));
    expect(ui.buttons.some(button => button.text === "저장 상태 다시 확인")).toBe(false);
    ui.buttons.find(button => button.text === "기록 백업·복구 안내")!.press();
    expect(ui.push).toHaveBeenCalledWith("/(tabs)/settings");
    expect(retry).not.toHaveBeenCalled();
  });

  it("coalesces rapid retry taps while an eligible recovery remains in flight", async () => {
    let finish!: () => void;
    const retry = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const ui = loadUi("learning-storage-notice.tsx", {
      getLearningStorageIssue: () => "일시 저장 실패",
      getLearningStorageRecovery: () => ({ canRetry: true, code: "WRITE_FAILED", pending: true }),
      retryLearningStorage: retry, subscribeLearningStorage: () => () => {},
    });
    renderToStaticMarkup(React.createElement(ui.exports.LearningStorageNotice));
    const button = ui.buttons.find(button => button.text === "저장 상태 다시 확인")!;
    button.press(); button.press();
    expect(retry).toHaveBeenCalledOnce();
    finish(); await Promise.resolve();
  });
});
import { URL } from "node:url";
