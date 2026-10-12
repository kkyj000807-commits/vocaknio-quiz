import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PronunciationSettings } from "@/components/pronunciation-settings";

vi.mock("react-native", () => {
  const element = (tag: string) => function MockNative({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
    return React.createElement(tag, { "aria-label": props.accessibilityLabel, "aria-expanded": (props.accessibilityState as { expanded?: boolean })?.expanded }, children);
  };
  return { Platform: { OS: "web" }, View: element("div"), Text: element("span"), Pressable: element("button"), StyleSheet: { create: <T,>(value: T) => value } };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "#222", muted: "#666", primary: "#536", card: "#fff", surface: "#eee", border: "#ccc", error: "#c00" }) }));
vi.mock("@/hooks/use-pronunciation", () => ({
  usePronunciationPreference: () => ({ voiceURI: null, preferRecording: false }),
  useAmericanVoices: () => [{ lang: "en-US", name: "Microsoft Aria Natural", voiceURI: "aria" }],
  updatePronunciationPreference: vi.fn(),
}));
vi.mock("@/components/pronunciation-button", () => ({ PronunciationButton: ({ text }: { text: string }) => React.createElement("button", { "aria-label": "미리듣기", "data-text": text }) }));

it("uses the existing settings screen with an honest device-dependent voice label and sentence preview", () => {
  const html = renderToStaticMarkup(<PronunciationSettings />);
  expect(html).toContain("여성 음성을 우선");
  expect(html).toContain("품질은 기기마다");
  expect(html).toContain("Microsoft Aria Natural");
  expect(html).toContain("자연스러운 속도 0.95");
  expect(html).toContain("미리듣기");
  expect(html).toContain("aria-expanded=\"false\"");
  expect(html).toContain("실제 녹음 우선");
});
