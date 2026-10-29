import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { convertPersonalVocabulary, importPersonalVocabulary, restorePersonalVocabulary } from "../scripts/import-personal-vocab.mjs";
import { makePersonalStudyItems, makeRetiredPersonalReferenceItems } from "../lib/personal-vocab";
import { VOCAB, WORDBOOK_VOCAB, VOCAB_META } from "../lib/vocab";

const { personalVocabPath } = createRequire(import.meta.url)("../scripts/lib/personal-vocab.cjs");
const folders: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true }); });
const baseline = [{ id: "original-capricious", num: 1, w: "capricious", k: "기존 뜻" }];
const rows = [
  { id: 100, headword: "capricious", meaning_display: "통합본의 별도 뜻", section: "V101" },
  { id: 101, headword: "new phrase", meaning_display: "원문 뜻; 다른 뜻", section: "보카바이블 B",
    vocabible_source_records: [{ source_uid: "VB:021:P2-0011:new phrase", meaning: "원문 뜻", page: 21,
      locator: "P2-0011", review_status: "source_image_partially_readable_gloss" }] },
];

it("preserves the base and adds only genuinely new headwords as study-only stable identities", () => {
  const before = JSON.stringify(baseline);
  const converted = convertPersonalVocabulary(rows, "a".repeat(64), baseline);
  const items = makePersonalStudyItems(baseline, converted.entries);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ w: "new phrase", k: "원문 뜻; 다른 뜻", p: "", s: [], referenceOnly: true });
  expect(items[0].num).toBeGreaterThan(38163);
  expect(Number.isSafeInteger(items[0].num)).toBe(true);
  expect(JSON.stringify(baseline)).toBe(before);
  expect(converted.entries[0].gloss).toBe("통합본의 별도 뜻");
  const reordered = convertPersonalVocabulary([...rows].reverse(), "b".repeat(64), baseline);
  expect(reordered.entries.find(x => x.key === "new phrase")?.id).toBe(items[0].id);
  expect(reordered.entries.find(x => x.key === "new phrase")?.num).toBe(items[0].num);
  expect(converted.entries[1].sources[0].status).toContain("partially");
});

it("rejects ambiguous duplicate keys, missing glosses and untraceable B records", () => {
  expect(() => convertPersonalVocabulary([rows[0], { ...rows[0], headword: " CAPRICIOUS " }], "a".repeat(64), baseline)).toThrow(/Duplicate/);
  expect(() => convertPersonalVocabulary([{ ...rows[0], meaning_display: "" }], "a".repeat(64), baseline)).toThrow(/Missing/);
  expect(() => convertPersonalVocabulary([{ ...rows[1], vocabible_source_records: [{ meaning: "뜻" }] }], "a".repeat(64), baseline)).toThrow(/evidence/);
});

it("uses an empty public placeholder and fails closed for missing/private target configuration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-personal-")); folders.push(root);
  expect(personalVocabPath(root, {})).toBe(path.join(root, "assets/personal-vocab.json"));
  expect(() => personalVocabPath(root, { FINETUNE_PERSONAL_VOCAB: "1" })).toThrow(/private/);
  expect(() => personalVocabPath(root, { FINETUNE_PERSONAL_VOCAB: "1", FINETUNE_DEPLOY_TARGET: "private" })).toThrow(/Import/);
});

it("leaves the default quiz vocabulary and all canonical IDs/counts unchanged", () => {
  expect(VOCAB).toHaveLength(38163);
  expect(VOCAB_META.sourceEntries).toBe(38163);
  expect(WORDBOOK_VOCAB).toHaveLength(VOCAB.length);
  expect(VOCAB.some(item => item.referenceOnly)).toBe(false);
});

it("accepts only the imported baseline hash for a private bundle", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-personal-baseline-")); folders.push(root);
  fs.mkdirSync(path.join(root, "assets"));
  fs.mkdirSync(path.join(root, "analysis/personal-vocab"), { recursive: true });
  const baselineFile = path.join(root, "assets/vocab-v1.4.json");
  fs.writeFileSync(baselineFile, "[]");
  const file = path.join(root, "analysis/personal-vocab/current.json");
  fs.writeFileSync(file, JSON.stringify({ schema: 1, requiresAccess: true, sourceSha256: "a".repeat(64),
    baselineSha256: crypto.createHash("sha256").update("[]").digest("hex"), entries: [] }));
  const env = { FINETUNE_PERSONAL_VOCAB: "1", FINETUNE_DEPLOY_TARGET: "private" };
  expect(personalVocabPath(root, env)).toBe(file);
  fs.writeFileSync(baselineFile, "[{}]");
  expect(() => personalVocabPath(root, env)).toThrow(/Canonical/);
});

