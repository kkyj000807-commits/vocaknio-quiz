import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readVerifiedPersonalVocabulary, verifyPersonalSnapshot } from "./lib/personal-vocab.cjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const key = value => String(value).trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const strings = values => [...new Set((values ?? []).flatMap(value => {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return [value.text, value.en, value.ko, value.meaning, value.word].filter(x => typeof x === "string" && x.trim());
}))];

const sourceStudyId = row => {
  if (row.study_entry_id === undefined || row.study_entry_id === null || row.study_entry_id === "") return null;
  if (typeof row.study_entry_id !== "string" || !row.study_entry_id.trim()) throw new Error("Invalid stable source study ID.");
  return row.study_entry_id;
};
const sourceString = (row, field) => {
  if (row[field] === undefined || row[field] === null) return "";
  if (typeof row[field] !== "string") throw new Error(`Invalid source ${field}: ${row.id}`);
  return row[field];
};

/** @typedef {import("../lib/personal-vocab").PersonalVocabEntry} PersonalVocabEntry */
/** @typedef {{ id: string, num: number, sourceStudyId: string | null, sourceKeys: string[] }} PersonalIdentity */
/**
 * @typedef {object} PreviousPersonalVocabulary
 * @property {PersonalVocabEntry[]} entries
 * @property {string} [sourceSha256]
 * @property {PersonalIdentity[]} [identityRegistry]
 * @property {PersonalVocabEntry[]} [retiredEntries]
 */
/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} sourceSha256
 * @param {Array<{ id: string, num: number, w: string }>} baseline
 * @param {{ previous?: PreviousPersonalVocabulary | null, previousSourceRows?: Array<Record<string, unknown>>,
 *   recoveredRetiredEntries?: PersonalVocabEntry[] }} [options]
 */
