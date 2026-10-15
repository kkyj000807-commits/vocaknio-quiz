import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { getKoreanPronunciation } from "../lib/korean-pronunciation";
import { writeJsonCheckpoint } from "./lib/json-checkpoint.mjs";

export const IPA_AUDIT_SHA256 = "f80be2d03ec895b3d603cb448a5b487f5eb06ffd1f82d3c637196716cfa3f3ef";
export const IPA_GATE_VERSION = "exact-row-us-source-v1";
const EXPECTED_ROWS = 38163;
export const sha256 = (input: string | Buffer): string => crypto.createHash("sha256").update(input).digest("hex");
const normalizeWord = (word: string) => word.trim().toLowerCase();

export type PronunciationRow = { id: string; w: string; p: string; k: string };
export type AuditRow = {
  row_id: string; headword: string; current_ipa: string; meaning_exact: string;
  status: string; confidence: string; human_review_required: boolean; issue_type: string;
  primary_source: string; primary_source_url: string; dictionary_ipa_raw: string;
};
export type IpaEvidenceEntry = {
  w: string; p: string; rows: { id: string; meaningSha256: string }[];
  primarySource: "wiktionary_US" | "wiktionary_untagged"; sourceUrl: string;
  secondaryUSProof?: { source: "ipa_dict_en_US"; matchedIpa: string; method: "conservative-symbol-equality-v1" };
};
export type IpaSourceEvidence = {
  schema: 1; gateVersion: string; auditSha256: string; sourceVocabularySha256: string;
  status: "source-ipa-matched-not-korean-reviewed";
  sourceNotes: string[]; entries: IpaEvidenceEntry[];
};

/** Symbol spelling only: do not erase stress or merge vowels to increase coverage. */
export function normalizeSourceIpa(ipa: string): string {
  return ipa.replace(/[\/\[\].\sː]/g, "").replace(/ɹ/g, "r").replace(/ɫ/g, "l").replace(/g/g, "ɡ");
}

export function multipleIpaWords(rows: PronunciationRow[]): Set<string> {
  const values = new Map<string, Set<string>>();
  for (const row of rows) {
    const word = normalizeWord(row.w);
    const ipas = values.get(word) ?? new Set<string>();
    ipas.add(row.p);
    values.set(word, ipas);
  }
  return new Set([...values].filter(([, ipas]) => ipas.size > 1).map(([word]) => word));
}

export function auditEvidenceForRow(row: PronunciationRow, audit: AuditRow, multiple: Set<string>): IpaEvidenceEntry | null {
  if (row.id !== audit.row_id || row.w !== audit.headword || row.p !== audit.current_ipa || row.k !== audit.meaning_exact) return null;
  if (audit.status !== "verified" || audit.confidence !== "high" || audit.human_review_required !== false || audit.issue_type !== "") return null;
  if (multiple.has(normalizeWord(row.w)) || !/^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(row.w)) return null;
  if (!audit.primary_source_url.startsWith("https://")) return null;
  let secondaryUSProof: IpaEvidenceEntry["secondaryUSProof"];
  if (audit.primary_source === "wiktionary_untagged") {
    const supported = audit.dictionary_ipa_raw.split(" | ").filter(part => part.startsWith("ipa_dict_en_US:"))
      .some(part => normalizeSourceIpa(part.slice("ipa_dict_en_US:".length)) === normalizeSourceIpa(row.p));
    if (!supported) return null;
    secondaryUSProof = { source: "ipa_dict_en_US", matchedIpa: row.p, method: "conservative-symbol-equality-v1" };
  } else if (audit.primary_source !== "wiktionary_US") return null;
  return {
    w: row.w, p: row.p, rows: [{ id: row.id, meaningSha256: sha256(row.k) }],
    primarySource: audit.primary_source, sourceUrl: audit.primary_source_url,
    ...(secondaryUSProof ? { secondaryUSProof } : {}),
  };
}

