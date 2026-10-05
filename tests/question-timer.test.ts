import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuestionTimer } from "@/hooks/use-question-timer";
const harness = vi.hoisted(() => ({ change: (_state: string) => {}, cleanup: () => {}, remove: vi.fn() }));
vi.mock("react", () => ({ useRef: <T>(value: T) => ({ current: value }), useMemo: <T>(create: () => T) => create(), useEffect: (effect: () => () => void) => { harness.cleanup = effect(); } }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: { addEventListener: (_name: string, listener: (state: string) => void) => { harness.change = listener; return { remove: harness.remove }; } } }));
afterEach(() => { harness.cleanup(); vi.useRealTimers(); });
describe("foreground response clock", () => {
  it("excludes background thinking time and resets each presented question", () => {
    vi.useFakeTimers(); vi.setSystemTime(1000000);
    const clock = useQuestionTimer(); clock.reset();
    vi.advanceTimersByTime(2000); harness.change("background");
    vi.advanceTimersByTime(600000); expect(clock.read().responseMs).toBe(2000);
    harness.change("active"); vi.advanceTimersByTime(3000);
    expect(clock.read()).toMatchObject({ presentedAt: 1000000, responseMs: 5000 });
    clock.reset(); vi.advanceTimersByTime(1000); expect(clock.read().responseMs).toBe(1000);
  });
});