export function convertPersonalVocabulary(rows, sourceSha256, baseline,
  { previous = null, previousSourceRows = [], recoveredRetiredEntries = [] } = {}) {
  if (!Array.isArray(rows) || !rows.length || !/^[a-f0-9]{64}$/.test(sourceSha256)) throw new Error("Invalid source dataset.");
  if (!Array.isArray(baseline) || (previous && !Array.isArray(previous.entries))) throw new Error("Invalid identity baseline.");
  const keys = new Set(), nums = new Set(baseline.map(x => x.num)), ids = new Set(baseline.map(x => x.id));
  const known = new Set(baseline.map(x => key(x.w)));
  // Legacy book numbers are display metadata, never a join key. Upgrade old
  // imports using their hash-verified original snapshot and exact prior heads.
  const priorRows = new Map();
  for (const row of previousSourceRows) {
    const normalized = key(row.headword);
    if (priorRows.has(normalized)) throw new Error("Ambiguous previous source headword.");
    priorRows.set(normalized, row);
  }
  const registry = new Map(), byStudy = new Map(), byPreviousHead = new Map(), historicalHeads = new Map();
  const remember = identity => {
    if (typeof identity.id !== "string" || !identity.id.startsWith("personal-")
      || !Number.isSafeInteger(identity.num) || ids.has(identity.id) || nums.has(identity.num)) {
      throw new Error("Stable identity collision.");
    }
    ids.add(identity.id); nums.add(identity.num);
    const value = { id: identity.id, num: identity.num, sourceStudyId: identity.sourceStudyId ?? null,
      sourceKeys: [...new Set(identity.sourceKeys ?? [])].sort() };
    if (value.sourceStudyId) {
      if (byStudy.has(value.sourceStudyId)) throw new Error("Ambiguous stable source study ID.");
      byStudy.set(value.sourceStudyId, value);
    }
    registry.set(value.id, value);
    for (const priorKey of value.sourceKeys) {
      if (!historicalHeads.has(priorKey)) historicalHeads.set(priorKey, new Set());
      historicalHeads.get(priorKey).add(value);
    }
    return value;
  };
  for (const identity of previous?.identityRegistry ?? []) remember(identity);
  for (const entry of previous?.entries ?? []) {
    let identity = registry.get(entry.id);
    const linkedStudyId = entry.sourceStudyId ?? sourceStudyId(priorRows.get(entry.key) ?? {});
    if (!identity) identity = remember({ ...entry, sourceStudyId: linkedStudyId, sourceKeys: [entry.key] });
    if (identity.num !== entry.num || (identity.sourceStudyId && linkedStudyId && identity.sourceStudyId !== linkedStudyId)) {
      throw new Error("Previous stable identity mapping conflict.");
    }
    if (!identity.sourceStudyId && linkedStudyId) {
      if (byStudy.has(linkedStudyId) && byStudy.get(linkedStudyId) !== identity) throw new Error("Ambiguous legacy study ID linkage.");
      identity.sourceStudyId = linkedStudyId; byStudy.set(linkedStudyId, identity);
    }
    if (byPreviousHead.has(entry.key)) throw new Error("Ambiguous previous headword identity.");
    byPreviousHead.set(entry.key, identity);
  }
  // Removed source rows remain readable by their old app IDs. They are not
  // aliases to a new learning record and never enter the current book list.
  const priorEntries = new Map();
  for (const entry of [...(previous?.entries ?? []), ...(previous?.retiredEntries ?? []), ...recoveredRetiredEntries]) {
    const identity = registry.get(entry.id);
    if (!identity || identity.num !== entry.num || typeof entry.word !== "string" || !entry.word.trim()
      || typeof entry.gloss !== "string" || !entry.gloss.trim()) throw new Error("Invalid retired identity snapshot.");
    if (!priorEntries.has(entry.id)) priorEntries.set(entry.id, entry);
  }
  const seenStudyIds = new Set(), usedIdentities = new Set();
  /** @type {Array<PersonalVocabEntry & { isNewHeadword: boolean }>} */
  const entries = rows.map(row => {
    if (typeof row.headword !== "string" || !row.headword.trim()
      || typeof row.meaning_display !== "string" || !row.meaning_display.trim()) throw new Error(`Missing original word/gloss: ${row.id}`);
    const normalized = key(row.headword);
    if (keys.has(normalized)) throw new Error(`Duplicate source headword requires review: ${normalized}`);
    keys.add(normalized);
    const studyId = sourceStudyId(row);
    if (studyId && seenStudyIds.has(studyId)) throw new Error("Ambiguous duplicate source study ID; import held.");
    if (studyId) seenStudyIds.add(studyId);
    const historical = historicalHeads.get(normalized);
    if (!byPreviousHead.has(normalized) && historical?.size > 1) throw new Error("Ambiguous historical headword identity.");
    const sameHead = byPreviousHead.get(normalized) ?? (historical?.size === 1 ? [...historical][0] : null);
    let identity = studyId ? byStudy.get(studyId) : null;
    if (identity && sameHead && identity !== sameHead) throw new Error("Stable study ID/headword conflict; import held.");
    if (!identity && sameHead) {
      if (studyId && sameHead.sourceStudyId && sameHead.sourceStudyId !== studyId) {
        throw new Error("Changed source study ID for an existing head; import held.");
      }
      identity = sameHead;
    }
    if (!identity) {
      const digest = hash(Buffer.from(studyId ? `study:${studyId}` : normalized));
      identity = remember({ id: `personal-${digest.slice(0, 24)}`,
        num: 1_000_000_000 + Number.parseInt(digest.slice(0, 12), 16),
        sourceStudyId: studyId, sourceKeys: [normalized] });
    } else if (studyId && !identity.sourceStudyId) {
      identity.sourceStudyId = studyId; byStudy.set(studyId, identity);
    }
    if (usedIdentities.has(identity.id)) throw new Error("Multiple source rows resolve to one identity; import held.");
    usedIdentities.add(identity.id);
    identity.sourceKeys = [...new Set([...identity.sourceKeys, normalized])].sort();
    const { id, num } = identity;
    const sources = (row.vocabible_source_records ?? []).map(record => {
      if (!record.source_uid || !record.meaning || !Number.isInteger(record.page) || !record.review_status) {
        throw new Error(`Missing source/review evidence: ${normalized}`);
      }
      return { ...record, id: record.source_uid, text: record.meaning, page: record.page,
        locator: record.locator ?? "", status: record.review_status };
    });
    return { id, num, key: normalized, word: row.headword, gloss: row.meaning_display,
      sourceSection: row.section ?? "통합 단어장", sourceBookId: row.id, sourceStudyId: studyId, sources,
      ipa: sourceString(row, "ipa"), koreanPronunciation: sourceString(row, "korean_pronunciation"),
      pronunciationStatus: sourceString(row, "pronunciation_status"),
      koreanPronunciationStatus: sourceString(row, "korean_pronunciation_status"),
      sourceReview: Object.fromEntries(Object.entries(row).filter(([name]) =>
        /review|hold|pronunciation|(^|_)ipa($|_)|(^|_)korean($|_)/i.test(name))),
      studyHoldReason: sourceString(row, "study_hold_reason"),
      studyStatus: row.study_hold_reason ? "SOURCE_STUDY_HOLD" : "PRIVATE_REFERENCE_ONLY",
      notes: strings(row.annotations), examples: strings(row.examples), relationHints: strings(row.synonym_hints),
      isNewHeadword: !known.has(normalized) };
  });
  /** @type {PersonalVocabEntry[]} */
  const retiredEntries = [...registry.values()].filter(identity => !usedIdentities.has(identity.id)).map(identity => {
    const entry = priorEntries.get(identity.id);
    if (!entry) throw new Error("Missing retired entry snapshot; recover verified import history first.");
    return { ...entry, retired: true, retirementStatus: "RETIRED_REFERENCE_ONLY",
      retiredFromSourceSha256: entry.retiredFromSourceSha256 ?? previous?.sourceSha256 ?? null,
      retirementReason: entry.retirementReason ?? "Not in the current source; original reference retained without merging learner history." };
  }).sort((a, b) => a.id.localeCompare(b.id));
  return { schema: 1, importVersion: 2, requiresAccess: true, privateContentMarker: "FINETUNE_PERSONAL_CONTENT_PRIVATE_ONLY",
    sourceSha256, reviewStatus: "source_transcription_partial_not_question_certification",
    identityRegistry: [...registry.values()].sort((a, b) => a.id.localeCompare(b.id)), entries, retiredEntries };
}

