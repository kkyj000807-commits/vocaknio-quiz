import { PRONUNCIATION_RATE, selectAmericanVoice } from "./us-pronunciation";
import type { PronunciationPreference } from "./pronunciation-preference";

export type PronunciationStatus = { speaking: boolean; starting?: boolean; source: "synthesis" | "recording"; failed: boolean };
type Request = { text: string; preference: PronunciationPreference; recordingUrl?: string; useDefaultVoice?: boolean; onStatus: (value: PronunciationStatus) => void };
type Environment = Pick<Window & typeof globalThis, "speechSynthesis" | "SpeechSynthesisUtterance" | "Audio">;
const START_TIMEOUT_MS = 2200;

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
      let startTimer: ReturnType<typeof setTimeout> | undefined;
      let source: PronunciationStatus["source"] = "synthesis";
      const clearStart = () => {
        if (startTimer !== undefined) clearTimeout(startTimer);
        startTimer = undefined;
      };
      const report = (speaking: boolean, starting = false) => {
        if (active) request.onStatus({ speaking, starting, source, failed: false });
      };
      const clearAudio = (interrupt: boolean) => {
        if (!audio) return;
        audio.onended = null; audio.onerror = null; audio.onplaying = null;
        if (interrupt) { try { audio.pause(); } catch { /* detached media */ } }
        audio = undefined;
      };
      const finish = (failed: boolean, interrupt: boolean) => {
        if (!active) return;
        active = false;
        clearStart();
        clearAudio(interrupt);
        if (utterance) {
          utterance.onend = null; utterance.onerror = null; utterance.onstart = null;
          if (interrupt) { try { env.speechSynthesis?.cancel(); } catch { /* unavailable engine */ } }
          utterance = undefined;
        }
        if (stopActive === stop) stopActive = undefined;
        request.onStatus({ speaking: false, starting: false, source, failed });
      };
      const stop = () => finish(false, true);
      const waitForStart = () => {
        clearStart();
        startTimer = setTimeout(() => finish(true, true), START_TIMEOUT_MS);
        report(false, true);
      };
      const started = () => { clearStart(); report(true); };
      stopActive = stop;
      const canSynthesize = !!(env.speechSynthesis && env.SpeechSynthesisUtterance);
      const speak = () => {
        if (!active) return;
        source = "synthesis";
        if (!canSynthesize) { finish(true, false); return; }
        try {
          utterance = new env.SpeechSynthesisUtterance(request.text.trim());
          utterance.lang = "en-US";
          utterance.rate = PRONUNCIATION_RATE;
          utterance.pitch = 1;
          utterance.volume = 1;
          // Query on every click: delayed voice lists and removed/manual voices
          // must not leave a stale object. If empty, retain the user gesture and
          // use the OS en-US fallback; never replay automatically on voiceschanged.
          utterance.voice = request.useDefaultVoice ? null : selectAmericanVoice(env.speechSynthesis.getVoices(), request.preference.voiceURI);
          utterance.onstart = started;
          utterance.onend = () => finish(false, false);
          utterance.onerror = () => finish(true, false);
          if (env.speechSynthesis.paused) env.speechSynthesis.resume();
          waitForStart();
          env.speechSynthesis.speak(utterance);
        } catch { finish(true, true); }
      };
      if (!request.text.trim()) { finish(true, false); return stop; }
      if (request.recordingUrl && env.Audio && (!canSynthesize || (request.preference.preferRecording && !request.useDefaultVoice))) {
        source = "recording";
        let fellBack = false;
        const fallback = () => {
          if (!active || fellBack) return;
          fellBack = true;
          clearStart();
          clearAudio(true);
          speak();
        };
        try {
          const recording = new env.Audio(request.recordingUrl);
          audio = recording;
          recording.onplaying = () => { if (audio === recording) started(); };
          recording.onended = () => { if (audio === recording) finish(false, false); };
          recording.onerror = fallback;
          waitForStart();
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
