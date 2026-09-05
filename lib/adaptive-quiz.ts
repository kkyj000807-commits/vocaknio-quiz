export const ADAPTIVE_HISTORY_SCHEMA_VERSION = 1 as const;

const MAX_RECENT_SESSIONS = 12;
const MAX_SEEN_SESSION_IDS = 128;
const MAX_PROCESSED_ANSWERS = 512;
const MAX_CONFUSIONS = 3;

export type AdaptiveOutcome = "correct" | "wrong" | "skip" | "mastered";

export interface AdaptiveCandidate {
  num: number;
  conceptId?: string;
  word?: string;
}

export interface AdaptiveConfusion {
  key: string;
  count: number;
}

export interface AdaptiveItemStats {
  mode: string;
  num: number;
  exposures: number;
  attempts: number;
  correct: number;
  wrong: number;
  skips: number;
  mastered: number;
  wrongStreak: number;
  lastSeenSequence: number;
  lastAnsweredAt: number;
  lastOutcome: AdaptiveOutcome | null;
  confusions: AdaptiveConfusion[];
}

export interface AdaptiveSession {
  sessionId: string;
  rangeId: string;
  mode: string;
  sequence: number;
  itemNums: number[];
}

export interface AdaptiveHistory {
  schemaVersion: typeof ADAPTIVE_HISTORY_SCHEMA_VERSION;
  revision: number;
  nextSessionSequence: number;
  stats: Record<string, AdaptiveItemStats>;
  recentSessions: AdaptiveSession[];
  seenSessionIds: string[];
  processedAnswerKeys: string[];
}

export interface SelectAdaptiveItemNumsOptions {
  candidates: AdaptiveCandidate[];
  count: number;
  mode: string;
  rangeId?: string;
  history: AdaptiveHistory;
  legacyWrongNums?: number[];
  random?: () => number;
}

export interface AdaptiveSessionInput {
  sessionId: string;
  rangeId: string;
  mode: string;
  itemNums: number[];
}

export interface AdaptiveAnswerInput {
  sessionId: string;
  itemNum: number;
  mode: string;
  outcome: AdaptiveOutcome;
  /** 오답으로 고른 단어/뜻/개념의 안정 키. 중복 응답 식별자는 아니다. */
  responseKey?: string;
  answeredAt?: number;
}

type CompactItemStats = [
  mode: string,
  num: number,
  exposures: number,
  attempts: number,
  correct: number,
  wrong: number,
  skips: number,
  mastered: number,
  wrongStreak: number,
  lastSeenSequence: number,
  lastAnsweredAt: number,
  lastOutcome: "c" | "w" | "s" | "m" | "",
  confusions: [key: string, count: number][],
];

type CompactSession = [
  sessionId: string,
  rangeId: string,
  mode: string,
  sequence: number,
  itemNums: number[],
];

type CompactHistory = [
  schemaVersion: 1,
  revision: number,
  nextSessionSequence: number,
  stats: CompactItemStats[],
  recentSessions: CompactSession[],
  seenSessionIds: string[],
  processedAnswerKeys: string[],
];

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePromptWord(value: unknown): string {
  return cleanString(value).toLowerCase().replace(/\s+/g, " ");
}

function isAdaptiveOutcome(value: unknown): value is AdaptiveOutcome {
  return (
    value === "correct" ||
    value === "wrong" ||
    value === "skip" ||
    value === "mastered"
  );
}

function statsKey(mode: string, num: number): string {
  return `${mode}\u0000${num}`;
}

function answerKey(sessionId: string, mode: string, itemNum: number): string {
  return `${sessionId}\u0000${mode}\u0000${itemNum}`;
}

function uniqueRecentStrings(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = cleanString(values[index]);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output.reverse();
}

function uniqueNums(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const output: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const num = positiveInteger(value);
    if (num === null || seen.has(num)) continue;
    seen.add(num);
    output.push(num);
  }
  return output;
}

