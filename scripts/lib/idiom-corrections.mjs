import fs from "node:fs";
import path from "node:path";

export const isMissingMeaning = (value) => !String(value ?? "").trim() || /^(?:p\s*\.?\s*\d+|[-—?]+|null|undefined|n\/?a)$/i.test(String(value).trim());

export function loadIdiomCorrections(root) {
  const file = path.join(root, "data", "idiom-corrections.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const compositions = JSON.parse(fs.readFileSync(path.join(root, "data/expression-composition.json"), "utf8"));
  const compositionKeys = new Set();
  for (const composition of compositions.entries) {
    if (compositionKeys.has(composition.key) || !data.entries.some((entry) => entry.key === composition.key)) throw new Error(`Invalid composition mapping: ${composition.key}`);
    compositionKeys.add(composition.key);
    if (!Array.isArray(composition.parts) || composition.parts.length < 2 || composition.parts.some((part) => !part.text?.trim() || !part.roleKo?.trim()) || !composition.combinedKo?.trim() || !composition.limitKo?.trim()) throw new Error(`Incomplete composition: ${composition.key}`);
    data.entries.find((entry) => entry.key === composition.key).composition = { ...composition, checkedAtKst: compositions.checkedAtKst, policy: compositions.policy };
  }
  const seen = new Set();
  for (const entry of data.entries) {
    for (const field of ["meaningKo", "definitionEn", "definitionKo", "memoryKo", "usageKo", "examTrapKo"]) {
      if (!entry[field]?.trim() || isMissingMeaning(entry[field])) throw new Error(`Invalid correction ${entry.key}: ${field}`);
    }
    if (!entry.example?.en || !entry.example?.ko) throw new Error(`Missing example: ${entry.key}`);
    if (entry.senses !== undefined) {
      if (!Array.isArray(entry.senses) || entry.senses.length < 2) throw new Error(`Multiple senses required: ${entry.key}`);
      const senseIds = new Set();
      for (const sense of entry.senses) {
        for (const field of ["id", "partOfSpeech", "definitionEn", "definitionKo", "memoryKo", "usageKo", "examTrapKo"]) {
          if (!sense[field]?.trim()) throw new Error(`Incomplete sense ${entry.key}:${sense.id ?? "unknown"}: ${field}`);
        }
        if (senseIds.has(sense.id)) throw new Error(`Duplicate sense: ${entry.key}:${sense.id}`);
        senseIds.add(sense.id);
        if (!Array.isArray(sense.contrasts)) throw new Error(`Missing contrasts: ${entry.key}:${sense.id}`);
        if (!sense.example?.en || !sense.example?.ko || !sense.example?.cueKo) throw new Error(`Missing contextualized example: ${entry.key}:${sense.id}`);
      }
    }
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
  return data.entries.flatMap((entry) => entry.targets.flatMap((target) => {
    const item = byId.get(target.id);
    if (!item || item.k !== entry.meaningKo) throw new Error(`Meaning correction not built: ${target.id}`);
    const senses = entry.senses ?? [{
      id: null,
      partOfSpeech: entry.partOfSpeech ?? "idiom",
      definitionEn: entry.definitionEn,
      definitionKo: entry.definitionKo,
      memoryKo: entry.memoryKo,
      usageKo: entry.usageKo,
      examTrapKo: entry.examTrapKo,
      contrasts: entry.contrasts ?? [],
      example: entry.example,
    }];
    return senses.map((sense) => ({
      id: `learn:correction:${target.id}${sense.id ? `:${sense.id}` : ""}`,
      senseId: `${entry.key}:${sense.id ?? "primary"}`,
      headword: item.w,
      group: item.group,
      partOfSpeech: sense.partOfSpeech,
      itemIds: [item.id],
      localGlosses: [item.k],
      definitionKind: "editorial",
      definitionEn: sense.definitionEn,
      definitionKo: sense.definitionKo,
      memoryKo: sense.memoryKo,
      usageKo: sense.usageKo,
      examTrapKo: sense.examTrapKo,
      contrasts: sense.contrasts,
      example: { ...sense.example, kind: "editorial" },
      ...(entry.composition ? { composition: entry.composition } : {}),
      sources: entry.sources.map((source) => ({ ...source, edition: `확인 ${data.checkedAtKst}`, license: "대조 출처 · 원문 미수록", role: "reference" })),
      verification: { status: "cross-agreed", checkedAtKst: data.checkedAtKst,
        reviewer: "Codex · 독립 출처 의미 대조 및 한영 학습 해설 검수", evidence: entry.sources },
    }));
  }));
}
