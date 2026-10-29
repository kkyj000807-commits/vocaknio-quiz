"""Verified v1.5 handoff -> separate public navigation and private study projections."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTIONS = ['V101', 'V201', 'V301', 'V401', 'V501', 'V502', 'V601', '부록', '보카바이블 B', '숙어']

def build(package, pdf):
    manifest = json.loads((package / 'manifest.json').read_text(encoding='utf-8-sig'))
    source = package / 'app/app_learning_records.jsonl'
    source_bytes = source.read_bytes()
    expected = next(f['sha256'] for f in manifest['files'] if f['path'] == 'app/app_learning_records.jsonl')
    if hashlib.sha256(source_bytes).hexdigest() != expected:
        raise ValueError('Handoff app payload hash mismatch')
    from pypdf import PdfReader
    pdf_sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    publication = str(PdfReader(pdf).metadata.get('/BindingSourcePublication', ''))
    if publication != 'v1.5-' + manifest['dataset_sha256'][:16]:
        raise ValueError('PDF and dataset publication mismatch')
    canonical_bytes = (ROOT / 'assets/vocab-v1.4.json').read_bytes()
    canonical = json.loads(canonical_bytes)
    by_word = {}
    for item in canonical:
        by_word.setdefault(item['w'], []).append(item['id'])
    public, private, ids, counts = [], [], set(), dict.fromkeys(SECTIONS, 0)
    for number, line in enumerate(source_bytes.decode('utf-8-sig').splitlines(), 1):
        row = json.loads(line)
        if row['book_order'] != number or row['study_entry_id'] in ids:
            raise ValueError('Book order or stable identity mismatch')
        ids.add(row['study_entry_id'])
        section = row['display_section']
        if section not in counts:
            raise ValueError('Unknown section')
        counts[section] += 1
        placement = row['placement']
        entry = dict(id=row['study_entry_id'], order=number, section=section,
                     word=row['headword'], appIds=by_word.get(row['headword'], []),
                     concept=placement.get('concept_label', ''), chunk=placement.get('chunk_label', ''),
                     chapter=placement.get('chapter'), automaticGrading=False)
        # Exact spelling is a navigation link, NEVER an identity/sense migration.
        if entry['appIds']:
            public.append(entry)
        private.append(dict(entry, display=row['display'], pronunciation=row['pronunciation'],
                            gradingReview=row['automatic_grading']))
    if len(ids) != manifest['counts']['learning_records']:
        raise ValueError('Learning record count mismatch')
    common = dict(schema=1, edition='1.5', datasetSha256=manifest['dataset_sha256'],
                  pdfSha256=pdf_sha, sections=SECTIONS, sourceCounts=counts,
                  canonicalSha256=hashlib.sha256(canonical_bytes).hexdigest())
    if source.read_bytes() != source_bytes:
        raise ValueError('Input drift while projecting')
    public_path = ROOT / 'assets/book-edition-v1.5.json'
    private_path = ROOT / 'analysis/book-edition-v1.5/current.json'
    private_path.parent.mkdir(parents=True, exist_ok=True)
    # A string envelope avoids TypeScript constructing 13k/25k inferred object types.
    def envelope(value):
        return json.dumps({'payload': json.dumps(value, ensure_ascii=False, separators=(',', ':'))}, ensure_ascii=False, separators=(',', ':'))+'\n'
    private_bytes = envelope(dict(common, privateContent=True,
        marker='FINETUNE_PERSONAL_CONTENT_PRIVATE_ONLY', entries=private)).encode('utf-8')
    # Only the digest enters the public app. The complete file is delivered locally.
    public_path.write_text(envelope(dict(common, privateContent=False,
        localFileSha256=hashlib.sha256(private_bytes).hexdigest(), entries=public)), encoding='utf-8')
    private_path.write_bytes(private_bytes)
    order = list(dict.fromkeys(entry['word'] for entry in public))
    (ROOT / 'assets/wordbook-order.json').write_text(json.dumps(dict(schema=1,
        sourceSha256=manifest['dataset_sha256'], canonicalSha256=common['canonicalSha256'],
        orderBasis='v1.5-verified-print-placements-not-raw-dataset-order', headwords=order),
        ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    print(json.dumps(dict(status='PROJECTED', publicRecords=len(public), privateRecords=len(private),
        canonicalUnchanged=(ROOT / 'assets/vocab-v1.4.json').read_bytes() == canonical_bytes,
        userRecordsWritten=0, datasetSha256=manifest['dataset_sha256'])))

def audit(package, projection):
    """Read-only whole-content audit: original display/pronunciation, not semantic approval."""
    manifest = json.loads((package / 'manifest.json').read_text(encoding='utf-8-sig'))
    source = package / 'app/app_learning_records.jsonl'
    source_bytes = source.read_bytes()
    expected = next(f['sha256'] for f in manifest['files'] if f['path'] == 'app/app_learning_records.jsonl')
    if hashlib.sha256(source_bytes).hexdigest() != expected:
        raise ValueError('Handoff app payload hash mismatch')
    content = json.loads(json.loads(projection.read_text(encoding='utf-8'))['payload'])
    if not content.get('privateContent') or content['datasetSha256'] != manifest['dataset_sha256']:
        raise ValueError('Expected complete personal study projection of this exact dataset')
    rows = [json.loads(line) for line in source_bytes.decode('utf-8-sig').splitlines()]
    if len(rows) != len(content['entries']) or len(rows) != manifest['counts']['learning_records']:
        raise ValueError('Full study content missing')
    ids, counts, review_ids = set(), dict.fromkeys(SECTIONS, 0), set()
    for row, entry in zip(rows, content['entries']):
        if entry['id'] in ids or entry['id'] != row['study_entry_id']:
            raise ValueError('Conflicting or mismatched stable study identity')
        ids.add(entry['id'])
        if (entry['word'], entry['order'], entry['section']) != (row['headword'], row['book_order'], row['display_section']):
            raise ValueError('Word or book order changed')
        if entry['display'] != row['display'] or entry['pronunciation'] != row['pronunciation']:
            raise ValueError('Original meanings/notes/examples/patterns/pronunciation changed or missing')
        if entry['gradingReview'] != row['automatic_grading'] or entry['automaticGrading'] is not False:
            raise ValueError('Editorial review or grading boundary lost')
        if entry['gradingReview']['status'] == 'requires_editorial_policy_review':
            review_ids.add(entry['id'])
        counts[entry['section']] += 1
    review = json.loads((package / 'app/automatic_grading_review.json').read_text(encoding='utf-8-sig'))
    if review_ids != {item['study_entry_id'] for item in review['items']}:
        raise ValueError('Required five editorial reviews not retained')
    if counts != content['sourceCounts']:
        raise ValueError('Section coverage mismatch')
    print(json.dumps(dict(status='PASS_FULL_CONTENT_SOURCE_CONTRACT', entries=len(ids), sections=counts,
        requiredEditorialReviews=len(review_ids), automaticGradingPromotions=0, learnerWrites=0,
        missingWholeIPA=sum(not entry['pronunciation']['ipa'] for entry in content['entries']),
        semanticApproval=False, publicDistributionApproval=False), ensure_ascii=False))

if __name__ == '__main__':
    if sys.argv[1] == '--audit':
        audit(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        build(Path(sys.argv[1]), Path(sys.argv[2]))