function recoverRetiredEntries(projectRoot, current) {
  if (!current) return [];
  const present = new Set([...current.data.entries, ...(current.data.retiredEntries ?? [])].map(entry => entry.id));
  const missing = new Set((current.data.identityRegistry ?? []).filter(identity => !present.has(identity.id)).map(identity => identity.id));
  const recovered = [], visited = new Set();
  let cursor = current;
  // Follow only hash-linked predecessors, never directory order or timestamps.
  while (missing.size && cursor.data.importVersion === 2) {
    const appSha = hash(cursor.bytes);
    if (visited.has(appSha)) throw new Error("Cyclic personal import history.");
    visited.add(appSha);
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "analysis/personal-vocab",
      cursor.data.sourceSha256, "imports", appSha, "manifest.json"), "utf8"));
    if (!manifest.previousAppSha256) break;
    if (!/^[a-f0-9]{64}$/.test(manifest.previousAppSha256)) throw new Error("Invalid personal history hash.");
    const bytes = fs.readFileSync(path.join(projectRoot, "analysis/personal-vocab/history", manifest.previousAppSha256, "app-data.json"));
    if (hash(bytes) !== manifest.previousAppSha256) throw new Error("Personal history hash mismatch; current preserved.");
    const data = JSON.parse(bytes);
    if (data.sourceSha256 !== manifest.previousSourceSha256) throw new Error("Personal history source mismatch.");
    verifyPersonalSnapshot(projectRoot, data, bytes);
    for (const entry of [...data.entries, ...(data.retiredEntries ?? [])]) {
      if (!missing.delete(entry.id)) continue;
      recovered.push({ ...entry, retiredFromSourceSha256: entry.retiredFromSourceSha256 ?? data.sourceSha256 });
    }
    cursor = { data, bytes };
  }
  if (missing.size) throw new Error("Missing retired entry history; current preserved.");
  return recovered;
}

function immutableWrite(file, bytes) {
  if (fs.existsSync(file)) {
    if (!fs.readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`Immutable personal snapshot mismatch: ${path.basename(file)}`);
    return;
  }
  fs.writeFileSync(file, bytes, { flag: "wx" });
}

