export interface PronunciationPreference {
  voiceURI: string | null;
  preferRecording: boolean;
}

export const DEFAULT_PRONUNCIATION: PronunciationPreference = {
  voiceURI: null,
  preferRecording: true,
};

export function normalizePronunciationPreference(value: unknown): PronunciationPreference {
  const entry = value && typeof value === "object" ? value as Partial<PronunciationPreference> : {};
  return {
    voiceURI: typeof entry.voiceURI === "string" && entry.voiceURI.trim() ? entry.voiceURI : null,
    preferRecording: typeof entry.preferRecording === "boolean"
      ? entry.preferRecording : DEFAULT_PRONUNCIATION.preferRecording,
  };
}
