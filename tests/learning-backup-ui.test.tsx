import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { LearningBackupSettings } from "@/components/learning-backup-settings";

const ui = vi.hoisted(() => ({ index: 0, expanded: true, preview: null as unknown, messages: [] as unknown[], buttons: [] as { label: string; disabled: boolean; press: () => void }[] }));
const store = vi.hoisted(() => ({ restore: vi.fn(), inspect: vi.fn(), export: vi.fn() }));
vi.mock("@/lib/store", () => ({ restoreLearningBackup: store.restore, inspectLearningBackup: store.inspect, exportLearningBackup: store.export }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: () => {
    const index = ui.index++;
    return [[ui.expanded, false, "", ui.preview][index], (value: unknown) => { if (index === 2) ui.messages.push(value); }];
  } };
});
vi.mock("react-native", () => {
  const element = (tag: string) => function MockNative({ children, disabled, onPress }: { children?: React.ReactNode; disabled?: boolean; onPress?: () => void }) {
    if (tag === "button") ui.buttons.push({ label: renderToStaticMarkup(<>{children}</>).replace(/<[^>]+>/g, ""), disabled: !!disabled, press: onPress! });
    return React.createElement(tag, { disabled }, children);
  };
  return { Platform: { OS: "web" }, View: element("div"), Text: element("span"), Pressable: element("button") };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "#222", muted: "#666", primary: "#536", card: "#fff" }) }));
beforeEach(() => { ui.index = 0; ui.expanded = true; ui.preview = null; ui.messages = []; ui.buttons = []; store.restore.mockReset(); store.inspect.mockReset(); store.export.mockReset(); });
const preview = { backup: { createdAt: "2026-10-12T15:00:00Z" }, entries: [["fixture", "[]"]], conflicts: [], unchanged: 7 };

it("makes startup export reachable without offering restore writes before migration is ready", () => {
  ui.preview = preview;
  const html = renderToStaticMarkup(<LearningBackupSettings exportOnly />);
  expect(html).toContain("백업 파일 다운로드");
  expect(html).not.toContain('type="file"');
  expect(html).not.toContain("빈 학습 저장소에 복원");
  expect(store.restore).not.toHaveBeenCalled();
  expect(store.export).not.toHaveBeenCalled();
});

it("does not restore merely by opening settings or selecting a preview", () => {
  ui.preview = preview;
  const html = renderToStaticMarkup(<LearningBackupSettings />);
  expect(html).toContain("아직 저장하지 않음");
  expect(html).toContain("로그인 정보는 포함하지 않습니다");
  expect(html).toContain("개인 학습 기록");
  expect(store.restore).not.toHaveBeenCalled();
});
it("keeps current data when a backup conflicts, without offering an overwrite button", () => {
  ui.preview = { ...preview, conflicts: ["fixture"] };
  const html = renderToStaticMarkup(<LearningBackupSettings />);
  expect(html).toContain("자동 병합·덮어쓰기는 하지 않습니다");
  expect(ui.buttons.some(button => button.label.includes("빈 학습 저장소에 복원"))).toBe(false);
  expect(store.restore).not.toHaveBeenCalled();
});
it("only explicitly restores the preview and never reports success on a rejected save", async () => {
  ui.preview = preview;
  store.restore.mockRejectedValue(new Error("synthetic failure"));
  renderToStaticMarkup(<LearningBackupSettings />);
  ui.buttons.find(button => button.label.includes("빈 학습 저장소에 복원"))!.press();
  await vi.waitFor(() => expect(ui.messages).toContain("기록 변경·충돌·저장 실패로 복원 완료를 확인하지 못했습니다. 백업을 보존하고 저장 상태를 확인해 주세요."));
  expect(store.restore).toHaveBeenCalledWith(preview);
  expect(ui.messages).not.toContain("복원이 저장되었습니다. 학습 화면을 다시 열어 기록을 확인해 주세요.");
});