function atomicCurrent(file, bytes, expectedBefore) {
  if (fs.existsSync(file) ? !expectedBefore || !fs.readFileSync(file).equals(expectedBefore) : expectedBefore !== null) {
    throw new Error("Personal current changed concurrently; promotion blocked.");
  }
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx" });
    const fd = fs.openSync(temporary, "r+");
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    // Same-directory rename; a failed write/rename leaves the old current intact.
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function preserveCurrentHistory(outputRoot, current) {
  if (!current) return;
  const history = path.join(outputRoot, "history", hash(current.bytes));
  fs.mkdirSync(history, { recursive: true });
  immutableWrite(path.join(history, "app-data.json"), current.bytes);
}

export function restorePersonalVocabulary(snapshotPath, { projectRoot = root } = {}) {
  const outputRoot = fs.realpathSync(path.join(projectRoot, "analysis/personal-vocab"));
  const target = fs.realpathSync(path.resolve(snapshotPath));
  const relative = path.relative(outputRoot, target).split(path.sep).join("/");
  const revision = relative.match(/^([a-f0-9]{64})\/imports\/([a-f0-9]{64})\/app-data\.json$/);
  const history = relative.match(/^history\/([a-f0-9]{64})\/app-data\.json$/);
  const legacy = relative.match(/^([a-f0-9]{64})\/app-data\.json$/);
  if (!revision && !history && !legacy) throw new Error("Restore requires an immutable snapshot/history inside analysis/personal-vocab.");
  const current = readVerifiedPersonalVocabulary(projectRoot);
  const bytes = fs.readFileSync(target), appSha256 = hash(bytes);
  if ((revision && revision[2] !== appSha256) || (history && history[1] !== appSha256)) {
    throw new Error("Restore target hash mismatch; current preserved.");
  }
  const data = JSON.parse(bytes);
  if ((revision && revision[1] !== data.sourceSha256) || (legacy && legacy[1] !== data.sourceSha256)
    || (legacy && data.importVersion !== undefined)) throw new Error("Restore target source/version mismatch.");
  verifyPersonalSnapshot(projectRoot, data, bytes);
  const source = path.join(outputRoot, data.sourceSha256, "source.json");
  if (hash(fs.readFileSync(source)) !== data.sourceSha256) throw new Error("Restore source hash mismatch; current preserved.");
  const report = { status: "RESTORED_PRIVATE_SNAPSHOT", sourceSha256: data.sourceSha256, appSha256,
    datasetEntries: data.entries.length, retiredReferenceEntries: data.retiredEntries?.length ?? 0,
    previousAppSha256: hash(current.bytes), learnerDataChanged: false };
  if (current.bytes.equals(bytes)) return { ...report, status: "NO_CHANGE", regenerated: false };
  preserveCurrentHistory(outputRoot, current);
  // Recheck the target/manifest/baseline immediately before atomic promotion.
  if (!fs.readFileSync(target).equals(bytes)) throw new Error("Restore target changed concurrently; current preserved.");
  verifyPersonalSnapshot(projectRoot, data, bytes);
  atomicCurrent(current.file, bytes, current.bytes);
  return report;
}

export function importPersonalVocabulary(pointerPath, { projectRoot = root } = {}) {
  const pointerBytes = fs.readFileSync(pointerPath);
  const pointer = JSON.parse(pointerBytes.toString("utf8"));
  const dataset = path.resolve(path.dirname(pointerPath), pointer.dataset);
  const sourceBytes = fs.readFileSync(dataset), sourceSha256 = hash(sourceBytes);
  if (sourceSha256 !== pointer.dataset_sha256) throw new Error("Source changed since its integration receipt; import blocked.");
  const outputRoot = path.join(projectRoot, "analysis/personal-vocab");
  const currentPath = path.join(outputRoot, "current.json");
  const baselinePath = path.join(projectRoot, "assets/vocab-v1.4.json");
  const baselineBytes = fs.readFileSync(baselinePath);
  const baseHash = hash(baselineBytes);
  const snapshot = path.join(outputRoot, sourceSha256);
  const old = fs.existsSync(currentPath) ? readVerifiedPersonalVocabulary(projectRoot) : null;
  let previousSourceRows = [];
  if (old) {
    const priorSource = fs.readFileSync(path.join(outputRoot, old.data.sourceSha256, "source.json"));
    if (hash(priorSource) !== old.data.sourceSha256) throw new Error("Previous source snapshot mismatch; identity migration blocked.");
    previousSourceRows = JSON.parse(priorSource);
  }
  const data = convertPersonalVocabulary(JSON.parse(sourceBytes), sourceSha256, JSON.parse(baselineBytes),
    { previous: old?.data ?? null, previousSourceRows, recoveredRetiredEntries: recoverRetiredEntries(projectRoot, old) });
  const bytes = JSON.stringify({ ...data, baselineSha256: baseHash });
  const appSha256 = hash(bytes);
  const priorNumbers = new Map((old?.data.entries ?? []).map(entry => [entry.id, entry.num]));
  const report = { status: "IMPORTED_PRIVATE_STUDY_ONLY", sourceSha256, baselineSha256: baseHash,
    appSha256, importVersion: 2,
    datasetEntries: data.entries.length, newHeadwords: data.entries.filter(x => x.isNewHeadword).length,
    vocabibleHeadwords: data.entries.filter(x => x.sources.length).length,
    vocabibleSourceRecords: data.entries.reduce((sum, x) => sum + x.sources.length, 0),
    preservedIdentities: data.entries.filter(entry => priorNumbers.get(entry.id) === entry.num).length,
    retiredReferenceEntries: data.retiredEntries.length,
    lookupIdentityCount: data.entries.length + data.retiredEntries.length,
    studyHolds: data.entries.filter(entry => entry.studyHoldReason).length,
    independentSemanticReview: "NOT_VERIFIED", masterDb: "UNVERIFIED_SYNC_REQUIRED",
    publicRedistribution: "NOT_AUTHORIZED", quizPromotion: 0, sourceStatus: pointer.status };
  const verifyInputsUnchanged = () => {
    if (!fs.readFileSync(pointerPath).equals(pointerBytes) || hash(fs.readFileSync(dataset)) !== sourceSha256
      || !fs.readFileSync(baselinePath).equals(baselineBytes)) throw new Error("Inputs changed during import; current preserved.");
  };
  if (old?.bytes.equals(Buffer.from(bytes))) {
    verifyInputsUnchanged();
    return { ...report, status: "NO_CHANGE", regenerated: false };
  }
  const revision = path.join(snapshot, "imports", appSha256);
  // A rollback can revisit an already-published content hash. Reuse its
  // verified receipt rather than rewrite immutable original lineage/report.
  if (fs.existsSync(path.join(revision, "manifest.json"))) {
    verifyPersonalSnapshot(projectRoot, JSON.parse(bytes), Buffer.from(bytes));
    preserveCurrentHistory(outputRoot, old);
    verifyInputsUnchanged();
    atomicCurrent(currentPath, bytes, old?.bytes ?? null);
    return { ...report, reusedSnapshot: true, regenerated: false };
  }
  fs.mkdirSync(revision, { recursive: true });
  // Immutable exact source, including all IPA, sense and review metadata not promoted into the UI.
  immutableWrite(path.join(snapshot, "source.json"), sourceBytes);
  immutableWrite(path.join(revision, "app-data.json"), bytes);
  const reportBytes = JSON.stringify(report, null, 2) + "\n";
  const manifest = { schema: 1, importVersion: 2, sourceSha256, baselineSha256: baseHash, appSha256,
    entries: data.entries.length, retiredEntries: data.retiredEntries.length, reportSha256: hash(reportBytes),
    previousSourceSha256: old?.data.sourceSha256 ?? null, previousAppSha256: old ? hash(old.bytes) : null };
  // Preserve the former current exactly, including v1 content that lacked study IDs.
  preserveCurrentHistory(outputRoot, old);
  immutableWrite(path.join(revision, "report.json"), reportBytes);
  immutableWrite(path.join(revision, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  verifyPersonalSnapshot(projectRoot, JSON.parse(bytes), Buffer.from(bytes));
  verifyInputsUnchanged();
  atomicCurrent(currentPath, bytes, old?.bytes ?? null);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length === 4 && process.argv[2] === "--restore") {
    console.log(JSON.stringify(restorePersonalVocabulary(process.argv[3]), null, 2));
  } else {
    if (process.argv.length !== 3 || process.argv[2] === "--restore") {
      throw new Error("Usage: node scripts/import-personal-vocab.mjs <latest_data_integration.json> | --restore <snapshot/app-data.json>");
    }
    console.log(JSON.stringify(importPersonalVocabulary(process.argv[2]), null, 2));
  }
}
