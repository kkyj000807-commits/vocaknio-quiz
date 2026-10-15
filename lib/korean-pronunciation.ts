/**
 * A deliberately lossy reading aid for an already trusted US IPA transcription.
 * Not an IPA validator, spelling-to-sound engine, or official Korean loanword name.
 * Korean cannot retain English stress, vowel length, rhoticity, /f v θ ð/ or all
 * vowel contrasts. Keep the original IPA and audio beside this optional aid.
 *
 * Mapping reference (not a claim that this implements every official rule):
 * National Institute of Korean Language, foreign-word notation / IPA table:
 * https://korean.go.kr/kornorms/main/main.do
 * https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=261&pageIndex=1&qna_seq=308562
 */

type Sound = { value: string; vowel: boolean; long: boolean };

const VOWELS: Record<string, number[]> = {
  i: [20], ɪ: [20], e: [5], ɛ: [5], æ: [1], a: [0], ɑ: [0], ɒ: [0],
  ə: [4], ʌ: [4], ɚ: [4], ɝ: [4], ɔ: [8], o: [8], u: [13], ʊ: [13],
  aɪ: [0, 20], aʊ: [0, 13], eɪ: [5, 20], oʊ: [8, 13], ɔɪ: [8, 20],
};
const INITIALS: Record<string, number> = {
  p: 17, b: 7, t: 16, d: 3, k: 15, g: 0, f: 17, v: 7,
  s: 9, z: 12, θ: 9, ð: 3, ʃ: 9, ʒ: 12, tʃ: 14, dʒ: 12,
  m: 6, n: 2, l: 5, r: 5, h: 18,
};
const CODAS: Record<string, number> = { m: 16, n: 4, ŋ: 21, l: 8, p: 17, t: 19, k: 1 };
const EPENTHETIC: Record<string, string> = {
  p: "프", b: "브", t: "트", d: "드", k: "크", g: "그", f: "프", v: "브",
  s: "스", z: "즈", θ: "스", ð: "드", ʃ: "시", ʒ: "지", tʃ: "치", dʒ: "지",
  m: "므", n: "느", l: "르", r: "르", h: "흐",
};
const PALATAL: Record<number, number> = { 0: 2, 1: 3, 4: 6, 5: 7, 8: 12, 13: 17, 20: 20 };
const LABIAL: Record<number, number> = { 0: 9, 1: 10, 4: 14, 5: 15, 8: 8, 13: 13, 20: 16 };
const ONSET_CLUSTERS = new Set([
  "pr", "pl", "br", "bl", "tr", "dr", "kr", "kl", "gr", "gl", "fr", "fl", "θr",
  "sp", "st", "sk", "sm", "sn", "sl", "sw", "tw", "dw", "kw", "gw", "ʃr",
  "spr", "spl", "str", "skr", "skl", "skw",
]);

function syllable(initial: number, vowel: number): string {
  return String.fromCharCode(0xac00 + (initial * 21 + vowel) * 28);
}

function addCoda(output: string[], consonant: string): boolean {
  const last = output.at(-1);
  const coda = CODAS[consonant];
  if (!last || coda === undefined) return false;
  const code = last.charCodeAt(0) - 0xac00;
  if (last.length !== 1 || code < 0 || code > 11171 || code % 28 !== 0) return false;
  output[output.length - 1] = String.fromCharCode(0xac00 + code + coda);
  return true;
}

function parseIpa(ipa: string): Sound[] | null {
  const wrapped = ipa.trim();
  // Requiring IPA delimiters also prevents accidentally transliterating a headword.
  if (!((wrapped.startsWith("/") && wrapped.endsWith("/"))
    || (wrapped.startsWith("[") && wrapped.endsWith("]")))) return null;
  const body = wrapped.slice(1, -1).replace(/t͡ʃ/g, "tʃ").replace(/d͡ʒ/g, "dʒ").replace(/ɹ/g, "r").replace(/ɡ/g, "g");
  if (!body || body.length > 128 || /\s/.test(body)) return null;
  const result: Sound[] = [];
  for (let index = 0; index < body.length;) {
    const ch = body[index];
    if (ch === "ˈ" || ch === "ˌ" || ch === ".") { index++; continue; }
    if (ch === "ː") {
      const previous = result.at(-1);
      if (!previous?.vowel || previous.long) return null;
      previous.long = true;
      index++;
      continue;
    }
    const pair = body.slice(index, index + 2);
    const value = pair in VOWELS || pair === "tʃ" || pair === "dʒ" ? pair : ch;
    const vowel = value in VOWELS;
    if (!vowel && !(value in INITIALS) && !["ŋ", "j", "w"].includes(value)) return null;
    // Geminates require boundary/allophone knowledge outside this helper.
    if (!vowel && result.at(-1)?.value === value) return null;
    result.push({ value, vowel, long: ["ɚ", "ɝ"].includes(value) });
    index += value.length;
  }
  const vowelCount = result.filter(sound => sound.vowel).length;
  return vowelCount > 0 && vowelCount <= 12 ? result : null;
}

