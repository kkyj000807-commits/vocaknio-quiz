import type { DefinitionQuizEntry } from "@/lib/definition-quiz";

type DefinitionBinding = Pick<DefinitionQuizEntry, "senseId" | "headword" | "definition">;
type Walkthrough = DefinitionBinding & {
  headlineKo: string;
  literalKo: string;
  naturalKo: string;
  whyKo: string;
  quickKo: string;
  example: { en: string; literalKo: string; naturalKo: string; cueKo: string };
  relations: readonly { word: string; meaningKo: string; contrastKo: string }[];
  sources: readonly string[];
};

// Display-only notes. The definition is already shipped under OEWN 2025.
// Korean explanations and complete example sentences are editorial, not dictionary quotes.
const reviewed: readonly Walkthrough[] = [
  {
    senseId: "garish%5:00:00:tasteless:02",
    headword: "garish",
    definition: "tastelessly showy",
    headlineKo: "눈에 거슬리게 화려한",
    literalKo: "세련되지 않은 방식으로 요란하게 눈에 띄는.",
    naturalKo: "색이나 장식이 지나치게 튀어 촌스럽거나 눈에 거슬리는.",
    whyKo: "showy는 눈에 띄게 화려하다는 뜻이다. tastelessly는 그 화려함에 ‘보기 좋지 않다’는 평가를 더한다. 단순히 화려한 것도, 선정적이라는 뜻도 아니다.",
    quickKo: "정의에는 ‘화려하다’뿐 아니라 ‘보기 좋지 않다’는 평가도 들어 있습니다.",
    example: {
      en: "The hotel replaced the garish neon sign with a simple wooden one.",
      literalKo: "그 호텔은 눈에 거슬리게 화려한 네온 간판을 단순한 나무 간판으로 바꿨다.",
      naturalKo: "호텔은 지나치게 요란한 네온 간판을 떼고 소박한 나무 간판을 달았다.",
      cueKo: "simple과 대비되는 대상은 간판의 모양이다. 이 문장에서 garish는 네온 간판이 요란하게 튄다는 부정적 묘사다.",
    },
    relations: [
      { word: "gaudy", meaningKo: "색이나 장식이 과하게 화려한", contrastKo: "이 간판을 가리킬 때는 gaudy로 바꿔도 과한 장식이나 색을 못마땅해하는 뜻이 남는다." },
      { word: "flashy", meaningKo: "눈길을 끄는, 과시적으로 화려한", contrastKo: "역시 튀는 모양에 쓸 수 있지만, 사람의 눈길을 끄는 데 초점이 있다. garish와 달리 이 문장의 ‘보기 거슬린다’는 평가를 그대로 담는다고 볼 수는 없다." },
    ],
    sources: [
      "https://dictionary.cambridge.org/dictionary/english/garish",
      "https://dictionary.cambridge.org/dictionary/english/gaudy",
      "https://dictionary.cambridge.org/dictionary/english/flashy",
    ],
  },
  {
    senseId: "partisanship%1:09:00::",
    headword: "partisanship",
    definition: "an inclination to favor one group or view or opinion over alternatives",
    headlineKo: "특정 편이나 입장에 치우쳐 지지하는 태도",
    literalKo: "다른 선택지들보다 한 집단이나 견해 또는 의견을 더 편드는 성향.",
    naturalKo: "여러 입장 중 특정 편에 치우쳐 그쪽을 밀어주는 태도.",
    whyKo: "inclination은 한 번의 행동이 아니라 ‘그러는 성향’이다. favor A over B는 B보다 A를 더 편든다는 말이므로, 핵심은 그냥 지지하는 게 아니라 특정 편으로 기우는 데 있다.",
    quickKo: "여러 대안 가운데 특정 편을 더 지지하는 성향입니다.",
    example: {
      en: "The chair's partisanship was clear: she excused her allies for mistakes she condemned in others.",
      literalKo: "위원장의 편파적 지지는 분명했다. 다른 사람들에게는 비난한 실수를 자기편에게는 눈감아 주었다.",
      naturalKo: "위원장이 자기편을 감싸는 건 뻔했다. 남이 저지르면 비난하던 실수도 자기편에겐 봐줬다.",
      cueKo: "같은 실수인데 allies(자기편)에게만 다른 잣대를 적용한다. 일관된 기준이 아니라 어느 편인지가 판단을 바꾼다.",
    },
    relations: [
      { word: "partiality", meaningKo: "편파성, 어느 한쪽을 더 좋게 보거나 대하는 태도", contrastKo: "여기서는 자기편을 더 유리하게 대한다는 점에서 같은 뜻이다. partiality는 특정 당파가 없어도 쓸 수 있고, partiality for jazz처럼 단순한 기호를 나타낼 수도 있다." },
    ],
    sources: [
      "https://dictionary.cambridge.org/dictionary/english/partisanship",
      "https://dictionary.cambridge.org/dictionary/english/partiality",
    ],
  },
];

export function getDefinitionWalkthrough(entry: DefinitionBinding | undefined): Walkthrough | undefined {
  if (!entry) return undefined;
  return reviewed.find(note => note.senseId === entry.senseId && note.headword === entry.headword &&
    note.definition === entry.definition);
}
