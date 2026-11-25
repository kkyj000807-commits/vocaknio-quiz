"""Make a local-only exam image pack from the pinned admissions PDFs.

No PDF or extracted body is added to public/, Git, or the release output.
Only a complete, number-bounded single-column crop with all choice markers is emitted.
"""
import base64
import hashlib
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

import pypdfium2 as pdf
from pypdf import PdfReader

STARTS = {'가천대': (1, 1, 1), '중앙대': (2, 3, 2), '동국대': (1, 2, 2),
          '한양대': (2, 2, 2), '건국대': (3, 3, 3)}
VOCAB = {'가천대': [(1, 8)]*3, '중앙대': [(1, 7)]*3, '동국대': [(1, 4)]*3,
         '한양대': [(1, 8), (2, 7), (2, 5)], '건국대': [(1, 5)]*3}
HY = {2024:'2256', 2025:'2866', 2026:'3372'}
CHOICES = {'동국대':'ⒶⒷⒸⒹⒺ','건국대':'①②③④⑤','한양대':'①②③④⑤',
           '가천대':'①②③④','중앙대':'①②③④'}
NUMBER = re.compile(r'(?:^|\n)[ \t]*(\d{1,2})[ \t]*[.．]\s*')
repo = Path(__file__).resolve().parents[1]


def pick_rectangles(raw, first_page, nums, markers):
    doc = pdf.PdfDocument(raw)
    cells = []
    for i in range(first_page - 1, min(first_page + 5, len(doc))):
        page = doc[i]
        t = page.get_textpage()
        string = t.get_text_range()
        w, h = page.get_size()
        heads = []
        for m in NUMBER.finditer(string):
            x, y, _x2, top = t.get_charbox(m.start(1))
            if x < w*.22 or w*.43 < x < w*.68:
                heads.append((int(m[1]), m.start(1), x, top))
        rights = [x for _, _, x, _ in heads if x > w*.4]
        seam = min(rights)-5 if rights else w*.5
        for n, pos, x, top in heads:
            if n not in nums:
                continue
            right = x > w*.4
            lo, hi = (seam, w-14) if right else (x-6, seam)
            next_in_col = [y for nn,_,xx,y in heads if (xx > w*.4) == right and y < top-6]
            bottom = max(next_in_col, default=h*.05) + 3
            # Choice markers must belong to this question's rectangle, even when
            # PDF reading order interleaves the two columns.
            glyphs = set()
            char_rects = []
            for j,ch in enumerate(string):
                if ch.isspace():
                    continue
                bx,by,br,bt = t.get_charbox(j)
                if lo <= bx < hi and bottom <= bt <= top+5 and br > bx and bt > by:
                    glyphs.add(ch)
                    char_rects.append((bx,by,br,bt))
            if not set(markers).issubset(glyphs):
                continue
            # Short question images exclude the other column, directions and footer.
            xmin = max(lo, min(box[0] for box in char_rects)-4)
            xmax = min(hi, max(box[2] for box in char_rects)+3)
            ymin = max(3, min(box[1] for box in char_rects)-4)
            ymax = min(h, max(box[3] for box in char_rects)+4)
            cells.append((n, i, (xmin, ymin, xmax, ymax)))
    picked = {}
    for n,i,rect in cells:
        if n in picked:
            raise ValueError(f'duplicate number {n}; inspect before publishing a crop')
        picked[n] = (i,rect)
    crops = {}
    for n,(i,(x1,y1,x2,y2)) in picked.items():
        page = doc[i]; w,h=page.get_size()
        img=page.render(scale=2.5,crop=(x1,y1,w-x2,h-y2)).to_pil().convert('RGB')
        with io.BytesIO() as fb:
            img.save(fb,format='JPEG',quality=87,optimize=True)
            crops[n]={'page':i+1,'w':img.width,'h':img.height,'jpeg':base64.b64encode(fb.getvalue()).decode()}
    return crops


def main(source, output):
    if output.parent != (repo/'output').resolve() or output.exists():
        raise ValueError('expected new file under ignored output/')
    official=json.loads((repo/'data/official-logic-sets.json').read_bytes())
    manifest=json.loads((source/'manifest.json').read_bytes())
    records={r['file']:r for r in manifest}
    sys.path.insert(0,str(source))
    from audit_answers import parse_sheet
    sets=[]
    for s in official:
        school,y=s['school'],s['year']
        if school=='한양대':
            expected='https://go.hanyang.ac.kr/file/download.do?menu=boardfile&file_no='+HY[y]
            if s['url']!=expected:
                raise ValueError('unexpected official attachment')
            with urllib.request.urlopen(expected,timeout=14) as response:
                raw=response.read(10_000_001)
            if not raw.startswith(b'%PDF-') or len(raw)>10_000_000:
                raise ValueError('not an expected official PDF')
        else:
            fname=f'{school}-{y}-문제.pdf'; r=records[fname]
            raw=(source/fname).read_bytes()
            if r['sourceType']!='university' or hashlib.sha256(raw).hexdigest()!=r['sha256']:
                raise ValueError('unverified original')
        vo=VOCAB[school][y-2024]
        answers={}
        if s.get('keyUrl'):
            fname=f'{school}-{y}-정답.pdf'; r=records[fname]; key=(source/fname).read_bytes()
            if s['keyUrl']!=r['attachment'] or r['sourceType']!='university' or hashlib.sha256(key).hexdigest()!=r['sha256']:
                raise ValueError('unverified answer sheet')
            answers=parse_sheet(school,y,PdfReader(io.BytesIO(key)).pages[0].extract_text(extraction_mode='layout'))
        nums=list(range(vo[0],vo[1]+1))+list(range(s['first'],s['last']+1))
        images=pick_rectangles(raw,STARTS[school][y-2024],nums,CHOICES[school])
        print(school,y,'원문 컷',len(images),'보류', sorted(set(nums)-images.keys()),flush=True)
        for kind,nn in [('vocabulary',nums[:vo[1]-vo[0]+1]),('logic', nums[vo[1]-vo[0]+1:])]:
            questions=[dict(number=n,**images[n],**({'answer':answers[n]} if answers else {})) for n in nn if n in images]
            if questions:
                sets.append(dict(school=school,year=y,kind=kind,form=s.get('form',''),choices=CHOICES[school],
                                 sourceSha256=hashlib.sha256(raw).hexdigest(),questions=questions))
    with output.open('x',encoding='utf-8') as handle:
        json.dump({'schema':1,'kind':'finetune-private-exam-images','sets':sets},handle,ensure_ascii=False,separators=(',',':'))
    print(output)


if __name__=='__main__':
    main(Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve())
