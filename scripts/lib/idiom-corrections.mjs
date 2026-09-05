import fs from "node:fs";
import path from "node:path";

export const isMissingMeaning = (value) => !String(value ?? "").trim() || /^(?:p\s*\.?\s*\d+|[-—?]+|null|undefined|n\/?a)$/i.test(String(value).trim());

export function loadIdiomCorrections(root) {
  const file = path.join(root, "data", "idiom-corrections.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const seen = new Set();
  for (const entry of data.entries) {
    for (const field of ["meaningKo", "definitionEn", "definitionKo", "memoryKo", "usageKo", "examTrapKo"]) {
      if (!entry[field]?.trim() || isMissingMeaning(entry[field])) throw new Error(`Invalid correction ${entry.key}: ${field}`);
    }
    if (!entry.example?.en || !entry.example?.ko) throw new Error(`Missing example: ${entry.key}`);
    if (new Set(entry.sources.map((source) => source.independenceGroup)).size < 2) throw new Error(`Two independent sources required: ${entry.key}`);
    for (const source of entry.sources) {
      if (!source.name || !source.noteKo || !/^https:\/\//.test(source.url)) throw new Error(`Incomplete evidence: ${entry.key}`);
    }
    for (const target of entry.targets) {
      if (seen.has(target.id)) throw new Error(`Duplicate correction: ${target.id}`);
      seen.add(target.id);
    }
  }
  return data;
}

export function applyIdiomCorrections(items, data) {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const entry of data.entries) {
    for (const target of entry.targets) {
      const item = byId.get(target.id);
      if (!item || item.w !== target.headword || (item.k !== target.before && item.k !== entry.meaningKo)) {
        throw new Error(`Correction target changed; review needed: ${target.id}`);
      }
      item.k = entry.meaningKo;
    }
  }
  return items;
}

export function correctionLearningEntries(vocab, data) {
  const byId = new Map(vocab.map((item) => [item.id, item]));
  return data.entries.flatMap((entry) => entry.targets.map((target) => {
    const item = byId.get(target.id);
    if (!item || item.k !== entry.meaningKo) throw new Error(`Meaning correction not built: ${target.id}`);
    return {
      id: `learn:correction:${target.id}`, headword: item.w, group: item.group,
      partOfSpeech: entry.partOfSpeech ?? "idiom", itemIds: [item.id], localGlosses: [item.k],
      definitionKind: "editorial", definitionEn: entry.definitionEn, definitionKo: entry.definitionKo,
      memoryKo: entry.memoryKo, usageKo: entry.usageKo, examTrapKo: entry.examTrapKo,
      contrasts: entry.contrasts ?? [], example: { ...entry.example, kind: "editorial" },
      sources: entry.sources.map((source) => ({ ...source, edition: `확인 ${data.checkedAtKst}`, license: "대조 출처 · 원문 미수록", role: "reference" })),
      verification: { status: "cross-agreed", checkedAtKst: data.checkedAtKst,
        reviewer: "Codex · 독립 출처 의미 대조 및 한영 학습 해설 검수", evidence: entry.sources },
    };
  }));
}