it("retains exact source IPA, Hangul aid, review evidence and hold without manufacturing pronunciation", () => {
  const evidence = { status: "source_conflict", original_IPA: "/raw/", note: "원문 보존" };
  const source = { ...rows[1], study_entry_id: "study-stable-1", ipa: "/ˌnjuː ˈfreɪz/",
    korean_pronunciation: "누 프레이즈", pronunciation_status: "official_exact_US",
    korean_pronunciation_status: "approximate_aid", pronunciation_review: evidence,
    study_hold_reason: "원문 뜻과 용법 확인 필요" };
  const result = convertPersonalVocabulary([source, { ...rows[0], headword: "null" }], "a".repeat(64), baseline);
  expect(result.entries[0]).toMatchObject({ sourceStudyId: "study-stable-1", ipa: source.ipa,
    koreanPronunciation: source.korean_pronunciation, pronunciationStatus: source.pronunciation_status,
    koreanPronunciationStatus: "approximate_aid", studyHoldReason: source.study_hold_reason,
    studyStatus: "SOURCE_STUDY_HOLD", sourceReview: { pronunciation_review: evidence } });
  const items = makePersonalStudyItems(baseline, result.entries);
  expect(items[0]).toMatchObject({ p: source.ipa, koreanPronunciation: "누 프레이즈",
    referenceOnly: true, studyStatus: "SOURCE_STUDY_HOLD" });
  expect(items[1]).toMatchObject({ w: "null", p: "", referenceOnly: true });
  expect(() => convertPersonalVocabulary([{ ...source, ipa: 0 }], "a".repeat(64), baseline)).toThrow(/Invalid source ipa/);
});

it("keeps prior IDs and nums across gloss/order/book-number changes and an explicit same-study-ID rename", () => {
  const original = rows.map((row, n) => ({ ...row, study_entry_id: `study-${n}` }));
  const first = convertPersonalVocabulary(original, "a".repeat(64), baseline);
  const changed = [{ ...original[1], headword: "renamed phrase", id: 999, meaning_display: "보존한 뜻; 추가 뜻" },
    { ...original[0], id: 2 }];
  const second = convertPersonalVocabulary(changed, "b".repeat(64), baseline, { previous: first });
  expect(second.entries[0]).toMatchObject({ id: first.entries[1].id, num: first.entries[1].num,
    sourceStudyId: "study-1", word: "renamed phrase", sourceBookId: 999 });
  expect(second.entries[1]).toMatchObject({ id: first.entries[0].id, num: first.entries[0].num });
  expect(first.entries[1].word).toBe("new phrase");
  const third = convertPersonalVocabulary(changed, "b".repeat(64), baseline, { previous: second });
  expect(third).toEqual(second);
});

it("upgrades legacy head-based identities only through the verified prior source, never book-number equality", () => {
  const oldSource = rows.map((row, n) => ({ ...row, study_entry_id: `source-${n}` }));
  const legacy = { entries: convertPersonalVocabulary(rows, "a".repeat(64), baseline).entries
    .map(entry => ({ ...entry, sourceStudyId: null })) };
  const updated = [{ ...oldSource[1], id: 100, headword: "explicitly renamed" }, { ...oldSource[0], id: 101 }];
  const result = convertPersonalVocabulary(updated, "b".repeat(64), baseline,
    { previous: legacy, previousSourceRows: oldSource });
  expect(result.entries[0]).toMatchObject({ id: legacy.entries[1].id, num: legacy.entries[1].num });
  expect(result.entries[1]).toMatchObject({ id: legacy.entries[0].id, num: legacy.entries[0].num });
});

