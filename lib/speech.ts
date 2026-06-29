import * as Speech from "expo-speech";

/**
 * 영단어/구문 발음 듣기 (TTS)
 *
 * - 웹(Safari/Chrome): 브라우저 내장 Web Speech API 사용 (expo-speech web 구현)
 * - iOS/Android 앱: 네이티브 TTS 엔진 사용
 *
 * 별도 오디오 파일 없이 모든 플랫폼에서 동작한다.
 */
export function speakWord(
  text: string,
  opts?: { rate?: number; lang?: string }
): void {
  if (!text) return;
  const clean = sanitize(text);
  if (!clean) return;
  try {
    // 이전 발화 중단 후 새로 재생 (버튼 연타 대응)
    Speech.stop();
    Speech.speak(clean, {
      language: opts?.lang ?? "en-US",
      rate: opts?.rate ?? 0.92, // 약간 느리게 (학습용)
      pitch: 1.0,
    });
  } catch {
    // TTS 미지원 환경 — 무시
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // noop
  }
}

/**
 * 발음에 부적합한 문자 제거.
 * - 발음기호(/.../)나 품사 표기 등이 섞여 있을 수 있어 영문/공백/하이픈만 남긴다.
 */
function sanitize(text: string): string {
  return text
    .replace(/\/[^/]*\//g, " ") // /ˈsmɜrk/ 같은 IPA 제거
    .replace(/\([^)]*\)/g, " ") // 괄호 안 보조 설명 제거
    .replace(/[^A-Za-z\s'-]/g, " ") // 영문/공백/아포스트로피/하이픈만 유지
    .replace(/\s+/g, " ")
    .trim();
}