function sanitizeConfusions(value: unknown): AdaptiveConfusion[] {
  if (!Array.isArray(value)) return [];
  const counts = new Map<string, number>();
  for (const entry of value) {
    let key = "";
    let count = 0;
    if (Array.isArray(entry)) {
      key = cleanString(entry[0]);
      count = nonNegativeInteger(entry[1]);
    } else if (entry && typeof entry === "object") {
      const candidate = entry as Partial<AdaptiveConfusion>;
      key = cleanString(candidate.key);
      count = nonNegativeInteger(candidate.count);
    }
    if (!key || count <= 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.key.localeCompare(right.key),
    )
    .slice(0, MAX_CONFUSIONS);
}

function emptyStats(mode: string, num: number): AdaptiveItemStats {
  return {
    mode,
    num,
    exposures: 0,
    attempts: 0,
    correct: 0,
    wrong: 0,
    skips: 0,
    mastered: 0,
    wrongStreak: 0,
    lastSeenSequence: 0,
    lastAnsweredAt: 0,
    lastOutcome: null,
    confusions: [],
  };
}

function sanitizeStats(
  value: unknown,
  fallbackMode = "",
  fallbackNum = 0,
): AdaptiveItemStats | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AdaptiveItemStats>;
  const mode = cleanString(candidate.mode) || fallbackMode;
  const num = positiveInteger(candidate.num) ?? positiveInteger(fallbackNum);
  if (!mode || num === null) return null;

  const correct = nonNegativeInteger(candidate.correct);
  const wrong = nonNegativeInteger(candidate.wrong);
  const skips = nonNegativeInteger(candidate.skips);
  const attempts = Math.max(
    nonNegativeInteger(candidate.attempts),
    correct + wrong + skips,
  );
  const mastered = Math.min(nonNegativeInteger(candidate.mastered), correct);
  const lastOutcome = isAdaptiveOutcome(candidate.lastOutcome)
    ? candidate.lastOutcome
    : null;

  return {
    mode,
    num,
    exposures: nonNegativeInteger(candidate.exposures),
    attempts,
    correct,
    wrong,
    skips,
    mastered,
    wrongStreak: Math.min(nonNegativeInteger(candidate.wrongStreak), attempts),
    lastSeenSequence: nonNegativeInteger(candidate.lastSeenSequence),
    lastAnsweredAt: nonNegativeInteger(candidate.lastAnsweredAt),
    lastOutcome,
    confusions: sanitizeConfusions(candidate.confusions),
  };
}

function sanitizeSession(value: unknown): AdaptiveSession | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AdaptiveSession>;
  const sessionId = cleanString(candidate.sessionId);
  const mode = cleanString(candidate.mode);
  if (!sessionId || !mode) return null;
  return {
    sessionId,
    rangeId: cleanString(candidate.rangeId),
    mode,
    sequence: nonNegativeInteger(candidate.sequence),
    itemNums: uniqueNums(candidate.itemNums),
  };
}

function outcomeCode(outcome: AdaptiveOutcome | null): CompactItemStats[11] {
  if (outcome === "correct") return "c";
  if (outcome === "wrong") return "w";
  if (outcome === "skip") return "s";
  if (outcome === "mastered") return "m";
  return "";
}

function decodeOutcome(code: unknown): AdaptiveOutcome | null {
  if (code === "c") return "correct";
  if (code === "w") return "wrong";
  if (code === "s") return "skip";
  if (code === "m") return "mastered";
  return null;
}

