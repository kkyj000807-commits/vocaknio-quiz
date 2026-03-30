import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { addStudySeconds } from "@/lib/store";

/**
 * 앱이 포그라운드(active)에 있는 동안만 시간을 측정해
 * 백그라운드 전환 시 경과 시간을 AsyncStorage에 저장합니다.
 *
 * 사용법: 루트 레이아웃(_layout.tsx)에서 한 번만 호출하세요.
 *
 * 측정 방식:
 * - 앱이 active 상태가 되면 타이머 시작
 * - 앱이 background/inactive 상태가 되면 경과 시간 저장
 * - 앱 종료 시에도 저장 (AppState 'background' 이벤트로 캐치)
 * - 최소 5초 이상 활성화된 경우에만 저장 (잠깐 전환 노이즈 제거)
 */
export function useStudyTimer() {
  const activeStartRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const flushTime = async () => {
    if (activeStartRef.current !== null) {
      const elapsed = Math.floor((Date.now() - activeStartRef.current) / 1000);
      activeStartRef.current = null;
      // 5초 이상만 유효한 학습 시간으로 간주
      if (elapsed >= 5) {
        await addStudySeconds(elapsed);
      }
    }
  };

  useEffect(() => {
    // 앱 시작 시 이미 active 상태면 바로 타이머 시작
    if (AppState.currentState === "active") {
      activeStartRef.current = Date.now();
    }

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        if (nextState === "active" && prev !== "active") {
          // 포그라운드 진입 → 타이머 시작
          activeStartRef.current = Date.now();
        } else if (nextState !== "active" && prev === "active") {
          // 백그라운드/비활성 전환 → 경과 시간 저장
          flushTime();
        }
      }
    );

    return () => {
      // 컴포넌트 언마운트 시 남은 시간 저장
      flushTime();
      subscription.remove();
    };
  }, []);
}
