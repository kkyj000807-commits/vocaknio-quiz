export interface VoiceLike {
  lang: string;
  name: string;
  default?: boolean;
  localService?: boolean;
  voiceURI?: string;
}

// The browser API has no gender field. These names are preference hints, not
// a claim that an unknown/default voice is female or that quality is measured.
const FEMALE_NAMES = /\b(samantha|ava|allison|zoe|aria|jenny|zira|joanna|salli)\b/i;
const QUALITY_NAMES = /\b(natural|enhanced|premium)\b/i;
export const PRONUNCIATION_RATE = 0.95;

export function isAmericanVoice(voice: VoiceLike): boolean {
  return /^en-us(?:-|$)/i.test(voice.lang.replace(/_/g, "-"));
}

export function scoreAmericanVoice(voice: VoiceLike): number {
  if (!isAmericanVoice(voice)) return 0;
  let score = 100;
  if (FEMALE_NAMES.test(voice.name)) score += 40;
  if (QUALITY_NAMES.test(voice.name)) score += 20;
  if (voice.localService) score += 2;
  if (voice.default) score += 1;
  return score;
}

export function selectAmericanVoice<T extends VoiceLike>(voices: readonly T[], voiceURI?: string | null): T | null {
  const selected = voiceURI && voices.find(voice => voice.voiceURI === voiceURI && isAmericanVoice(voice));
  if (selected) return selected;
  const ranked = voices
    .map((voice, index) => ({ voice, index, score: scoreAmericanVoice(voice) }))
    .filter((candidate) => candidate.score >= 100)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return ranked[0]?.voice ?? null;
}