function compactToObject(value: unknown): unknown {
  if (!Array.isArray(value) || value[0] !== ADAPTIVE_HISTORY_SCHEMA_VERSION)
    return value;
  const stats: Record<string, AdaptiveItemStats> = {};
  if (Array.isArray(value[3])) {
    for (const raw of value[3]) {
      if (!Array.isArray(raw)) continue;
      const mode = cleanString(raw[0]);
      const num = positiveInteger(raw[1]);
      if (!mode || num === null) continue;
      const item = sanitizeStats(
        {
          mode,
          num,
          exposures: raw[2],
          attempts: raw[3],
          correct: raw[4],
          wrong: raw[5],
          skips: raw[6],
          mastered: raw[7],
          wrongStreak: raw[8],
          lastSeenSequence: raw[9],
          lastAnsweredAt: raw[10],
          lastOutcome: decodeOutcome(raw[11]),
          confusions: raw[12],
        },
        mode,
        num,
      );
      if (item) stats[statsKey(mode, num)] = item;
    }
  }

  const recentSessions: AdaptiveSession[] = [];
  if (Array.isArray(value[4])) {
    for (const raw of value[4]) {
      if (!Array.isArray(raw)) continue;
      const session = sanitizeSession({
        sessionId: raw[0],
        rangeId: raw[1],
        mode: raw[2],
        sequence: raw[3],
        itemNums: raw[4],
      });
      if (session) recentSessions.push(session);
    }
  }

  return {
    schemaVersion: value[0],
    revision: value[1],
    nextSessionSequence: value[2],
    stats,
    recentSessions,
    seenSessionIds: value[5],
    processedAnswerKeys: value[6],
  };
}

export function createEmptyAdaptiveHistory(): AdaptiveHistory {
  return {
    schemaVersion: ADAPTIVE_HISTORY_SCHEMA_VERSION,
    revision: 0,
    nextSessionSequence: 1,
    stats: {},
    recentSessions: [],
    seenSessionIds: [],
    processedAnswerKeys: [],
  };
}

export function sanitizeAdaptiveHistory(value: unknown): AdaptiveHistory {
  if (typeof value === "string") {
    try {
      return sanitizeAdaptiveHistory(JSON.parse(value));
    } catch {
      return createEmptyAdaptiveHistory();
    }
  }

  const expanded = compactToObject(value);
  if (!expanded || typeof expanded !== "object")
    return createEmptyAdaptiveHistory();
  const candidate = expanded as Partial<AdaptiveHistory>;
  if (candidate.schemaVersion !== ADAPTIVE_HISTORY_SCHEMA_VERSION) {
    return createEmptyAdaptiveHistory();
  }

  const stats: Record<string, AdaptiveItemStats> = {};
  if (
    candidate.stats &&
    typeof candidate.stats === "object" &&
    !Array.isArray(candidate.stats)
  ) {
    for (const [key, value] of Object.entries(candidate.stats)) {
      const separator = key.lastIndexOf("\u0000");
      const fallbackMode = separator >= 0 ? key.slice(0, separator) : "";
      const fallbackNum = separator >= 0 ? Number(key.slice(separator + 1)) : 0;
      const item = sanitizeStats(value, fallbackMode, fallbackNum);
      if (item) stats[statsKey(item.mode, item.num)] = item;
    }
  }

  const sessionMap = new Map<string, AdaptiveSession>();
  if (Array.isArray(candidate.recentSessions)) {
    for (const value of candidate.recentSessions) {
      const session = sanitizeSession(value);
      if (session) sessionMap.set(session.sessionId, session);
    }
  }
  const recentSessions = [...sessionMap.values()]
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.sessionId.localeCompare(right.sessionId),
    )
    .slice(-MAX_RECENT_SESSIONS);
  const maxSequence = recentSessions.reduce(
    (maximum, session) => Math.max(maximum, session.sequence),
    0,
  );
  const seenSessionIds = uniqueRecentStrings(
    [
      ...(Array.isArray(candidate.seenSessionIds)
        ? candidate.seenSessionIds
        : []),
      ...recentSessions.map((s) => s.sessionId),
    ],
    MAX_SEEN_SESSION_IDS,
  );

  return {
    schemaVersion: ADAPTIVE_HISTORY_SCHEMA_VERSION,
    revision: nonNegativeInteger(candidate.revision),
    nextSessionSequence: Math.max(
      1,
      nonNegativeInteger(candidate.nextSessionSequence, 1),
      maxSequence + 1,
    ),
    stats,
    recentSessions,
    seenSessionIds,
    processedAnswerKeys: uniqueRecentStrings(
      candidate.processedAnswerKeys,
      MAX_PROCESSED_ANSWERS,
    ),
  };
}

