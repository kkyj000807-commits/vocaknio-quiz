import { examQuestions } from "../lib/exam-questions";
import { examDisposition, examStructuralIssues } from "../lib/exam-integrity";
import { normalizeSchoolId } from "../lib/schools";
import fs from "node:fs";
import path from "node:path";

const ids = examQuestions.map(q => q.id);
const groups: Record<string, { retained: number; eligible: number }> = {};
const statuses: Record<string, number> = {};
const issues: Record<string, string[]> = {};
const logicAnswerIndices: Record<string, number> = {};
for (const q of examQuestions) {
  const disposition = examDisposition(q);
  statuses[disposition.status] = (statuses[disposition.status] ?? 0) + 1;
  const key = [normalizeSchoolId(q.school) ?? "unknown", q.year, q.type].join("/");
  const group = groups[key] ??= { retained: 0, eligible: 0 };
  group.retained++;
  if (disposition.status === "verified") group.eligible++;
  for (const issue of examStructuralIssues(q)) (issues[issue] ??= []).push(q.id);
  if (q.id.startsWith("logic-top")) logicAnswerIndices[q.answer] = (logicAnswerIndices[q.answer] ?? 0) + 1;
}
const eligible = examQuestions.filter(q => examDisposition(q).status === "verified");
const catalog = { schema: 1, retainedCount: examQuestions.length, questions: eligible };
const catalogPath = path.resolve("assets/exam-release-catalog.json");
const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
if (fs.readFileSync(catalogPath, "utf8").replace(/\r\n/g, "\n") !== serialized) fs.writeFileSync(catalogPath, serialized, "utf8");
const errors = [];
if (new Set(ids).size !== ids.length) errors.push("duplicate-question-id");
if (eligible.some(q => examStructuralIssues(q).length)) errors.push("invalid-practice-question");
console.log(JSON.stringify({
  retained: ids.length, statuses, groups, issues, logicAnswerIndices,
  eligibility: eligible.length,
  answerAccuracy: "NOT_VERIFIED: structural checks are not official answer evidence",
  quarantine: errors.length ? "FAIL" : "PASS",
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
