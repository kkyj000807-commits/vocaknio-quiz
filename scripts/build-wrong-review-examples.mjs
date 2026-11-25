// Project licensed bilingual examples. Never read a learner's wrong list.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const manifest = read('assets/public-book-manifest.json');
if (manifest.edition !== '1.7.4') throw new Error('Recheck examples against the new edition first');
const book = read('public/' + manifest.file).current.entries;
const vocab = read('assets/vocab-v1.4.json');
const legacy = new Map(vocab.map(v => [v.id, v]));
const bookByLegacy = new Map();
for (const e of book) for (const id of e.appIds) {
  if (!bookByLegacy.has(id)) bookByLegacy.set(id, []);
  bookByLegacy.get(id).push(e);
}
const units = s => s.split(/[;,/·①-⑳]|→/u).map(x => x.trim()).filter(Boolean);
const hasSense = (gloss, sense) => {
  if (gloss === sense) return true;
  const g = units(gloss), s = units(sense);
  return s.length > 0 && g.some((_, i) => s.every((v, j) => g[i+j] === v));
};
const rows = [];
function add(word, sense, en, ko, ids, books, source = 'FINETUNE') {
  const links = new Map();
  for (const id of ids) {
    const v = legacy.get(id);
    if (v?.w === word && hasSense(v.k, sense)) links.set(id, { id, gloss:v.k, section:v.group });
  }
  for (const b of books) if (b && b.word === word && hasSense(b.display.meaning_display, sense))
    links.set(b.id, { id:b.id, gloss:b.display.meaning_display, section:b.section });
  if (links.size) rows.push({ word, sense, en, ko, source, links:[...links.values()] });
  return links;
}
for (const x of read('data/vocab-learning/wrong-review-examples.json').entries) {
  const b = book.find(e => e.id === x.id);
  if (!add(x.word,x.sense,x.en,x.ko,b?.appIds ?? [],[b]).has(x.id)) throw new Error('Unmatched authoring target: '+x.id);
}
for (const x of read('data/vocab-learning/editorial-examples-20261015.json').entries) {
  if (x.reviewStatus !== 'ai-reviewed-editorial-example' || !x.en || !x.ko) continue;
  add(x.headword,x.sourceMeaningKo,x.en,x.ko,x.sourceRowIds,x.sourceRowIds.flatMap(id => bookByLegacy.get(id) ?? []));
}
const index = read('assets/vocab-learning-index-v1.4.json');
const dir = 'public/data/vocab-learning/'+index.version;
for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()) {
  const batch = read(dir+'/'+file);
  if (batch.version !== index.version) throw new Error('Learning source version mismatch');
  for (const x of batch.entries) {
    if (x.definitionStatus !== 'production' || x.verification?.status !== 'cross-agreed' ||
        x.example?.kind !== 'editorial' || !x.example.en || !x.example.ko) continue;
    for (const gloss of x.localGlosses) {
      const ids = x.itemIds.filter(id=>legacy.get(id)?.k === gloss);
      add(x.headword, gloss, x.example.en, x.example.ko, ids, ids.flatMap(id=>bookByLegacy.get(id)??[]));
    }
  }
}
const translated = read('data/vocab-learning/reviewed-examples-20261014.json');
// This specific selection was inspected as full sentences; never auto-approve new inputs.
if (createHash('sha256').update(JSON.stringify(translated.entries)).digest('hex') !== 'c8078e56cd16e80ca9ab2da2205c0dde33c9d61d440bc5cf0f977525707616e9') throw new Error('Recheck translated example selection');
for (const x of translated.entries) {
  if (x.reviewStatus !== 'ai-reviewed-example-translation' || !x.ko || !/^[A-Z]/.test(x.en) ||
      x.en.split(/\s+/).length < 5 || x.en.startsWith('Slavery was abolished')) continue;
  add(x.headword,x.sourceMeaningKo,x.en,x.ko,x.sourceRowIds,x.sourceRowIds.flatMap(id=>bookByLegacy.get(id)??[]),'OEWN 2025');
}
const path = 'assets/wrong-review-examples.json';
const json = JSON.stringify(rows)+'\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n') !== json) throw new Error('Stale example projection');
} else fs.writeFileSync(path,json);
console.log({examples:rows.length, legacyIds:new Set(rows.flatMap(r=>r.links.filter(l=>!l.id.startsWith('study-')).map(l=>l.id))).size,
  bookIds:new Set(rows.flatMap(r=>r.links.filter(l=>l.id.startsWith('study-')).map(l=>l.id))).size});
