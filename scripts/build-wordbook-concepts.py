"""Export display-only original 301/502 headings; never modify quiz concepts or IDs."""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build(rows, vocabulary):
    source = {row['row_id']: row for row in rows}
    assignments = {}
    for group in ('V301', 'V502'):
        major = detail = chapter = ''
        for row in rows:
            if row.get('group') != group:
                continue
            label = row.get('headword', '').strip()
            if row['kind'] == 'section':
                chapter = label
                major = detail = ''
            elif row['kind'] == 'note':
                if re.match(r'^\d+\.\s*\S', label):
                    major, detail = label, ''
                else:
                    detail = label
            elif row['kind'] == 'entry':
                assignments[row['row_id']] = (major, detail, chapter)
    # Repeated alphabetical appendix occurrences may reuse a heading only when
    # the same section + exact original word/gloss has one unambiguous grouping.
    candidates = {}
    for row in rows:
        if row['row_id'] not in assignments or row['kind'] != 'entry':
            continue
        heading = assignments[row['row_id']]
        if heading[0]:
            key = (row['group'], row['headword'], row['meaning'])
            candidates.setdefault(key, set()).add(heading[:2])
    result = {}
    for item in vocabulary:
        if item['group'] not in ('V301', 'V502'):
            continue
        row = source.get(item['id'])
        if not row or (row['headword'], row['group']) != (item['w'], item['group']):
            raise ValueError('Source ID/word/group mismatch: ' + item['id'])
        if row['meaning'] != item['k']:
            # A corrected app gloss is preserved, not replaced by an older source.
            continue
        major, detail, chapter = assignments[item['id']]
        if not major:
            matches = candidates.get((item['group'], item['w'], item['k']), set())
            if len(matches) != 1:
                continue
            major, detail = next(iter(matches))
        result[item['id']] = {'word': item['w'], 'meaning': item['k'], 'group': item['group'],
                              'major': major, 'detail': detail, 'chapter': chapter}
    return result


if __name__ == '__main__':
    source_path = Path(sys.argv[1])
    source_bytes = source_path.read_bytes()
    base_bytes = (ROOT / 'assets/vocab-v1.4.json').read_bytes()
    entries = build(json.loads(source_bytes), json.loads(base_bytes))
    payload = {'schema': 1, 'purpose': 'original-source-display-only-not-answer-contract',
               'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
               'canonicalSha256': hashlib.sha256(base_bytes).hexdigest(), 'entries': entries,
               'unresolvedIds': [x['id'] for x in json.loads(base_bytes)
                                 if x['group'] in ('V301', 'V502') and x['id'] not in entries]}
    target = ROOT / 'assets/wordbook-concepts.json'
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'EXPORTED_ORIGINAL_HEADINGS', 'rows': len(entries),
                      'groups': {g: sum(e['group'] == g for e in entries.values()) for g in ('V301', 'V502')},
                      'sourceSha256': payload['sourceSha256'], 'learnerWrites': 0}))