it("holds ambiguous identity changes and remembers retired IDs for a later reappearance", () => {
  const original = rows.map((row, n) => ({ ...row, study_entry_id: `stable-${n}` }));
  const first = convertPersonalVocabulary(original, "a".repeat(64), baseline);
  expect(() => convertPersonalVocabulary([{ ...original[0], study_entry_id: "another-source" }],
    "b".repeat(64), baseline, { previous: first })).toThrow(/study ID/);
  expect(() => convertPersonalVocabulary([{ ...original[0], headword: "new phrase" }],
    "b".repeat(64), baseline, { previous: first })).toThrow(/conflict/);
  expect(() => convertPersonalVocabulary([original[0], { ...original[1], study_entry_id: original[0].study_entry_id }],
    "b".repeat(64), baseline)).toThrow(/duplicate source study ID/);
  const fewer = convertPersonalVocabulary([original[0]], "b".repeat(64), baseline, { previous: first });
  expect(fewer.retiredEntries).toHaveLength(1);
  expect(fewer.retiredEntries[0]).toMatchObject({ ...first.entries[1], retired: true,
    retirementStatus: "RETIRED_REFERENCE_ONLY", retiredFromSourceSha256: "a".repeat(64) });
  expect(makePersonalStudyItems(baseline, fewer.entries)).toEqual([]);
  expect(makeRetiredPersonalReferenceItems(fewer.retiredEntries)[0]).toMatchObject({
    id: first.entries[1].id, num: first.entries[1].num, w: "new phrase", k: original[1].meaning_display,
    referenceOnly: true, retiredReferenceOnly: true });
  expect(convertPersonalVocabulary([original[0]], "b".repeat(64), baseline, { previous: fewer })).toEqual(fewer);
  const returned = convertPersonalVocabulary(original, "c".repeat(64), baseline, { previous: fewer });
  expect(returned.entries.map(entry => [entry.id, entry.num])).toEqual(first.entries.map(entry => [entry.id, entry.num]));
  expect(returned.retiredEntries).toEqual([]);
});

function privateProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-personal-import-"));
  folders.push(projectRoot);
  fs.mkdirSync(path.join(projectRoot, "assets"));
  fs.writeFileSync(path.join(projectRoot, "assets/vocab-v1.4.json"), JSON.stringify(baseline));
  const pointer = path.join(projectRoot, "pointer.json"), dataset = path.join(projectRoot, "source.json");
  const writeSource = (sourceRows: unknown[]) => {
    const bytes = JSON.stringify(sourceRows); fs.writeFileSync(dataset, bytes);
    fs.writeFileSync(pointer, JSON.stringify({ dataset, dataset_sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      status: "PARTIAL_SOURCE_REVIEW" }));
  };
  writeSource(rows.map((row, n) => ({ ...row, study_entry_id: `stable-${n}` })));
  return { projectRoot, pointer, dataset, writeSource, current: path.join(projectRoot, "analysis/personal-vocab/current.json") };
}

it("writes hash-verified immutable snapshots and NO_CHANGE leaves current and snapshot bytes unchanged", () => {
  const fixture = privateProject();
  const report = importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const before = fs.readFileSync(fixture.current);
  const env = { FINETUNE_PERSONAL_VOCAB: "1", FINETUNE_DEPLOY_TARGET: "private" };
  expect(personalVocabPath(fixture.projectRoot, env)).toBe(fixture.current);
  const snapshot = path.join(fixture.projectRoot, "analysis/personal-vocab", report.sourceSha256, "imports", report.appSha256);
  const manifestBytes = fs.readFileSync(path.join(snapshot, "manifest.json"));
  expect(importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot })).toMatchObject({ status: "NO_CHANGE", regenerated: false });
  expect(fs.readFileSync(fixture.current)).toEqual(before);
  expect(fs.readFileSync(path.join(snapshot, "manifest.json"))).toEqual(manifestBytes);
  fs.writeFileSync(path.join(snapshot, "app-data.json"), "{}");
  expect(() => personalVocabPath(fixture.projectRoot, env)).toThrow(/hash mismatch/);
  expect(() => importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot })).toThrow(/hash mismatch/);
  expect(fs.readFileSync(fixture.current)).toEqual(before);
});