async function hashFile(file: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

export async function importIpaAudit(auditPath: string, vocab: PronunciationRow[], vocabularySha: string): Promise<IpaSourceEvidence> {
  if (vocab.length !== EXPECTED_ROWS || new Set(vocab.map(row => row.id)).size !== EXPECTED_ROWS) throw new Error("Unexpected vocabulary row identity/count");
  if (await hashFile(auditPath) !== IPA_AUDIT_SHA256) throw new Error("Audit input hash mismatch; do not import an unknown audit");
  const byId = new Map(vocab.map(row => [row.id, row]));
  const multiple = multipleIpaWords(vocab);
  const seen = new Set<string>();
  const grouped = new Map<string, IpaEvidenceEntry>();
  const lines = readline.createInterface({ input: fs.createReadStream(auditPath, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const audit = JSON.parse(line) as AuditRow;
    if (seen.has(audit.row_id)) throw new Error("Duplicate audit row ID");
    seen.add(audit.row_id);
    const row = byId.get(audit.row_id);
    if (!row) throw new Error("Audit row is absent from current vocabulary");
    const entry = auditEvidenceForRow(row, audit, multiple);
    if (!entry) continue;
    const key = JSON.stringify([entry.w, entry.p, entry.primarySource, entry.sourceUrl, entry.secondaryUSProof]);
    const prior = grouped.get(key);
    if (prior) prior.rows.push(...entry.rows);
    else grouped.set(key, entry);
  }
  if (seen.size !== EXPECTED_ROWS || await hashFile(auditPath) !== IPA_AUDIT_SHA256) throw new Error("Audit changed or row count mismatch");
  return {
    schema: 1, gateVersion: IPA_GATE_VERSION, auditSha256: IPA_AUDIT_SHA256,
    sourceVocabularySha256: vocabularySha, status: "source-ipa-matched-not-korean-reviewed",
    sourceNotes: [
      "Wiktionary US, or untagged Wiktionary supported by an actually matching en_US IPA, with exact row/headword/meaning/IPA identity.",
      "ipa-dict en_US is derived from CMUdict-IPA; it is not independent of CMUdict. Raw dictionary payloads are not redistributed here.",
      "Korean output is an algorithmic approximation, not a verified pronunciation or a claim of audio alignment.",
    ],
    entries: [...grouped.values()].map(entry => ({ ...entry, rows: entry.rows.sort((a, b) => a.id.localeCompare(b.id)) }))
      .sort((a, b) => a.w.localeCompare(b.w) || a.p.localeCompare(b.p) || a.sourceUrl.localeCompare(b.sourceUrl)),
  };
}

export function buildKoreanPronunciationEntries(vocab: PronunciationRow[], evidence: IpaSourceEvidence) {
  if (evidence.schema !== 1 || evidence.gateVersion !== IPA_GATE_VERSION || evidence.auditSha256 !== IPA_AUDIT_SHA256) throw new Error("Unsupported pronunciation evidence");
  const byId = new Map(vocab.map(row => [row.id, row]));
  if (byId.size !== vocab.length) throw new Error("Duplicate vocabulary row IDs");
  const multiple = multipleIpaWords(vocab);
  const grouped = new Map<string, { w: string; p: string; ko: string; ids: string[] }>();
  const converted = new Map<string, string | null>();
  const seen = new Set<string>();
  const held: Record<string, number> = { rowChanged: 0, ambiguousWord: 0, unsupportedIpa: 0, sourceProof: 0 };
  for (const entry of evidence.entries) {
    const sourceValid = entry.primarySource === "wiktionary_US" || (entry.primarySource === "wiktionary_untagged"
      && entry.secondaryUSProof?.source === "ipa_dict_en_US"
      && entry.secondaryUSProof.method === "conservative-symbol-equality-v1" && entry.secondaryUSProof.matchedIpa === entry.p);
    for (const pointer of entry.rows) {
      if (seen.has(pointer.id)) throw new Error("Duplicate pronunciation evidence row");
      seen.add(pointer.id);
      const row = byId.get(pointer.id);
      if (!row || row.w !== entry.w || row.p !== entry.p || sha256(row.k) !== pointer.meaningSha256) { held.rowChanged++; continue; }
      if (!sourceValid || !entry.sourceUrl.startsWith("https://")) { held.sourceProof++; continue; }
      const normalized = normalizeWord(entry.w);
      if (multiple.has(normalized) || !/^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(entry.w)) { held.ambiguousWord++; continue; }
      const key = JSON.stringify([normalized, entry.p]);
      const existing = grouped.get(key);
      if (existing) { existing.ids.push(row.id); continue; }
      if (!converted.has(entry.p)) converted.set(entry.p, getKoreanPronunciation(entry.p));
      const ko = converted.get(entry.p);
      if (!ko) { held.unsupportedIpa++; continue; }
      grouped.set(key, { w: normalized, p: entry.p, ko, ids: [row.id] });
    }
  }
  const entries = [...grouped.values()].map(entry => ({ ...entry, ids: entry.ids.sort() })).sort((a, b) => a.w.localeCompare(b.w));
  return { entries, held, evidenceRows: seen.size, acceptedRows: entries.reduce((sum, entry) => sum + entry.ids.length, 0) };
}

export function pronunciationInputHash(vocab: Buffer, evidence: Buffer, helper: Buffer, builder: Buffer): string {
  return sha256(JSON.stringify([IPA_GATE_VERSION, ...[vocab, evidence, helper, builder].map(sha256)]));
}

export async function runKoreanPronunciationBuild(root: string, auditPath?: string) {
  const vocabPath = path.join(root, "assets/vocab-v1.4.json");
  const evidencePath = path.join(root, "data/pronunciation/ipa-source-evidence.json");
  const outputPath = path.join(root, "assets/korean-pronunciation.json");
  const vocabBytes = fs.readFileSync(vocabPath);
  const vocab = JSON.parse(vocabBytes.toString("utf8")) as PronunciationRow[];
  if (auditPath) writeJsonCheckpoint(evidencePath, await importIpaAudit(auditPath, vocab, sha256(vocabBytes)), { indent: 0 });
  if (!fs.existsSync(evidencePath)) throw new Error("Missing evidence: use --import-audit with the pinned local audit once");
  const evidenceBytes = fs.readFileSync(evidencePath);
  const inputHash = pronunciationInputHash(vocabBytes, evidenceBytes,
    fs.readFileSync(path.join(root, "lib/korean-pronunciation.ts")), fs.readFileSync(path.join(root, "scripts/build-korean-pronunciation.ts")));
  // Valid JSON is required even on the no-change path; corruption is not hidden.
  if (fs.existsSync(outputPath)) {
    const previous = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    if (previous.inputHash === inputHash && Array.isArray(previous.entries)
      && previous.outputSha256 === sha256(JSON.stringify(previous.entries))) return { status: "NO_CHANGE", inputHash };
  }
  const evidence = JSON.parse(evidenceBytes.toString("utf8")) as IpaSourceEvidence;
  const result = buildKoreanPronunciationEntries(vocab, evidence);
  const payload = {
    schema: 1, status: "algorithmic-korean-approximation", gateVersion: IPA_GATE_VERSION,
    sourceVocabularySha256: sha256(vocabBytes), evidenceVocabularySha256: evidence.sourceVocabularySha256,
    evidenceSha256: sha256(evidenceBytes), auditSha256: IPA_AUDIT_SHA256, inputHash,
    outputSha256: sha256(JSON.stringify(result.entries)),
    ...result,
  };
  writeJsonCheckpoint(outputPath, payload, { indent: 0 });
  return { status: "BUILT", inputHash, headwords: result.entries.length, acceptedRows: result.acceptedRows, held: result.held };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--import-audit")) throw new Error("Usage: build-korean-pronunciation.ts [--import-audit <local-audit.jsonl>]");
  runKoreanPronunciationBuild(process.cwd(), args[1]).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error("Korean pronunciation build failed: source evidence, hash, or data contract requires review.");
    process.exitCode = 1;
  });
}
