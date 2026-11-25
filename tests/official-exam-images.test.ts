import { beforeEach, expect, it, vi } from 'vitest';

const {disk} = vi.hoisted(()=>({disk:new Map<string,string>()}));
vi.mock('@/lib/learning-storage',()=>({default:{
  getItem: async (k:string)=>disk.get(k) ?? null,
  setItem: async (k:string,v:string)=>{disk.set(k,v);},
}}));
vi.mock('@/lib/local-book-file',()=>({readPrivateExamContent:vi.fn(),writePrivateExamContent:vi.fn()}));
import { emptyExamProgress, examProgressKey, importExamPack, readExamProgress, type ScannedExamSet,
  writeExamPick, writeExamRevisit } from '@/lib/official-exam-images';
import {writePrivateExamContent} from '@/lib/local-book-file';

const set: ScannedExamSet = {school:'가천대',year:2026,kind:'logic',sourceSha256:'fixture-a',form:'영어',
  choices:'①②③④',questions:[{number:15,page:4,w:400,h:600,jpeg:'unused',answer:3}]};
beforeEach(()=>disk.clear());

it('records each source question and review mark separately and restores only the selected set',async()=>{
  const vocab = {...set,kind:'vocabulary' as const};
  const otherSchool = {...set,school:'중앙대',sourceSha256:'fixture-b'};
  disk.set('vocaknio_stats','existing records');
  await writeExamPick(set,15,2);
  await writeExamRevisit(set,15,true);
  await writeExamPick(vocab,15,3);
  expect(await readExamProgress(set)).toEqual({picks:{15:2},revisit:{15:true}});
  expect(await readExamProgress(vocab)).toEqual({picks:{15:3},revisit:{}});
  expect(await readExamProgress(otherSchool)).toEqual(emptyExamProgress());
  expect(disk.get('vocaknio_stats')).toBe('existing records');
});

it('rejects invalid records and cannot write answers outside that exam form',async()=>{
  const key = examProgressKey(set,15,'pick');
  disk.set(key,'5');
  await expect(readExamProgress(set)).rejects.toThrow();
  await expect(writeExamPick(set,15,5)).rejects.toThrow();
  await expect(writeExamPick(set,16,1)).rejects.toThrow();
  expect(disk.get(key)).toBe('5');
});

it('rejects an arbitrary local import without replacing stored content',async()=>{
  await expect(importExamPack(JSON.stringify({kind:'finetune-private-exam-images',sets:[]}))).rejects.toThrow();
  expect(writePrivateExamContent).not.toHaveBeenCalled();
});

it.each([true, false])('only reports persistence after the verified file is saved (persisted=%s)', async persisted => {
  const verifiedHash = '0ac30e833da2b68d40ee00d202b273a4b754c6ab05ddb93917963eef8da2b023';
  const digest = vi.fn(async () => Uint8Array.from(Buffer.from(verifiedHash, 'hex')).buffer);
  const write = vi.mocked(writePrivateExamContent);
  if (persisted) write.mockResolvedValueOnce(undefined);
  else write.mockRejectedValueOnce(new Error('Device storage unavailable'));
  const raw = JSON.stringify({ sets:[set] });
  vi.stubGlobal('crypto', {subtle:{digest}});
  try {
    const result = await importExamPack(raw);
    expect(digest).toHaveBeenCalledOnce();
    expect(write).toHaveBeenLastCalledWith(raw);
    expect(result).toEqual({ pack:{sets:[set]}, persisted });
    expect(disk.size).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
