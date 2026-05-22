from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_PATH = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
pdfmetrics.registerFont(TTFont("KR", FONT_PATH))

W, H = A4
MARGIN = 15 * mm

def style(name, size=11, bold=False, color=colors.black, align=0, leading=None):
    return ParagraphStyle(
        name,
        fontName="KR",
        fontSize=size,
        textColor=color,
        alignment=align,
        leading=leading or (size * 1.45),
        spaceAfter=0,
        spaceBefore=0,
    )

S_TITLE    = style("title",   26, color=colors.HexColor("#1A237E"), align=1)
S_SUB      = style("sub",     13, color=colors.HexColor("#3949AB"), align=1)
S_H1       = style("h1",      15, color=colors.HexColor("#1565C0"))
S_H2       = style("h2",      12, color=colors.HexColor("#1976D2"))
S_BODY     = style("body",    11)
S_SMALL    = style("small",   9,  color=colors.HexColor("#555555"))
S_IPA_BIG  = style("ipa_big", 20, color=colors.HexColor("#B71C1C"), align=1)
S_CENTER   = style("center",  11, align=1)
S_TIP      = style("tip",     10, color=colors.HexColor("#2E7D32"))
S_WARN     = style("warn",    10, color=colors.HexColor("#E65100"))
S_WHITE    = style("white",   12, color=colors.white, align=1)
S_WHITE_SM = style("white_sm",10, color=colors.white, align=1)

BLUE_LIGHT  = colors.HexColor("#E3F2FD")
BLUE_MID    = colors.HexColor("#BBDEFB")
BLUE_DARK   = colors.HexColor("#1565C0")
RED_LIGHT   = colors.HexColor("#FFEBEE")
GREEN_LIGHT = colors.HexColor("#E8F5E9")
YELLOW_LIGHT= colors.HexColor("#FFFDE7")
GREY_LIGHT  = colors.HexColor("#F5F5F5")
ORANGE_LIGHT= colors.HexColor("#FFF3E0")

def hr(color=BLUE_MID, thickness=1):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=4, spaceBefore=4)

def sp(h=4):
    return Spacer(1, h * mm)

def section(title):
    return [sp(3), Paragraph(title, S_H1), hr(BLUE_MID, 1.5), sp(1)]

def tbl(data, col_widths, row_styles=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    base = [
        ("FONTNAME", (0,0), (-1,-1), "KR"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, GREY_LIGHT]),
        ("BACKGROUND",    (0,0), (-1,0), BLUE_DARK),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTSIZE",      (0,0), (-1,0), 11),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("GRID",          (0,0), (-1,-1), 0.4, colors.HexColor("#BDBDBD")),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, BLUE_LIGHT]),
    ]
    if row_styles:
        base.extend(row_styles)
    t.setStyle(TableStyle(base))
    return t