it("protects the last current on input-hash errors or atomic promotion failure and resumes without duplicate IDs", () => {
  const fixture = privateProject();
  importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const before = fs.readFileSync(fixture.current);
  fs.appendFileSync(fixture.dataset, " ");
  expect(() => importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot })).toThrow(/Source changed/);
  expect(fs.readFileSync(fixture.current)).toEqual(before);
  fixture.writeSource(rows.map((row, n) => ({ ...row, study_entry_id: `stable-${n}`, meaning_display: `${row.meaning_display}; 보강` })));
  const rename = vi.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("simulated rename failure"); });
  expect(() => importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot })).toThrow(/simulated rename failure/);
  expect(fs.readFileSync(fixture.current)).toEqual(before);
  rename.mockRestore();
  importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const after = JSON.parse(fs.readFileSync(fixture.current, "utf8"));
  expect(after.entries.map((entry: { id: string; num: number }) => [entry.id, entry.num]))
    .toEqual(JSON.parse(before.toString("utf8")).entries.map((entry: { id: string; num: number }) => [entry.id, entry.num]));
  expect(fs.readdirSync(path.dirname(fixture.current)).filter(name => name.endsWith(".tmp"))).toEqual([]);
});

// Recreate the already-shipped v2 format: registry preserved removed IDs, but
// full entries existed only in the manifest-linked previous snapshot.
function registryOnlyRetirementFixture() {
  const fixture = privateProject();
  const first = importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const oldBytes = fs.readFileSync(fixture.current);
  const old = JSON.parse(oldBytes.toString("utf8"));
  const remaining = [{ ...rows[0], study_entry_id: "stable-0" }];
  fixture.writeSource(remaining);
  const sourceBytes = fs.readFileSync(fixture.dataset);
  const sha = (bytes: string | Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
  const sourceSha256 = sha(sourceBytes);
  const converted = convertPersonalVocabulary(remaining, sourceSha256, baseline, { previous: old });
  const { retiredEntries, ...registryOnly } = converted;
  expect(retiredEntries).toHaveLength(1);
  const bytes = JSON.stringify({ ...registryOnly, baselineSha256: old.baselineSha256 });
  const appSha256 = sha(bytes);
  const outputRoot = path.dirname(fixture.current);
  const revision = path.join(outputRoot, sourceSha256, "imports", appSha256);
  fs.mkdirSync(revision, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, sourceSha256, "source.json"), sourceBytes);
  fs.writeFileSync(path.join(revision, "app-data.json"), bytes);
  const reportBytes = JSON.stringify({ appSha256, sourceSha256 });
  fs.writeFileSync(path.join(revision, "report.json"), reportBytes);
  fs.writeFileSync(path.join(revision, "manifest.json"), JSON.stringify({ schema: 1, importVersion: 2,
    sourceSha256, baselineSha256: old.baselineSha256, appSha256, entries: 1, reportSha256: sha(reportBytes),
    previousSourceSha256: first.sourceSha256, previousAppSha256: first.appSha256 }));
  const history = path.join(outputRoot, "history", first.appSha256, "app-data.json");
  fs.mkdirSync(path.dirname(history), { recursive: true });
  fs.writeFileSync(history, oldBytes);
  fs.writeFileSync(fixture.current, bytes);
  return { ...fixture, old, history };
}

it("recovers registry-only retired references from hash-linked history and does not duplicate them on rerun", () => {
  const fixture = registryOnlyRetirementFixture();
  const result = importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  expect(result).toMatchObject({ datasetEntries: 1, retiredReferenceEntries: 1, lookupIdentityCount: 2 });
  const current = JSON.parse(fs.readFileSync(fixture.current, "utf8"));
  expect(current.retiredEntries[0]).toMatchObject({ ...fixture.old.entries[1], retired: true,
    retiredFromSourceSha256: fixture.old.sourceSha256 });
  expect(current.identityRegistry.map((entry: { id: string }) => entry.id).sort())
    .toEqual(fixture.old.identityRegistry.map((entry: { id: string }) => entry.id).sort());
  const before = fs.readFileSync(fixture.current);
  expect(importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot }).status).toBe("NO_CHANGE");
  expect(fs.readFileSync(fixture.current)).toEqual(before);
});