function renderOnset(output: string[], cluster: string[], vowel: Sound): boolean {
  const vowels = [...VOWELS[vowel.value]];
  const glide = ["j", "w"].includes(cluster.at(-1) ?? "") ? cluster.pop() : undefined;
  if (glide) {
    // /jɚ/ has reduced, rhotic transitions which this simple Hangul vowel
    // inventory cannot safely distinguish from /jʊr/. Hold rather than print 겨.
    if (glide === "j" && ["ɚ", "ɝ"].includes(vowel.value)) return false;
    if (vowels.length !== 1) return false;
    const combined = (glide === "j" ? PALATAL : LABIAL)[vowels[0]];
    if (combined === undefined) return false;
    vowels[0] = combined;
  }
  // Combining /sw/ directly as 쉬/쉐 hides /s/ versus /ʃ/. Preserve /s/
  // separately (스위/스웨), rather than merging it into a Korean palatal sound.
  if (glide === "w" && cluster.at(-1) === "s") {
    output.push("스");
    cluster.pop();
  }
  if (cluster.includes("ŋ") || cluster.includes("j") || cluster.includes("w")) return false;
  if (cluster.length > 1 && !ONSET_CLUSTERS.has(cluster.join(""))) return false;
  while (cluster.length > 1) {
    const consonant = cluster.shift()!;
    if (!EPENTHETIC[consonant]) return false;
    output.push(EPENTHETIC[consonant]);
  }
  const consonant = cluster[0];
  if (consonant === "l") addCoda(output, "l");
  if (consonant === "ʃ" && !glide) {
    const mapped = PALATAL[vowels[0]];
    if (mapped === undefined) return false;
    vowels[0] = mapped;
  }
  output.push(syllable(consonant ? INITIALS[consonant] : 11, vowels[0]));
  for (const next of vowels.slice(1)) output.push(syllable(11, next));
  return true;
}

function shortVowel(vowel: Sound): boolean {
  return !vowel.long && ["ɪ", "ɛ", "e", "æ", "ʌ", "ə", "ɒ", "ʊ"].includes(vowel.value);
}

function renderNonPrevocalicR(output: string[], vowel: Sound): void {
  // /ɪr/ is not simply /ɪ/: peer, cheer and volunteer need the audible
  // centering transition. Do not apply this to an onset r before a vowel.
  if (["i", "ɪ", "e", "ɛ", "u", "ʊ", "eɪ", "aɪ", "aʊ", "ɔɪ"].includes(vowel.value)) {
    output.push("어");
  }
}

/**
 * Returns a Hangul approximation, or null instead of guessing unsupported input.
 * Unsupported: phrases/alternatives, optional sounds, syllabic consonants,
 * narrow allophones (flaps, aspiration, devoicing, nasalization), unknown vowels,
 * and consonant clusters outside the conservative supported English subset.
 * The caller must independently gate the source IPA's reliability and quiz hints.
 */
export function getKoreanPronunciation(ipa: string | null | undefined): string | null {
  if (typeof ipa !== "string") return null;
  const sounds = parseIpa(ipa);
  if (!sounds) return null;
  const output: string[] = [];
  let cluster: string[] = [];
  let previousVowel: Sound | undefined;
  for (const sound of sounds) {
    if (!sound.vowel) {
      cluster.push(sound.value);
      if (cluster.length > 4) return null;
      continue;
    }
    if (previousVowel && cluster.length === 0 && ["ɚ", "ɝ"].includes(previousVowel.value)) {
      // Rhotic vowels followed by another vowel retain their linking /r/:
      // aberration /æbɚeɪʃən/ must not lose the r and become 애버에이션.
      cluster.push("r");
    }
    if (previousVowel && cluster.length) {
      // Postvocalic r has no faithful Hangul equivalent. Do not insert an extra
      // 르 syllable before another consonant; intervocalic r remains an onset.
      if (cluster[0] === "r" && cluster.length > 1) {
        renderNonPrevocalicR(output, previousVowel);
        cluster.shift();
      }
      const first = cluster[0];
      if (first === "l" || (cluster.length > 1 && ["m", "n", "ŋ"].includes(first))) {
        if (!addCoda(output, first)) return null;
        if (cluster.length > 1) cluster.shift();
      } else if (cluster.length > 1 && shortVowel(previousVowel)
        && ["p", "t", "k"].includes(first) && !["l", "r", "m", "n", "w", "j"].includes(cluster[1])) {
        if (!addCoda(output, first)) return null;
        cluster.shift();
      }
    }
    if (!renderOnset(output, [...cluster], sound)) return null;
    cluster = [];
    previousVowel = sound;
  }
  if (cluster[0] === "r") {
    if (previousVowel) renderNonPrevocalicR(output, previousVowel);
    cluster.shift();
  }
  for (let index = 0; index < cluster.length; index++) {
    const consonant = cluster[index];
    if (["m", "n", "ŋ", "l"].includes(consonant)) {
      if (!addCoda(output, consonant)) return null;
    } else if (index === 0 && previousVowel && shortVowel(previousVowel)
      && ["p", "t", "k"].includes(consonant)) {
      if (!addCoda(output, consonant)) return null;
    } else {
      if (!EPENTHETIC[consonant] || ["h", "r"].includes(consonant)) return null;
      output.push(EPENTHETIC[consonant]);
    }
  }
  const result = output.join("");
  return /^[가-힣]{1,32}$/.test(result) ? result : null;
}
