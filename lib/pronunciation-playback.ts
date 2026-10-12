import { PRONUNCIATION_RATE, selectAmericanVoice } from "./us-pronunciation";
import type { PronunciationPreference } from "./pronunciation-preference";

export type PronunciationStatus = { speaking: boolean; source: "synthesis" | "recording"; failed: boolean };
type Request = { text: string; preference: PronunciationPreference; recordingUrl?: string; onStatus: (value: PronunciationStatus) => void };
type Environment = Pick<Window & typeof globalThis, "speechSynthesis" | "SpeechSynthesisUtterance" | "Audio">;

/** One owner across word, sentence and preview buttons. Old callbacks cannot
 * start fallback audio after another button was pressed or the owner unmounted. */
export function createPronunciationPlayer(env: Environment) {
  let stopActive: (() => void) | undefined;
  return {
    play(request: Request): () => void {
      stopActive?.();
      let active = true;
      let audio: HTMLAudioElement | undefined;
      let utterance: SpeechSynthesisUtterance | undefined;
      let source: PronunciationStatus["source"] = "synthesis";
      const report = (speaking: boolean, failed = false) => {
        if (active) request.onStatus({ speaking, source, failed });
      };
      const stop = () => {
        if (!active) return;
        report(false);
        active = false;
        if (audio) { audio.onended = null; audio.onerror = null; audio.onplay = null; audio.pause(); }
        if (utterance) { utterance.onend = null; utterance.onerror = null; utterance.onstart = null; env.speechSynthesis?.cancel(); }
        if (stopActive === stop) stopActive = undefined;
      };
      stopActive = stop;
      const speak = () => {
        if (!active) return;
        source = "synthesis";
        if (!env.speechSynthesis || !env.SpeechSynthesisUtterance) { report(false, true); return; }
        try {
          utterance = new env.SpeechSynthesisUtterance(request.text.trim());
          utterance.lang = "en-US";
          utterance.rate = PRONUNCIATION_RATE;
          utterance.pitch = 1;
          utterance.volume = 1;
          // Query on every click: delayed voice lists and removed/manual voices
          // must not leave a stale object. If empty, retain the user gesture and
          // use the OS en-US fallback; never replay automatically on voiceschanged.
          utterance.voice = selectAmericanVoice(env.speechSynthesis.getVoices(), request.preference.voiceURI);
          utterance.onstart = () => report(true);
          utterance.onend = () => report(false);
          utterance.onerror = () => report(false, true);
          report(true);
          env.speechSynthesis.speak(utterance);
        } catch { report(false, true); }
      };
      if (!request.text.trim()) { report(false, true); return stop; }
      if (request.recordingUrl && env.Audio && (request.preference.preferRecording || !env.speechSynthesis || !env.SpeechSynthesisUtterance)) {
        source = "recording";
        let fellBack = false;
        const fallback = () => {
          if (!active || fellBack) return;
          fellBack = true;
          if (audio) { audio.onplay = null; audio.onerror = null; audio.onended = null; audio.pause(); }
          speak();
        };
        try {
          audio = new env.Audio(request.recordingUrl);
          audio.onplay = () => report(true);
          audio.onended = () => report(false);
          audio.onerror = fallback;
          report(true);
          void audio.play().catch(fallback);
        } catch { fallback(); }
      } else speak();
      return stop;
    },
  };
}

let player: ReturnType<typeof createPronunciationPlayer> | undefined;
export function playPronunciation(request: Request) {
  if (typeof window === "undefined") return () => undefined;
  player ??= createPronunciationPlayer(window);
  return player.play(request);
}