def tip_box(text, bg=GREEN_LIGHT, icon="✅"):
    data = [[Paragraph(f"{icon}  {text}", style("tip_in", 10, color=colors.HexColor("#1B5E20")))]]
    t = Table(data, colWidths=[W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING",   (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return t

def warn_box(text):
    return tip_box(text, bg=ORANGE_LIGHT, icon="⚠️")

def card_row(items):
    """items: list of (ipa, korean, example)"""
    cells = []
    for ipa, kor, ex in items:
        inner = [
            [Paragraph(ipa, style("card_ipa", 18, color=colors.HexColor("#C62828"), align=1))],
            [Paragraph(kor, style("card_kor", 9,  color=colors.HexColor("#1A237E"), align=1))],
            [Paragraph(ex,  style("card_ex",  8,  color=colors.HexColor("#424242"), align=1))],
        ]
        inner_t = Table(inner, colWidths=[(W-2*MARGIN)/len(items)-4])
        inner_t.setStyle(TableStyle([
            ("FONTNAME",      (0,0),(-1,-1),"KR"),
            ("ALIGN",         (0,0),(-1,-1),"CENTER"),
            ("TOPPADDING",    (0,0),(-1,-1),3),
            ("BOTTOMPADDING", (0,0),(-1,-1),3),
            ("BACKGROUND",    (0,0),(0,0), RED_LIGHT),
            ("BACKGROUND",    (0,1),(0,2), colors.white),
        ]))
        cells.append(inner_t)
    cw = [(W-2*MARGIN)/len(items)] * len(items)
    outer = Table([cells], colWidths=cw)
    outer.setStyle(TableStyle([
        ("VALIGN",     (0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),2),
        ("RIGHTPADDING",(0,0),(-1,-1),2),
        ("GRID",       (0,0),(-1,-1),0.5,BLUE_MID),
    ]))
    return outer

# ── DATA ───────────────────────────────────────────────────────────────────────

VOWELS_SHORT = [
    ("ɪ",  "짧은 이", "bit, sit, fish",   "한국어 '이'보다 입 덜 벌림. 혀 높이↑ 중앙 쪽"),
    ("e",  "짧은 에", "bed, red, pen",    "한국어 '에'와 거의 동일. 짧고 단호하게"),
    ("æ",  "애~에 사이", "cat, bad, man", "입을 크게 벌리고 '애'. 한국어에 없는 모음!"),
    ("ʌ",  "짧은 어", "cup, bus, fun",   "입 살짝 벌리고 '어'. 강세음절에서 사용"),
    ("ɒ",  "짧은 오(영국)", "hot, dog, top", "영국식. 입 크게 벌리고 둥글게 '오'"),
    ("ʊ",  "짧은 우", "book, good, put", "한국어 '우'보다 느슨하게. 입술 살짝만 모음"),
    ("ə",  "슈와(약모음)", "about, sofa, the", "가장 흔한 영어 모음! 힘없는 '어'. 비강세"),
]

VOWELS_LONG = [
    ("iː", "긴 이",  "see, tea, feet",   "한국어 '이'를 길게. 입 옆으로 쭉"),
    ("ɑː", "긴 아",  "car, far, start",  "입 크게 벌리고 '아'. 목 안쪽에서"),
    ("ɔː", "긴 오",  "door, more, talk", "입술 동그랗게 '오'를 길게"),
    ("uː", "긴 우",  "blue, food, soon", "입술 앞으로 모아 '우'를 길게"),
    ("ɜː", "긴 어",  "bird, girl, word", "영어 특유의 긴 '어'. r 없이 혀 중앙"),
]

DIPHTHONGS = [
    ("eɪ", "에이", "day, face, game",    "에→이 미끄러지듯"),
    ("aɪ", "아이", "my, time, night",    "아→이 미끄러지듯"),
    ("ɔɪ", "오이", "boy, noise, join",   "오→이 미끄러지듯"),
    ("əʊ", "어우", "go, home, boat",     "어→우 미끄러지듯 (영국식)"),
    ("oʊ", "오우", "go, home, boat",     "오→우 미끄러지듯 (미국식)"),
    ("aʊ", "아우", "now, town, house",   "아→우 미끄러지듯"),
    ("ɪə", "이어", "here, near, beer",   "이→어 미끄러지듯"),
    ("eə", "에어", "hair, care, bear",   "에→어 미끄러지듯"),
    ("ʊə", "우어", "tour, poor, cure",   "우→어 미끄러지듯"),
]

CONSONANTS_TRICKY = [
    ("θ", "무성 th",  "think, math, bath",  "혀끝을 윗니 사이에 살짝 끼우고 바람 → 한국어에 없음!"),
    ("ð", "유성 th",  "this, the, mother",  "θ와 동일 위치, 성대 울림 추가 → '드'처럼"),
    ("ŋ", "ng 받침",  "sing, ring, long",   "'ㅇ' 받침. n+g 두 소리 아님! 코로 울리는 비음"),
    ("ʒ", "유성 zh",  "vision, measure",    "한국어 없음. 'ㅈ'+'ㅅ' 혼합 느낌. 혀 말아올려"),
    ("ʃ", "sh",       "she, ship, wash",    "'슈' 느낌. 혀 뒤로 당기고 입술 앞으로"),
    ("tʃ","ch",       "chair, watch, chin", "'츄' 느낌. ʃ보다 더 막았다 터트림"),
    ("dʒ","j/dg",    "judge, age, jump",   "'줘' 느낌. tʃ의 유성음 버전"),
    ("r", "영어 r",   "red, car, more",     "혀 말지 않음! 혀끝 들어올리고 어디도 안 닿게"),
    ("w", "w",        "wet, we, swim",      "'우'에서 바로 다음 모음으로. 입술 동그랗게 먼저"),
    ("j", "y 소리",   "yes, you, year",     "'이'에서 바로 다음 모음으로. 한국어 'ㅣ' 반모음"),
    ("ʔ", "성문파열음","butter(미국)",       "모음 사이 't'가 사라지는 느낌. 목에서 잠깐 막힘"),
]

STRESS = [
    ("ˈ", "1차 강세", "ˈphotograph", "강하고 높게. 표시 바로 뒤 음절"),
    ("ˌ", "2차 강세", "ˌphoˈtography", "약간 강조. 1차보다 약함"),
    (".", "음절 경계", "pho.to.graph", "음절을 나누는 점"),
    ("ː", "장음",     "siːt vs sɪt",  "소리를 길게 늘임"),
    ("()", "생략가능", "ˈlaɪbrəri(j)", "있어도 없어도 되는 소리"),
]

CONFUSE_PAIRS = [
    ("ɪ vs iː",  "sit ≠ seat",   "ɪ = 짧고 느슨한 이\niː = 길고 팽팽한 이"),
    ("e vs æ",   "bed ≠ bad",    "e = 입 반쯤 벌림\næ = 입 크게 벌림 '애'"),
    ("ʌ vs ə",   "cup vs sofa",  "ʌ = 강세 있는 어\nə = 강세 없는 약한 어"),
    ("ʊ vs uː",  "book ≠ boot",  "ʊ = 짧고 느슨한 우\nuː = 길고 팽팽한 우"),
    ("θ vs ð",   "think ≠ this", "θ = 바람만(무성)\nð = 성대울림(유성)"),
    ("ʃ vs ʒ",   "ship ≠ vision","ʃ = 무성 sh\nʒ = 유성 zh(흔치않음)"),
    ("n vs ŋ",   "sin ≠ sing",   "n = 혀끝 위 잇몸\nŋ = 혀 뒤쪽 입천장"),
]

# ── BUILD ───────────────────────────────────────────────────────────────────────

def build():
    path = "/home/user/vocaknio-quiz/IPA_발음기호_완전정복.pdf"
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=12*mm, bottomMargin=12*mm,
    )
    story = []

    # ── COVER ──
    cover_data = [[Paragraph("IPA 발음기호 완전정복", S_TITLE)]]
    cover_tbl = Table(cover_data, colWidths=[W-2*MARGIN])
    cover_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), BLUE_DARK),
        ("TOPPADDING",    (0,0),(-1,-1), 18),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 10),
    ]))
    story.append(cover_tbl)

    sub_data = [[Paragraph("파닉스는 알지만 발음기호가 헷갈리는 분을 위한 완벽 가이드", S_SUB)]]
    sub_tbl = Table(sub_data, colWidths=[W-2*MARGIN])
    sub_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), colors.HexColor("#3949AB")),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
    ]))
    story.append(sub_tbl)
    story.append(sp(4))

    # intro box
    intro_lines = [
        "📌  이 자료의 목표: 발음기호를 보는 순간 소리가 떠오르게 만들기",
        "📌  파닉스와의 차이: 파닉스는 철자→소리 규칙, IPA는 소리 그 자체를 표기",
        "📌  활용법: 새 단어 외울 때 발음기호를 먼저 읽고, 소리→철자 순으로 익히기",
    ]
    for line in intro_lines:
        story.append(tip_box(line))
        story.append(sp(1))
    story.append(sp(2))

    # ── 1. 모음 총론 ──
    story += section("1. 모음(Vowels) — 파닉스와 IPA의 차이가 가장 큰 부분")
    story.append(Paragraph(
        "파닉스에서 'a'는 여러 소리(cat의 æ, cake의 eɪ, car의 ɑː)를 냅니다. "
        "IPA는 이것을 각각 다른 기호로 구분합니다. 기호 하나 = 소리 하나.",
        S_BODY))
    story.append(sp(2))

    # 1-1 단모음
    story.append(Paragraph("1-1  단모음 (Short Vowels)", S_H2))
    story.append(sp(1))
    hdr = [Paragraph(h, S_WHITE) for h in ["기호", "소리 느낌", "예시 단어", "발음 팁"]]
    rows_sv = [hdr]
    for sym, feel, ex, tip in VOWELS_SHORT:
        rows_sv.append([
            Paragraph(sym,  style("sv_sym", 16, color=colors.HexColor("#B71C1C"), align=1)),
            Paragraph(feel, S_CENTER),
            Paragraph(ex,   style("sv_ex", 10, align=1)),
            Paragraph(tip,  style("sv_tip", 9, color=colors.HexColor("#37474F"))),
        ])
    story.append(tbl(rows_sv, [18*mm, 28*mm, 42*mm, None]))
    story.append(sp(2))

    # ə 강조
    story.append(warn_box(
        "⭐ ə (슈와) 는 영어에서 가장 자주 나오는 모음! "
        "강세 없는 음절은 거의 다 ə 로 줄어듭니다. "
        "예: banana = bəˈnɑːnə  /  photograph = ˈfəʊtəɡrɑːf"
    ))
    story.append(sp(2))

    # 1-2 장모음
    story.append(Paragraph("1-2  장모음 (Long Vowels)  — ː 기호가 붙으면 길게!", S_H2))
    story.append(sp(1))
    hdr2 = [Paragraph(h, S_WHITE) for h in ["기호", "소리", "예시", "팁"]]
    rows_lv = [hdr2]
    for sym, feel, ex, tip in VOWELS_LONG:
        rows_lv.append([
            Paragraph(sym,  style("lv_sym", 16, color=colors.HexColor("#1565C0"), align=1)),
            Paragraph(feel, S_CENTER),
            Paragraph(ex,   style("lv_ex", 10, align=1)),
            Paragraph(tip,  style("lv_tip", 9, color=colors.HexColor("#37474F"))),
        ])
    story.append(tbl(rows_lv, [18*mm, 25*mm, 42*mm, None]))
    story.append(sp(3))

    # 1-3 이중모음
    story.append(Paragraph("1-3  이중모음 (Diphthongs)  — 두 모음이 연결되어 미끄러짐", S_H2))
    story.append(sp(1))
    hdr3 = [Paragraph(h, S_WHITE) for h in ["기호", "느낌", "예시", "설명"]]
    rows_di = [hdr3]
    for sym, feel, ex, tip in DIPHTHONGS:
        rows_di.append([
            Paragraph(sym,  style("di_sym", 15, color=colors.HexColor("#880E4F"), align=1)),
            Paragraph(feel, S_CENTER),
            Paragraph(ex,   style("di_ex", 10, align=1)),
            Paragraph(tip,  style("di_tip", 9, color=colors.HexColor("#37474F"))),
        ])
    story.append(tbl(rows_di, [18*mm, 22*mm, 42*mm, None]))
    story.append(sp(3))

    # ── 2. 자음 ──
    story += section("2. 자음(Consonants) — 파닉스로 아는 것 + 헷갈리는 것만 정리")
    story.append(tip_box(
        "b d f g h k l m n p s t v z — 이 자음들은 파닉스와 IPA가 동일합니다. "
        "아래는 파닉스와 다르거나 한국어에 없어서 헷갈리는 자음만 모았습니다.",
        bg=BLUE_LIGHT, icon="ℹ️"
    ))
    story.append(sp(2))

    hdr_c = [Paragraph(h, S_WHITE) for h in ["기호", "이름", "예시", "핵심 포인트"]]
    rows_c = [hdr_c]
    for sym, name, ex, tip in CONSONANTS_TRICKY:
        rows_c.append([
            Paragraph(sym,  style("c_sym", 15, color=colors.HexColor("#1A237E"), align=1)),
            Paragraph(name, S_CENTER),
            Paragraph(ex,   style("c_ex", 10, align=1)),
            Paragraph(tip,  style("c_tip", 9, color=colors.HexColor("#37474F"))),
        ])
    story.append(tbl(rows_c, [14*mm, 22*mm, 42*mm, None]))
    story.append(sp(2))

    story.append(warn_box(
        "th는 두 종류! θ(think) vs ð(this)  —  "
        "단어 외울 때 th 발음기호가 θ인지 ð인지 꼭 확인하세요."
    ))
    story.append(sp(3))

    # ── 3. 강세와 기타 기호 ──
    story += section("3. 강세(Stress) & 기타 기호")
    hdr_s = [Paragraph(h, S_WHITE) for h in ["기호", "의미", "예시", "설명"]]
    rows_s = [hdr_s]
    for sym, name, ex, tip in STRESS:
        rows_s.append([
            Paragraph(sym,  style("s_sym", 15, color=colors.HexColor("#4A148C"), align=1)),
            Paragraph(name, S_CENTER),
            Paragraph(ex,   style("s_ex", 11, align=1)),
            Paragraph(tip,  style("s_tip", 9, color=colors.HexColor("#37474F"))),
        ])
    story.append(tbl(rows_s, [14*mm, 28*mm, 40*mm, None]))
    story.append(sp(2))

    story.append(tip_box(
        "강세 위치가 다르면 뜻이 달라지는 단어 예시:\n"
        "ˈrecord (명사: 기록)  vs  rɪˈkɔːd (동사: 녹음하다)\n"
        "ˈpresent (명사/형용사: 선물/현재)  vs  prɪˈzent (동사: 발표하다)",
        bg=YELLOW_LIGHT, icon="💡"
    ))
    story.append(sp(3))

    # ── 4. 헷갈리는 쌍 ──
    story += section("4. 자주 헷갈리는 기호 쌍 — 나란히 비교")

    hdr_p = [Paragraph(h, S_WHITE) for h in ["헷갈리는 쌍", "예시 비교", "구분 방법"]]
    rows_p = [hdr_p]
    for pair, ex, how in CONFUSE_PAIRS:
        rows_p.append([
            Paragraph(pair, style("p_pair", 13, color=colors.HexColor("#B71C1C"), align=1)),
            Paragraph(ex,   style("p_ex",   10, align=1)),
            Paragraph(how,  style("p_how",   9, color=colors.HexColor("#1B5E20"))),
        ])
    story.append(tbl(rows_p, [38*mm, 38*mm, None]))
    story.append(sp(3))

    # ── 5. 실전 읽기 연습 ──
    story += section("5. 실전 발음기호 읽기 연습")
    story.append(Paragraph("아래 발음기호를 소리로 읽어보세요. 정답은 오른쪽.", S_BODY))
    story.append(sp(2))

    practice = [
        ("ˈsɪmpəl",   "simple",    "단순한"),
        ("ˌedʒʊˈkeɪʃn","education","교육"),
        ("ɪnˈkredɪbl̩", "incredible","믿기 어려운"),
        ("ˌɒpəˈtjuːnɪti","opportunity","기회"),
        ("prɪˈzɜːv",  "preserve",  "보존하다"),
        ("ˈθɔːtfl̩",  "thoughtful","사려깊은"),
        ("ənˈθjuːziæzm","enthusiasm","열정"),
        ("ˌkɒmpɹɪˈhensɪv","comprehensive","포괄적인"),
    ]
    hdr_pr = [Paragraph(h, S_WHITE) for h in ["발음기호", "정답 단어", "뜻"]]
    rows_pr = [hdr_pr]
    for ipa, word, kor in practice:
        rows_pr.append([
            Paragraph(ipa,  style("pr_ipa", 12, color=colors.HexColor("#B71C1C"), align=1)),
            Paragraph(word, style("pr_w",   12, color=colors.HexColor("#1565C0"), align=1)),
            Paragraph(kor,  style("pr_k",   11, align=1)),
        ])
    story.append(tbl(rows_pr, [65*mm, 55*mm, None]))
    story.append(sp(3))

    # ── 6. 빠른 참조표 ──
    story += section("6. 한눈에 보는 빠른 참조표")
    story.append(Paragraph("모음 전체 (단모음 → 장모음 → 이중모음)", S_H2))
    story.append(sp(1))

    all_vowels = [
        ("ɪ","짧은이","ð","유성th"),  ("iː","긴이","θ","무성th"),
        ("e","짧은에","ʃ","sh"),      ("æ","애에사이","ʒ","zh"),
        ("ʌ","짧은어","tʃ","ch"),     ("ə","슈와","dʒ","j"),
        ("ɒ","짧은오","ŋ","ng받침"),  ("ɑː","긴아","r","영어r"),
        ("ɔː","긴오","w","w"),        ("uː","긴우","j","y소리"),
        ("ɜː","긴어","ʔ","성문파열"),
        ("eɪ","에이","ˈ","1차강세"),  ("aɪ","아이","ˌ","2차강세"),
        ("ɔɪ","오이","ː","장음"),     ("əʊ","어우(영)","→","미끄러짐"),
        ("aʊ","아우","",""),
    ]

    hdr_q = [Paragraph(h, S_WHITE) for h in ["모음기호","소리","자음/기타","의미"]]
    rows_q = [hdr_q]
    for v_sym, v_kor, c_sym, c_kor in all_vowels:
        rows_q.append([
            Paragraph(v_sym, style("q_v",12,color=colors.HexColor("#880E4F"),align=1)),
            Paragraph(v_kor, style("q_vk",9,align=1)),
            Paragraph(c_sym, style("q_c",12,color=colors.HexColor("#1A237E"),align=1)),
            Paragraph(c_kor, style("q_ck",9,align=1)),
        ])
    story.append(tbl(rows_q, [28*mm, 35*mm, 28*mm, None]))
    story.append(sp(3))

    # ── 7. 핵심 암기 포인트 ──
    story += section("7. 핵심 암기 포인트 TOP 7")
    tips7 = [
        ("1", "ə (슈와) 는 영어 최빈출 모음", "강세 없는 모든 음절에서 등장. about = əˈbaʊt"),
        ("2", "ː 가 있으면 길게", "sit(ɪ) ≠ seat(iː) — 장단이 의미를 바꿈"),
        ("3", "th는 두 종류", "think = θɪŋk (무성),  this = ðɪs (유성)"),
        ("4", "ŋ 은 단독 비음", "sing = sɪŋ — n+g 두 소리가 아닌 하나의 소리"),
        ("5", "ˈ 는 강세 표시", "ˈphotograph — ˈ 바로 뒤 음절을 강하게"),
        ("6", "이중모음은 미끄러지듯", "aɪ = '아'에서 '이'로 자연스럽게 이동"),
        ("7", "r은 혀를 아무 데도 안 닿게", "영어 r = 혀끝 들어올리되 어디도 접촉 안 함"),
    ]
    for num, title, desc in tips7:
        row_data = [[
            Paragraph(num,   style("t7n", 16, color=colors.white, align=1)),
            Paragraph(f"<b>{title}</b>  —  {desc}", style("t7d", 10, color=colors.HexColor("#212121"))),
        ]]
        t = Table(row_data, colWidths=[14*mm, W-2*MARGIN-14*mm])
        t.setStyle(TableStyle([
            ("FONTNAME",     (0,0),(-1,-1),"KR"),
            ("BACKGROUND",   (0,0),(0,0), BLUE_DARK),
            ("BACKGROUND",   (1,0),(1,0), YELLOW_LIGHT),
            ("VALIGN",       (0,0),(-1,-1),"MIDDLE"),
            ("TOPPADDING",   (0,0),(-1,-1),6),
            ("BOTTOMPADDING",(0,0),(-1,-1),6),
            ("LEFTPADDING",  (1,0),(1,0),8),
            ("GRID",         (0,0),(-1,-1),0.5,BLUE_MID),
        ]))
        story.append(t)
        story.append(sp(1))

    story.append(sp(2))

    # footer
    footer_data = [[Paragraph(
        "이 자료로 발음기호에 익숙해지면 단어 암기 속도가 크게 빨라집니다. "
        "새 단어를 볼 때마다 발음기호를 먼저 읽는 습관을 들이세요! 💪",
        style("footer", 10, color=colors.white, align=1)
    )]]
    footer_tbl = Table(footer_data, colWidths=[W-2*MARGIN])
    footer_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), colors.HexColor("#1A237E")),
        ("TOPPADDING",    (0,0),(-1,-1), 10),
        ("BOTTOMPADDING", (0,0),(-1,-1), 10),
        ("LEFTPADDING",   (0,0),(-1,-1), 10),
        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
    ]))
    story.append(footer_tbl)

    doc.build(story)
    print(f"PDF saved: {path}")

build()
