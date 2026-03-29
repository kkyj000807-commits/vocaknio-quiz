// 한양대 편입 기출 문제 데이터 (2024~2026 서울 인문A)
// 문제 유형: vocab-synonym(어휘동의어), vocab-blank(어휘빈칸), logic-blank(논리빈칸),
//           reading-main(독해내용일치), reading-vocab(독해밑줄어휘), reading-blank(독해빈칸),
//           reading-title(독해제목), grammar(문법)

export type QuestionType =
  | "vocab-synonym"
  | "vocab-blank"
  | "logic-blank"
  | "reading-main"
  | "reading-vocab"
  | "reading-blank"
  | "reading-title"
  | "grammar";

export interface ExamQuestion {
  id: string;
  year: number;
  qNum: number;
  type: QuestionType;
  passage?: string;       // 독해 지문
  question: string;       // 문제 지문/질문 (밑줄 단어 포함)
  underlined?: string;    // 밑줄 친 단어/구
  choices: string[];      // 선택지 (4~5개)
  answer: number;         // 정답 인덱스 (0-based)
  explanation: string;    // 해설
  points: number;         // 배점
}

export const examQuestions: ExamQuestion[] = [
  // ─────────────────────────────────────────────
  // 2026 어휘 동의어 (Q2~Q5)
  // ─────────────────────────────────────────────
  {
    id: "2026-02",
    year: 2026,
    qNum: 2,
    type: "vocab-synonym",
    question:
      "Seasoned critics were [flabbergasted] by the playwright's abrupt subversion of narrative logic, which upended even the most settled interpretive expectations.",
    underlined: "flabbergasted",
    choices: ["soothed", "affronted", "unfettered", "astonished", "transfigured"],
    answer: 3,
    explanation: "flabbergasted = 몹시 놀란 → astonished(깜짝 놀란)",
    points: 2,
  },
  {
    id: "2026-03",
    year: 2026,
    qNum: 3,
    type: "vocab-synonym",
    question:
      "The senator's [obstreperous] refusal to yield the floor—marked by raised voice and calculated belligerence—disrupted the proceedings.",
    underlined: "obstreperous",
    choices: ["unruly", "defiant", "reticent", "vociferous", "conciliatory"],
    answer: 0,
    explanation: "obstreperous = 소란스럽고 다루기 힘든 → unruly(제멋대로인, 다루기 힘든)",
    points: 2,
  },
  {
    id: "2026-04",
    year: 2026,
    qNum: 4,
    type: "vocab-synonym",
    question:
      "He remained [circumspect] when addressing the sensitive topic.",
    underlined: "circumspect",
    choices: ["evasive", "cautious", "resigned", "dogmatic", "indifferent"],
    answer: 1,
    explanation: "circumspect = 신중한, 조심스러운 → cautious(조심스러운)",
    points: 2,
  },
  {
    id: "2026-05",
    year: 2026,
    qNum: 5,
    type: "vocab-synonym",
    question:
      "The Board of Governors considered that the university did not [eschew] such opportunities altogether.",
    underlined: "eschew",
    choices: ["shun", "relish", "embrace", "belie", "assuage"],
    answer: 0,
    explanation: "eschew = 의도적으로 피하다 → shun(피하다). relish/embrace는 반대 의미.",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2026 어휘 빈칸 (Q6~Q8)
  // ─────────────────────────────────────────────
  {
    id: "2026-06",
    year: 2026,
    qNum: 6,
    type: "vocab-blank",
    question:
      "X-bar theory, which was once ___ by most prominent scholars, has lost much of its luster and been jettisoned by most scholars.",
    choices: ["confuted", "propounded", "falsified", "refuted", "encapsulated"],
    answer: 1,
    explanation: "빈칸 뒤에 '지금은 버려졌다'고 하므로 과거에는 지지받았음. propounded = 제안·지지된",
    points: 2,
  },
  {
    id: "2026-07",
    year: 2026,
    qNum: 7,
    type: "vocab-blank",
    question:
      "In most cases, the President's responses are impertinent, if not downright ___, but this morning his responses were remarkably courteous, almost reverential.",
    choices: ["effusive", "spurious", "enigmatic", "inconsiderate", "ignominious"],
    answer: 3,
    explanation: "대조 구조: 무례한(impertinent) → 더 심하면 inconsiderate(배려 없는). 뒤에 courteous와 대비.",
    points: 2,
  },
  {
    id: "2026-08",
    year: 2026,
    qNum: 8,
    type: "vocab-blank",
    question:
      "A genetic test from one person can provide information about a relative. This was possible to a limited extent before modern genetics. What is new is the extent to which these possibilities can be realized; and this extent is forcing us to rethink ___.",
    choices: [
      "informed consent",
      "patient autonomy",
      "medical confidentiality",
      "scientific experimentation",
      "hereditary determinism",
    ],
    answer: 4,
    explanation: "유전자 검사가 친척 정보까지 드러낸다는 내용 → 유전적 결정론(hereditary determinism) 재고",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2026 독해 밑줄 어휘
  // ─────────────────────────────────────────────
  {
    id: "2026-17",
    year: 2026,
    qNum: 17,
    type: "reading-vocab",
    passage:
      "Chomsky maintains that one of the characteristics that all languages have in common is their creative aspect. Thus, this constitutes an essential property of language: it provides definite means for expressing indefinitely many thoughts and for reacting appropriately in an indefinite range of new situations. However, in Sampson's view, this merely constitutes part of human creativity, which he terms 'fixed creativity.' Sampson contends that languages also exhibit another kind of creativity called the 'enlarging creativity.' This has to do with the ways in which humans depart from the fixed rules in place to create new rules, and in doing so, produce innovative expressions.",
    question: "밑줄 친 'depart from the fixed rules in place'의 의미와 가장 가까운 것은?",
    underlined: "depart from the fixed rules in place",
    choices: [
      "violate the rules",
      "comprehend the rules",
      "complicate the rules",
      "design the rules",
      "cognitively absorb the rules",
    ],
    answer: 0,
    explanation: "depart from = 벗어나다 → violate the rules(규칙을 어기다). 새 규칙을 만들기 위해 기존 규칙에서 벗어남.",
    points: 2,
  },
  {
    id: "2026-25",
    year: 2026,
    qNum: 25,
    type: "reading-vocab",
    passage:
      "Today, Washington Irving's A History of the Life and Voyages of Christopher Columbus is regarded as historical fiction based loosely on the life of Columbus. But when it was released, it popularized the now-debunked story that Columbus' voyage faced opposition from Catholic scholars who believed the Earth was flat. The myth was further entrenched in the public consciousness by inaccurate histories.",
    question: "밑줄 친 'entrenched'의 뜻과 가장 가까운 것은?",
    underlined: "entrenched",
    choices: ["questioned", "eliminated", "reinforced", "clarified", "challenged"],
    answer: 2,
    explanation: "entrenched = 깊이 박힌, 확고히 자리잡은 → reinforced(강화된)",
    points: 2,
  },
  {
    id: "2026-27",
    year: 2026,
    qNum: 27,
    type: "reading-vocab",
    passage:
      "In one study, the taste test was a subterfuge to make available an unlimited supply of food—the crackers—and the amount eaten was the dependent variable.",
    question: "밑줄 친 'subterfuge'의 뜻과 가장 가까운 것은?",
    underlined: "subterfuge",
    choices: ["rectitude", "candor", "trick", "compliance", "coincidence"],
    answer: 2,
    explanation: "subterfuge = 속임수, 핑계 → trick(속임수)",
    points: 2,
  },
  {
    id: "2026-31",
    year: 2026,
    qNum: 31,
    type: "reading-vocab",
    passage:
      "Much of our familiarity with our world comes through photographic visualization as a surrogate for first-hand experience. An iconophobic future might make some important gains by dispensing with the mediation of cameras, but the costs would be immense.",
    question: "밑줄 친 'iconophobic'의 뜻과 가장 가까운 것은?",
    underlined: "iconophobic",
    choices: [
      "indifferent to technological mediation",
      "devoted to preserving aesthetic enchantment",
      "excessively fascinated by visual representation",
      "distrustful of visual images and their cultural authority",
      "over-reliant on photography as an authentic mode of knowledge",
    ],
    answer: 3,
    explanation: "iconophobic = 이미지/시각적 표현을 두려워하거나 불신하는 → distrustful of visual images",
    points: 2,
  },
  {
    id: "2026-33",
    year: 2026,
    qNum: 33,
    type: "reading-blank",
    passage:
      "Widely recognized as one of the most original and influential political thinkers of the twentieth century, Hannah Arendt remains a(n) ___ figure. She never wrote a systematic political philosophy in the mode of Thomas Hobbes or John Rawls, and the books she did write are extremely diverse in topic. These works are not constructed upon a single argument, diligently unfolded, or upon a linear narrative. Rather, they are grounded upon a series of striking conceptual distinctions.",
    question: "빈칸에 들어갈 가장 적절한 것은?",
    choices: ["elusive", "solipsistic", "sympathetic", "authoritarian", "single-minded"],
    answer: 0,
    explanation: "체계적 철학 없이 다양한 주제를 다루는 사상가 → elusive(파악하기 어려운, 규정하기 힘든)",
    points: 2,
  },
  {
    id: "2026-35",
    year: 2026,
    qNum: 35,
    type: "reading-blank",
    passage:
      "Widowed, she did not withdraw but intensified her role as ___: Oskar Kokoschka's obsession burned itself into paint, Walter Gropius embodied the promise of architectural modernism, and Franz Werfel offered literary partnership and eventual exile. Alma Mahler shaped modernism through relational and affective mediation.",
    question: "빈칸에 들어갈 가장 적절한 것은?",
    choices: ["accomplice", "catalyst", "charlatan", "amanuensis", "accessory"],
    answer: 1,
    explanation: "예술가들에게 영감을 주고 변화를 촉진한 역할 → catalyst(촉매, 변화를 이끄는 사람)",
    points: 2,
  },
  {
    id: "2026-37",
    year: 2026,
    qNum: 37,
    type: "reading-vocab",
    passage:
      "The humanist self-image of Afro-Americans is one neither of heroic superhumans untouched by the experience of oppression nor of pathetic subhumans devoid of a supportive culture. Rather Afro-Americans are viewed as both meek and belligerent, kind and cruel, creative and dull—in short, as human beings.",
    question: "밑줄 친 'meek'의 뜻과 가장 가까운 것은?",
    underlined: "meek",
    choices: ["compliant", "pugnacious", "haughty", "callous", "volatile"],
    answer: 0,
    explanation: "meek = 온순한, 유순한 → compliant(순응하는, 고분고분한). pugnacious는 반대(호전적).",
    points: 2,
  },
  {
    id: "2026-39",
    year: 2026,
    qNum: 39,
    type: "reading-vocab",
    passage:
      "Whether apocryphal in detail or not, the episode has assumed emblematic force because it condenses, in a single gesture, the violent convergence of compassion and breakdown that marked the end of Nietzsche's productive life.",
    question: "밑줄 친 'apocryphal'의 뜻과 가장 가까운 것은?",
    underlined: "apocryphal",
    choices: ["minute", "pristine", "plenteous", "unfounded", "ambivalent"],
    answer: 3,
    explanation: "apocryphal = 진위가 의심스러운, 근거 없는 → unfounded(근거 없는)",
    points: 2,
  },
  {
    id: "2026-41",
    year: 2026,
    qNum: 41,
    type: "reading-blank",
    passage:
      "One reason why the twentieth century brooded on the meaning of existence more agonizedly than most epochs may be because it held human life so appallingly cheap. It was by far the bloodiest epoch on historical record. If life is so drastically devalued in practice, one might well expect its meaning to be questioned in theory. It is typical of the modern era that what one might call the ___ dimension of human life is pushed steadily to the margins. Within this dimension, three areas have traditionally been vital: religion, culture, and sexuality.",
    question: "빈칸에 들어갈 가장 적절한 것은?",
    choices: ["heuristic", "symbolic", "temporal", "historical", "epistemological"],
    answer: 1,
    explanation: "종교·문화·성(sexuality)을 포괄하는 차원 → symbolic(상징적) 차원",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2025 어휘 동의어 (Q2~Q7)
  // ─────────────────────────────────────────────
  {
    id: "2025-02",
    year: 2025,
    qNum: 2,
    type: "vocab-synonym",
    question:
      "Democracy, that delicate and ever-evolving tapestry of collective will, is both the guardian of individual freedoms and the [crucible] in which the aspirations of humanity are unceasingly tested and refined.",
    underlined: "crucible",
    choices: ["trial", "catalyst", "portal", "foundation", "experiment"],
    answer: 0,
    explanation: "crucible = 도가니, 시련의 장 → trial(시련, 시험의 장)",
    points: 2,
  },
  {
    id: "2025-03",
    year: 2025,
    qNum: 3,
    type: "vocab-synonym",
    question:
      "Videogames certainly have a reputation for encouraging predatory tendencies. Still, to billions, gaming is a space for [respite], for building lives not yet lived.",
    underlined: "respite",
    choices: ["rest", "penance", "aggression", "consensus", "authenticity"],
    answer: 0,
    explanation: "respite = 휴식, 잠시 쉬는 시간 → rest(휴식)",
    points: 2,
  },
  {
    id: "2025-04",
    year: 2025,
    qNum: 4,
    type: "vocab-synonym",
    question:
      "In the late-nineteenth and early-twentieth-century period, Irish revivalism and modernism were both still in their fledgling and most [protean] phases.",
    underlined: "protean",
    choices: ["morbid", "prolific", "mutable", "trivial", "timorous"],
    answer: 2,
    explanation: "protean = 변화무쌍한, 다양한 형태를 취하는 → mutable(변하기 쉬운)",
    points: 2,
  },
  {
    id: "2025-05",
    year: 2025,
    qNum: 5,
    type: "vocab-synonym",
    question:
      'The less the worker identifies his own freedom with the purpose of the work, Marx writes, "the exertion of the working organs" must be forcibly [cajoled].',
    underlined: "cajoled",
    choices: ["reenacted", "expelled", "mitigated", "coaxed", "dissociated"],
    answer: 3,
    explanation: "cajoled = 달래서 시키다, 구슬리다 → coaxed(구슬리다, 달래다)",
    points: 2,
  },
  {
    id: "2025-06",
    year: 2025,
    qNum: 6,
    type: "vocab-synonym",
    question:
      "People with advantages don't want their own children to [forgo] those advantages.",
    underlined: "forgo",
    choices: ["belittle", "reserve", "procure", "disclose", "relinquish"],
    answer: 4,
    explanation: "forgo = 포기하다, 단념하다 → relinquish(포기하다, 내려놓다)",
    points: 2,
  },
  {
    id: "2025-07",
    year: 2025,
    qNum: 7,
    type: "vocab-synonym",
    question:
      "Honor, that ineffable [beacon] of human virtue, stands as the unyielding compass guiding the soul through the labyrinth of moral ambiguity.",
    underlined: "beacon",
    choices: ["signal", "agency", "obstacle", "retainer", "medium"],
    answer: 0,
    explanation: "beacon = 등대, 길잡이 → signal(신호, 지표). 도덕적 안내자 역할.",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2025 어휘 빈칸 (Q8~Q15)
  // ─────────────────────────────────────────────
  {
    id: "2025-08",
    year: 2025,
    qNum: 8,
    type: "vocab-blank",
    question:
      "The new intern's ___ behavior, marked by constant flattery and excessive eagerness to please, quickly became tiresome to her colleagues.",
    choices: ["assertive", "apathetic", "sedulous", "scrupulous", "obsequious"],
    answer: 4,
    explanation: "아첨하고 지나치게 비위를 맞추는 행동 → obsequious(아첨하는, 굽실거리는)",
    points: 2,
  },
  {
    id: "2025-09",
    year: 2025,
    qNum: 9,
    type: "vocab-blank",
    question:
      "Discrimination based on race or gender is often recognized in blatant forms, but it can also manifest in more ___ behaviors, such as subtle biases in hiring practices or microaggressions in daily interactions.",
    choices: ["overt", "casual", "explicit", "insidious", "redundant"],
    answer: 3,
    explanation: "미묘한 편견·미세공격 → insidious(교묘하게 해를 끼치는, 잠행성의). overt/explicit은 반대.",
    points: 2,
  },
  {
    id: "2025-10",
    year: 2025,
    qNum: 10,
    type: "vocab-blank",
    question:
      "The scientist's theory, once dismissed as ___, has now gained widespread acceptance due to recent discoveries that support its validity.",
    choices: ["implausible", "empirical", "ingenuous", "terse", "transparent"],
    answer: 0,
    explanation: "과거에 무시되었다가 지금은 인정받음 → 과거에 implausible(믿기 어려운)로 여겨졌던 것",
    points: 2,
  },
  {
    id: "2025-11",
    year: 2025,
    qNum: 11,
    type: "vocab-blank",
    question:
      "Aristocrats have never taken kindly to ___. They have seen themselves as born to command others rather than accept the dictates of superiors.",
    choices: ["acclaim", "intrigue", "vulgarity", "compulsion", "conservatism"],
    answer: 1,
    explanation: "귀족은 상급자의 지시를 받는 것을 싫어함 → intrigue(음모, 간섭) 또는 being told what to do",
    points: 3,
  },
  {
    id: "2025-12",
    year: 2025,
    qNum: 12,
    type: "vocab-blank",
    question:
      "No composer could afford to act like a prima donna. Nobody was about to treat a mere hired hand with that sort of ___. His was essentially a service role.",
    choices: ["obstinacy", "deference", "informality", "consistency", "rapport"],
    answer: 1,
    explanation: "고용된 작곡가는 특별 대우를 받을 수 없음 → deference(경의, 특별 대우)를 기대할 수 없다",
    points: 3,
  },
  {
    id: "2025-13",
    year: 2025,
    qNum: 13,
    type: "vocab-blank",
    question:
      'Epicurus saw greater rewards in ___, extolling the "immunity which results from a quiet life and the retirement from the world."',
    choices: ["salvation", "solidarity", "sympathy", "seclusion", "subtlety"],
    answer: 3,
    explanation: "조용한 삶, 세상으로부터의 은퇴 → seclusion(은둔, 격리)",
    points: 3,
  },
  {
    id: "2025-14",
    year: 2025,
    qNum: 14,
    type: "vocab-blank",
    question:
      "Identity has been aptly called the 'primary commodity of the social media culture industry.' This further ___ what's considered public and what should be kept private.",
    choices: ["curbs", "promotes", "elucidates", "erodes", "regulates"],
    answer: 3,
    explanation: "소셜미디어가 공사 경계를 침식함 → erodes(침식하다, 약화시키다)",
    points: 3,
  },
  {
    id: "2025-15",
    year: 2025,
    qNum: 15,
    type: "vocab-blank",
    question:
      "When we read, we often ask ourselves why we are reading. These meditations and reflections do not ___ the value of literature. They texture it.",
    choices: ["underscore", "circumvent", "fortify", "disseminate", "undermine"],
    answer: 4,
    explanation: "독서에 대한 의문이 문학의 가치를 훼손하지 않는다 → undermine(훼손하다)의 부정형",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2025 독해 밑줄 어휘
  // ─────────────────────────────────────────────
  {
    id: "2025-22",
    year: 2025,
    qNum: 22,
    type: "reading-vocab",
    passage:
      "Our skin is curiously soft compared to that of other more hirsute vertebrates. Each sweat gland is an oasis colonised by 100,000 bacteria, quietly tolerated, except during adolescence, when a flood of hormones stimulates oil production, food for Propionibacterium acnes, causing unsightly blackheads; our castle sanctions some itinerant campers outside its walls, feeding on scraps.",
    question: "밑줄 친 'sanctions'의 뜻과 가장 가까운 것은?",
    underlined: "sanctions",
    choices: ["releases", "permits", "stimulates", "abandons", "supervises"],
    answer: 1,
    explanation: "sanctions = 허가하다, 승인하다 → permits(허가하다). 피부가 박테리아를 묵인/허용하는 맥락.",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2024 어휘 동의어 (Q1~Q8)
  // ─────────────────────────────────────────────
  {
    id: "2024-01",
    year: 2024,
    qNum: 1,
    type: "vocab-synonym",
    question:
      "Unsubstantiated claims often suggest that internet memes related to psychiatric symptoms visually depict and promote aversive behaviour (e.g., self harm), leading to an [exacerbation] of symptoms.",
    underlined: "exacerbation",
    choices: ["abatement", "alleviation", "aggravation", "ambivalence", "amelioration"],
    answer: 2,
    explanation: "exacerbation = 악화 → aggravation(악화, 심화). abatement/alleviation/amelioration은 반대(완화).",
    points: 2,
  },
  {
    id: "2024-02",
    year: 2024,
    qNum: 2,
    type: "vocab-synonym",
    question:
      "The diplomat's [perspicacity] in navigating complex international negotiations was complimented. His keen insight to discern underlying intentions and nuances proved invaluable.",
    underlined: "perspicacity",
    choices: ["obtuseness", "sagacity", "ineptitude", "credence", "verboseness"],
    answer: 1,
    explanation: "perspicacity = 통찰력, 예리함 → sagacity(현명함, 통찰력). obtuseness는 반대(둔감함).",
    points: 2,
  },
  {
    id: "2024-03",
    year: 2024,
    qNum: 3,
    type: "vocab-synonym",
    question:
      "For most of the twentieth century, the evolutionary origin of feathers had been a classic but [intractable] problem.",
    underlined: "intractable",
    choices: ["stubborn", "enervating", "debilitating", "preventable", "counterproductive"],
    answer: 0,
    explanation: "intractable = 다루기 힘든, 해결하기 어려운 → stubborn(완고한, 고집스러운)",
    points: 2,
  },
  {
    id: "2024-04",
    year: 2024,
    qNum: 4,
    type: "vocab-synonym",
    question:
      "The company's [nefarious] activities were eventually exposed, revealing a series of unethical and illegal practices.",
    underlined: "nefarious",
    choices: ["mundane", "sedentary", "altruistic", "subversive", "malevolent"],
    answer: 4,
    explanation: "nefarious = 사악한, 극악한 → malevolent(악의적인, 사악한)",
    points: 2,
  },
  {
    id: "2024-05",
    year: 2024,
    qNum: 5,
    type: "vocab-synonym",
    question:
      "The industrialization of food in the nineteenth century was a major [impetus] for the introduction of salt into human diets.",
    underlined: "impetus",
    choices: ["disclosure", "dealbreaker", "inducement", "impediment", "compromise"],
    answer: 2,
    explanation: "impetus = 자극, 추진력 → inducement(유인, 자극). impediment는 반대(장애물).",
    points: 2,
  },
  {
    id: "2024-06",
    year: 2024,
    qNum: 6,
    type: "vocab-synonym",
    question:
      'Advocates of reducing animal agriculture have proposed the names "slaughter-free," "cruelty-free," "animal-free" and "clean meat." But traditional meat producers have rejected these as [pejorative] to conventional products.',
    underlined: "pejorative",
    choices: ["abrogative", "denigratory", "congenial", "dispassionate", "inviolable"],
    answer: 1,
    explanation: "pejorative = 경멸적인, 비하하는 → denigratory(비하하는, 폄하하는)",
    points: 2,
  },
  {
    id: "2024-07",
    year: 2024,
    qNum: 7,
    type: "vocab-synonym",
    question:
      "The professor's lectures were known for their [abstruse] content, often delving into subjects that were obscure and beyond the comprehension of the average student.",
    underlined: "abstruse",
    choices: ["recondite", "malicious", "flamboyant", "substantive", "pedagogical"],
    answer: 0,
    explanation: "abstruse = 난해한, 심오한 → recondite(난해한, 심오한). 두 단어는 거의 동의어.",
    points: 2,
  },
  {
    id: "2024-08",
    year: 2024,
    qNum: 8,
    type: "vocab-synonym",
    question:
      "Her penchant for [veracity] made her a standout journalist. Her dedication to the truth was unwavering, ensuring that her reports were always factual and reliable.",
    underlined: "veracity",
    choices: ["mendacity", "honesty", "artifice", "falsity", "erudition"],
    answer: 1,
    explanation: "veracity = 진실성, 정직함 → honesty(정직함). mendacity/falsity는 반대(거짓말).",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2024 어휘 빈칸 (Q9~Q15)
  // ─────────────────────────────────────────────
  {
    id: "2024-09",
    year: 2024,
    qNum: 9,
    type: "vocab-blank",
    question:
      "Isaac Newton defined the mass of a body as 'the quantity of matter' it contains, which begs the question of what matter is or how its 'quantity' can be measured. Some concepts are so fundamental that any such attempt leads to a(n) ___ definition like that just stated.",
    choices: ["figurative", "empirical", "circular", "hypothetical", "lexical"],
    answer: 2,
    explanation: "질량을 물질의 양으로 정의하고 물질을 다시 질량으로 정의하는 순환 → circular(순환적인)",
    points: 3,
  },
  {
    id: "2024-10",
    year: 2024,
    qNum: 10,
    type: "vocab-blank",
    question:
      "In the heated debate, his arguments were marked by ___. Each point was delivered with a harshness and severity that seemed to go beyond mere disagreement.",
    choices: ["languor", "geniality", "asperity", "subterfuge", "contrition"],
    answer: 2,
    explanation: "가혹함과 심각함 → asperity(신랄함, 가혹함). languor(나태), geniality(친절함)는 반대.",
    points: 3,
  },
  {
    id: "2024-11",
    year: 2024,
    qNum: 11,
    type: "vocab-blank",
    question:
      "Today we live with calendars at hand but, at the same time, we live with the feeling that everything in history occurs without particular regard for its chronology, and that even music is a sort of warehouse of samples, whose shelf life is ultimately ___ because, when we get down to it, it can be pushed around according to our inner needs.",
    choices: ["irrelevant", "elucidating", "miscellaneous", "circumscribed", "self-explanatory"],
    answer: 0,
    explanation: "음악의 시간적 순서가 우리의 내적 필요에 따라 바뀜 → 연대기는 irrelevant(무관한, 중요하지 않은)",
    points: 3,
  },
  {
    id: "2024-12",
    year: 2024,
    qNum: 12,
    type: "vocab-blank",
    question:
      "Throughout the entire Charlie Chan film series one finds a constant return to the problems and solutions posed by modern technology. It is important to note here that these moments of gadgetry are not ___ to the narratives; indeed, they routinely constitute the most distinctive parts of each film.",
    choices: ["intrinsic", "favorable", "conducive", "peripheral", "consequent"],
    answer: 3,
    explanation: "기술적 장치들이 서사의 주변부가 아니라 핵심 → peripheral(주변적인)의 부정: not peripheral",
    points: 3,
  },
  {
    id: "2024-13",
    year: 2024,
    qNum: 13,
    type: "vocab-blank",
    question:
      "Though I have read so much, I am a bad reader. I read slowly and I am ___. I find it difficult to leave a book, however bad and however much it bores me, unfinished.",
    choices: [
      "an efficient scroller",
      "a choosy bibliophile",
      "a poor skipper",
      "a rapid peruser",
      "a thoughtful perceiver",
    ],
    answer: 2,
    explanation: "책을 끝까지 읽어야 하는 강박 → a poor skipper(건너뛰기를 못하는 사람). skipper = 건너뛰는 사람.",
    points: 3,
  },
];

// 연도별 필터링
export function getQuestionsByYear(year: number): ExamQuestion[] {
  return examQuestions.filter((q) => q.year === year);
}

// 유형별 필터링
export function getQuestionsByType(type: QuestionType): ExamQuestion[] {
  return examQuestions.filter((q) => q.type === type);
}

// 랜덤 셔플
export function shuffleQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  return [...questions].sort(() => Math.random() - 0.5);
}

// 선택지 셔플 (정답 인덱스도 함께 업데이트)
export function shuffleChoices(question: ExamQuestion): ExamQuestion {
  const indexed = question.choices.map((c, i) => ({ choice: c, isAnswer: i === question.answer }));
  const shuffled = indexed.sort(() => Math.random() - 0.5);
  return {
    ...question,
    choices: shuffled.map((c) => c.choice),
    answer: shuffled.findIndex((c) => c.isAnswer),
  };
}
