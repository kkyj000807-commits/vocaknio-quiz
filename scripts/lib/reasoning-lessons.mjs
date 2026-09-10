import fs from "node:fs";
import path from "node:path";

const errorTypes = new Set(["supported", "sequence", "scope", "degree", "polarity", "modality", "causality", "relation", "unsupported", "sense"]);
const required = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Reasoning: missing ${label}`);
};

export function validateReasoningLessons(data, entries) {
  const known = new Set(entries.map((entry) => entry.id));
  const usedEntries = new Set();
  const ids = new Set();
  if (data.version !== 1 || !Array.isArray(data.lessons) || !data.lessons.length) throw new Error("Reasoning: invalid version or lessons");
  for (const lesson of data.lessons) {
    for (const key of ["id", "literalKo", "bridgeKo", "originNoteKo"]) required(lesson[key], key);
    if (ids.has(lesson.id)) throw new Error("Reasoning: duplicate lesson ID");
    ids.add(lesson.id);
    // This first batch uses learning imagery only, not unverified historical origins.
    if (lesson.originStatus !== "mnemonic") throw new Error("Reasoning: origin evidence needs a separately reviewed schema");
    if (lesson.coreMeaning !== undefined) {
      const core = lesson.coreMeaning;
      for (const key of ["keyMeaningKo", "semanticCoreEn", "bridgeKo", "evidenceNoteKo", "limitsKo", "checkedAtKst"]) required(core[key], `core ${key}`);
      // This contract supports modern conceptual explanations only. Historical
      // claims need claim-level evidence and a separately reviewed extension.
      if (core.kind !== "conceptual") throw new Error("Reasoning: core historical evidence is not supported");
      if (!Array.isArray(core.extensions) || !core.extensions.length) throw new Error("Reasoning: core needs sense paths");
      for (const extension of core.extensions) {
        for (const key of ["senseKo", "exampleEn", "exampleKo", "cueKo"]) required(extension[key], `core ${key}`);
        if (!Array.isArray(extension.stepsKo) || extension.stepsKo.length < 2) throw new Error("Reasoning: core needs a meaning path");
        extension.stepsKo.forEach((step) => required(step, "core step"));
      }
      if (!Array.isArray(core.sources) || new Set(core.sources.map((s) => s.independenceGroup)).size < 2) throw new Error("Reasoning: core needs independent sources");
      for (const source of core.sources) {
        required(source.name, "core source name"); required(source.independenceGroup, "core source group");
        if (typeof source.url !== "string" || !source.url.startsWith("https://")) throw new Error("Reasoning: core needs a source URL");
      }
    }
    if (!Array.isArray(lesson.entryIds) || !lesson.entryIds.length) throw new Error("Reasoning: no entry mapping");
    for (const id of lesson.entryIds) {
      if (!known.has(id) || usedEntries.has(id)) throw new Error(`Reasoning: invalid or duplicate entry ${id}`);
      usedEntries.add(id);
    }
    if (!Array.isArray(lesson.neighbors) || !lesson.neighbors.length) throw new Error("Reasoning: no semantic neighbors");
    for (const neighbor of lesson.neighbors) {
      required(neighbor.expression, "neighbor expression"); required(neighbor.noteKo, "neighbor constraint");
    }
    if (!Array.isArray(lesson.questions) || !lesson.questions.length) throw new Error("Reasoning: no questions");
    for (const question of lesson.questions) {
      for (const key of ["id", "passageEn", "promptKo", "translationKo", "relationKo", "correctChoiceId"]) required(question[key], key);
      if (ids.has(question.id)) throw new Error("Reasoning: duplicate question ID");
      ids.add(question.id);
      if (question.choices?.length !== 4) throw new Error("Reasoning: four choices required");
      const choiceIds = new Set();
      const choiceTexts = new Set();
      for (const choice of question.choices) {
        for (const key of ["id", "text", "explanationKo"]) required(choice[key], key);
        const normalized = choice.text.trim().toLowerCase();
        if (choiceIds.has(choice.id) || choiceTexts.has(normalized)) throw new Error("Reasoning: duplicate choice");
        choiceIds.add(choice.id); choiceTexts.add(normalized);
        if (!errorTypes.has(choice.errorType)) throw new Error("Reasoning: unknown error type");
      }
      if (question.choices.filter((c) => c.errorType === "supported").length !== 1 ||
          !question.choices.some((c) => c.id === question.correctChoiceId && c.errorType === "supported")) throw new Error("Reasoning: answer mismatch");
      if (!question.evidence?.length || question.evidence.some((text) => typeof text !== "string" || !text.trim() || !question.passageEn.includes(text))) throw new Error("Reasoning: evidence not in passage");
    }
  }
  return data;
}

export function attachReasoningLessons(root, entries) {
  const data = validateReasoningLessons(JSON.parse(fs.readFileSync(path.join(root, "data/reasoning-lessons.json"), "utf8")), entries);
  const byEntry = new Map(data.lessons.flatMap((lesson) => lesson.entryIds.map((id) => [id, lesson])));
  for (const entry of entries) {
    const lesson = byEntry.get(entry.id);
    if (lesson) {
      const { entryIds, ...payload } = lesson;
      entry.reasoning = { ...payload, authorship: data.authorship, checkedAtKst: data.checkedAtKst };
    }
  }
  console.log(`문맥 적용: ${data.lessons.length}개 숙어 / ${data.lessons.reduce((n, l) => n + l.questions.length, 0)}문항 / ${byEntry.size}개 목록 연결`);
}