export function serializeAdaptiveHistory(history: AdaptiveHistory): string {
  const safe = sanitizeAdaptiveHistory(history);
  const compactStats: CompactItemStats[] = Object.values(safe.stats)
    .sort(
      (left, right) =>
        left.mode.localeCompare(right.mode) || left.num - right.num,
    )
    .map((item) => [
      item.mode,
      item.num,
      item.exposures,
      item.attempts,
      item.correct,
      item.wrong,
      item.skips,
      item.mastered,
      item.wrongStreak,
      item.lastSeenSequence,
      item.lastAnsweredAt,
      outcomeCode(item.lastOutcome),
      item.confusions.map((confusion) => [confusion.key, confusion.count]),
    ]);
  const compactSessions: CompactSession[] = safe.recentSessions.map(
    (session) => [
      session.sessionId,
      session.rangeId,
      session.mode,
      session.sequence,
      session.itemNums,
    ],
  );
  const compact: CompactHistory = [
    ADAPTIVE_HISTORY_SCHEMA_VERSION,
    safe.revision,
    safe.nextSessionSequence,
    compactStats,
    compactSessions,
    safe.seenSessionIds,
    safe.processedAnswerKeys,
  ];
  return JSON.stringify(compact);
}

export function deserializeAdaptiveHistory(
  raw: string | null | undefined,
): AdaptiveHistory {
  if (!raw) return createEmptyAdaptiveHistory();
  try {
    return sanitizeAdaptiveHistory(JSON.parse(raw));
  } catch {
    return createEmptyAdaptiveHistory();
  }
}

function cloneForUpdate(history: AdaptiveHistory): AdaptiveHistory {
  return sanitizeAdaptiveHistory(history);
}

function getOrCreateStats(
  history: AdaptiveHistory,
  mode: string,
  num: number,
): AdaptiveItemStats {
  const key = statsKey(mode, num);
  const existing = history.stats[key];
  if (existing) return existing;
  const created = emptyStats(mode, num);
  history.stats[key] = created;
  return created;
}

export function recordAdaptiveSession(
  history: AdaptiveHistory,
  input: AdaptiveSessionInput,
): AdaptiveHistory {
  const next = cloneForUpdate(history);
  const sessionId = cleanString(input.sessionId);
  const rangeId = cleanString(input.rangeId);
  const mode = cleanString(input.mode);
  const itemNums = uniqueNums(input.itemNums);
  if (!sessionId || !mode || itemNums.length === 0) return next;
  if (next.seenSessionIds.includes(sessionId)) return next;

  const sequence = next.nextSessionSequence;
  next.nextSessionSequence += 1;
  for (const num of itemNums) {
    const stats = getOrCreateStats(next, mode, num);
    stats.exposures += 1;
    stats.lastSeenSequence = sequence;
  }
  next.recentSessions = [
    ...next.recentSessions,
    { sessionId, rangeId, mode, sequence, itemNums },
  ].slice(-MAX_RECENT_SESSIONS);
  next.seenSessionIds = [...next.seenSessionIds, sessionId].slice(
    -MAX_SEEN_SESSION_IDS,
  );
  next.revision += 1;
  return next;
}

