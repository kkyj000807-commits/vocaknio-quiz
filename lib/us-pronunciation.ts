export interface VoiceLike {
  lang: string;
  name: string;
  default?: boolean;
  localService?: boolean;
}

const QUALITY_NAMES = [
  "natural",
  "enhanced",
  "premium",
  "samantha",
  "ava",
  "allison",
  "zoe",
  "aria",
  "jenny",
  "guy",
  "google us english",
];

export function scoreAmericanVoice(voice: VoiceLike): number {
  const language = voice.lang.toLowerCase().replace("_", "-");
  const name = voice.name.toLowerCase();
  let score = 0;
  if (language === "en-us") score += 100;
  else if (language.startsWith("en-us-")) score += 95;
  else if (language.startsWith("en")) score += 10;
  if (QUALITY_NAMES.some((hint) => name.includes(hint))) score += 20;
  if (voice.localService) score += 2;
  if (voice.default && language.startsWith("en-us")) score += 1;
  return score;
}

export function selectAmericanVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const ranked = voices
    .map((voice, index) => ({ voice, index, score: scoreAmericanVoice(voice) }))
    .filter((candidate) => candidate.score >= 100)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return ranked[0]?.voice ?? null;
}
