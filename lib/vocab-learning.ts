import learningIndexRaw from "@/assets/vocab-learning-index-v1.4.json";
import sharedLinks from "@/assets/shared-sense-links.json";
import type { ReasoningLesson } from "@/lib/reasoning-practice";

export interface LearningSource {
  name: string;
  url: string;
  edition: string;
  license: string;
  attribution?: string;
}

export interface LearningAudio {
  url: string;
  region: "US";
  source: "Wikimedia Commons";
  sourcePage: string;
  license: string;
  attribution: string;
}

export interface LearningEntry {
  sharedBookReferences?: { entryId: string; sourceSha256: string }[];
  id: string;
  senseId: string;
  itemIds: string[];
  headword: string;
  partOfSpeech: string;
  definitionEn: string;
  definitionKind?: "editorial";
  definitionStatus: "production";
  definitionKo: string;
  exactSynonyms?: string[];
  nearSynonyms?: string[];
  relationMeaningsKo?: Record<string, string>;
  memoryKo: string;
  usageKo: string;
  contextExplanationKo: string;
  examTrapKo: string;
  contrasts: Array<{ word: string; noteKo: string }>;
  example: { en: string; ko: string; cueKo?: string; kind: "source" | "editorial" };
  nuance?: {
    register?: string;
    connotation?: string;
    intensity?: { scale: string[]; noteKo: string };
  };
  sources: LearningSource[];
  verification: {
    status: "cross-agreed";
    checkedAtKst: string;
    reviewer: string;
  };
  audio?: LearningAudio;
  reasoning?: ReasoningLesson;
  composition?: {
    parts: Array<{ text: string; roleKo: string }>;
    combinedKo: string;
    limitKo: string;
    policy: string;
    checkedAtKst: string;
  };
}

// One runtime contract for the app loader and the offline book export.
// These links do not create a new sense or grant production eligibility.
export const SHARED_LINK_SCHEMA = 2;
export interface SharedSenseLink {
  itemId: string;
  senseId: string;
  bookEntryId: string;
  headword: string;
  bookOriginalGloss: string;
  definitionKo: string;
  definitionEn: string;
  partOfSpeech: string;
  exampleEn: string;
  exampleKo: string;
}
export interface SharedSenseLinks {
  schema: number;
  contentVersion: string;
  sourceSha256: string;
  review: string;
  links: SharedSenseLink[];
}
export function isSharedSenseLinks(value: unknown): value is SharedSenseLinks {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<SharedSenseLinks>;
  const fields: (keyof SharedSenseLink)[] = [
    "itemId", "senseId", "bookEntryId", "headword", "bookOriginalGloss",
    "definitionKo", "definitionEn", "partOfSpeech", "exampleEn", "exampleKo",
  ];
  if (data.schema !== SHARED_LINK_SCHEMA || typeof data.contentVersion !== "string" ||
      !data.contentVersion || typeof data.sourceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(data.sourceSha256) || typeof data.review !== "string" ||
      !data.review.trim() || !Array.isArray(data.links)) return false;
  const keys = new Set<string>();
  return data.links.every(link => {
    if (!link || typeof link !== "object" ||
        fields.some(field => typeof link[field] !== "string" || !link[field].trim())) return false;
    const identity = `${link.itemId}\0${link.senseId}\0${link.bookEntryId}`;
    if (keys.has(identity)) return false;
    keys.add(identity);
    return true;
  });
}
export function sharedLinkMatches(entry: LearningEntry, link: SharedSenseLink): boolean {
  return entry.itemIds.includes(link.itemId) && entry.senseId === link.senseId &&
    entry.headword === link.headword && entry.definitionKo === link.definitionKo &&
    entry.definitionEn === link.definitionEn && entry.partOfSpeech === link.partOfSpeech &&
    entry.example.en === link.exampleEn && entry.example.ko === link.exampleKo;
}
export function sharedBookReferences(
  entry: LearningEntry, itemId: string, value: unknown = sharedLinks,
): NonNullable<LearningEntry["sharedBookReferences"]> {
  if (!isSharedSenseLinks(value) || value.contentVersion !== LEARNING_INDEX.version) return [];
  return value.links.filter(link => link.itemId === itemId && sharedLinkMatches(entry, link))
    .map(link => ({ entryId: link.bookEntryId, sourceSha256: value.sourceSha256 }));
}

