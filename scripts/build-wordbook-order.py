"""Read verified book array order; export only existing app headwords, no record writes."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if __name__ == '__main__':
    pointer_path = Path(sys.argv[1])
    pointer_bytes = pointer_path.read_bytes()
    pointer = json.loads(pointer_bytes)
    dataset_path = Path(pointer['dataset'])
    dataset = dataset_path.read_bytes()
    if hashlib.sha256(dataset).hexdigest() != pointer['dataset_sha256']:
        raise ValueError('Book source hash mismatch')
    base = (ROOT / 'assets/vocab-v1.4.json').read_bytes()
    known = {r['w'] for r in json.loads(base) if r['group'] in ('V101', 'V201', 'V301', 'V401', 'V501', 'V502', 'V601')}
    order = []
    seen = set()
    for row in json.loads(dataset):
        word = row['headword']
        if word in known and word not in seen:
            order.append(word)
            seen.add(word)
    if pointer_path.read_bytes() != pointer_bytes or dataset_path.read_bytes() != dataset:
        raise ValueError('Book changed during export')
    payload = {'schema': 1, 'sourceSha256': pointer['dataset_sha256'],
               'canonicalSha256': hashlib.sha256(base).hexdigest(),
               'orderBasis': 'verified-current-book-dataset-array-not-unbuilt-PDF', 'headwords': order}
    (ROOT / 'assets/wordbook-order.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'EXPORTED_DISPLAY_ORDER', 'mappedHeadwords': len(order),
                      'unmappedHeadwordsPreserved': len(known - seen), 'sourceSha256': pointer['dataset_sha256']}))