function addConfusion(stats: AdaptiveItemStats, responseKey: string): void {
  const key = cleanString(responseKey);
  if (!key) return;
  const existing = stats.confusions.find((confusion) => confusion.key === key);
  if (existing) {
    existing.count += 1;
  } else if (stats.confusions.length < MAX_CONFUSIONS) {
    stats.confusions.push({ key, count: 1 });
  } else {
    // Space-Saving 방식의 bounded heavy hitters: 새 혼동도 반복되면 기존
    // 최저 빈도 항목을 밀어낼 수 있으면서 저장 크기는 항상 3개로 유지한다.
    const weakest = [...stats.confusions].sort(
      (left, right) =>
        left.count - right.count || right.key.localeCompare(left.key),
    )[0];
    const index = stats.confusions.indexOf(weakest);
    stats.confusions[index] = { key, count: weakest.count + 1 };
  }
  stats.confusions = stats.confusions
    .sort(
      (left, right) =>
        right.count - left.count || left.key.localeCompare(right.key),
    )
    .slice(0, MAX_CONFUSIONS);
}

export function recordAdaptiveAnswer(
  history: AdaptiveHistory,
  input: AdaptiveAnswerInput,
): AdaptiveHistory {
  const next = cloneForUpdate(history);
  const sessionId = cleanString(input.sessionId);
  const mode = cleanString(input.mode);
  const itemNum = positiveInteger(input.itemNum);
  if (
    !sessionId ||
    !mode ||
    itemNum === null ||
    !isAdaptiveOutcome(input.outcome)
  )
    return next;

  const processedKey = answerKey(sessionId, mode, itemNum);
  if (next.processedAnswerKeys.includes(processedKey)) return next;

  const stats = getOrCreateStats(next, mode, itemNum);
  stats.attempts += 1;
  stats.lastOutcome = input.outcome;
  stats.lastAnsweredAt = nonNegativeInteger(input.answeredAt);
  if (input.outcome === "correct") {
    stats.correct += 1;
    stats.wrongStreak = 0;
  } else if (input.outcome === "mastered") {
    stats.correct += 1;
    stats.mastered += 1;
    stats.wrongStreak = 0;
  } else if (input.outcome === "wrong") {
    stats.wrong += 1;
    stats.wrongStreak += 1;
    addConfusion(stats, input.responseKey ?? "");
  } else {
    stats.skips += 1;
    stats.wrongStreak += 1;
    addConfusion(stats, input.responseKey ?? "");
  }

  next.processedAnswerKeys = [...next.processedAnswerKeys, processedKey].slice(
    -MAX_PROCESSED_ANSWERS,
  );
  next.revision += 1;
  return next;
}

function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function safeRandom(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value)) return 0.5;
  return ((value % 1) + 1) % 1;
}

interface RankedCandidate extends AdaptiveCandidate {
  conceptId?: string;
  stats: AdaptiveItemStats;
  tie: number;
  weakness: number;
}

function conceptWeakness(
  candidates: AdaptiveCandidate[],
  mode: string,
  history: AdaptiveHistory,
): Map<string, number> {
  const totals = new Map<string, { attempts: number; failures: number }>();
  for (const candidate of candidates) {
    const conceptId = cleanString(candidate.conceptId);
    if (!conceptId) continue;
    const stats = history.stats[statsKey(mode, candidate.num)];
    if (!stats || stats.attempts <= 0) continue;
    const total = totals.get(conceptId) ?? { attempts: 0, failures: 0 };
    total.attempts += stats.attempts;
    total.failures += stats.wrong + stats.skips;
    totals.set(conceptId, total);
  }
  return new Map(
    [...totals.entries()].map(([conceptId, total]) => [
      conceptId,
      total.attempts > 0 ? total.failures / total.attempts : 0,
    ]),
  );
}

interface ConfusionPriority {
  item: Map<number, number>;
  concept: Map<string, number>;
}

function addPriority<K>(scores: Map<K, number>, key: K, value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  scores.set(key, (scores.get(key) ?? 0) + value);
}

/**
 * Turns the bounded response-key history into later review signals.
 *
 * Current choice screens store the selected wrong word as `responseKey`, so a
 * normalized word match promotes that exact candidate and one peer from its
 * concept. Stable `num:` / `concept:` / `word:` prefixes are also understood
 * for callers that can provide a more explicit key later.
 */