interface LearningIndex {
  version: string;
  coverage: { senses: number; rows: number; checkedAtKst: string };
  items: Record<string, { group: string; entryIds: string[] }>;
}

interface LearningGroupFile {
  version: string;
  group: string;
  entries: LearningEntry[];
}

const LEARNING_INDEX = learningIndexRaw as LearningIndex;
const groupCache = new Map<string, Promise<LearningGroupFile>>();

export const LEARNING_COVERAGE = LEARNING_INDEX.coverage;

export function hasLearningEntry(itemId: string): boolean {
  return Boolean(LEARNING_INDEX.items[itemId]);
}

function getPublicBasePath(): string {
  if (typeof window === "undefined" || typeof window.document === "undefined") return "";
  return window.location.pathname === "/vocaknio-quiz" ||
    window.location.pathname.startsWith("/vocaknio-quiz/")
    ? "/vocaknio-quiz"
    : "";
}

export function isLearningEntry(value: unknown): value is LearningEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LearningEntry>;
  return Boolean(
      entry.id &&
      entry.senseId &&
      entry.headword &&
      entry.definitionEn &&
      entry.definitionStatus === "production" &&
      entry.definitionKo &&
      entry.contextExplanationKo &&
      typeof entry.example?.en === "string" && entry.example.en.trim() &&
      typeof entry.example?.ko === "string" && entry.example.ko.trim() &&
      (entry.example.cueKo === undefined || (typeof entry.example.cueKo === "string" && entry.example.cueKo.trim())) &&
      entry.verification?.status === "cross-agreed" &&
      Array.isArray(entry.itemIds) &&
      Array.isArray(entry.sources),
  );
}

async function loadGroup(group: string): Promise<LearningGroupFile> {
  const cached = groupCache.get(group);
  if (cached) return cached;

  const request = (async () => {
    if (typeof window === "undefined" || typeof window.document === "undefined" || typeof fetch !== "function") {
      throw new Error("깊이 학습 자료는 현재 웹 앱에서 제공합니다.");
    }
    const basePath = getPublicBasePath();
    const url = `${basePath}/data/vocab-learning/${encodeURIComponent(LEARNING_INDEX.version)}/${encodeURIComponent(group.toLowerCase())}.json`;
    // Fixed display versions reuse the data partition. Revalidate on a new
    // page; groupCache still prevents repeat requests within this page.
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`학습 자료 요청 실패: ${response.status}`);
    const value = (await response.json()) as Partial<LearningGroupFile>;
    if (value.version !== LEARNING_INDEX.version || !Array.isArray(value.entries)) {
      throw new Error("학습 자료 판본이 앱과 일치하지 않습니다.");
    }
    return {
      version: value.version,
      group: value.group ?? group,
      entries: value.entries.filter(isLearningEntry),
    };
  })();

  groupCache.set(group, request);
  request.catch(() => groupCache.delete(group));
  return request;
}

export async function loadLearningEntries(itemId: string): Promise<LearningEntry[]> {
  const pointer = LEARNING_INDEX.items[itemId];
  if (!pointer) return [];
  const group = await loadGroup(pointer.group);
  const allowed = new Set(pointer.entryIds);
  return group.entries.filter(
    (entry) => allowed.has(entry.id) && entry.itemIds.includes(itemId),
  ).map(entry => {
    const references = sharedBookReferences(entry, itemId);
    return references.length ? { ...entry, sharedBookReferences: references } : entry;
  });
}

export async function loadLearningAudio(itemId: string): Promise<LearningAudio | null> {
  const entries = await loadLearningEntries(itemId);
  return entries.find((entry) => entry.audio)?.audio ?? null;
}
