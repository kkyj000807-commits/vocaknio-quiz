import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { classifyQuizSwipe, getNextQuizIndex, canReorderQuizQuestion } from "@/lib/quiz-navigation";

describe("touch navigation without grading", () => {
  it("moves forward before answering without modifying responses", () => {
    const states = [{ answered: false }, { answered: false }];
    expect(getNextQuizIndex(0, states)).toBe(1);
    expect(states).toEqual([{ answered: false }, { answered: false }]);
  });
  it("returns to remaining questions at the end and never finishes unanswered work", () => {
    expect(getNextQuizIndex(2, [{ answered: false }, { answered: true }, { answered: true }])).toBe(0);
    expect(getNextQuizIndex(0, [{ answered: false }])).toBe(0);
    expect(getNextQuizIndex(2, [{ answered: true }, { answered: true }, { answered: true }])).toBeNull();
  });
  it("keeps vertical/diagonal movement and taps out of horizontal navigation", () => {
    expect(classifyQuizSwipe(-90, 15)).toBe("next");
    expect(classifyQuizSwipe(90, 15)).toBe("previous");
    expect(classifyQuizSwipe(10, 95)).toBeNull();
    expect(classifyQuizSwipe(60, 65)).toBeNull();
    expect(classifyQuizSwipe(20, 3)).toBeNull();
    expect(classifyQuizSwipe(NaN, 0)).toBeNull();
  });
  it("does not shuffle questions with an answer, draft, or revealed hint", () => {
    expect(canReorderQuizQuestion(undefined)).toBe(true);
    expect(canReorderQuizQuestion({ answered: false })).toBe(true);
    for (const state of [{ answered: true }, { typedAnswer: "draft" }, { hintLevel: 1 }, { revealed: true }, { mastered: true }]) {
      expect(canReorderQuizQuestion(state)).toBe(false);
    }
  });
});

// Run the real screen's touch callbacks; no DOM-only imitation of gesture logic.
function touchHandlers() {
  const source = readFileSync("app/quiz.tsx", "utf8");
  const handlers = source.slice(source.indexOf("  const handleWebTouchStart"), source.indexOf("  // 네이티브 제스처"));
  const moves: string[] = [];
  const suppressed = { current: 0 };
  const trace = { current: null };
  const code = ts.transpileModule(`${handlers}\nresult={handleWebTouchStart,handleWebTouchMove,handleWebTouchEnd};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { result: undefined, Platform: { OS: "web" }, useCallback: (fn: unknown) => fn,
    webSwipeTraceRef: trace, suppressTouchPressUntilRef: suppressed, currentIdx: 3,
    handleNext: () => moves.push("next"), handlePrevious: () => moves.push("previous"), classifyQuizSwipe,
    getTouchPoint: (e: any, end = false) => { const t = (end ? e.nativeEvent.changedTouches : e.nativeEvent.touches)[0]; return { x: t.pageX, y: t.pageY }; },
  };
  vm.runInNewContext(code, context);
  const result = context.result as unknown as Record<"handleWebTouchStart" | "handleWebTouchMove" | "handleWebTouchEnd", (event: unknown) => void>;
  const event = (x: number, y: number, count = 1, editing = false) => ({
    target: { closest: () => editing },
    nativeEvent: { touches: Array.from({ length: count }, () => ({ pageX: x, pageY: y })), changedTouches: [{ pageX: x, pageY: y }] },
  });
  return { ...result, event, moves, suppressed };
}

it("screen responders navigate an unanswered card in both directions and suppress accidental answer taps", () => {
  const h = touchHandlers();
  h.handleWebTouchStart(h.event(220, 100));
  h.handleWebTouchMove(h.event(120, 105));
  h.handleWebTouchEnd(h.event(90, 105));
  expect(h.moves).toEqual(["next"]);
  expect(h.suppressed.current).toBeGreaterThan(Date.now());
  h.handleWebTouchStart(h.event(100, 100));
  h.handleWebTouchEnd(h.event(230, 105));
  expect(h.moves).toEqual(["next", "previous"]);
});

it("screen responders do not convert vertical scrolling, pinch or text editing into navigation", () => {
  const h = touchHandlers();
  h.handleWebTouchStart(h.event(100, 100));
  h.handleWebTouchMove(h.event(105, 155));
  h.handleWebTouchEnd(h.event(230, 160));
  h.handleWebTouchStart(h.event(100, 100, 2));
  h.handleWebTouchEnd(h.event(230, 100));
  h.handleWebTouchStart(h.event(100, 100, 1, true));
  h.handleWebTouchEnd(h.event(230, 100));
  expect(h.moves).toEqual([]);
});
