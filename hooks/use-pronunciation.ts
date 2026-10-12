import { useEffect, useState, useSyncExternalStore } from "react";
import { loadQuizSettings, saveQuizSettings } from "@/lib/store";
import { DEFAULT_PRONUNCIATION, type PronunciationPreference } from "@/lib/pronunciation-preference";
import { isAmericanVoice, scoreAmericanVoice } from "@/lib/us-pronunciation";

let preference = DEFAULT_PRONUNCIATION;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const snapshot = () => preference;
const serverSnapshot = () => DEFAULT_PRONUNCIATION;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const publish = (value: PronunciationPreference) => { preference = value; listeners.forEach(listener => listener()); };

function ensureLoaded() {
  loading ??= loadQuizSettings().then(value => { publish(value.pronunciation); });
  return loading;
}

export function usePronunciationPreference() {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => { void ensureLoaded(); }, []);
  return value;
}

export async function updatePronunciationPreference(value: PronunciationPreference) {
  await ensureLoaded();
  await saveQuizSettings({ pronunciation: value });
  publish(value);
}

export function useAmericanVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const refresh = () => setVoices(synth.getVoices().filter(isAmericanVoice)
      .sort((a, b) => scoreAmericanVoice(b) - scoreAmericanVoice(a)));
    // Some browsers publish their voices only after the first getVoices call.
    synth.addEventListener("voiceschanged", refresh);
    refresh();
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, []);
  return voices;
}
