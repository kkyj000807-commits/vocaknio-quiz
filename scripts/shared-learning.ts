/** One-way export of the existing app contract, never a learner-data importer. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  isLearningEntry, isSharedSenseLinks, sharedLinkMatches, SHARED_LINK_SCHEMA,
  type LearningEntry, type SharedSenseLinks,
} from '../lib/vocab-learning';

export const sha = (bytes: string | Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
type Occurrence = { id: string; w: string; num: number; k: string; p: string; group: string };
export function validateSharedLinks(value: unknown, entries: LearningEntry[], occurrences: Occurrence[]): SharedSenseLinks {
  if (!isSharedSenseLinks(value)) throw new Error('Unsupported shared link contract');
  const rows = new Map(occurrences.map(row => [row.id, row]));
  for (const link of value.links) {
    if (rows.get(link.itemId)?.w !== link.headword ||
        !entries.some(entry => sharedLinkMatches(entry, link))) throw new Error('Stale reviewed link');
  }
  return value;
}
export function readShared(directory: string) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const raw = fs.readFileSync(path.join(directory, 'shared.json'));
  if (manifest.schema !== 1 || sha(raw) !== manifest.sha256) throw new Error('Shared schema/hash mismatch');
  const data = JSON.parse(raw.toString());
  if (data.schema !== 1 || data.adapterVersion !== 3 || data.contentVersion !== manifest.contentVersion ||
      manifest.adapterVersion !== 3) throw new Error('Mixed shared version or unsupported adapter');
  if (!Array.isArray(data.occurrences) || !Array.isArray(data.entries)) throw new Error('Missing shared arrays');
  const ids = new Set<string>();
  for (const row of data.occurrences) {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) ||
        typeof row.w !== 'string' || !row.w.trim() || typeof row.k !== 'string' ||
        typeof row.p !== 'string' || !Number.isSafeInteger(row.num)) throw new Error('Invalid occurrence identity');
    ids.add(row.id);
  }
  approvedSharedEntries(data.entries, ids);
  const links = validateSharedLinks(data.sharedLinks, data.entries, data.occurrences);
  if (links.contentVersion !== data.contentVersion || manifest.bookSourceSha256 !== links.sourceSha256) {
    throw new Error('Mixed shared link/content version');
  }
  if (manifest.rows !== data.occurrences.length ||
      manifest.senses !== new Set(data.entries.map((e: LearningEntry) => e.senseId)).size ||
      manifest.exportOccurrences !== data.entries.length) throw new Error('Shared manifest count mismatch');
  for (const name of ['print-supplement.csv', 'book-linked-supplement.html']) {
    if (typeof manifest.artifacts?.[name] !== 'string' ||
        sha(fs.readFileSync(path.join(directory, name))) !== manifest.artifacts[name]) throw new Error('Shared artifact hash mismatch');
  }
  return data;
}
export function approvedSharedEntries(entries: unknown[], ids: Set<string>): LearningEntry[] {
  const seen = new Set<string>();
  const contentBySense = new Map<string, string>();
  return entries.map(entry => {
    if (!isLearningEntry(entry) || !entry.itemIds.length || entry.itemIds.some(id => !ids.has(id))) throw new Error('Invalid app contract or broken occurrence link');
    // Same sense in different chapters remains separate export occurrences.
    const key = `${entry.id}\0${entry.itemIds.join('\0')}`;
    if (seen.has(key)) throw new Error('Duplicate export occurrence');
    seen.add(key);
    // Chapter/group and printed expression variants belong to occurrences.
    // They remain in the exported objects, not in the shared explanation key.
    const content = Object.fromEntries(Object.entries(entry).filter(([field]) =>
      !['id', 'itemIds', 'sharedBookReferences', 'group', 'headword'].includes(field)));
    const signature = JSON.stringify(content);
    if (contentBySense.has(entry.senseId) && contentBySense.get(entry.senseId) !== signature) {
      throw new Error('Conflicting content for the same sense');
    }
    contentBySense.set(entry.senseId, signature);
    return entry;
  });
}

export function exportShared(root: string, destination: string) {
  const baselineBytes = fs.readFileSync(path.join(root, 'assets/vocab-v1.4.json'));
  const baseline = JSON.parse(baselineBytes.toString()) as Occurrence[];
  const indexBytes = fs.readFileSync(path.join(root, 'assets/vocab-learning-index-v1.4.json'));
  const index = JSON.parse(indexBytes.toString()) as { version: string; items: Record<string, {group: string; entryIds: string[]}> };
  const groups = [...new Set(Object.values(index.items).map(p => p.group))];
  const files: Record<string, string> = {};
  const entries: LearningEntry[] = [];
  const ids = new Set(baseline.map(row => row.id));
  for (const group of groups) {
    if (!/^[A-Z0-9]+$/.test(group)) throw new Error('Invalid group');
    const relative = `public/data/vocab-learning/${index.version}/${group.toLowerCase()}.json`;
    const bytes = fs.readFileSync(path.join(root, relative));
    const data = JSON.parse(bytes.toString());
    if (data.version !== index.version || data.group !== group) throw new Error('Mixed content version');
    files[relative] = sha(bytes);
    entries.push(...approvedSharedEntries(data.entries, ids));
  }
  approvedSharedEntries(entries, ids);
  for (const [id, pointer] of Object.entries(index.items) as [string, { entryIds: string[] }][]) {
    for (const entryId of pointer.entryIds) if (!entries.some(e => e.id === entryId && e.itemIds.includes(id))) throw new Error('Broken index pointer');
  }
  // Full fields preserved in JSON; the print supplement intentionally omits audio etc.
  const linksBytes = fs.readFileSync(path.join(root, 'assets/shared-sense-links.json'));
  const sharedLinks = validateSharedLinks(JSON.parse(linksBytes.toString()), entries, baseline);
  if (sharedLinks.contentVersion !== index.version) throw new Error('Shared link content version mismatch');
  const payload = JSON.stringify({ schema: 1, adapterVersion: 3, contentVersion: index.version, entries, occurrences: baseline, sharedLinks });
  const digest = sha(payload);
  const out = path.resolve(destination, digest);
  fs.mkdirSync(out, { recursive: true });
  const writeOnce = (name: string, bytes: string) => {
    const target = path.join(out, name);
    if (fs.existsSync(target)) { if (fs.readFileSync(target, 'utf8') !== bytes) throw new Error('Immutable export conflict'); }
    else fs.writeFileSync(target, bytes, { flag: 'wx' });
  };
  writeOnce('shared.json', payload);
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const entriesByItem = new Map<string, LearningEntry[]>();
  for (const entry of entries) for (const id of entry.itemIds) {
    const list = entriesByItem.get(id) ?? [];
    if (!list.some(existing => existing.senseId === entry.senseId)) list.push(entry);
    entriesByItem.set(id, list);
  }
  const printRows = [['itemId', 'senseId', 'word', 'originalGloss', 'definitionKo', 'exampleEn', 'exampleKo'],
    ...baseline.flatMap(row => (entriesByItem.get(row.id) ?? []).map(e => [row.id, e.senseId, row.w, row.k, e.definitionKo, e.example.en, e.example.ko]))];
  const printCsv = '\ufeff' + printRows.map(r => r.map(quote).join(',')).join('\r\n');
  writeOnce('print-supplement.csv', printCsv);
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const linked = sharedLinks.links.map(link => {
    const entry = entries.find(e => sharedLinkMatches(e, link));
    if (!entry) throw new Error('Stale reviewed link');
    return `<article><h2>${escape(entry.headword)}</h2><p>제본 ${escape(link.bookEntryId)} · 앱 ${escape(link.itemId)} · ${escape(entry.senseId)}</p><p>${escape(entry.definitionKo)}</p><p>${escape(entry.example.en)}</p><p>${escape(entry.example.ko)}</p><small>${entry.sources.map(source => escape([source.name,source.edition,source.license,source.attribution ?? '',source.url].join(' · '))).join('<br>')}</small></article>`;
  });
  const printHtml = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>공통 검수 학습 보충</title><style>body{max-width:800px;margin:24px auto;padding:16px;font:18px/1.65 sans-serif}article{break-inside:avoid;border-bottom:1px solid #aaa;padding:16px 0}</style><h1>제본·FINETUNE 공통 학습 보충</h1><p>원본 제본의 순서·뜻을 교체하지 않는 보충자료. 기존 승인 해설 재사용, 새 문제 승격 없음.</p>${linked.join('')}</html>`;
  writeOnce('book-linked-supplement.html', printHtml);
  // Recheck inputs before publishing the receipt; partial output has no manifest.
  if (sha(fs.readFileSync(path.join(root, 'assets/vocab-v1.4.json'))) !== sha(baselineBytes) ||
      sha(fs.readFileSync(path.join(root, 'assets/vocab-learning-index-v1.4.json'))) !== sha(indexBytes) ||
      sha(fs.readFileSync(path.join(root, 'assets/shared-sense-links.json'))) !== sha(linksBytes) ||
      Object.entries(files).some(([name, hash]) => sha(fs.readFileSync(path.join(root, name))) !== hash)) {
    throw new Error('Source changed during export');
  }
  const manifest = { schema: 1, adapterVersion: 3, contentVersion: index.version, sha256: digest, baselineSha256: sha(baselineBytes), indexSha256: sha(indexBytes), files,
    bookSourceSha256: sharedLinks.sourceSha256, linksSha256: sha(linksBytes),
    artifacts: { 'print-supplement.csv': sha(printCsv), 'book-linked-supplement.html': sha(printHtml) },
    rows: baseline.length, senses: new Set(entries.map(e => e.senseId)).size, exportOccurrences: entries.length,
    migration: 'NONE', bookSenseLinks: { linkedOccurrences: sharedLinks.links.length, newAnswerPromotion: 0 }, status: 'EXPORTED_EXISTING_APP_APPROVAL_NOT_NEW_REVIEW' };
  writeOnce('manifest.json', JSON.stringify(manifest, null, 2));
  readShared(out);
  return { ...manifest, directory: out };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] === '--validate') {
    const data = readShared(process.argv[3]);
    console.log(JSON.stringify({ schema: data.schema, adapterVersion: data.adapterVersion,
      sourceSha256: data.sharedLinks.sourceSha256, contentVersion: data.contentVersion,
      rows: data.occurrences.length, links: data.sharedLinks.links.length }));
  } else if (process.argv[2] === '--contract') {
    const index = JSON.parse(fs.readFileSync('assets/vocab-learning-index-v1.4.json', 'utf8'));
    console.log(JSON.stringify({ sharedLinkSchema: SHARED_LINK_SCHEMA, contentVersion: index.version }));
  } else if (process.argv[2] === '--validate-links') {
    const candidate = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    const baseline = JSON.parse(fs.readFileSync('assets/vocab-v1.4.json', 'utf8'));
    const index = JSON.parse(fs.readFileSync('assets/vocab-learning-index-v1.4.json', 'utf8'));
    const entries = [...new Set(Object.values(index.items).map((p) => (p as { group: string }).group))]
      .flatMap(group => JSON.parse(fs.readFileSync(`public/data/vocab-learning/${index.version}/${group.toLowerCase()}.json`, 'utf8')).entries);
    approvedSharedEntries(entries, new Set(baseline.map((r: Occurrence) => r.id)));
    const links = validateSharedLinks(candidate, entries, baseline);
    if (links.contentVersion !== index.version) throw new Error('Link content version mismatch');
    console.log(JSON.stringify({ valid: true, links: links.links.length, schema: SHARED_LINK_SCHEMA }));
  } else {
    console.log(JSON.stringify(exportShared(process.cwd(), process.argv[2] ?? 'analysis/shared-learning'), null, 2));
  }
}