function confusionPriority(
  candidates: AdaptiveCandidate[],
  mode: string,
  history: AdaptiveHistory,
): ConfusionPriority {
  const item = new Map<number, number>();
  const concept = new Map<string, number>();
  const candidatesByNum = new Map(
    candidates.map((candidate) => [candidate.num, candidate]),
  );
  const candidatesByWord = new Map<string, AdaptiveCandidate[]>();
  for (const candidate of candidates) {
    const word = normalizePromptWord(candidate.word);
    if (!word) continue;
    const matches = candidatesByWord.get(word) ?? [];
    matches.push(candidate);
    candidatesByWord.set(word, matches);
  }

  const currentSequence = Math.max(0, history.nextSessionSequence - 1);
  for (const stats of Object.values(history.stats)) {
    if (stats.mode !== mode || stats.confusions.length === 0) continue;
    const age = Math.max(0, currentSequence - stats.lastSeenSequence);
    const recency = 1 + 2 / (age + 1);
    const totalConfusions = stats.confusions.reduce(
      (sum, confusion) => sum + confusion.count,
      0,
    );
    const sourceCandidate = candidatesByNum.get(stats.num);
    if (sourceCandidate) {
      addPriority(item, sourceCandidate.num, totalConfusions * recency);
      const sourceConcept = cleanString(sourceCandidate.conceptId);
      if (sourceConcept)
        addPriority(concept, sourceConcept, totalConfusions * recency * 0.5);
    }

    for (const confusion of stats.confusions) {
      const rawKey = cleanString(confusion.key);
      if (!rawKey) continue;
      const signal = confusion.count * recency;
      const explicitNum = /^num:(\d+)$/i.exec(rawKey);
      const explicitConcept = /^concept:(.+)$/i.exec(rawKey);
      const explicitWord = /^word:(.+)$/i.exec(rawKey);
      const matched: AdaptiveCandidate[] = [];

      if (explicitNum) {
        const candidate = candidatesByNum.get(Number(explicitNum[1]));
        if (candidate) matched.push(candidate);
      } else if (explicitConcept) {
        const conceptId = cleanString(explicitConcept[1]);
        if (conceptId) addPriority(concept, conceptId, signal);
      } else {
        const word = normalizePromptWord(explicitWord?.[1] ?? rawKey);
        matched.push(...(candidatesByWord.get(word) ?? []));
      }

      const matchedConcepts = new Set<string>();
      for (const candidate of matched) {
        addPriority(item, candidate.num, signal);
        const conceptId = cleanString(candidate.conceptId);
        if (conceptId) matchedConcepts.add(conceptId);
      }
      for (const conceptId of matchedConcepts)
        addPriority(concept, conceptId, signal * 0.75);
    }
  }
  return { item, concept };
}

function weaknessScore(
  candidate: AdaptiveCandidate,
  stats: AdaptiveItemStats,
  legacyWrong: Set<number>,
  conceptScores: Map<string, number>,
  confusionScores: ConfusionPriority,
): number {
  // A successful latest answer resolves the old mistake; the notebook remains intact.
  if (stats.lastOutcome === "correct" || stats.lastOutcome === "mastered") return 0;
  const failures = stats.wrong + stats.skips;
  const errorRate = stats.attempts > 0 ? failures / stats.attempts : 0;
  const skipRate = stats.attempts > 0 ? stats.skips / stats.attempts : 0;
  const recentFailure =
    stats.lastOutcome === "skip" ? 2.5 : stats.lastOutcome === "wrong" ? 2 : 0;
  const legacy = legacyWrong.has(candidate.num) && stats.attempts === 0 ? 2 : 0;
  const concept = conceptScores.get(cleanString(candidate.conceptId)) ?? 0;
  const confusion = confusionScores.item.get(candidate.num) ?? 0;
  const conceptConfusion =
    confusionScores.concept.get(cleanString(candidate.conceptId)) ?? 0;
  return (
    legacy +
    recentFailure +
    Math.min(stats.wrongStreak, 4) * 1.25 +
    errorRate * 3 +
    skipRate * 1.5 +
    concept * 1.5 +
    Math.min(confusion, 12) * 1.5 +
    Math.min(conceptConfusion, 12) * 0.5
  );
}

