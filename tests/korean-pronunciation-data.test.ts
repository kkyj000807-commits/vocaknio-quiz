import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getKoreanPronunciation as getPublishedPronunciation } from "../lib/korean-pronunciation-data";
import {
  auditEvidenceForRow, buildKoreanPronunciationEntries, importIpaAudit, IPA_AUDIT_SHA256, IPA_GATE_VERSION,
  multipleIpaWords, pronunciationInputHash, runKoreanPronunciationBuild, sha256,
  type AuditRow, type IpaSourceEvidence, type PronunciationRow,
} from "../scripts/build-korean-pronunciation";

const row: PronunciationRow = { id: "ROW1", w: "cat", p: "/ˈkæt/", k: "고양이" };
const audit: AuditRow = {
  row_id: row.id, headword: row.w, current_ipa: row.p, meaning_exact: row.k,
  status: "verified", confidence: "high", human_review_required: false, issue_type: "",
  primary_source: "wiktionary_US", primary_source_url: "https://en.wiktionary.org/wiki/cat",
  dictionary_ipa_raw: "wiktionary_US:kæt | ipa_dict_en_US:ˈkæt",
};
const evidence = (): IpaSourceEvidence => ({
  schema: 1, gateVersion: IPA_GATE_VERSION, auditSha256: IPA_AUDIT_SHA256,
  sourceVocabularySha256: "fixture", status: "source-ipa-matched-not-korean-reviewed", sourceNotes: [],
  entries: [auditEvidenceForRow(row, audit, new Set())!],
});
const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

