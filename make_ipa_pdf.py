"""
IPA 발음기호 완전정복 PDF 생성기
- 한국인 학습자를 위한 시인성 중심 디자인
- 모든 예시 단어에 한글 발음 병기
- 카드 기반 레이아웃
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_REG = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
FONT_IPA = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_IPA_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

pdfmetrics.registerFont(TTFont("KR", FONT_REG))
pdfmetrics.registerFont(TTFont("KR-Bold", FONT_BOLD))
pdfmetrics.registerFont(TTFont("IPA", FONT_IPA))
pdfmetrics.registerFont(TTFont("IPA-Bold", FONT_IPA_BOLD))

from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("KR", normal="KR", bold="KR-Bold", italic="KR", boldItalic="KR-Bold")
registerFontFamily("IPA", normal="IPA", bold="IPA-Bold", italic="IPA", boldItalic="IPA-Bold")

# IPA에서만 등장하는 유니코드 문자들 — NanumGothic이 지원 안 하므로 IPA 폰트로 감싸야 함
IPA_ONLY = set("ɪæθðʃʒʌəɔɒʊɜɑɐɛɘɞɵɤʏʉœɶɲɳɭɽɻɹɰɢʁʕʡʢʘǀǁǂǃˈˌːˑʔʼŋɡɟʈɖɱɫɬɮβɸʋʍɥ̩̥̃̊")

def _has_korean(text):
    return any('가' <= ch <= '힣' for ch in text)

def _has_ipa(text):
    return any(ch in IPA_ONLY for ch in text)

import re
_TAG_RE = re.compile(r'<[^>]+>')

def W_IPA(text):
    """IPA 전용 문자를 IPA 폰트로 감싸 줌. HTML 태그를 보존.
    - IPA 문자가 없으면 원본 반환
    - HTML 태그는 그대로 두고, 태그 사이의 텍스트 청크 단위로 처리
    - 한글이 없는 청크는 통째로 IPA 폰트로 감쌈 (bidi 안정)
    - 한글이 있는 청크는 IPA 단일 문자만 감쌈
    """
    if not text or not _has_ipa(text):
        return text

    parts = []
    last = 0
    for m in _TAG_RE.finditer(text):
        if m.start() > last:
            parts.append(("text", text[last:m.start()]))
        parts.append(("tag", m.group()))
        last = m.end()
    if last < len(text):
        parts.append(("text", text[last:]))

    out = []
    for kind, chunk in parts:
        if kind == "tag":
            out.append(chunk)
            continue
        if not _has_ipa(chunk):
            out.append(chunk)
            continue
        if not _has_korean(chunk):
            out.append(f'<font name="IPA">{chunk}</font>')
            continue
        # 혼합: 글자 단위로 IPA 문자만 감쌈 (ASCII는 그대로 KR 폰트 - 안 보이는 글자 거의 없음)
        buf = ""
        in_ipa = False
        for ch in chunk:
            cur = ch in IPA_ONLY
            if cur != in_ipa:
                if buf:
                    out.append(f'<font name="IPA">{buf}</font>' if in_ipa else buf)
                buf = ""
                in_ipa = cur
            buf += ch
        if buf:
            out.append(f'<font name="IPA">{buf}</font>' if in_ipa else buf)
    return "".join(out)

W, H = A4
MARGIN = 14 * mm
CONTENT_W = W - 2 * MARGIN

# ── 색상 팔레트 (학습 친화적 파스텔톤) ──────────────────────────────────────
NAVY       = colors.HexColor("#1E3A8A")
NAVY_DARK  = colors.HexColor("#0F1E4D")
BLUE       = colors.HexColor("#3B82F6")
SKY        = colors.HexColor("#DBEAFE")
SKY_SOFT   = colors.HexColor("#EFF6FF")
ROSE       = colors.HexColor("#E11D48")
ROSE_SOFT  = colors.HexColor("#FFF1F2")
PEACH      = colors.HexColor("#FED7AA")
PEACH_SOFT = colors.HexColor("#FFF7ED")
GREEN      = colors.HexColor("#059669")
GREEN_SOFT = colors.HexColor("#ECFDF5")
MINT       = colors.HexColor("#D1FAE5")
YELLOW     = colors.HexColor("#F59E0B")
YELLOW_SOFT= colors.HexColor("#FEF3C7")
PURPLE     = colors.HexColor("#7C3AED")
PURPLE_SOFT= colors.HexColor("#F3E8FF")
GREY_TXT   = colors.HexColor("#374151")
GREY_LIGHT = colors.HexColor("#F3F4F6")
GREY_BORDER= colors.HexColor("#E5E7EB")
WHITE      = colors.white

# ── 스타일 ────────────────────────────────────────────────────────────────
def st(name, size=11, color=GREY_TXT, align=0, bold=False, leading=None):
    return ParagraphStyle(
        name, fontName="KR", fontSize=size, textColor=color,
        alignment=align, leading=leading or size * 1.4
    )

S_COVER_TITLE  = st("ct",  34, WHITE,     align=1, leading=42)
S_COVER_SUB    = st("cs",  13, SKY,       align=1)
S_COVER_TAG    = st("ctg", 11, WHITE,     align=1)
S_SECTION      = st("sec", 18, NAVY,      align=0, leading=22)
S_SECTION_SUB  = st("ses", 11, GREY_TXT,  align=0)
S_H2           = st("h2",  14, BLUE,      align=0)
S_BODY         = st("b",   11, GREY_TXT)
S_BODY_C       = st("bc",  11, GREY_TXT,  align=1)

# 카드 내부 스타일
S_IPA_HUGE     = st("ipa", 32, ROSE,      align=1, leading=36)
S_KOR_READ     = st("kr",  18, NAVY,      align=1, leading=22)
S_CARD_LABEL   = st("cl",  10, GREY_TXT,  align=1)
S_CARD_EX_EN   = st("cee", 11, NAVY,      align=1)
S_CARD_EX_KR   = st("cek", 10, ROSE,      align=1)
S_CARD_TIP     = st("cti", 9,  GREEN,     align=0, leading=12)

S_BIG_NUMBER   = st("bn",  20, WHITE,     align=1)
S_WHITE_BODY   = st("wb",  11, WHITE,     align=0)
S_WHITE_C      = st("wc",  11, WHITE,     align=1)

# ── 유틸 ─────────────────────────────────────────────────────────────────
def sp(h=4):
    return Spacer(1, h * mm)

def hr(color=GREY_BORDER, thick=0.8):
    return HRFlowable(width="100%", thickness=thick, color=color, spaceBefore=2, spaceAfter=2)

def section_header(num, title, subtitle=""):
    """챕터 헤더 — 큰 번호 + 제목"""
    inner_left = Paragraph(num, S_BIG_NUMBER)
    inner_right_data = [
        [Paragraph(W_IPA(title), S_SECTION)],
        [Paragraph(W_IPA(subtitle), S_SECTION_SUB)] if subtitle else [Paragraph("", S_SECTION_SUB)],
    ]
    inner_right = Table(inner_right_data, colWidths=[CONTENT_W - 18*mm])
    inner_right.setStyle(TableStyle([
        ("VALIGN", (0,0),(-1,-1),"MIDDLE"),
        ("LEFTPADDING",(0,0),(-1,-1),6),
        ("TOPPADDING",(0,0),(-1,-1),0),
        ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))

    t = Table([[inner_left, inner_right]], colWidths=[18*mm, CONTENT_W - 18*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(0,0), NAVY),
        ("BACKGROUND",(1,0),(1,0), SKY_SOFT),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),10),
        ("BOTTOMPADDING",(0,0),(-1,-1),10),
        ("LEFTPADDING",(0,0),(0,0),0),
        ("RIGHTPADDING",(0,0),(0,0),0),
        ("LEFTPADDING",(1,0),(1,0),12),
        ("LINEBELOW",(0,0),(-1,-1),2,NAVY),
    ]))
    return t

def make_card(ipa, korean_read, desc, examples, tip, accent=ROSE, soft=ROSE_SOFT):
    """
    단일 발음기호 카드.
    examples: [(영어, 한글발음), ...]
    """
    # 상단: 큰 IPA 기호
    top = Table([[Paragraph(W_IPA(ipa), S_IPA_HUGE)]], colWidths=[None])
    top.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), soft),
        ("TOPPADDING",(0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))

    # 한글 읽기
    kor_p = Paragraph(W_IPA(f'<b>"{korean_read}"</b>'), S_KOR_READ)
    kor_tbl = Table([[kor_p]], colWidths=[None])
    kor_tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), soft),
        ("TOPPADDING",(0,0),(-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 6),
    ]))

    # 설명
    desc_p = Paragraph(W_IPA(desc), st("desc", 10, GREY_TXT, align=1, leading=13))
    desc_tbl = Table([[desc_p]], colWidths=[None])
    desc_tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), WHITE),
        ("TOPPADDING",(0,0),(-1,-1), 6),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("LINEABOVE",(0,0),(-1,0), 0.5, GREY_BORDER),
    ]))

    # 예시 (영어/한글)
    ex_rows = []
    for en, kr in examples:
        ex_rows.append([
            Paragraph(W_IPA(en), S_CARD_EX_EN),
            Paragraph(W_IPA(f"[{kr}]"), S_CARD_EX_KR),
        ])
    ex_tbl = Table(ex_rows, colWidths=[None, None])
    ex_tbl.setStyle(TableStyle([
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1), 2),
        ("BOTTOMPADDING",(0,0),(-1,-1), 2),
    ]))

    ex_wrap = Table([[ex_tbl]], colWidths=[None])
    ex_wrap.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), WHITE),
        ("TOPPADDING",(0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 6),
    ]))

    # 팁
    tip_p = Paragraph(W_IPA(f"&#9679; {tip}"), st("tip", 9, GREEN, leading=12))
    tip_tbl = Table([[tip_p]], colWidths=[None])
    tip_tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), GREEN_SOFT),
        ("TOPPADDING",(0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING",(0,0),(-1,-1), 8),
        ("RIGHTPADDING",(0,0),(-1,-1), 8),
    ]))

    # 카드 전체 조립
    card_data = [
        [top],
        [kor_tbl],
        [desc_tbl],
        [ex_wrap],
        [tip_tbl],
    ]
    card = Table(card_data, colWidths=[None])
    card.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1), 0),
        ("RIGHTPADDING",(0,0),(-1,-1), 0),
        ("TOPPADDING",(0,0),(-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 0),
        ("BOX",(0,0),(-1,-1), 1.5, accent),
        ("LINEBELOW",(0,0),(0,0), 2, accent),
    ]))
    return card

def card_grid(cards, cols=2):
    """카드들을 그리드로 배치"""
    rows = []
    for i in range(0, len(cards), cols):
        row = cards[i:i+cols]
        while len(row) < cols:
            row.append("")
        rows.append(row)

    col_w = (CONTENT_W - 4*mm) / cols
    t = Table(rows, colWidths=[col_w]*cols)
    t.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1), 2),
        ("RIGHTPADDING",(0,0),(-1,-1), 2),
        ("TOPPADDING",(0,0),(-1,-1), 2),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))
    return t

def info_box(text, bg=YELLOW_SOFT, border=YELLOW, icon="◆"):
    p = Paragraph(W_IPA(f"<b>{icon}</b>  {text}"),
                  st("ib", 11, GREY_TXT, leading=16))
    t = Table([[p]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), bg),
        ("BOX",(0,0),(-1,-1), 1, border),
        ("LINEBEFORE",(0,0),(0,0), 4, border),
        ("LEFTPADDING",(0,0),(-1,-1), 12),
        ("RIGHTPADDING",(0,0),(-1,-1), 12),
        ("TOPPADDING",(0,0),(-1,-1), 10),
        ("BOTTOMPADDING",(0,0),(-1,-1), 10),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]))
    return t

# ── 데이터: 모든 예시에 한글 발음 병기 ──────────────────────────────────────

VOWELS_SHORT = [
    # ipa, 한글읽기, 설명, 예시[(영,한글발음)], 팁
    ("ɪ", "이", "짧고 느슨한 '이'",
     [("bit","빝"),("sit","씯"),("fish","피쉬")],
     "입을 '이'보다 덜 벌리고 짧게. 힘 빼고!"),
    ("e", "에", "한국어 '에'와 거의 같음",
     [("bed","베드"),("red","뤧"),("pen","펜")],
     "한국어 '에' 그대로. 짧게 끊어주세요"),
    ("æ", "애", "입 크게 벌린 '애'",
     [("cat","캩"),("bad","뱉"),("man","맨")],
     "한국어에 없는 소리! '에'+'아' 중간. 입을 크게"),
    ("ʌ", "어", "짧고 강한 '어' (강세O)",
     [("cup","컾"),("bus","버스"),("fun","펀")],
     "입을 살짝 벌리고 짧은 '어'. 강세 받음"),
    ("ɒ", "오", "입 크게 벌린 '오' (영국)",
     [("hot","핱"),("dog","돸"),("top","톺")],
     "영국식. 입 크게, 입술 둥글게. 미국은 ɑː"),
    ("ʊ", "우", "짧고 느슨한 '우'",
     [("book","붘"),("good","귿"),("put","풑")],
     "입술 살짝만 모으고 짧게. '우'보다 가볍게"),
    ("ə", "어(약)", "약하고 흐릿한 '어' — 슈와",
     [("about","어바웉"),("sofa","쏘우퍼"),("the","더")],
     "★영어 최빈출★ 강세 없는 모든 모음은 거의 다 이 소리!"),
]

VOWELS_LONG = [
    ("iː", "이ㅡ", "길고 팽팽한 '이'",
     [("see","씨ㅡ"),("tea","티ㅡ"),("feet","피ㅡ트")],
     "입을 옆으로 쭉 벌려 길게. ɪ와 구분!"),
    ("ɑː", "아ㅡ", "길고 깊은 '아'",
     [("car","카ㅡ"),("far","파ㅡ"),("start","스타ㅡㅌ")],
     "목 안쪽에서 입 크게 벌리고 길게"),
    ("ɔː", "오ㅡ", "길고 둥근 '오'",
     [("door","도ㅡ"),("more","모ㅡ"),("talk","토ㅡㅋ")],
     "입술 동그랗게 모아서 길게"),
    ("uː", "우ㅡ", "길고 팽팽한 '우'",
     [("blue","블루ㅡ"),("food","푸ㅡㄷ"),("soon","쑤ㅡㄴ")],
     "입술 앞으로 쭉 내밀고 길게"),
    ("ɜː", "어ㅡ", "혀 중앙에서 긴 '어'",
     [("bird","버ㅡㄷ"),("girl","거ㅡㄹ"),("word","워ㅡㄷ")],
     "한국어 '어'를 길게 + r 없이 평평하게"),
]

DIPHTHONGS = [
    ("eɪ", "에이", "에 → 이 미끄러짐",
     [("day","데이"),("face","페이스"),("game","게임")],
     "'에'로 시작해서 '이'로 자연스럽게 흘려요"),
    ("aɪ", "아이", "아 → 이 미끄러짐",
     [("my","마이"),("time","타임"),("night","나잍")],
     "'아'에서 '이'로. 두 음이 한 호흡에"),
    ("ɔɪ", "오이", "오 → 이 미끄러짐",
     [("boy","보이"),("noise","노이즈"),("join","조인")],
     "둥근 '오'에서 '이'로 자연스럽게"),
    ("əʊ", "어우", "어 → 우 (영국)",
     [("go","거우"),("home","허움"),("boat","버웉")],
     "영국식. 'ㅓ'로 시작 → '우'로 끝남"),
    ("oʊ", "오우", "오 → 우 (미국)",
     [("go","고우"),("home","호움"),("boat","보웉")],
     "미국식. 'ㅗ'로 시작 → '우'로 끝남"),
    ("aʊ", "아우", "아 → 우 미끄러짐",
     [("now","나우"),("town","타운"),("house","하우스")],
     "'아'에서 입술 모으며 '우'로"),
    ("ɪə", "이어", "이 → 어 미끄러짐",
     [("here","히어"),("near","니어"),("beer","비어")],
     "'이'에서 '어'로. 짧게 흘리듯"),
    ("eə", "에어", "에 → 어 미끄러짐",
     [("hair","헤어"),("care","케어"),("bear","베어")],
     "'에'에서 '어'로 자연스럽게"),
    ("ʊə", "우어", "우 → 어 미끄러짐",
     [("tour","투어"),("poor","푸어"),("cure","큐어")],
     "'우'에서 '어'로. 점차 사라지는 발음"),
]

CONSONANTS = [
    ("θ", "쓰(무성)", "무성 th — 바람만",
     [("think","씽크"),("math","매쓰"),("bath","배쓰")],
     "★혀끝을 윗니 사이에 살짝! 성대 안 떨림. 한국어 'ㅆ' 아님"),
    ("ð", "드(유성)", "유성 th — 성대 떨림",
     [("this","디스"),("the","더"),("mother","머더")],
     "θ와 위치 같지만 성대 떨림. 'ㄷ'보다 부드럽게"),
    ("ŋ", "ㅇ받침", "코로 울리는 'ㅇ' 받침",
     [("sing","씽"),("ring","륑"),("long","롱")],
     "n+g 두 소리 아님! 한국어 '강' 받침 'ㅇ'과 동일"),
    ("ʒ", "쥬(유성)", "유성 zh — 흔치 않음",
     [("vision","비전"),("measure","메줘"),("usual","유주얼")],
     "한국어 없음. 'ㅈ'+'ㅅ' 섞은 부드러운 소리"),
    ("ʃ", "쉬", "무성 sh",
     [("she","쉬"),("ship","쉬프"),("wash","와쉬")],
     "혀 뒤로 당기고 입술 앞으로 모으며 '쉬'"),
    ("tʃ", "취", "ch 소리",
     [("chair","췌어"),("watch","와취"),("chin","췬")],
     "혀 막았다 터트리며 '취'. ʃ보다 강하게"),
    ("dʒ", "쥐", "j 소리 (유성)",
     [("judge","줘쥐"),("age","에이쥐"),("jump","점프")],
     "tʃ의 유성음. 'ㅈ'+'ㅢ' 느낌. 성대 떨림"),
    ("r", "ㄹ(영어)", "혀 어디도 안 닿게",
     [("red","뤧"),("car","카ㄹ"),("more","모ㄹ")],
     "★혀 말지 마세요! 혀끝 살짝 들고 어디도 접촉 X"),
    ("w", "워/위", "입술 동그랗게 시작",
     [("wet","웻"),("we","위"),("swim","스윔")],
     "'우'에서 즉시 다음 모음으로. 입술 먼저 동그랗게"),
    ("j", "이/야", "y 소리 (반모음)",
     [("yes","예스"),("you","유"),("year","이어")],
     "'이'에서 즉시 다음 모음으로. 한국어 'ㅑㅕㅛ'의 'ㅣ'"),
]

STRESS_INFO = [
    ("ˈ",  "1차 강세", "ˈphotograph", "포터그래프",
     "이 표시 바로 다음 음절을 가장 강하고 높게"),
    ("ˌ",  "2차 강세", "ˌphoˈtography", "포터그래피",
     "1차보다 약하지만 두 번째로 강조"),
    ("ː",  "장음 표시", "siːt vs sɪt", "씨ㅡㅌ vs 씯",
     "소리를 길게 늘여 발음 (장단이 의미를 바꿈!)"),
    (".",  "음절 경계", "ˈfo.to.ɡrəf", "포·터·그러프",
     "음절을 나누는 점 (사전마다 표기 다름)"),
    ("(  )", "생략 가능", "ˈlaɪbrəri", "라이브러리",
     "괄호 안 소리는 발음해도/안 해도 됨"),
]

CONFUSE_PAIRS = [
    ("ɪ vs iː", "sit vs seat", "씯 vs 씨ㅡㅌ",
     "ɪ는 짧고 느슨, iː는 길고 팽팽"),
    ("e vs æ", "bed vs bad", "베드 vs 뱉",
     "e는 입 반쯤, æ는 입 크게 벌려 '애'"),
    ("ʌ vs ə", "cup vs sofa", "컾 vs 쏘우퍼",
     "ʌ는 강세 있는 '어', ə는 약한 '어'"),
    ("ʊ vs uː", "book vs boot", "붘 vs 부ㅡㅌ",
     "ʊ는 짧고 가벼움, uː는 길고 팽팽"),
    ("θ vs ð", "think vs this", "씽크 vs 디스",
     "θ는 바람만, ð는 성대 떨림"),
    ("ʃ vs ʒ", "ship vs vision", "쉬프 vs 비전",
     "ʃ는 '쉬'(무성), ʒ는 '쥬'(유성)"),
    ("n vs ŋ", "sin vs sing", "씬 vs 씽",
     "n은 혀끝 잇몸, ŋ은 혀 뒤 입천장"),
    ("r vs l", "right vs light", "롸잍 vs 라잍",
     "r은 혀 안 닿게, l은 혀끝 윗잇몸 붙임"),
]

PRACTICE = [
    ("ˈsɪmpəl",        "simple",        "씸펄",       "단순한"),
    ("ˌedʒʊˈkeɪʃn",    "education",     "에쥬케이션", "교육"),
    ("ɪnˈkredəbl",     "incredible",    "인크뤠더블", "믿기 어려운"),
    ("ˌɒpəˈtjuːnəti",  "opportunity",   "오퍼튜ㅡ너티","기회"),
    ("prɪˈzɜːv",       "preserve",      "프리저ㅡㅂ", "보존하다"),
    ("ˈθɔːtfʊl",       "thoughtful",    "쏘ㅡㅌ풀",   "사려깊은"),
    ("ɪnˈθjuːziæzəm",  "enthusiasm",    "인쑤ㅡ지애즘","열정"),
    ("ˌkɒmprɪˈhensɪv", "comprehensive", "캄프리헨씨브","포괄적인"),
    ("əˈʃʊrəns",       "assurance",     "어슈어런스", "확신"),
    ("ˌʌndərˈstænd",   "understand",    "언더스탠드", "이해하다"),
]

TOP_TIPS = [
    ("슈와(ə)는 영어 최빈출 모음",
     "강세 없는 음절은 거의 다 ə로 줄어듭니다. about[어바웉], banana[버내너]"),
    ("ː 가 있으면 길게 발음",
     "sit[씯]과 seat[씨ㅡㅌ]는 장단으로 완전히 다른 단어!"),
    ("th는 두 종류",
     "θ=무성[쓰/think], ð=유성[드/this]. 단어마다 확인 필수"),
    ("ŋ은 'ㅇ' 받침 하나의 소리",
     "sing[씽] — n+g 따로가 아님. 한국어 받침 'ㅇ'과 동일"),
    ("ˈ 바로 다음 음절을 강하게",
     "ˈphotograph는 '포'에 강세. 강세 위치가 뜻을 바꾸기도 함"),
    ("이중모음은 한 호흡에 미끄러지듯",
     "aɪ는 '아'+'이'를 따로 X. '아이'를 한 번에 자연스럽게"),
    ("영어 r은 혀를 굴리지 않음",
     "혀끝을 살짝 들되 입천장 어디에도 닿지 않게. 한국어 'ㄹ'과 완전 다름"),
]

# ── PDF 빌드 ────────────────────────────────────────────────────────────

def build():
    path = "/home/user/vocaknio-quiz/IPA_발음기호_완전정복.pdf"
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=12*mm, bottomMargin=12*mm,
    )
    story = []

    # ═══════ 표지 ═══════
    cover_main = Table([
        [Paragraph("발음기호", S_COVER_TITLE)],
        [Paragraph("완전정복", S_COVER_TITLE)],
        [Spacer(1, 8*mm)],
        [Paragraph("IPA Phonetic Symbols", S_COVER_SUB)],
        [Spacer(1, 12*mm)],
        [Paragraph("파닉스는 알지만 발음기호가 헷갈리는<br/>한국인 학습자를 위한 완벽 가이드", S_COVER_TAG)],
    ], colWidths=[CONTENT_W])
    cover_main.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), NAVY),
        ("TOPPADDING",(0,0),(-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 0),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
    ]))
    cover_wrap = Table([[cover_main]], colWidths=[CONTENT_W])
    cover_wrap.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), NAVY),
        ("TOPPADDING",(0,0),(-1,-1), 40),
        ("BOTTOMPADDING",(0,0),(-1,-1), 40),
    ]))
    story.append(cover_wrap)
    story.append(sp(6))

    # 표지 하단 안내
    story.append(info_box(
        "<b>읽는 법</b> &nbsp;&nbsp; 발음기호 → 한글 발음 → 예시 단어 → 입모양 팁 순으로 익혀요.<br/>"
        "<b>학습 순서</b> &nbsp; 1. 모음 → 2. 자음 → 3. 강세 → 4. 헷갈리는 쌍 → 5. 실전 연습",
        bg=SKY_SOFT, border=BLUE, icon="▶"
    ))
    story.append(sp(3))

    story.append(info_box(
        "<b>한국인이 가장 헷갈리는 TOP 3</b><br/>"
        "① <b>æ</b>(애) vs <b>e</b>(에) &nbsp;&nbsp; ② <b>θ</b>(쓰) vs <b>ð</b>(드) &nbsp;&nbsp; ③ <b>ɪ</b>(이) vs <b>iː</b>(이ㅡ)",
        bg=ROSE_SOFT, border=ROSE, icon="★"
    ))

    story.append(PageBreak())

    # ═══════ 1. 단모음 ═══════
    story.append(section_header("1", "단모음 — Short Vowels", "짧게 끊어 발음하는 7개 모음"))
    story.append(sp(3))
    story.append(info_box(
        "<b>슈와(ə)</b>는 영어에서 가장 자주 나오는 모음입니다. "
        "강세 없는 음절은 거의 모두 ə로 약화돼요. 꼭 익혀두세요!",
        bg=YELLOW_SOFT, border=YELLOW, icon="★"
    ))
    story.append(sp(3))

    cards = [
        make_card(ipa, kor, desc, ex, tip, accent=ROSE, soft=ROSE_SOFT)
        for ipa, kor, desc, ex, tip in VOWELS_SHORT
    ]
    story.append(card_grid(cards, cols=2))

    story.append(PageBreak())

    # ═══════ 2. 장모음 ═══════
    story.append(section_header("2", "장모음 — Long Vowels", "ː 기호가 붙으면 길게! (총 5개)"))
    story.append(sp(3))
    story.append(info_box(
        "ː 표시는 소리를 길게 늘이라는 뜻. "
        "<b>sit[씯]</b>과 <b>seat[씨ㅡㅌ]</b>처럼 장단이 단어 뜻을 바꿉니다.",
        bg=SKY_SOFT, border=BLUE, icon="◆"
    ))
    story.append(sp(3))

    cards = [
        make_card(ipa, kor, desc, ex, tip, accent=BLUE, soft=SKY_SOFT)
        for ipa, kor, desc, ex, tip in VOWELS_LONG
    ]
    story.append(card_grid(cards, cols=2))

    story.append(PageBreak())

    # ═══════ 3. 이중모음 ═══════
    story.append(section_header("3", "이중모음 — Diphthongs", "두 모음이 한 호흡에 미끄러지는 9개"))
    story.append(sp(3))
    story.append(info_box(
        "이중모음은 두 개의 모음을 <b>따로따로 발음하지 않고</b> "
        "한 호흡에 자연스럽게 미끄러지듯 이어줍니다.",
        bg=PURPLE_SOFT, border=PURPLE, icon="∿"
    ))
    story.append(sp(3))

    cards = [
        make_card(ipa, kor, desc, ex, tip, accent=PURPLE, soft=PURPLE_SOFT)
        for ipa, kor, desc, ex, tip in DIPHTHONGS
    ]
    story.append(card_grid(cards, cols=2))

    story.append(PageBreak())

    # ═══════ 4. 자음 ═══════
    story.append(section_header("4", "헷갈리는 자음 — Tricky Consonants",
                                "파닉스와 다르거나 한국어에 없는 자음만"))
    story.append(sp(3))
    story.append(info_box(
        "<b>b, d, f, g, h, k, l, m, n, p, s, t, v, z</b>는 파닉스와 동일하므로 생략. "
        "아래는 헷갈리는 것만 모았습니다.",
        bg=GREEN_SOFT, border=GREEN, icon="ⓘ"
    ))
    story.append(sp(3))

    cards = [
        make_card(ipa, kor, desc, ex, tip, accent=GREEN, soft=GREEN_SOFT)
        for ipa, kor, desc, ex, tip in CONSONANTS
    ]
    story.append(card_grid(cards, cols=2))

    story.append(PageBreak())

    # ═══════ 5. 강세 & 기타 기호 ═══════
    story.append(section_header("5", "강세 & 기타 기호", "발음기호 안의 작은 기호들 의미"))
    story.append(sp(3))

    # 강세 카드들 (가로 한 줄)
    hdr_row = [
        Paragraph("기호", S_WHITE_C),
        Paragraph("이름", S_WHITE_C),
        Paragraph("예시 (IPA)", S_WHITE_C),
        Paragraph("한글 발음", S_WHITE_C),
        Paragraph("설명", S_WHITE_C),
    ]
    rows = [hdr_row]
    for sym, name, ipa_ex, kor_ex, desc in STRESS_INFO:
        rows.append([
            Paragraph(W_IPA(sym), st("ssym", 18, ROSE, align=1)),
            Paragraph(name, st("snm", 11, NAVY, align=1)),
            Paragraph(W_IPA(ipa_ex), st("sip", 11, GREY_TXT, align=1)),
            Paragraph(W_IPA(kor_ex), st("skr", 11, ROSE, align=1)),
            Paragraph(W_IPA(desc), st("sds", 9, GREY_TXT, leading=12)),
        ])

    t = Table(rows, colWidths=[15*mm, 22*mm, 35*mm, 30*mm, None])
    t.setStyle(TableStyle([
        ("FONTNAME",(0,0),(-1,-1),"KR"),
        ("BACKGROUND",(0,0),(-1,0), NAVY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, SKY_SOFT]),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ("BOX",(0,0),(-1,-1), 1, NAVY),
        ("LINEBELOW",(0,0),(-1,0), 1, NAVY),
        ("GRID",(0,1),(-1,-1), 0.4, GREY_BORDER),
    ]))
    story.append(t)
    story.append(sp(4))

    story.append(info_box(
        "<b>강세 위치가 다르면 단어가 달라져요!</b><br/>"
        "• <b>ˈrecord</b>[뤠커ㄷ] 명사: 기록 &nbsp;vs&nbsp; <b>rɪˈcord</b>[리코ㅡㄷ] 동사: 녹음하다<br/>"
        "• <b>ˈpresent</b>[프뤠즌트] 선물 &nbsp;vs&nbsp; <b>prɪˈzent</b>[프리젠트] 발표하다",
        bg=YELLOW_SOFT, border=YELLOW, icon="◆"
    ))

    story.append(PageBreak())

    # ═══════ 6. 헷갈리는 쌍 ═══════
    story.append(section_header("6", "헷갈리는 쌍 비교", "나란히 두고 차이를 익혀요"))
    story.append(sp(3))

    pair_rows = [[
        Paragraph("헷갈리는 쌍", S_WHITE_C),
        Paragraph("영어 예시", S_WHITE_C),
        Paragraph("한글 발음", S_WHITE_C),
        Paragraph("구분 포인트", S_WHITE_C),
    ]]
    for pair, en, kor, how in CONFUSE_PAIRS:
        pair_rows.append([
            Paragraph(W_IPA(pair), st("pp", 14, ROSE, align=1)),
            Paragraph(W_IPA(en), st("pe", 12, NAVY, align=1)),
            Paragraph(W_IPA(kor), st("pk", 11, GREY_TXT, align=1)),
            Paragraph(W_IPA(how), st("ph", 10, GREEN, leading=13)),
        ])

    t = Table(pair_rows, colWidths=[30*mm, 40*mm, 38*mm, None])
    t.setStyle(TableStyle([
        ("FONTNAME",(0,0),(-1,-1),"KR"),
        ("BACKGROUND",(0,0),(-1,0), NAVY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, ROSE_SOFT]),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1), 10),
        ("BOTTOMPADDING",(0,0),(-1,-1), 10),
        ("BOX",(0,0),(-1,-1), 1, NAVY),
        ("GRID",(0,1),(-1,-1), 0.4, GREY_BORDER),
    ]))
    story.append(t)

    story.append(PageBreak())

    # ═══════ 7. 실전 연습 ═══════
    story.append(section_header("7", "실전 발음기호 읽기 연습",
                                "발음기호 → 한글 → 단어 순으로 익혀요"))
    story.append(sp(3))
    story.append(info_box(
        "왼쪽 발음기호만 보고 소리내어 읽어본 뒤, "
        "오른쪽 한글 발음과 비교해보세요!",
        bg=SKY_SOFT, border=BLUE, icon="▶"
    ))
    story.append(sp(3))

    pr_rows = [[
        Paragraph("발음기호 (IPA)", S_WHITE_C),
        Paragraph("한글 발음", S_WHITE_C),
        Paragraph("영어 단어", S_WHITE_C),
        Paragraph("뜻", S_WHITE_C),
    ]]
    for ipa, en, kor, mean in PRACTICE:
        pr_rows.append([
            Paragraph(W_IPA(ipa),  st("pri", 13, ROSE,    align=1)),
            Paragraph(W_IPA(kor),  st("prk", 13, NAVY,    align=1)),
            Paragraph(W_IPA(en),   st("pre", 12, GREY_TXT,align=1)),
            Paragraph(W_IPA(mean), st("prm", 11, GREEN,   align=1)),
        ])

    t = Table(pr_rows, colWidths=[55*mm, 42*mm, 38*mm, None])
    t.setStyle(TableStyle([
        ("FONTNAME",(0,0),(-1,-1),"KR"),
        ("BACKGROUND",(0,0),(-1,0), NAVY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, YELLOW_SOFT]),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1), 11),
        ("BOTTOMPADDING",(0,0),(-1,-1), 11),
        ("BOX",(0,0),(-1,-1), 1, NAVY),
        ("GRID",(0,1),(-1,-1), 0.4, GREY_BORDER),
    ]))
    story.append(t)
    story.append(sp(4))

    # ═══════ 8. 핵심 TOP 7 ═══════
    story.append(section_header("8", "꼭 기억할 핵심 TOP 7", "이것만 알면 발음기호 70% 정복!"))
    story.append(sp(3))

    for i, (title, desc) in enumerate(TOP_TIPS, 1):
        num_cell = Paragraph(str(i), st("tn", 22, WHITE, align=1, leading=24))
        body_cell_data = [
            [Paragraph(W_IPA(f"<b>{title}</b>"), st("tt", 12, NAVY, leading=15))],
            [Paragraph(W_IPA(desc), st("td", 10, GREY_TXT, leading=14))],
        ]
        body_cell = Table(body_cell_data, colWidths=[CONTENT_W - 16*mm])
        body_cell.setStyle(TableStyle([
            ("LEFTPADDING",(0,0),(-1,-1), 10),
            ("RIGHTPADDING",(0,0),(-1,-1), 10),
            ("TOPPADDING",(0,0),(-1,-1), 3),
            ("BOTTOMPADDING",(0,0),(-1,-1), 3),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]))

        row = Table([[num_cell, body_cell]], colWidths=[16*mm, CONTENT_W - 16*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(0,0), NAVY),
            ("BACKGROUND",(1,0),(1,0), SKY_SOFT),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("TOPPADDING",(0,0),(-1,-1), 8),
            ("BOTTOMPADDING",(0,0),(-1,-1), 8),
            ("BOX",(0,0),(-1,-1), 0.5, NAVY),
        ]))
        story.append(row)
        story.append(sp(1.5))

    story.append(sp(4))

    # 마지막 격려 메시지
    footer = Table([[Paragraph(
        "<b>발음기호에 익숙해지면 단어 암기 속도가 2배 빨라집니다.</b><br/>"
        "새 단어를 만날 때마다 발음기호를 먼저 읽고, "
        "한글 발음으로 한 번 더 확인하는 습관을 들이세요!",
        st("ftr", 11, WHITE, align=1, leading=17)
    )]], colWidths=[CONTENT_W])
    footer.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), NAVY),
        ("TOPPADDING",(0,0),(-1,-1), 14),
        ("BOTTOMPADDING",(0,0),(-1,-1), 14),
        ("LEFTPADDING",(0,0),(-1,-1), 12),
        ("RIGHTPADDING",(0,0),(-1,-1), 12),
    ]))
    story.append(footer)

    # ════════════════════════════════════════════════════════════
    # PART 2 — 파닉스 규칙
    # ════════════════════════════════════════════════════════════
    story.append(PageBreak())

    part2_banner = Table([[Paragraph("PART 2 — 파닉스 규칙", st("p2t", 24, WHITE, align=1)),
                           ]], colWidths=[CONTENT_W])
    part2_banner.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), colors.HexColor("#0D47A1")),
        ("TOPPADDING",(0,0),(-1,-1), 20),
        ("BOTTOMPADDING",(0,0),(-1,-1), 20),
    ]))
    story.append(part2_banner)
    sub_banner = Table([[Paragraph(
        "철자만 보고 발음을 유추하는 규칙 — IPA를 읽기 전에 먼저 소리를 예측해 봐요",
        st("p2s", 11, WHITE, align=1))]], colWidths=[CONTENT_W])
    sub_banner.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), colors.HexColor("#1565C0")),
        ("TOPPADDING",(0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 8),
    ]))
    story.append(sub_banner)
    story.append(sp(5))

    # ─── 헬퍼: 비교 카드 (좌/우 두 규칙을 나란히) ─────────────────────
    def rule_card(label, spell_hint, ipa_sound, kor_sound, examples, bg, border, note=""):
        """단일 규칙 카드"""
        top_data = [
            [Paragraph(label, st("rclbl", 10, border, align=1))],
            [Paragraph(spell_hint, st("rcsp", 22, border, align=1, leading=26))],
            [Paragraph(W_IPA(f'{ipa_sound}  →  "{kor_sound}"'),
                       st("rcipa", 13, NAVY, align=1))],
        ]
        top_t = Table(top_data, colWidths=[None])
        top_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(0,0), bg),
            ("BACKGROUND",(0,1),(0,1), bg),
            ("BACKGROUND",(0,2),(0,2), WHITE),
            ("TOPPADDING",(0,0),(-1,-1), 4),
            ("BOTTOMPADDING",(0,0),(-1,-1), 4),
            ("LINEBELOW",(0,1),(0,1), 1.5, border),
        ]))
        ex_rows = [[Paragraph(W_IPA(en), st("rce",11,NAVY,align=1)),
                    Paragraph(f"[{kr}]", st("rck",10,ROSE,align=1))]
                   for en,kr in examples]
        ex_t = Table(ex_rows, colWidths=[None,None])
        ex_t.setStyle(TableStyle([
            ("ALIGN",(0,0),(-1,-1),"CENTER"),
            ("TOPPADDING",(0,0),(-1,-1),2),
            ("BOTTOMPADDING",(0,0),(-1,-1),2),
        ]))
        ex_wrap = Table([[ex_t]], colWidths=[None])
        ex_wrap.setStyle(TableStyle([
            ("TOPPADDING",(0,0),(-1,-1),4),
            ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ]))
        parts = [top_t, ex_wrap]
        if note:
            note_t = Table([[Paragraph(W_IPA(f"* {note}"), st("rcn",8,GREEN,leading=11))]], colWidths=[None])
            note_t.setStyle(TableStyle([
                ("BACKGROUND",(0,0),(-1,-1),GREEN_SOFT),
                ("LEFTPADDING",(0,0),(-1,-1),6),
                ("TOPPADDING",(0,0),(-1,-1),4),
                ("BOTTOMPADDING",(0,0),(-1,-1),4),
            ]))
            parts.append(note_t)
        card = Table([[p] for p in parts], colWidths=[None])
        card.setStyle(TableStyle([
            ("TOPPADDING",(0,0),(-1,-1),0),
            ("BOTTOMPADDING",(0,0),(-1,-1),0),
            ("LEFTPADDING",(0,0),(-1,-1),0),
            ("RIGHTPADDING",(0,0),(-1,-1),0),
            ("BOX",(0,0),(-1,-1),1.5,border),
        ]))
        return card

    def two_cards(left, right):
        t = Table([[left, right]], colWidths=[(CONTENT_W-4*mm)/2]*2)
        t.setStyle(TableStyle([
            ("VALIGN",(0,0),(-1,-1),"TOP"),
            ("LEFTPADDING",(0,0),(-1,-1),2),
            ("RIGHTPADDING",(0,0),(-1,-1),2),
        ]))
        return t

    def rule_table(headers, rows, col_widths, accent=NAVY):
        hdr = [Paragraph(h, S_WHITE_C) for h in headers]
        data = [hdr] + [[Paragraph(W_IPA(str(c)), st(f"rt{i}{j}",10,GREY_TXT,align=1 if j<len(col_widths)-1 else 0,leading=13))
                         for j,c in enumerate(row)] for i,row in enumerate(rows)]
        t = Table(data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("FONTNAME",(0,0),(-1,-1),"KR"),
            ("BACKGROUND",(0,0),(-1,0), accent),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, SKY_SOFT]),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("TOPPADDING",(0,0),(-1,-1),7),
            ("BOTTOMPADDING",(0,0),(-1,-1),7),
            ("BOX",(0,0),(-1,-1),1,accent),
            ("GRID",(0,1),(-1,-1),0.4,GREY_BORDER),
        ]))
        return t

    # ═══════ P2-1. C와 K ═══════
    story.append(section_header("9", "C 와 K — 둘 다 /k/ 지만 쓰는 규칙이 다름", ""))
    story.append(sp(3))
    story.append(info_box(
        "<b>핵심 규칙:</b> C 다음에 e·i·y 가 오면 /s/, 나머지(a·o·u·자음)는 /k/ &nbsp;&nbsp;"
        "K 는 항상 /k/ — C가 헷갈릴 때 K를 쓰면 안전!",
        bg=SKY_SOFT, border=BLUE, icon="◆"))
    story.append(sp(3))

    c_hard = rule_card("C + a / o / u / 자음",  "C (hard)",  "/k/", "ㅋ",
        [("cat","캩"),("cold","코울드"),("cup","컾"),("class","클래스")],
        SKY_SOFT, BLUE, note="자음 앞 C도 /k/ → cry[크라이], club[클럽]")
    c_soft = rule_card("C + e / i / y",          "C (soft)",  "/s/", "ㅅ",
        [("cell","쎌"),("city","씨티"),("cycle","싸이클"),("price","프라이스")],
        ROSE_SOFT, ROSE, note="예외 없음! e·i·y 앞 C는 무조건 /s/")
    story.append(two_cards(c_hard, c_soft))
    story.append(sp(3))

    k_card = rule_card("K 는 항상", "K", "/k/", "ㅋ",
        [("king","킹"),("keep","키ㅡ프"),("skill","스킬"),("break","브레이크")],
        GREEN_SOFT, GREEN, note="K는 e·i·y 앞에서도 /k/ → key[키ㅡ], kit[킽]")
    ck_card = rule_card("단모음 뒤 이중 자음", "CK", "/k/", "ㅋ",
        [("black","블랙"),("lock","락"),("quick","쿠익"),("check","첵")],
        PEACH_SOFT, colors.HexColor("#E65100"),
        note="단모음 직후: back/beck/brick/block/buck. 장모음·이중모음 뒤엔 K 단독")
    story.append(two_cards(k_card, ck_card))
    story.append(sp(2))
    story.append(info_box(
        "<b>QU → /kw/</b> &nbsp; queen[쿠ㅡ인] / quick[쿠익] / quiet[쿠아이엇] &nbsp;&nbsp; "
        "<b>CH → /tʃ/</b> &nbsp; chair[췌어] / beach[비ㅡ취] &nbsp;&nbsp; "
        "<b>CH → /k/</b> (그리스어 계열) &nbsp; character[캐릭터] / chemistry[케미스트리]",
        bg=YELLOW_SOFT, border=YELLOW, icon="◆"))

    story.append(PageBreak())

    # ═══════ P2-2. G ═══════
    story.append(section_header("10", "G 의 두 가지 발음 — Hard G vs Soft G", ""))
    story.append(sp(3))
    story.append(info_box(
        "<b>핵심 규칙:</b> G 다음에 e·i·y 가 오면 /dʒ/ (soft), 나머지는 /g/ (hard)"
        " — 단, 예외 단어가 C보다 많으므로 사전 확인 필수!",
        bg=YELLOW_SOFT, border=YELLOW, icon="★"))
    story.append(sp(3))

    g_hard = rule_card("G + a / o / u / 자음", "G (hard)", "/g/", "ㄱ",
        [("gap","갭"),("go","고우"),("gun","건"),("green","그리ㅡ인")],
        GREEN_SOFT, GREEN)
    g_soft = rule_card("G + e / i / y (일반적)", "G (soft)", "/dʒ/", "쥐",
        [("gem","줴음"),("giant","쟈이언트"),("gym","줴임"),("age","에이쥐")],
        PURPLE_SOFT, PURPLE)
    story.append(two_cards(g_hard, g_soft))
    story.append(sp(2))

    story.append(info_box(
        "<b>G soft 예외 (e·i 앞에서도 /g/ 발음):</b> &nbsp;"
        "get[겟] / give[기브] / girl[거ㅡㄹ] / begin[비긴] / tiger[타이거] / gear[기어]<br/>"
        "→ 이 단어들은 외워야 합니다!",
        bg=ROSE_SOFT, border=ROSE, icon="★"))
    story.append(sp(2))

    gh_data = [
        ("gh 묵음",  "-igh / -ight",  "night[나잍], light[라잍], right[롸잍], eight[에잍]"),
        ("gh 묵음",  "-ough (장모음)", "through[쓰루ㅡ], though[도우], dough[도우]"),
        ("gh → /f/", "-ough (단모음)", "tough[터프], rough[러프], enough[이너프], laugh[래프]"),
        ("gh → /f/", "-augh",         "cough[코프], draught[드래프트]"),
        ("gh → /g/", "어두 gh",        "ghost[고우스트], ghetto[게토우]"),
    ]
    story.append(Paragraph("GH 패턴 — 묵음이 가장 많음", st("h2g", 13, BLUE, leading=16)))
    story.append(sp(1))
    story.append(rule_table(
        ["패턴","위치/조건","예시"],
        gh_data,
        [28*mm, 35*mm, None],
        accent=NAVY))

    story.append(PageBreak())

    # ═══════ P2-3. 묵음 자음 ═══════
    story.append(section_header("11", "묵음 자음 (Silent Consonants)", "철자에 있지만 발음하지 않는 글자들"))
    story.append(sp(3))
    story.append(info_box(
        "영어는 라틴어·프랑스어·그리스어에서 빌려온 단어가 많아 철자와 발음이 다릅니다. "
        "<b>아래 패턴을 외워두면 처음 보는 단어도 발음을 추측할 수 있어요.</b>",
        bg=SKY_SOFT, border=BLUE, icon="ⓘ"))
    story.append(sp(3))

    silent_data = [
        ("kn-",  "k 묵음",  "knife[나이프]  know[노우]  knock[나크]  knee[니ㅡ]  knight[나잍]"),
        ("wr-",  "w 묵음",  "write[롸잍]  wrong[롱]  wrap[랩]  wrist[리스트]  wreck[렉]"),
        ("-mb",  "b 묵음",  "bomb[밤]  climb[클라임]  thumb[썸]  lamb[람]  comb[코움]"),
        ("-mn",  "n 묵음",  "autumn[어텀]  column[칼럼]  damn[담]  hymn[힘]"),
        ("-bt/-pt", "b·p 묵음", "debt[뎃]  doubt[다웉]  subtle[서틀]  receipt[리씨ㅡ트]"),
        ("h-",   "h 묵음",  "hour[아워]  honest[아니스트]  heir[에어]  honor[아너]"),
        ("-gh",  "gh 묵음", "night[나잍]  daughter[도ㅡ터]  eight[에잍]  high[하이]"),
        ("-ght", "ght→t",   "thought[쏘ㅡ트]  bought[보ㅡ트]  fight[파잍]  might[마잍]"),
        ("-l-",  "l 묵음",  "calm[캄]  half[해프]  walk[워ㅡ크]  talk[토ㅡ크]  would[우드]"),
        ("-w-",  "w 묵음",  "sword[소ㅡ드]  two[투ㅡ]  answer[앤서]  whole[호울]"),
        ("ps-",  "p 묵음",  "psychology[싸이칼러지]  psalm[쌈]  pneumonia[뉴모우니어]"),
    ]
    story.append(rule_table(
        ["패턴","규칙","예시 단어 + 한글 발음"],
        silent_data,
        [18*mm, 22*mm, None],
        accent=colors.HexColor("#37474F")))

    story.append(PageBreak())

    # ═══════ P2-4. Magic E ═══════
    story.append(section_header("12", "Magic E 규칙 (CVCe 패턴)", "끝의 e가 앞 모음을 장모음으로 바꿈"))
    story.append(sp(3))
    story.append(info_box(
        "<b>CVCe = 자음(C) + 모음(V) + 자음(C) + 묵음 e</b><br/>"
        "끝의 e는 발음하지 않지만, 앞의 모음을 '알파벳 이름(장모음)'으로 바꿉니다.",
        bg=YELLOW_SOFT, border=YELLOW, icon="★"))
    story.append(sp(3))

    magic_e_data = [
        ("a_e", "a → /eɪ/", "cap → cape",  "캡 → 케이프",  "man→mane, hat→hate, tap→tape, plan→plane"),
        ("i_e", "i → /aɪ/", "kit → kite",  "킽 → 카이트",  "bit→bite, pin→pine, rid→ride, slim→slime"),
        ("o_e", "o → /oʊ/", "hop → hope",  "합 → 호우프",  "not→note, rod→rode, glob→globe, ton→tone"),
        ("u_e", "u → /juː/", "cut → cute", "컾 → 큐ㅡ트",  "us→use, tub→tube, cub→cube, dun→dune"),
        ("e_e", "e → /iː/", "pet → Pete", "펫 → 피ㅡ트",  "these[디ㅡ즈], eve[이ㅡ브], scene[씨ㅡ인]"),
    ]
    magic_hdr = ["패턴", "변화", "비교", "한글 발음", "추가 예시"]
    magic_rows = [[d[0], W_IPA(d[1]), d[2], d[3], d[4]] for d in magic_e_data]
    story.append(rule_table(magic_hdr, magic_rows, [14*mm, 22*mm, 24*mm, 24*mm, None], accent=colors.HexColor("#880E4F")))
    story.append(sp(2))
    story.append(info_box(
        "<b>주의:</b> have[해브] / give[기브] / live[리브] / come[컴] / some[섬] — "
        "e로 끝나지만 Magic E 규칙이 적용 안 되는 예외 단어들, 그냥 외우세요!",
        bg=ROSE_SOFT, border=ROSE, icon="★"))

    story.append(PageBreak())

    # ═══════ P2-5. 모음 이중자 ═══════
    story.append(section_header("13", "모음 이중자 (Vowel Digraphs/Teams)", "두 모음이 붙어 하나의 소리"))
    story.append(sp(3))
    story.append(info_box(
        "<b>'두 모음이 나란히 있으면 첫 번째가 제 이름을 말한다'</b> — 완전한 법칙은 아니지만 "
        "ai/ay, ee/ea, oa 패턴에선 꽤 잘 맞습니다.",
        bg=SKY_SOFT, border=BLUE, icon="◆"))
    story.append(sp(3))

    digraph_data = [
        ("ai / ay", "/eɪ/", "에이", "rain[레인]  wait[웨잍]  day[데이]  play[플레이]", "ai는 단어 중간, ay는 단어 끝"),
        ("ee / ea", "/iː/", "이ㅡ", "tree[트리ㅡ]  feed[피ㅡ드]  beat[비ㅡ트]  sea[씨ㅡ]", "ea는 /ɛ/ 예외: bread[브레드], head[헤드]"),
        ("oa",      "/oʊ/", "오우", "boat[보웉]  road[로우드]  coat[코웉]  soap[쏘웁]",   "oa는 대부분 /oʊ/"),
        ("oo",      "/uː/ or /ʊ/","우ㅡ/우","food[푸ㅡ드]  moon[무ㅡ인]  book[붘]  good[귿]","food/moon은 길게, book/good은 짧게"),
        ("oi / oy", "/ɔɪ/", "오이", "oil[오일]  coin[코인]  boy[보이]  toy[토이]",         "oi는 중간, oy는 끝"),
        ("ou / ow", "/aʊ/", "아우", "out[아웉]  mouth[마우쓰]  cow[카우]  town[타운]",     "ou·ow는 /oʊ/도 됨: soul[쏘울], snow[스노우]"),
        ("ow",      "/oʊ/", "오우", "snow[스노우]  slow[슬로우]  own[오운]  blow[블로우]", "ou/ow 두 소리 구분은 외워야"),
        ("ew / ue", "/juː/ or /uː/","유ㅡ/우ㅡ","new[뉴ㅡ]  few[퓨ㅡ]  blue[블루ㅡ]  due[듀ㅡ]","자음 뒤엔 /uː/: brew[브루ㅡ]"),
        ("au / aw", "/ɔː/", "오ㅡ", "caught[코ㅡ트]  sauce[쏘ㅡ스]  saw[쏘ㅡ]  draw[드로ㅡ]", "au는 중간, aw는 끝에 주로"),
        ("ie",      "/iː/ or /aɪ/","이ㅡ/아이","believe[빌리ㅡ브]  piece[피ㅡ스]  die[다이]  tie[타이]","단어 중간은 /iː/, 끝은 /aɪ/ 경향"),
    ]
    digraph_hdr = ["철자", "IPA", "한글", "예시", "주의"]
    story.append(rule_table(digraph_hdr, digraph_data, [15*mm, 20*mm, 18*mm, 55*mm, None], accent=BLUE))

    story.append(PageBreak())

    # ═══════ P2-6. 특수 패턴 ═══════
    story.append(section_header("14", "특수 철자 패턴", "파닉스 예외 — 꼭 알아야 할 덩어리들"))
    story.append(sp(3))

    special_data = [
        ("ph",     "/f/",   "포/파/프", "phone[포운]  photo[포우토]  graph[그래프]  alphabet[앨퍼벳]",
         "그리스어 유래. f 대신 ph 쓰는 학술 단어 많음"),
        ("-tion",  "/ʃən/", "션",      "nation[네이션]  action[액션]  station[스테이션]  fiction[픽션]",
         "동사→명사: -tion 붙으면 강세 앞 음절로 이동"),
        ("-sion",  "/ʒən/ or /ʃən/","전/션","vision[비전]  tension[텐션]  mission[미션]  explosion[익스플로전]",
         "모음 뒤 -sion → /ʒən/, 자음 뒤 -sion → /ʃən/"),
        ("-ture",  "/tʃər/","처",      "nature[네이처]  picture[픽처]  future[퓨처]  culture[컬처]",
         "-ture는 항상 /tʃər/. '쳐' 로 읽으면 됨"),
        ("-ough",  "여러 소리", "복수", "through[쓰루ㅡ] / though[도우] / thought[쏘ㅡ트] / tough[터프] / cough[코프]",
         "영어에서 가장 불규칙한 패턴. 단어별로 외워야"),
        ("-ight",  "/aɪt/", "아잍",   "night[나잍]  light[라잍]  right[롸잍]  fight[파잍]  might[마잍]",
         "-igh → /aɪ/, t는 발음. -ight = 아이+트"),
        ("-ought/-aught", "/ɔːt/","오ㅡ트","thought[쏘ㅡ트]  bought[보ㅡ트]  caught[코ㅡ트]  taught[토ㅡ트]",
         "철자 달라도 소리는 같음. /ɔːt/"),
        ("wh-",    "/w/ or /h/", "워/ㅎ","where[웨어]  when[웬]  what[왓] | who[후ㅡ]  whole[호울]  whom[후ㅡ임]",
         "wh + 모음 → /w/. 예외: who/whole/whom은 /h/"),
        ("-le",    "/əl/",  "얼",     "table[테이벌]  simple[씸펄]  puzzle[퍼즐]  bottle[바틀]",
         "단어 끝 -le = /əl/. e는 발음 안 함"),
        ("-ed",    "/t/ /d/ /ɪd/","트/드/이드","jumped[점프트]  played[플레이드]  wanted[완팃]",
         "무성음→/t/, 유성음→/d/, t/d 뒤→/ɪd/"),
    ]
    story.append(rule_table(
        ["철자","IPA","한글","예시","설명"],
        special_data,
        [20*mm, 20*mm, 14*mm, 58*mm, None],
        accent=colors.HexColor("#4A148C")))

    story.append(PageBreak())

    # ═══════ P2-7. -ed 어미 ═══════
    story.append(section_header("15", "-ed / -s 어미 발음 규칙", "동사 과거형 · 복수/3인칭단수 어미"))
    story.append(sp(3))

    story.append(Paragraph("-ed 과거형 어미 — 3가지 발음", st("h2ed", 13, BLUE, leading=16)))
    story.append(sp(2))
    ed_data = [
        ("/t/ — 무성음 뒤", "p·k·f·s·sh·ch·x 뒤", "jumped[점프트]  looked[룩트]  laughed[래프트]  passed[패스트]  watched[와취트]"),
        ("/d/ — 유성음 뒤", "b·g·v·z·m·n·l·r·모음 뒤", "played[플레이드]  called[코ㅡ일드]  loved[러브드]  opened[오우펀드]"),
        ("/ɪd/ — t·d 뒤",  "어간 끝이 t 또는 d",     "wanted[완팃]  needed[니ㅡ딧]  started[스타ㅡ팃]  ended[엔딧]"),
    ]
    story.append(rule_table(
        ["발음","조건","예시"],
        ed_data,
        [30*mm, 45*mm, None],
        accent=colors.HexColor("#1B5E20")))
    story.append(sp(3))

    story.append(Paragraph("-s/-es 복수·3인칭 어미 — 3가지 발음", st("h2s", 13, BLUE, leading=16)))
    story.append(sp(2))
    s_data = [
        ("/s/ — 무성음 뒤",  "p·t·k·f·θ 뒤",    "cats[캩츠]  books[북스]  stops[스탑스]  myths[미쓰스]"),
        ("/z/ — 유성음 뒤",  "b·d·g·v·m·n·l·r·모음 뒤", "dogs[도그즈]  beds[베즈]  calls[코ㅡ일즈]  plays[플레이즈]"),
        ("/ɪz/ — 시빌란트 뒤","s·z·sh·zh·ch·dʒ 뒤","buses[버씨즈]  watches[와취즈]  judges[줘쥐즈]  roses[로우지즈]"),
    ]
    story.append(rule_table(
        ["발음","조건","예시"],
        s_data,
        [30*mm, 45*mm, None],
        accent=colors.HexColor("#004D40")))
    story.append(sp(3))

    story.append(info_box(
        "<b>한 줄 요약:</b> &nbsp;"
        "-ed/-s 어미는 직전 소리가 <b>무성→/t/ /s/</b>, <b>유성→/d/ /z/</b>, "
        "<b>같은 계열(t·d / 시빌란트)→/ɪd/ /ɪz/</b> 로 발음됩니다.",
        bg=YELLOW_SOFT, border=YELLOW, icon="◆"))

    story.append(PageBreak())

    # ═══════ P2-8. 강모음 약모음·강세 이동 ═══════
    story.append(section_header("16", "강세 이동 & 파생어 발음 변화", "철자는 같아도 강세 위치에 따라 발음이 바뀜"))
    story.append(sp(3))
    story.append(info_box(
        "영어는 강세 받는 모음이 또렷하고, 강세 없는 모음은 ə(슈와)로 약화됩니다. "
        "파생어를 만들 때 강세가 이동하면서 발음이 크게 달라지므로 주의하세요.",
        bg=SKY_SOFT, border=BLUE, icon="◆"))
    story.append(sp(3))

    stress_shift_data = [
        ("PHO-to-graph",   "ˈfoʊtəɡræf", "포우터그래프", "PHO-TOG-ra-phy",  "fəˈtɒɡrəfi",  "퍼탁그러피"),
        ("E-co-no-my",     "iˈkɒnəmi",   "이카너미",     "e-co-NOM-ic",     "ˌiːkəˈnɒmɪk", "이ㅡ커나믹"),
        ("PO-li-tics",     "ˈpɒlɪtɪks",  "팔리틱스",     "po-LIT-i-cal",    "pəˈlɪtɪkəl",  "펄리티컬"),
        ("RE-cord (명사)",  "ˈrekərd",    "뤠커드",       "re-CORD (동사)",  "rɪˈkɔːrd",    "리코ㅡ드"),
        ("PER-mit (명사)", "ˈpɜːrmɪt",   "퍼ㅡ밋",       "per-MIT (동사)",  "pərˈmɪt",      "퍼밋"),
        ("PRE-sent (명사)","ˈpreznt",     "프레즌트",     "pre-SENT (동사)", "prɪˈzent",     "프리젠트"),
    ]
    hdr_ss = [Paragraph(h, S_WHITE_C) for h in ["기본형","IPA","한글","파생형/품사","IPA","한글"]]
    rows_ss = [hdr_ss]
    for row in stress_shift_data:
        rows_ss.append([
            Paragraph(W_IPA(row[0]), st(f"ss0",11,NAVY,align=1)),
            Paragraph(W_IPA(row[1]), st(f"ss1",11,ROSE,align=1)),
            Paragraph(W_IPA(row[2]), st(f"ss2",10,GREY_TXT,align=1)),
            Paragraph(W_IPA(row[3]), st(f"ss3",11,NAVY,align=1)),
            Paragraph(W_IPA(row[4]), st(f"ss4",11,ROSE,align=1)),
            Paragraph(W_IPA(row[5]), st(f"ss5",10,GREY_TXT,align=1)),
        ])
    t_ss = Table(rows_ss, colWidths=[30*mm, 28*mm, 22*mm, 30*mm, 28*mm, None])
    t_ss.setStyle(TableStyle([
        ("FONTNAME",(0,0),(-1,-1),"KR"),
        ("BACKGROUND",(0,0),(-1,0), NAVY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, SKY_SOFT]),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),8),
        ("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("BOX",(0,0),(-1,-1),1,NAVY),
        ("GRID",(0,1),(-1,-1),0.4,GREY_BORDER),
        ("LINEAFTER",(2,0),(2,-1),1.5,colors.HexColor("#90CAF9")),
    ]))
    story.append(t_ss)
    story.append(sp(3))

    story.append(info_box(
        "<b>슈와 약화 법칙:</b> photograph → photography 변환 시 "
        "photo의 'o'[oʊ]가 photography에서 'o'[ə]로 약화됩니다. "
        "강세 받는 음절은 또렷하게, 나머지는 슈와(ə)로 흐리게.",
        bg=YELLOW_SOFT, border=YELLOW, icon="◆"))
    story.append(sp(3))

    # 파닉스 최종 푸터
    phonics_footer = Table([[Paragraph(
        "<b>파닉스 규칙 + IPA 발음기호를 함께 익히면</b><br/>"
        "처음 보는 단어도 소리를 유추할 수 있습니다. "
        "규칙 → 예외 순서로 반복하면서 패턴을 몸에 익히세요!",
        st("pftr", 11, WHITE, align=1, leading=17)
    )]], colWidths=[CONTENT_W])
    phonics_footer.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), colors.HexColor("#0D47A1")),
        ("TOPPADDING",(0,0),(-1,-1), 14),
        ("BOTTOMPADDING",(0,0),(-1,-1), 14),
        ("LEFTPADDING",(0,0),(-1,-1), 12),
        ("RIGHTPADDING",(0,0),(-1,-1), 12),
    ]))
    story.append(phonics_footer)

    doc.build(story)
    print(f"PDF 생성 완료: {path}")

if __name__ == "__main__":
    build()
