import { useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";

/** Visible foreground thinking time; inactive tabs cannot create slow answers. */
export function useQuestionTimer() {
  const clock = useRef({ presentedAt: Date.now(), segmentAt: Date.now(), elapsed: 0, active: true });
  useEffect(() => {
    const setActive = (active: boolean) => {
      const now = Date.now(); const current = clock.current;
      if (current.active) current.elapsed += Math.max(0, now - current.segmentAt);
      current.segmentAt = now; current.active = active;
    };
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    const visibility = () => setActive(document.visibilityState !== "hidden");
    if (Platform.OS === "web" && typeof document !== "undefined") {
      visibility(); document.addEventListener("visibilitychange", visibility);
    }
    return () => { subscription.remove(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return useMemo(() => ({
    reset() { const now = Date.now(); clock.current = { presentedAt: now, segmentAt: now, elapsed: 0, active: clock.current.active }; },
    read() { const value = clock.current; return { presentedAt: value.presentedAt, responseMs: value.elapsed + (value.active ? Math.max(0, Date.now() - value.segmentAt) : 0) }; },
  }), []);
}