describe("IPA 근거 기반 한국어 근사 발음 데이터", () => {
  it("현재 row ID·표제어·뜻·IPA가 정확히 일치하는 high verified 근거만 받는다", () => {
    expect(auditEvidenceForRow(row, audit, new Set())?.rows[0]).toEqual({ id: row.id, meaningSha256: sha256(row.k) });
    for (const patch of [{ id: "OTHER" }, { w: "Cat" }, { k: "다른 뜻" }, { p: "/kət/" }]) {
      expect(auditEvidenceForRow({ ...row, ...patch }, audit, new Set())).toBeNull();
    }
    for (const patch of [{ status: "variant_acceptable" }, { confidence: "medium" }, { human_review_required: true }, { issue_type: "heteronym" }]) {
      expect(auditEvidenceForRow(row, { ...audit, ...patch }, new Set())).toBeNull();
    }
    expect(auditEvidenceForRow(row, { ...audit, primary_source: "ipa_dict_en_US" }, new Set())).toBeNull();
    expect(auditEvidenceForRow(row, { ...audit, primary_source: "cmudict" }, new Set())).toBeNull();
  });

  it("untagged는 실제 US 보조 IPA 일치를 요구하며 출처 이름만으로 통과시키지 않는다", () => {
    const untagged = { ...audit, primary_source: "wiktionary_untagged" };
    expect(auditEvidenceForRow(row, untagged, new Set())?.secondaryUSProof?.matchedIpa).toBe(row.p);
    expect(auditEvidenceForRow(row, { ...untagged, dictionary_ipa_raw: "ipa_dict_en_US:kət" }, new Set())).toBeNull();
    expect(auditEvidenceForRow(row, { ...untagged, dictionary_ipa_raw: "cmudict:ˈkæt" }, new Set())).toBeNull();
  });

  it("같은 표제어의 다른 IPA와 구·선택적 성분 표기를 보류한다", () => {
    const multiple = multipleIpaWords([row, { ...row, id: "ROW2", p: "/kət/" }]);
    expect(auditEvidenceForRow(row, audit, multiple)).toBeNull();
    const phrase = { ...row, w: "cat A (with B)" };
    expect(auditEvidenceForRow(phrase, { ...audit, headword: phrase.w }, new Set())).toBeNull();
    expect(buildKoreanPronunciationEntries([row, { ...row, id: "ROW2", p: "/kət/" }], evidence()).held.ambiguousWord).toBe(1);
  });

  it("보존된 근거만 변환하고 미지원 IPA에서 철자 추측으로 대체하지 않는다", () => {
    const accepted = buildKoreanPronunciationEntries([row], evidence());
    expect(accepted.entries).toHaveLength(1);
    expect(accepted.entries[0]).toMatchObject({ w: "cat", p: row.p, ids: ["ROW1"] });
    expect(accepted.entries[0].ko).toMatch(/[가-힣]/);
    const unsupported = { ...row, p: "/ˈkætɾ/" };
    const source = evidence();
    source.entries[0].p = unsupported.p;
    expect(buildKoreanPronunciationEntries([unsupported], source)).toMatchObject({ entries: [], held: { unsupportedIpa: 1 } });
    expect(buildKoreanPronunciationEntries([{ ...row, p: "/kət/" }], evidence()).held.rowChanged).toBe(1);
    expect(buildKoreanPronunciationEntries([{ ...row, k: "다른 뜻" }], evidence()).held.rowChanged).toBe(1);
    expect(buildKoreanPronunciationEntries([{ ...row, w: "Cat" }], evidence()).held.rowChanged).toBe(1);
    expect(buildKoreanPronunciationEntries([{ ...row, id: "OTHER" }], evidence()).entries).toEqual([]);
  });

  it("audit pin과 source gate를 고정하고 중복 ID를 허용하지 않는다", async () => {
    expect(() => buildKoreanPronunciationEntries([row], { ...evidence(), auditSha256: "changed" })).toThrow("Unsupported pronunciation evidence");
    const duplicate = evidence();
    duplicate.entries.push(duplicate.entries[0]);
    expect(() => buildKoreanPronunciationEntries([row], duplicate)).toThrow("Duplicate pronunciation evidence row");
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-ipa-pin-"));
    directories.push(temporary);
    const auditPath = path.join(temporary, "unknown.jsonl");
    fs.writeFileSync(auditPath, JSON.stringify(audit));
    const rows = Array.from({ length: 38163 }, (_, index) => ({ ...row, id: String(index) }));
    await expect(importIpaAudit(auditPath, rows, "fixture")).rejects.toThrow("Audit input hash mismatch");
  });

  it("같은 입력은 재생성하지 않고 helper·근거·현재 IPA 변경은 다시 검증한다", async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-ipa-build-"));
    directories.push(temporary);
    for (const directory of ["assets", "data/pronunciation", "lib", "scripts"]) fs.mkdirSync(path.join(temporary, directory), { recursive: true });
    fs.writeFileSync(path.join(temporary, "assets/vocab-v1.4.json"), JSON.stringify([row]));
    fs.writeFileSync(path.join(temporary, "data/pronunciation/ipa-source-evidence.json"), JSON.stringify(evidence()));
    fs.writeFileSync(path.join(temporary, "lib/korean-pronunciation.ts"), "helper v1");
    fs.writeFileSync(path.join(temporary, "scripts/build-korean-pronunciation.ts"), "builder v1");
    const first = await runKoreanPronunciationBuild(temporary);
    expect(first.status).toBe("BUILT");
    const output = path.join(temporary, "assets/korean-pronunciation.json");
    const original = fs.readFileSync(output, "utf8");
    expect(await runKoreanPronunciationBuild(temporary)).toMatchObject({ status: "NO_CHANGE", inputHash: first.inputHash });
    expect(fs.readFileSync(output, "utf8")).toBe(original);
    expect(original).not.toContain("dictionary_ipa_raw");
    expect(original).not.toContain(temporary);
    const tampered = JSON.parse(original);
    tampered.entries[0].ko = "변조";
    fs.writeFileSync(output, JSON.stringify(tampered));
    expect(await runKoreanPronunciationBuild(temporary)).toMatchObject({ status: "BUILT" });
    expect(fs.readFileSync(output, "utf8")).toBe(original);
    fs.writeFileSync(path.join(temporary, "assets/vocab-v1.4.json"), JSON.stringify([{ ...row, p: "/kət/" }]));
    expect(await runKoreanPronunciationBuild(temporary)).toMatchObject({ status: "BUILT", acceptedRows: 0, held: { rowChanged: 1 } });
    const bytes = Buffer.from("input");
    expect(pronunciationInputHash(bytes, bytes, bytes, bytes)).not.toBe(pronunciationInputHash(bytes, bytes, Buffer.from("helper change"), bytes));
  });

  it("실제 공개 asset의 전체 입력 해시·행 ID·IPA와 getter의 fail-closed 경계를 검사한다", () => {
    const vocabBytes = fs.readFileSync(path.join(process.cwd(), "assets/vocab-v1.4.json"));
    const vocab = JSON.parse(vocabBytes.toString("utf8")) as PronunciationRow[];
    const byId = new Map(vocab.map(item => [item.id, item]));
    const payload = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets/korean-pronunciation.json"), "utf8")) as {
      sourceVocabularySha256: string; outputSha256: string; entries: { w: string; p: string; ko: string; ids: string[] }[];
    };
    expect(payload.sourceVocabularySha256).toBe(sha256(vocabBytes));
    expect(payload.outputSha256).toBe(sha256(JSON.stringify(payload.entries)));
    expect(payload.entries.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const entry of payload.entries) {
      expect(entry.ko).toMatch(/^[가-힣]{1,32}$/);
      for (const id of entry.ids) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        const item = byId.get(id)!;
        expect(item.w.trim().toLowerCase()).toBe(entry.w);
        expect(item.p).toBe(entry.p);
        expect(getPublishedPronunciation(item)).toBe(entry.ko);
      }
    }
    const first = byId.get(payload.entries[0].ids[0])!;
    expect(getPublishedPronunciation({ ...first, id: "unknown-row" })).toBeNull();
    expect(getPublishedPronunciation({ ...first, p: `${first.p} ` })).toBeNull();
    expect(getPublishedPronunciation({ ...first, w: "unknown-spelling" })).toBeNull();
  });
});
