import catalog from "../data/sentence-completion.json";
import { validateSentenceCompletionCatalog, blankPosition, sentenceCompletionKey } from "../lib/sentence-completion";
const questions = validateSentenceCompletionCatalog(catalog).questions;
if (questions.some(q => blankPosition(q).start < 0)) throw new Error("Missing blank");
console.log(JSON.stringify({ sentenceCompletion: {
  questions: questions.length, stableKeys: new Set(questions.map(sentenceCompletionKey)).size,
  logicTypes: new Set(questions.map(q => q.logicType)).size,
  difficulties: [...new Set(questions.map(q => q.difficulty))],
  generated: questions.filter(q => q.authorship === "generated").length,
  pastExam: questions.filter(q => q.authorship === "past-exam").length,
  note: "Structure/link validation only; not independent exam-equivalence or learning-effect evidence",
} }, null, 2));
