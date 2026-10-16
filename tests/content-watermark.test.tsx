import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { ScreenContainer } from "@/components/screen-container";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ muted: "#64748B" }) }));
vi.mock("react-native", () => {
  function Host({ children, pointerEvents, testID, style }: {
    children?: React.ReactNode; pointerEvents?: string; testID?: string; style?: React.CSSProperties;
  }) { return <div data-testid={testID} data-pointer-events={pointerEvents} style={style}>{children}</div>; }
  return { View: Host, Text: Host, Platform: { OS: "web" } };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: { children?: React.ReactNode }) => <section>{children}</section> }));

describe("non-blocking ownership watermark", () => {
  it("preserves study content and keeps its compact notice outside the scrolling content, without overlay positioning", () => {
    const html = renderToStaticMarkup(<ScreenContainer><button>다음 문제</button></ScreenContainer>);
    expect(html).toContain("FINETUNE · 개인 학습용 · 무단 복제·재배포 금지");
    expect(html).toContain('data-pointer-events="none"');
    expect(html).toContain("font-size:10px");
    expect(html).toContain("flex-shrink:0");
    expect(html.indexOf("다음 문제")).toBeLessThan(html.indexOf('data-testid="content-watermark"'));
    expect(html).not.toMatch(/position:(fixed|absolute)|user-select:none|oncontextmenu/i);
  });
});
