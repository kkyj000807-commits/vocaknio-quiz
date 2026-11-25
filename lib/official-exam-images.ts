import storage from '@/lib/learning-storage';
import { readPrivateExamContent, writePrivateExamContent } from '@/lib/local-book-file';

export type ExamKind = 'vocabulary' | 'logic';
export type ExamQuestionImage = { number: number; page: number; w: number; h: number; jpeg: string; answer?: number };
export type ScannedExamSet = { school: string; year: number; kind: ExamKind; form: string;
  choices: string; sourceSha256: string; questions: ExamQuestionImage[] };
type ExamPack = { sets: ScannedExamSet[] };
export const EXAM_FILE_MAX_BYTES = 24 * 1024 ** 2;
// This digest identifies the verified private artifact. The artifact itself
// must not be committed, bundled, fetched, or sent to a server.
const PRIVATE_EXAM_SHA256 = '0ac30e833da2b68d40ee00d202b273a4b754c6ab05ddb93917963eef8da2b023';

async function verifyExamPack(raw: string): Promise<ExamPack> {
  if (raw.length > EXAM_FILE_MAX_BYTES || !globalThis.crypto?.subtle) throw new Error('Exam verification unavailable');
  const bytes = new TextEncoder().encode(raw);
  if (bytes.byteLength > EXAM_FILE_MAX_BYTES) throw new Error('Exam file too large');
  const hash = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== PRIVATE_EXAM_SHA256) throw new Error('Exam file checksum mismatch');
  return JSON.parse(raw) as ExamPack;
}

export async function loadExamPack() {
  const raw = await readPrivateExamContent();
  return raw === undefined ? null : verifyExamPack(raw);
}
export async function importExamPack(raw: string) {
  const pack = await verifyExamPack(raw);
  await writePrivateExamContent(raw);
  return pack;
}

export type ExamProgress = { picks: Record<number, number>; revisit: Record<number, boolean> };
export const emptyExamProgress = (): ExamProgress => ({ picks: {}, revisit: {} });
export function examSetId(set: ScannedExamSet) {
  return `${set.sourceSha256}:${set.year}:${set.kind}`;
}
export function examProgressKey(set: ScannedExamSet, number: number, field: 'pick' | 'revisit') {
  if (!set.questions.some(q => q.number === number)) throw new Error('Exam question does not exist');
  return `finetune_private_exam_v1:${examSetId(set)}:${number}:${field}`;
}
export async function readExamProgress(set: ScannedExamSet) {
  const result = emptyExamProgress();
  await Promise.all(set.questions.map(async q => {
    const [pick, revisit] = await Promise.all([
      storage.getItem(examProgressKey(set,q.number,'pick')), storage.getItem(examProgressKey(set,q.number,'revisit')),
    ]);
    if (pick !== null) {
      if (!/^[1-5]$/.test(pick) || Number(pick) > set.choices.length) throw new Error('Invalid saved answer');
      result.picks[q.number] = Number(pick);
    }
    if (revisit !== null && revisit !== '1' && revisit !== '0') throw new Error('Invalid review mark');
    if (revisit === '1') result.revisit[q.number] = true;
  }));
  return result;
}
export async function writeExamPick(set: ScannedExamSet, number: number, pick: number) {
  if (!Number.isInteger(pick) || pick < 1 || pick > set.choices.length) throw new Error('Invalid answer');
  await storage.setItem(examProgressKey(set, number, 'pick'), String(pick));
}
export async function writeExamRevisit(set: ScannedExamSet, number: number, marked: boolean) {
  await storage.setItem(examProgressKey(set, number, 'revisit'), marked ? '1' : '0');
}
