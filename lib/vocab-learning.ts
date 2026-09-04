import learningIndexRaw from "@/assets/vocab-learning-index-v1.4.json";

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
  id: string;
  itemIds: string[];
  headword: string;
  partOfSpeech: string;
  definitionEn: string;
  definitionKo: string;
  memoryKo: string;
  usageKo: string;
  examTrapKo: string;
  contrasts: Array<{ word: string; noteKo: string }>;
  example: { en: string; ko: string; kind: "source" | "editorial" };
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

function isLearningEntry(value: unknown): value is LearningEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LearningEntry>;
  return Boolean(
    entry.id &&
      entry.headword &&
      entry.definitionEn &&
      entry.definitionKo &&
      entry.example?.en &&
      entry.example?.ko &&
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
    const response = await fetch(url, { cache: "force-cache" });
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
  );
}

export async function loadLearningAudio(itemId: string): Promise<LearningAudio | null> {
  const entries = await loadLearningEntries(itemId);
  return entries.find((entry) => entry.audio)?.audio ?? null;
}