it("blocks retirement recovery from damaged history without modifying current", () => {
  const fixture = registryOnlyRetirementFixture();
  const before = fs.readFileSync(fixture.current);
  fs.appendFileSync(fixture.history, " ");
  expect(() => importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot })).toThrow(/history hash mismatch/);
  expect(fs.readFileSync(fixture.current)).toEqual(before);
});

it("restores an immutable older snapshot, preserves current history, and reimports without changing IDs or receipts", () => {
  const fixture = privateProject();
  const first = importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const original = fs.readFileSync(fixture.current);
  const target = path.join(path.dirname(fixture.current), first.sourceSha256, "imports", first.appSha256, "app-data.json");
  fixture.writeSource(rows.map((row, n) => ({ ...row, study_entry_id: `stable-${n}`, meaning_display: `${row.meaning_display}; 보강` })));
  const second = importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const updated = fs.readFileSync(fixture.current);
  const secondManifest = path.join(path.dirname(fixture.current), second.sourceSha256, "imports", second.appSha256, "manifest.json");
  const receipt = fs.readFileSync(secondManifest);
  expect(restorePersonalVocabulary(target, { projectRoot: fixture.projectRoot })).toMatchObject({
    status: "RESTORED_PRIVATE_SNAPSHOT", appSha256: first.appSha256, learnerDataChanged: false });
  expect(fs.readFileSync(fixture.current)).toEqual(original);
  expect(fs.readFileSync(path.join(path.dirname(fixture.current), "history", second.appSha256, "app-data.json"))).toEqual(updated);
  expect(restorePersonalVocabulary(target, { projectRoot: fixture.projectRoot }).status).toBe("NO_CHANGE");
  expect(importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot })).toMatchObject({ reusedSnapshot: true });
  expect(fs.readFileSync(fixture.current)).toEqual(updated);
  expect(fs.readFileSync(secondManifest)).toEqual(receipt);
  const historyTarget = path.join(path.dirname(fixture.current), "history", first.appSha256, "app-data.json");
  expect(restorePersonalVocabulary(historyTarget, { projectRoot: fixture.projectRoot }).appSha256).toBe(first.appSha256);
  expect(fs.readFileSync(fixture.current)).toEqual(original);
});

it("rejects corrupted or out-of-snapshot restore targets without changing current", () => {
  const fixture = privateProject();
  const first = importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const target = path.join(path.dirname(fixture.current), first.sourceSha256, "imports", first.appSha256, "app-data.json");
  fixture.writeSource(rows.map((row, n) => ({ ...row, study_entry_id: `stable-${n}`, meaning_display: `${row.meaning_display}; 갱신` })));
  importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const before = fs.readFileSync(fixture.current);
  const outside = path.join(fixture.projectRoot, "app-data.json");
  fs.copyFileSync(target, outside);
  expect(() => restorePersonalVocabulary(outside, { projectRoot: fixture.projectRoot })).toThrow(/inside analysis/);
  expect(() => restorePersonalVocabulary(fixture.current, { projectRoot: fixture.projectRoot })).toThrow(/immutable snapshot/);
  fs.appendFileSync(target, " ");
  expect(() => restorePersonalVocabulary(target, { projectRoot: fixture.projectRoot })).toThrow(/target hash mismatch/);
  expect(fs.readFileSync(fixture.current)).toEqual(before);
});

it("keeps the current snapshot when rollback atomic promotion fails", () => {
  const fixture = privateProject();
  const first = importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const target = path.join(path.dirname(fixture.current), first.sourceSha256, "imports", first.appSha256, "app-data.json");
  fixture.writeSource(rows.map((row, n) => ({ ...row, study_entry_id: `stable-${n}`, meaning_display: `${row.meaning_display}; 갱신` })));
  importPersonalVocabulary(fixture.pointer, { projectRoot: fixture.projectRoot });
  const before = fs.readFileSync(fixture.current);
  vi.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("rollback rename failed"); });
  expect(() => restorePersonalVocabulary(target, { projectRoot: fixture.projectRoot })).toThrow(/rollback rename failed/);
  expect(fs.readFileSync(fixture.current)).toEqual(before);
  expect(fs.readdirSync(path.dirname(fixture.current)).filter(name => name.endsWith(".tmp"))).toEqual([]);
});
