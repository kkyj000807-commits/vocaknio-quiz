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
  // ─────────────────────────────────────────────
  // 2023 어휘 동의어 (Q3~Q8)
  // ─────────────────────────────────────────────
  {
    id: "2023-03",
    year: 2023,
    qNum: 3,
    type: "vocab-synonym",
    question: "The debate grew increasingly [acrimonious] as both sides refused to concede any ground.",
    underlined: "acrimonious",
    choices: ["amicable", "caustic", "indifferent", "verbose", "conciliatory"],
    answer: 1,
    explanation: "acrimonious = 신랄한, 독설적인 → caustic(신랄한, 독설적인). amicable/conciliatory는 반대(우호적인).",
    points: 2,
  },
  {
    id: "2023-04",
    year: 2023,
    qNum: 4,
    type: "vocab-synonym",
    question: "The [pernicious] effects of misinformation on public health cannot be overstated.",
    underlined: "pernicious",
    choices: ["beneficial", "negligible", "ambiguous", "deleterious", "transient"],
    answer: 3,
    explanation: "pernicious = 유해한, 치명적인 → deleterious(유해한, 해로운). beneficial은 반대(유익한).",
    points: 2,
  },
  {
    id: "2023-05",
    year: 2023,
    qNum: 5,
    type: "vocab-synonym",
    question: "The crowd was [exuberant] after the home team's unexpected victory.",
    underlined: "exuberant",
    choices: ["exhilarated", "despondent", "indignant", "apprehensive", "stoic"],
    answer: 0,
    explanation: "exuberant = 활기찬, 넘치는 기쁨의 → exhilarated(기쁨에 넘치는, 활기찬). despondent는 반대(낙담한).",
    points: 2,
  },
  {
    id: "2023-06",
    year: 2023,
    qNum: 6,
    type: "vocab-synonym",
    question: "Her [proclivity] for risk-taking often led her into dangerous situations.",
    underlined: "proclivity",
    choices: ["aversion", "reluctance", "propensity", "indifference", "restraint"],
    answer: 2,
    explanation: "proclivity = 성향, 경향 → propensity(성향, 경향). aversion/reluctance는 반대(혐오, 꺼림).",
    points: 2,
  },
  {
    id: "2023-07",
    year: 2023,
    qNum: 7,
    type: "vocab-synonym",
    question: "The court found that the defendant bore significant [culpability] for the accident.",
    underlined: "culpability",
    choices: ["exoneration", "immunity", "impunity", "commendation", "accountability"],
    answer: 4,
    explanation: "culpability = 책임, 과실 → accountability(책임, 책임감). exoneration/immunity/impunity는 반대(면죄, 면책).",
    points: 2,
  },
  {
    id: "2023-08",
    year: 2023,
    qNum: 8,
    type: "vocab-synonym",
    question: "There was something [uncanny] about the way the twins moved in perfect synchrony.",
    underlined: "uncanny",
    choices: ["mundane", "eerie", "predictable", "familiar", "ordinary"],
    answer: 1,
    explanation: "uncanny = 기이한, 으스스한 → eerie(기이한, 섬뜩한). mundane/ordinary는 반대(평범한).",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2023 어휘 빈칸 (Q9~Q24 선별)
  // ─────────────────────────────────────────────
  {
    id: "2023-09",
    year: 2023,
    qNum: 9,
    type: "vocab-blank",
    question: "The government's stimulus checks will ___ some of the country's economic problems, but they are not a permanent solution.",
    choices: ["exacerbate", "eradicate", "palliate", "perpetuate", "amplify"],
    answer: 2,
    explanation: "경기 부양책이 경제 문제를 '완화'한다는 맥락 → palliate(완화하다, 경감하다). exacerbate는 반대(악화시키다).",
    points: 3,
  },
  {
    id: "2023-10",
    year: 2023,
    qNum: 10,
    type: "vocab-blank",
    question: "Individuals may feel personally ___ when others who share their identity are ill-treated or discriminated against.",
    choices: ["injured", "elated", "vindicated", "liberated", "indifferent"],
    answer: 0,
    explanation: "자신과 정체성을 공유하는 사람이 부당하게 대우받을 때 개인적으로 '상처받는다' → injured(상처받은, 피해를 입은). elated는 반대(기쁜).",
    points: 3,
  },
  {
    id: "2023-13",
    year: 2023,
    qNum: 13,
    type: "vocab-blank",
    question: "In animals, sentiment and brutality exist side by side, giving them a(n) ___ quality that humans find both fascinating and disturbing.",
    choices: ["schizoid", "harmonious", "rational", "predictable", "unified"],
    answer: 0,
    explanation: "감정과 잔인함이 공존한다는 모순적 특성 → schizoid(분열된, 모순적인). harmonious/unified는 반대(조화로운, 통일된).",
    points: 3,
  },
  {
    id: "2023-21",
    year: 2023,
    qNum: 21,
    type: "vocab-blank",
    question: "The Dunning-Kruger effect refers to a cognitive bias in which people with limited knowledge in a domain ___ their own competence.",
    choices: ["accurately assess", "consistently underestimate", "believe they are smarter and more capable than they are", "tend to overestimate others", "seek external validation for"],
    answer: 2,
    explanation: "더닝-크루거 효과: 지식이 부족한 사람들이 자신의 능력을 과대평가함 → 자신이 실제보다 더 똑똑하고 유능하다고 믿는다.",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2023 독해 (Q25, Q31~Q32, Q34~Q35)
  // ─────────────────────────────────────────────
  {
    id: "2023-25",
    year: 2023,
    qNum: 25,
    type: "reading-main",
    passage: "Galileo published his works in Italian rather than Latin, making scientific truths accessible to ordinary people. This was a century after Copernicus, and the Church saw it as a far greater threat because the vernacular publication allowed the general public to read and judge scientific arguments directly.",
    question: "윗글의 내용과 일치하는 것은?",
    choices: [
      "Galileo published his works in Latin to reach the educated elite.",
      "The greatest danger that Galileo posed for the Church was easier access for the public to scientific truths.",
      "Copernicus published his works a century after Galileo.",
      "The Church welcomed Galileo's vernacular publications as educational tools.",
      "Galileo's works were less threatening than those of Copernicus.",
    ],
    answer: 1,
    explanation: "갈릴레오는 라틴어 대신 이탈리아어(자국어)로 출판하여 일반인이 과학적 진실에 접근하기 쉬워짐 → 이것이 교회에 더 큰 위협이 됨. ①은 반대(이탈리아어로 출판), ③은 시간 순서 반대.",
    points: 4,
  },
  {
    id: "2023-31",
    year: 2023,
    qNum: 31,
    type: "reading-main",
    passage: "Pedro Ponce de Leon, a 16th-century Spanish Benedictine monk, is credited with being the first teacher of the deaf. He taught the congenitally deaf sons of Spanish nobility to read, write, and speak, demonstrating that the deaf could be educated.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Ponce de Leon was a Spanish Benedictine monk.",
      "He is considered the first teacher of the deaf.",
      "He taught deaf students to read, write, and speak.",
      "Ponce de Leon argued that the congenitally deaf sons of the nobility be exempt from reading and writing.",
      "His students were from Spanish noble families.",
    ],
    answer: 3,
    explanation: "④는 틀린 내용: Ponce de Leon은 귀족의 선천성 청각 장애 아들들에게 읽기와 쓰기를 가르쳤다. 면제(exempt)시킨 것이 아니라 오히려 교육했다.",
    points: 4,
  },
  {
    id: "2023-32",
    year: 2023,
    qNum: 32,
    type: "reading-main",
    passage: "Bram Stoker was not a littérateur. He was a storyteller, and Dracula is above all a gripping tale. Stoker's prose is functional rather than literary; he uses multiple narrators and documents (diaries, letters, newspaper clippings) to create a sense of documentary realism rather than striking literary imagery.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Stoker was primarily a storyteller rather than a literary artist.",
      "Dracula is described as a gripping tale.",
      "Stoker used literary language to create striking imagery.",
      "Stoker employed multiple narrators and documentary forms.",
      "Stoker's prose is described as functional rather than literary.",
    ],
    answer: 2,
    explanation: "③은 틀린 내용: Stoker는 'not a littérateur'이며 문학적 언어보다는 기능적 산문과 다큐멘터리적 사실감을 추구했다. 화려한 문학적 이미지를 만들었다는 것은 본문과 반대.",
    points: 4,
  },
  // ─────────────────────────────────────────────
  // 2022 문법 (Q2~Q3)
  // ─────────────────────────────────────────────
  {
    id: "2022-02",
    year: 2022,
    qNum: 2,
    type: "grammar",
    question: "Cerebral cortex neurons are ①the only ②type of cell ③what ④we can confidently say ⑤is never replaced. 밑줄 친 부분 중 어법상 틀린 것은?",
    choices: ["① the only", "② type of cell", "③ what", "④ we can confidently say", "⑤ is never replaced"],
    answer: 2,
    explanation: "③ what → that: 선행사 'type of cell'이 있으므로 관계대명사 that을 써야 한다. what은 선행사 없이 단독으로 쓰이는 관계대명사.",
    points: 3,
  },
  {
    id: "2022-03",
    year: 2022,
    qNum: 3,
    type: "grammar",
    question: "①Synthetic rubies and diamonds ②have ③the same ④hard and composition as the ⑤real stones. 밑줄 친 부분 중 어법상 틀린 것은?",
    choices: ["① Synthetic", "② have", "③ the same", "④ hard", "⑤ real"],
    answer: 3,
    explanation: "④ hard → hardness: 'and'로 연결되는 병렬 구조에서 'composition(명사)'과 대등하게 'hardness(명사)'가 와야 한다. hard는 형용사이므로 부적절.",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2022 어휘 동의어 (Q4~Q7)
  // ─────────────────────────────────────────────
  {
    id: "2022-04",
    year: 2022,
    qNum: 4,
    type: "vocab-synonym",
    question: "The company's once-innovative culture had become [rigidified] by years of bureaucratic procedures.",
    underlined: "rigidified",
    choices: ["liberalized", "diversified", "formalistic", "energized", "streamlined"],
    answer: 2,
    explanation: "rigidified = 경직된, 굳어진 → formalistic(형식적인, 경직된). liberalized/energized는 반대(자유화된, 활성화된).",
    points: 2,
  },
  {
    id: "2022-05",
    year: 2022,
    qNum: 5,
    type: "vocab-synonym",
    question: "The [mercenary] politician only supported policies that would benefit his financial backers.",
    underlined: "mercenary",
    choices: ["greedy", "altruistic", "principled", "idealistic", "visionary"],
    answer: 0,
    explanation: "mercenary = 돈만 아는, 탐욕스러운 → greedy(탐욕스러운). altruistic/principled/idealistic은 반대(이타적인, 원칙적인).",
    points: 2,
  },
  {
    id: "2022-06",
    year: 2022,
    qNum: 6,
    type: "vocab-synonym",
    question: "The designer insisted on avoiding anything [ostentatious], preferring pure, simple lines in all her work.",
    underlined: "ostentatious",
    choices: ["minimalist", "elegant", "flamboyant", "understated", "refined"],
    answer: 2,
    explanation: "ostentatious = 과시적인, 화려한 → flamboyant(화려한, 과시적인). minimalist/understated는 반대(단순한, 절제된).",
    points: 2,
  },
  {
    id: "2022-07",
    year: 2022,
    qNum: 7,
    type: "vocab-synonym",
    question: "The [officious] manager constantly interfered in matters that were not his responsibility.",
    underlined: "officious",
    choices: ["efficient", "decisive", "reserved", "meddlesome", "authoritative"],
    answer: 3,
    explanation: "officious = 참견하기 좋아하는, 지나치게 나서는 → meddlesome(참견하기 좋아하는). reserved는 반대(내성적인).",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2022 어휘 빈칸 (Q10~Q16 선별)
  // ─────────────────────────────────────────────
  {
    id: "2022-10",
    year: 2022,
    qNum: 10,
    type: "vocab-blank",
    question: "Comedy is tragedy plus time. Any terrible misfortune can be made ___ given enough time to recover and gain perspective.",
    choices: ["tragic", "inevitable", "irreversible", "tolerable", "memorable"],
    answer: 3,
    explanation: "시간이 지나면 어떤 불행도 '견딜 수 있게' 된다는 맥락 → tolerable(견딜 수 있는, 참을 수 있는). tragic은 반대(비극적인).",
    points: 3,
  },
  {
    id: "2022-12",
    year: 2022,
    qNum: 12,
    type: "vocab-blank",
    question: "Thomas was the first to read the ancient tablet. 'I am the first man to read that after more than two thousand years of ___,' he said.",
    choices: ["preservation", "discovery", "translation", "excavation", "oblivion"],
    answer: 4,
    explanation: "2천 년 이상 아무도 읽지 않았다는 맥락 → oblivion(망각, 잊혀짐). preservation은 반대(보존).",
    points: 3,
  },
  {
    id: "2022-13",
    year: 2022,
    qNum: 13,
    type: "vocab-blank",
    question: "Research shows that people with high self-esteem are most prone to anger when their self-image is threatened. Ironically, ___ are the most dangerous people when their ego is challenged.",
    choices: ["introverts", "perfectionists", "altruists", "narcissists", "empaths"],
    answer: 3,
    explanation: "자아상이 위협받을 때 가장 분노하기 쉬운 고자존감 집단 → narcissists(자기애적 성격자). 자기애가 강한 사람들이 자아가 도전받을 때 가장 위험하다.",
    points: 3,
  },
  {
    id: "2022-15",
    year: 2022,
    qNum: 15,
    type: "vocab-blank",
    question: "Psychoanalytic theory holds that early childhood experiences set personality processes to a great extent ___, making it extremely difficult to change one's fundamental character later in life.",
    choices: ["temporarily", "immutable", "gradually", "consciously", "selectively"],
    answer: 1,
    explanation: "초기 경험이 성격을 '불변적으로' 결정한다는 정신분석 이론의 주장 → immutable(불변의, 변하지 않는). temporarily는 반대(일시적으로).",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2022 독해 (Q27~Q30 선별)
  // ─────────────────────────────────────────────
  {
    id: "2022-29",
    year: 2022,
    qNum: 29,
    type: "reading-main",
    passage: "Karl Popper argued that a scientific theory must make predictions that can be tested empirically. If those predictions are shown to be incorrect by observation, the theory must be rejected or revised. A theory that cannot be falsified by any possible observation is not scientific.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Popper believed scientific theories must make testable predictions.",
      "Scientific theory should make predictions that can be tested, and the theory rejected if these predictions are shown to be incorrect.",
      "A theory that cannot be falsified is not considered scientific by Popper.",
      "Observation plays a crucial role in evaluating scientific theories.",
      "Scientific knowledge based on sufficient observation can be justified without falsifying it.",
    ],
    answer: 4,
    explanation: "⑤는 틀린 내용: 포퍼는 반증 가능성(falsifiability)을 과학의 핵심 기준으로 봤다. 충분한 관찰만으로 이론이 정당화될 수 없으며, 언제든 반증될 수 있어야 한다.",
    points: 4,
  },
  {
    id: "2022-30",
    year: 2022,
    qNum: 30,
    type: "reading-main",
    passage: "Traditional film histories were largely written by amateur historians who brought teleological and essentialist assumptions to their work. They assumed that film history was a story of progress toward some ideal form of cinema, and that certain films were inherently more 'cinematic' than others.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Traditional film histories were often written by amateur historians.",
      "These historians brought teleological assumptions to their work.",
      "They assumed film history was a story of progress.",
      "Old film histories carry out the research using rigorous, systematic, and explicit methods.",
      "Some films were considered inherently more cinematic than others.",
    ],
    answer: 3,
    explanation: "④는 틀린 내용: 전통적 영화 역사는 아마추어 역사가들이 비체계적으로 썼다. 엄격하고 체계적인 방법론을 사용했다는 것은 본문과 반대.",
    points: 4,
  },
  // ─────────────────────────────────────────────
  // 2021 문법 (Q2~Q4)
  // ─────────────────────────────────────────────
  {
    id: "2021-02",
    year: 2021,
    qNum: 2,
    type: "grammar",
    question: "Elizabeth Taylor was the American motion picture actress ___ the last major star to have come out of the old Hollywood studio system. 빈칸에 알맞은 것은?",
    choices: ["who", "which critics called", "that critics called", "whom critics called", "whose critics called"],
    answer: 3,
    explanation: "'critics called her the last major star'에서 her를 관계대명사로 바꾸면 목적격 whom. 'whom critics called'가 정답. who는 주격이므로 불가.",
    points: 3,
  },
  {
    id: "2021-03",
    year: 2021,
    qNum: 3,
    type: "grammar",
    question: "For many Americans, homeownership is still viewed ①as a central component... ②that many present-day Americans are pushing back ③on modern living arrangements closely ④resembling what ⑤came centuries, even millennia, before in other parts of the world. 밑줄 친 부분 중 어법상 틀린 것은?",
    choices: ["① as", "② that", "③ on", "④ resembling", "⑤ came"],
    answer: 4,
    explanation: "⑤ came → had come: 'came centuries before'는 현재 시점보다 훨씬 이전의 과거를 가리키므로 과거완료 had come이 필요하다.",
    points: 3,
  },
  {
    id: "2021-04",
    year: 2021,
    qNum: 4,
    type: "grammar",
    question: "In a video that ①has since gone viral, comedian Florian Schroeder faces the crowd ②who question Covid-19, suspect face masks to be part of a plot to silence ③his critical opinions, ④telling them he wanted to talk about Hegel's dialectics, a method ⑤that relies on a contradictory process. 밑줄 친 부분 중 어법상 틀린 것은?",
    choices: ["① has since gone viral", "② who question", "③ his", "④ telling", "⑤ that relies"],
    answer: 2,
    explanation: "③ his → their: 'hundreds who'의 소유격이므로 their가 맞다. his는 단수 남성 소유격으로 'hundreds'를 받을 수 없다.",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2021 어휘 동의어 (Q5~Q10)
  // ─────────────────────────────────────────────
  {
    id: "2021-05",
    year: 2021,
    qNum: 5,
    type: "vocab-synonym",
    question: "The politician's [incendiary] speech sparked protests across the country.",
    underlined: "incendiary",
    choices: ["conciliatory", "measured", "inflammatory", "subdued", "diplomatic"],
    answer: 2,
    explanation: "incendiary = 선동적인, 자극적인 → inflammatory(선동적인, 자극적인). conciliatory/diplomatic은 반대(화해적인, 외교적인).",
    points: 2,
  },
  {
    id: "2021-06",
    year: 2021,
    qNum: 6,
    type: "vocab-synonym",
    question: "The [fallibility] of human memory means that eyewitness testimony is not always reliable.",
    underlined: "fallibility",
    choices: ["infallibility", "precision", "vulnerability", "accuracy", "reliability"],
    answer: 2,
    explanation: "fallibility = 오류 가능성, 실수할 수 있음 → vulnerability(취약성, 결함 가능성). infallibility는 반대(무오류성). reliability/accuracy도 반대(신뢰성, 정확성).",
    points: 2,
  },
  {
    id: "2021-07",
    year: 2021,
    qNum: 7,
    type: "vocab-synonym",
    question: "The lawyer's [rebuttal] effectively dismantled the prosecution's key arguments.",
    underlined: "rebuttal",
    choices: ["endorsement", "refutation", "corroboration", "elaboration", "reiteration"],
    answer: 1,
    explanation: "rebuttal = 반박, 논박 → refutation(반박, 반증). endorsement/corroboration은 반대(지지, 확증).",
    points: 2,
  },
  {
    id: "2021-08",
    year: 2021,
    qNum: 8,
    type: "vocab-synonym",
    question: "The lab's [cutting-edge] research on gene therapy has attracted international attention.",
    underlined: "cutting-edge",
    choices: ["outdated", "conventional", "rudimentary", "obsolete", "innovative"],
    answer: 4,
    explanation: "cutting-edge = 최첨단의, 선도적인 → innovative(혁신적인, 최신의). outdated/obsolete는 반대(구식의).",
    points: 2,
  },
  {
    id: "2021-09",
    year: 2021,
    qNum: 9,
    type: "vocab-synonym",
    question: "The charity campaign managed to [garner] support from thousands of donors worldwide.",
    underlined: "garner",
    choices: ["squander", "repel", "dissipate", "discourage", "attract"],
    answer: 4,
    explanation: "garner = 모으다, 끌어들이다 → attract(끌어들이다, 모으다). squander/dissipate는 반대(낭비하다, 흩어지다).",
    points: 2,
  },
  {
    id: "2021-10",
    year: 2021,
    qNum: 10,
    type: "vocab-synonym",
    question: "The conspiracy theory seemed [far-fetched] to most scientists who examined the evidence.",
    underlined: "far-fetched",
    choices: ["credible", "implausible", "compelling", "substantiated", "plausible"],
    answer: 1,
    explanation: "far-fetched = 억지스러운, 믿기 어려운 → implausible(믿기 어려운, 있음직하지 않은). credible/plausible은 반대(믿을 만한, 그럴듯한).",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2021 어휘 빈칸 (Q11~Q18 선별)
  // ─────────────────────────────────────────────
  {
    id: "2021-11",
    year: 2021,
    qNum: 11,
    type: "vocab-blank",
    question: "Many of the homebrewers who ___ high-octane IPAs in their garages went on to found some of the most celebrated craft breweries in America.",
    choices: ["gave up on", "turned away from", "cut their teeth on", "steered clear of", "looked down on"],
    answer: 2,
    explanation: "홈브루어들이 차고에서 IPA를 만들며 '처음 경험을 쌓았다' → cut their teeth on(~으로 처음 경험을 쌓다, 단련하다). 관용 표현.",
    points: 3,
  },
  {
    id: "2021-15",
    year: 2021,
    qNum: 15,
    type: "vocab-blank",
    question: "Moral reflection is dialectical. Philosophy untouched by concrete situations can only yield a(n) ___ utopia, beautiful in theory but empty in practice.",
    choices: ["vibrant", "dynamic", "pragmatic", "sterile", "inspiring"],
    answer: 3,
    explanation: "구체적 상황과 무관한 철학은 '공허한' 유토피아만 만든다 → sterile(불모의, 공허한, 생산성 없는). vibrant/dynamic/inspiring은 반대(활기찬, 역동적인).",
    points: 3,
  },
  {
    id: "2021-17",
    year: 2021,
    qNum: 17,
    type: "vocab-blank",
    question: "Car rental companies are reluctant to rent to drivers under 25, citing higher accident rates. But the argument is ___: seniors also have higher accident rates yet face no such restrictions.",
    choices: ["valid", "spurious", "compelling", "consistent", "well-founded"],
    answer: 1,
    explanation: "노인도 사고율이 높지만 제한이 없다는 반례가 있으므로 해당 주장은 '근거 없는' 것 → spurious(근거 없는, 허위의). valid/well-founded는 반대(타당한, 근거 있는).",
    points: 3,
  },
  {
    id: "2021-18",
    year: 2021,
    qNum: 18,
    type: "vocab-blank",
    question: "In utilitarian ethics, making 90% of people happy by making 10% unhappy could be justified. But the increased unhappiness of the minority might ___ the increased happiness of the majority.",
    choices: ["reinforce", "justify", "amplify", "undermine", "complement"],
    answer: 3,
    explanation: "소수의 불행이 다수의 행복을 '약화시킬' 수 있다 → undermine(약화시키다, 훼손하다). reinforce/amplify는 반대(강화하다).",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2021 독해 (Q34~Q35, Q38~Q40)
  // ─────────────────────────────────────────────
  {
    id: "2021-34",
    year: 2021,
    qNum: 34,
    type: "reading-main",
    passage: "Depression is a biological disorder. Over the last 50 years, rates of depression have (C) gradually risen across the developed world. The disorder is (A) sensitive to stress but is not caused by stress alone. It is (B) more common in women than men, and its biological basis means that psychological treatments alone are often insufficient.",
    question: "밑줄 친 (A)~(E) 중 문맥상 낱말의 쓰임이 적절하지 않은 것은? (C) gradually fallen",
    choices: ["(A) sensitive", "(B) more common", "(C) gradually fallen", "(D) spurious", "(E) increasing"],
    answer: 2,
    explanation: "(C) gradually fallen → gradually risen: 지난 50년간 선진국에서 우울증 비율이 '올랐다'고 해야 맥락상 맞다. fallen(떨어졌다)은 틀린 표현.",
    points: 4,
  },
  {
    id: "2021-38",
    year: 2021,
    qNum: 38,
    type: "reading-main",
    passage: "Galileo used an inclined plane to study motion. He rolled balls down ramps of different angles and measured the time taken. This allowed him to demonstrate that all objects, regardless of weight, accelerate at the same rate under gravity — directly contradicting Aristotle's claim that heavier objects fall faster.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Galileo used an inclined plane to study the motion of objects.",
      "He measured the time taken for balls to roll down ramps.",
      "A heavy object falls faster than a lighter one, in direct proportion to its weight.",
      "Galileo's findings contradicted Aristotle's claims.",
      "All objects accelerate at the same rate under gravity.",
    ],
    answer: 2,
    explanation: "③은 틀린 내용: 이것은 아리스토텔레스의 주장이며, 갈릴레오가 실험으로 반증한 내용이다. 갈릴레오는 무게와 관계없이 모든 물체가 같은 속도로 가속한다는 것을 증명했다.",
    points: 4,
  },
  // ─────────────────────────────────────────────
  // 2020 어휘 동의어 (Q4)
  // ─────────────────────────────────────────────
  {
    id: "2020-04",
    year: 2020,
    qNum: 4,
    type: "vocab-synonym",
    question: "The researcher conducted an [exhaustive] review of all available literature on the subject.",
    underlined: "exhaustive",
    choices: ["comprehensive", "superficial", "selective", "cursory", "partial"],
    answer: 0,
    explanation: "exhaustive = 철저한, 완전한 → comprehensive(포괄적인, 철저한). superficial/cursory는 반대(피상적인, 대충의).",
    points: 2,
  },
  // ─────────────────────────────────────────────
  // 2020 어휘 빈칸 (Q5~Q18 선별)
  // ─────────────────────────────────────────────
  {
    id: "2020-05",
    year: 2020,
    qNum: 5,
    type: "vocab-blank",
    question: "Vice is a bad way of being — it means being oblivious to the suffering of others and at odds with civic virtue. The most common example of vice in modern society is ___.",
    choices: ["altruism", "empathy", "Greed", "prudence", "temperance"],
    answer: 2,
    explanation: "타인의 고통에 무관심하고 시민적 덕목에 반하는 악덕의 대표 예 → Greed(탐욕). altruism/empathy는 반대(이타심, 공감).",
    points: 3,
  },
  {
    id: "2020-11",
    year: 2020,
    qNum: 11,
    type: "vocab-blank",
    question: "The Gothic label was applied with ___ in the 17th century, carrying pejorative connotations of barbarism and lack of classical refinement.",
    choices: ["admiration", "reverence", "enthusiasm", "derision", "nostalgia"],
    answer: 3,
    explanation: "고딕이라는 명칭이 17세기에 경멸적 의미로 사용됨 → derision(경멸, 조롱). admiration/reverence는 반대(존경, 경외).",
    points: 3,
  },
  {
    id: "2020-18",
    year: 2020,
    qNum: 18,
    type: "vocab-blank",
    question: "Indeed, ___ feelings are physiological reactions. Unlike fear, which is triggered by threats, this emotion occurs in response to small deviations from social expectations.",
    choices: ["proud", "joyful", "awkward", "sorrowful", "angry"],
    answer: 2,
    explanation: "사회적 기대에서 벗어날 때 생기는 생리적 반응 → awkward(어색한, 민망한). 사회적 규범 위반에 대한 감정은 어색함/당혹감이다.",
    points: 3,
  },
  // ─────────────────────────────────────────────
  // 2020 독해 (Q26~Q28, Q29~Q30 선별)
  // ─────────────────────────────────────────────
  {
    id: "2020-26",
    year: 2020,
    qNum: 26,
    type: "reading-main",
    passage: "Newton proposed that light consists of particles. Huygens argued it was a wave. In 1905, Einstein's photoelectric effect demonstrated particle-like behavior of light. Quantum mechanics later showed that light exhibits both wave and particle properties — wave-particle duality is a central concept of modern quantum physics, not Newtonian physics.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Newton proposed that light consists of particles.",
      "Wave-particle duality is one of the great puzzles of Newtonian physics.",
      "Einstein's photoelectric effect demonstrated particle-like behavior of light.",
      "Quantum mechanics showed that light has both wave and particle properties.",
      "Huygens argued that light was a wave.",
    ],
    answer: 1,
    explanation: "②는 틀린 내용: 파동-입자 이중성(wave-particle duality)은 뉴턴 물리학이 아닌 현대 양자역학의 개념이다. 뉴턴은 빛이 입자라고만 주장했다.",
    points: 4,
  },
  {
    id: "2020-27",
    year: 2020,
    qNum: 27,
    type: "reading-main",
    passage: "Darwin's theory of evolution requires that variants occasionally appear in a population AND that these variants are heritable — they can be passed on to offspring. The inheritance of acquired characteristics (Lamarckism) is not part of Darwin's theory; Darwin relied on natural selection acting on heritable variation.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Darwin's theory requires that variants occasionally appear in a population.",
      "Darwin's theory requires that variants be heritable.",
      "Natural selection acts on heritable variation in Darwin's theory.",
      "Inheritance of acquired characters is the driving force of Darwin's theory of evolution.",
      "Lamarckism is distinct from Darwin's theory of evolution.",
    ],
    answer: 3,
    explanation: "④는 틀린 내용: 획득형질의 유전(inheritance of acquired characteristics)은 라마르크의 이론이지 다윈의 이론이 아니다. 다윈은 자연선택과 유전적 변이를 강조했다.",
    points: 4,
  },
  {
    id: "2020-28",
    year: 2020,
    qNum: 28,
    type: "reading-main",
    passage: "Karl Popper argued that scientific theories are always provisional and can never be proven true — they can only be falsified. A single observation that contradicts a theory is sufficient to disprove it. Scientists should seek to falsify their theories, not to confirm them.",
    question: "윗글의 내용과 일치하지 않는 것은?",
    choices: [
      "Scientific theories are always provisional according to Popper.",
      "A single contradictory observation is sufficient to disprove a theory.",
      "Scientists should seek to falsify their theories.",
      "Scientific theories can never be proven absolutely true.",
      "A scientific theory must take measures to make the observed reality fit its predictions.",
    ],
    answer: 4,
    explanation: "⑤는 틀린 내용: 포퍼에 따르면 이론이 관찰에 맞춰야 하는 것이지, 관찰을 이론에 끼워 맞추는 것이 아니다. 이론은 반증 가능해야 하며, 현실을 이론에 맞추려는 시도는 비과학적이다.",
    points: 4,
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
