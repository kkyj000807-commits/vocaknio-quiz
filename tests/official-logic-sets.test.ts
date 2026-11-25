import { expect, it } from 'vitest';
import sets from '@/data/official-logic-sets.json';

it('links unique school/year blocks on admissions hosts, without publishing the passages', () => {
  const hosts = ['admission.gachon.ac.kr','admisfile.cau.ac.kr','admission.cau.ac.kr','ipsi.dongguk.edu','go.hanyang.ac.kr','admission.konkuk.ac.kr'];
  expect(new Set(sets.map(s => s.school)).size).toBe(5);
  expect(new Set(sets.map(s => s.school+s.year)).size).toBe(sets.length);
  for (const s of sets) {
    expect(hosts).toContain(new URL(s.url).hostname);
    expect(s.last).toBeGreaterThanOrEqual(s.first);
    expect(s).not.toHaveProperty('passageEn');
    if (!s.keyUrl) expect(s.answers).toBeUndefined();
    else {
      expect(new URL(s.keyUrl).hostname).toBe('admission.gachon.ac.kr');
      expect(s.answers).toHaveLength(s.last-s.first+1);
      expect(s.answers!.every(a => Number.isInteger(a) && a>=1 && a<=4)).toBe(true);
    }
  }
  expect(sets.flatMap(s=>s.answers??[])).toHaveLength(24);
});