function selectWithConceptDiversity(
  ranked: RankedCandidate[],
  limit: number,
  selectedNums: Set<number>,
  usedConcepts: Set<string>,
  usedWords: Set<string>,
  allowRepeatedWords = true,
): RankedCandidate[] {
  const selected: RankedCandidate[] = [];
  const trySelect = (candidate: RankedCandidate, enforceConcept: boolean) => {
    if (selected.length >= limit || selectedNums.has(candidate.num)) return;
    const conceptId = cleanString(candidate.conceptId);
    const word = normalizePromptWord(candidate.word);
    if (!allowRepeatedWords && word && usedWords.has(word)) return;
    if (
      enforceConcept &&
      ((conceptId && usedConcepts.has(conceptId)) ||
        (word && usedWords.has(word)))
    )
      return;
    selected.push(candidate);
    selectedNums.add(candidate.num);
    if (conceptId) usedConcepts.add(conceptId);
    if (word) usedWords.add(word);
  };

  for (const candidate of ranked) trySelect(candidate, true);
  if (selected.length < limit) {
    for (const candidate of ranked) trySelect(candidate, false);
  }
  return selected;
}

export function selectAdaptiveItemNums(
  options: SelectAdaptiveItemNumsOptions,
): number[] {
  const mode = cleanString(options.mode);
  const requestedCount = nonNegativeInteger(options.count);
  if (!mode || requestedCount <= 0 || !Array.isArray(options.candidates))
    return [];

  const candidateMap = new Map<number, AdaptiveCandidate>();
  for (const raw of options.candidates) {
    if (!raw || typeof raw !== "object") continue;
    const num = positiveInteger(raw.num);
    if (num === null || candidateMap.has(num)) continue;
    const conceptId = cleanString(raw.conceptId);
    const word = cleanString(raw.word);
    candidateMap.set(num, {
      num,
      ...(conceptId ? { conceptId } : {}),
      ...(word ? { word } : {}),
    });
  }
  const allCandidates = [...candidateMap.values()].sort(
    (left, right) => left.num - right.num,
  );
  const count = Math.min(requestedCount, allCandidates.length);
  if (count <= 0) return [];

  const history = sanitizeAdaptiveHistory(options.history);
  // Different source rows for the same prompt share exposure and answer history.
  const promptKey = (candidate: AdaptiveCandidate) =>
    normalizePromptWord(candidate.word) || `num:${candidate.num}`;
  const promptStats = new Map<string, AdaptiveItemStats>();
  for (const candidate of allCandidates) {
    const key = promptKey(candidate);
    const stats = history.stats[statsKey(mode, candidate.num)] ?? emptyStats(mode, candidate.num);
    const previous = promptStats.get(key);
    if (!previous) {
      promptStats.set(key, { ...stats });
      continue;
    }
    const latest = stats.lastAnsweredAt >= previous.lastAnsweredAt && stats.lastOutcome !== null ? stats : previous;
    promptStats.set(key, {
      ...latest,
      exposures: previous.exposures + stats.exposures,
      attempts: previous.attempts + stats.attempts,
      correct: previous.correct + stats.correct,
      wrong: previous.wrong + stats.wrong,
      skips: previous.skips + stats.skips,
      mastered: previous.mastered + stats.mastered,
      lastSeenSequence: Math.max(previous.lastSeenSequence, stats.lastSeenSequence),
    });
  }
  const recent = history.recentSessions.filter((session) =>
    session.mode === mode && session.itemNums.some((num) => candidateMap.has(num)),
  );
  const protection = new Map<string, number>();
  recent.slice(-3).forEach((session, index, sessions) => {
    session.itemNums.forEach((num) => {
      const candidate = candidateMap.get(num);
      if (!candidate) return;
      const key = promptKey(candidate);
      const outcome = promptStats.get(key)?.lastOutcome;
      if (index === sessions.length - 1 || outcome === "correct" || outcome === "mastered") {
        protection.set(key, index + 1);
      }
    });
  });
  const legacyWrong = new Set(uniqueNums(options.legacyWrongNums));
  const conceptScores = conceptWeakness(allCandidates, mode, history);
  const confusionScores = confusionPriority(allCandidates, mode, history);
  const defaultSeed = hashSeed(
    `${mode}|${history.revision}|${history.nextSessionSequence}|${allCandidates
      .map((candidate) => candidate.num)
      .join(",")}`,
  );
  const random = options.random ?? seededRandom(defaultSeed);

  const ranked: RankedCandidate[] = allCandidates.map((candidate) => {
    const stats = promptStats.get(promptKey(candidate))!;
    return {
      ...candidate,
      stats,
      tie: safeRandom(random),
      weakness: weaknessScore(
        candidate,
        stats,
        legacyWrong,
        conceptScores,
        confusionScores,
      ),
    };
  });

  const reviewLimit = Math.floor(count * 0.25);
  const reviewRanked = ranked
    .filter((candidate) => candidate.weakness > 0 && !protection.has(promptKey(candidate)))
    .sort(
      (left, right) =>
        right.weakness - left.weakness ||
        left.stats.lastSeenSequence - right.stats.lastSeenSequence ||
        left.tie - right.tie ||
        left.num - right.num,
    );
  const coverageRanked = [...ranked].sort(
    (left, right) =>
      (protection.get(promptKey(left)) ?? 0) - (protection.get(promptKey(right)) ?? 0) ||
      left.stats.exposures - right.stats.exposures ||
      Number(left.stats.lastOutcome === "correct" || left.stats.lastOutcome === "mastered") -
        Number(right.stats.lastOutcome === "correct" || right.stats.lastOutcome === "mastered") ||
      left.stats.lastSeenSequence - right.stats.lastSeenSequence ||
      left.tie - right.tie ||
      left.num - right.num,
  );

  const selectedNums = new Set<number>();
  const usedConcepts = new Set<string>();
  const usedWords = new Set<string>();
  const review = selectWithConceptDiversity(
    reviewRanked,
    reviewLimit,
    selectedNums,
    usedConcepts,
    usedWords,
    false,
  );
  // Do not let concept diversity jump over unseen words to a recently correct prompt.
  const coverage: RankedCandidate[] = [];
  for (const tier of [...new Set(coverageRanked.map((candidate) => protection.get(promptKey(candidate)) ?? 0))].sort((a, b) => a - b)) {
    const pool = coverageRanked.filter((candidate) => (protection.get(promptKey(candidate)) ?? 0) === tier);
    for (const seen of [false, true]) {
      coverage.push(...selectWithConceptDiversity(
        pool.filter((candidate) => (candidate.stats.exposures > 0) === seen),
        count - review.length - coverage.length, selectedNums, usedConcepts, usedWords, false,
      ));
    }
  }
  if (review.length + coverage.length < count) {
    coverage.push(...selectWithConceptDiversity(
      coverageRanked, count - review.length - coverage.length, selectedNums, usedConcepts, usedWords,
    ));
  }
  const selected = [...review, ...coverage];

  // 학습 흐름에서 약점 문제가 한곳에 몰리지 않도록 주입된 RNG로 최종 순서만 섞는다.
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const target = Math.floor(safeRandom(random) * (index + 1));
    [selected[index], selected[target]] = [selected[target], selected[index]];
  }
  return selected.map((candidate) => candidate.num);
}
