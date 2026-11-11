import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectEncryptedBookPackage, revisedBookEdition, persistRevisedBook, restoreRevisedBook, REVISED_BOOK_PDF_HASH } from '../lib/encrypted-book-package';
import { inspectLocalBook, readRevisedBookContent, writeRevisedBookContent } from '../lib/local-book-file';
import { activateRevisedBook } from '../lib/integrated-wordbook';

vi.mock('@/lib/local-book-file', () => ({ inspectLocalBook: vi.fn(), readRevisedBookContent: vi.fn(), writeRevisedBookContent: vi.fn() }));
vi.mock('@/lib/integrated-wordbook', () => ({ activateRevisedBook: vi.fn() }));
const expectedDigest = '7edd91a704b8e68d853c770cf6cc5e078e4f36f0a9f60b6480b03130f98ba9eb';
const encoder = new TextEncoder();
function fixture() {
  const sections = ['V101', 'V201', 'V301', 'V401', 'V501', 'V502', 'V601', '부록', '추가 숙어'];
  const counts = [166, 88, 12, 156, 622, 11, 2, 557, 4175];
  const rows = sections.flatMap((section, i) => Array.from({ length: counts[i] }, () => ({ print_section: section })));
  const revision = rows.map((row, i) => ({ ...row, id: `study-${i + 1}`, display_number: i + 1,
    headword: 'fixture', meaning_display: '뜻', ipa: '', korean_pronunciation: '', display_notes: [],
    source_member_ids: [`study-${i + 1}`, ...(i < 74 ? [`study-${5790 + i}`] : [])] }));
  const base = { entries: Array.from({ length: 5873 }, (_, i) => ({ id: `study-${i + 1}`, section: '숙어' })) };
  return { base, revision };
}
const payload = (revision: unknown) => encoder.encode(JSON.stringify({ schema: 2, edition: '1.7.4', pdfSha256: REVISED_BOOK_PDF_HASH, base: 'fixture', revision: JSON.stringify({ idioms: revision }) }));
const digest = (hex: string) => Uint8Array.from(hex.match(/../g)!, part => parseInt(part, 16)).buffer;
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('encrypted revision validation', () => {
  it('validates ordered representatives and preserves all base entries', async () => {
    const f = fixture(); vi.mocked(inspectLocalBook).mockResolvedValue(f.base as never);
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(digest(expectedDigest));
    const result = await inspectEncryptedBookPackage(payload(f.revision));
    expect(result.placements).toHaveLength(5789);
    expect(result.base.entries).toHaveLength(5873);
    expect(result.placements[0].sourceIds).toEqual(['study-1', 'study-5790']);
  });
  it('rejects hash drift and duplicate source membership before returning data', async () => {
    const f = fixture(); vi.mocked(inspectLocalBook).mockResolvedValue(f.base as never);
    const hash = vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(digest('00'.repeat(32)));
    await expect(inspectEncryptedBookPackage(payload(f.revision))).rejects.toThrow('checksum');
    hash.mockResolvedValue(digest(expectedDigest));
    f.revision[1].source_member_ids.push('study-1');
    await expect(inspectEncryptedBookPackage(payload(f.revision))).rejects.toThrow('identity');
  });
  it('uses the current source meaning and pronunciation without appending any old text', async () => {
    const f = fixture();
    const original = JSON.stringify(f.base);
    Object.assign(f.base.entries[0], { display: { meaning_display: 'obsolete', annotations: ['old note'] },
      pronunciation: { ipa: 'old ipa' } });
    vi.mocked(inspectLocalBook).mockResolvedValue(f.base as never);
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(digest(expectedDigest));
    const verified = await inspectEncryptedBookPackage(payload(f.revision));
    const sourceBefore = JSON.stringify(verified.base);
    const current = revisedBookEdition(verified);
    expect(current.edition).toBe('1.7.4');
    expect(current.entries).toHaveLength(5789);
    expect(current.entries[0].display).toEqual({ meaning_display: '뜻', annotations: [], examples: [], patterns: [] });
    expect(current.entries[0].pronunciation?.ipa).toBe('');
    expect(current.entries.at(-1)?.printedNumber).toBe(5789);
    expect(current.entries[0].automaticGrading).toBe(false);
    expect(JSON.stringify(verified.base)).toBe(sourceBefore);
    expect(original).not.toContain('obsolete');
  });
  it('does not activate on a failed save; restores the verified revision before learning resumes', async () => {
    const f = fixture(); vi.mocked(inspectLocalBook).mockResolvedValue(f.base as never);
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(digest(expectedDigest));
    vi.mocked(writeRevisedBookContent).mockRejectedValueOnce(new Error('quota'));
    await expect(persistRevisedBook(payload(f.revision))).rejects.toThrow('quota');
    expect(activateRevisedBook).not.toHaveBeenCalled();
    vi.mocked(writeRevisedBookContent).mockResolvedValueOnce(undefined);
    await persistRevisedBook(payload(f.revision));
    expect(activateRevisedBook).toHaveBeenCalledTimes(1);
    vi.mocked(readRevisedBookContent).mockResolvedValueOnce(new TextDecoder().decode(payload(f.revision)));
    expect(await restoreRevisedBook()).toBe(true);
    expect(activateRevisedBook).toHaveBeenCalledTimes(2);
    vi.mocked(readRevisedBookContent).mockResolvedValueOnce('invalid preserved source');
    await expect(restoreRevisedBook()).rejects.toThrow();
    expect(activateRevisedBook).toHaveBeenCalledTimes(2);
    expect(writeRevisedBookContent).toHaveBeenCalledTimes(2); // no repair write on failed read
  });
  it('rejects the old package even when its old book and idiom hashes match', async () => {
    const raw = JSON.parse(new TextDecoder().decode(payload(fixture().revision)));
    raw.edition = '1.5';
    await expect(inspectEncryptedBookPackage(encoder.encode(JSON.stringify(raw)))).rejects.toThrow('Invalid package');
  });
});
