import definitionMetaRaw from "@/assets/vocab-definitions-oewn-2025.json";
import { VOCAB_BY_ID } from "@/lib/vocab";

export type VocabDefinitionStatus =
  | "single_sense"
  | "dictionary_primary_unreviewed"
  | "dictionary_alias_unreviewed"
  | "source_not_found";

export interface VocabDictionarySense {
  senseId: string;
  synsetId?: string;
  partOfSpeech: string;
  definition: string;
  matchedHeadword?: string;
  examples?: string[];
  reviewedExamples?: { en: string; ko: string; cueKo: string }[];
}

export interface VocabDefinitionEntry {
  headword: string;
  status: VocabDefinitionStatus;
  representativeSenseId: string | null;
  matches?: { headword: string; matchType: string }[];
  senses: VocabDictionarySense[];
}

interface DefinitionMetadata {
  version: string;
  source: {
    name: string;
    edition: string;
    url: string;
    license: string;
    attribution: string;
    archiveSha256: string;
  };
  coverage: {
    totalRows: number;
    matchedRows: number;
    matchedRowPercent: number;
    singleSenseRows: number;
    ambiguousRows: number;
    aliasMatchedRows: number;
    sourceNotFoundRows: number;
  };
}

interface DefinitionGroupFile {
  version: string;
  group: string;
  items: Record<string, string>;
  headwords: Record<string, VocabDefinitionEntry>;
}

const DEFINITION_META = definitionMetaRaw as DefinitionMetadata;
const groupCache = new Map<string, Promise<DefinitionGroupFile>>();

export const VOCAB_DEFINITION_COVERAGE = DEFINITION_META.coverage;
export const VOCAB_DEFINITION_SOURCE = DEFINITION_META.source;

function getPublicBasePath(): string {
  if (typeof window === "undefined" || typeof window.document === "undefined") return "";
  return window.location.pathname === "/vocaknio-quiz" ||
    window.location.pathname.startsWith("/vocaknio-quiz/")
    ? "/vocaknio-quiz"
    : "";
}

function isDefinitionEntry(value: unknown): value is VocabDefinitionEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<VocabDefinitionEntry>;
  return Boolean(
    entry.headword &&
    ["single_sense", "dictionary_primary_unreviewed", "dictionary_alias_unreviewed", "source_not_found"].includes(
      entry.status ?? "",
    ) &&
    Array.isArray(entry.senses),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function loadGroup(group: string): Promise<DefinitionGroupFile> {
  const cached = groupCache.get(group);
  if (cached) return cached;

  const request = (async () => {
    if (
      typeof window === "undefined" ||
      typeof window.document === "undefined" ||
      typeof fetch !== "function"
    ) {
      throw new Error("영영 정의 자료는 현재 웹 앱에서 제공합니다.");
    }
    const basePath = getPublicBasePath();
    const url = `${basePath}/data/vocab-definitions/${encodeURIComponent(DEFINITION_META.version)}/${encodeURIComponent(group.toLowerCase())}.json`;
    // Revalidate the reused data partition on a new page or failed retry.
    // Successful requests still share groupCache for the lifetime of this page.
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`영영 정의 요청 실패: ${response.status}`);
    const value: unknown = await response.json();
    if (
      !isRecord(value) ||
      value.version !== DEFINITION_META.version ||
      value.group !== group ||
      !isRecord(value.items) ||
      !isRecord(value.headwords)
    ) {
      throw new Error("영영 정의 판본이 앱과 일치하지 않습니다.");
    }
    return {
      version: DEFINITION_META.version,
      group,
      items: value.items as Record<string, string>,
      headwords: value.headwords as Record<string, VocabDefinitionEntry>,
    };
  })();

  groupCache.set(group, request);
  request.catch(() => groupCache.delete(group));
  return request;
}

export async function loadVocabDefinition(itemId: string): Promise<VocabDefinitionEntry | null> {
  const vocabItem = VOCAB_BY_ID.get(itemId);
  if (!vocabItem) return null;
  const group = await loadGroup(vocabItem.group);
  const key = group.items[itemId];
  const entry = key ? group.headwords[key] : null;
  return isDefinitionEntry(entry) ? entry : null;
}
