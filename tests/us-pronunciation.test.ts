import { describe, expect, it } from "vitest";

import { scoreAmericanVoice, selectAmericanVoice } from "@/lib/us-pronunciation";

describe("미국 영어 음성 선택", () => {
  it("자동 선택은 남성 Natural보다 알려진 여성 미국 영어 음성을 우선한다", () => {
    expect(selectAmericanVoice([
      { lang: "en-US", name: "Microsoft Guy Natural" },
      { lang: "en-US", name: "Samantha" },
    ])?.name).toBe("Samantha");
  });

  it("수동 선택은 실제로 제공되는 미국 영어 URI만 허용한다", () => {
    const voices = [
      { lang: "en-US", name: "Aria Natural", voiceURI: "aria" },
      { lang: "en-US", name: "Basic", voiceURI: "basic" },
      { lang: "en-GB", name: "Premium", voiceURI: "british" },
    ];
    expect(selectAmericanVoice(voices, "basic")?.voiceURI).toBe("basic");
    expect(selectAmericanVoice(voices, "missing")?.voiceURI).toBe("aria");
    expect(selectAmericanVoice(voices, "british")?.voiceURI).toBe("aria");
  });

  it("지역 확장 태그를 수용하되 비미국 영어를 품질 점수로 승격하지 않는다", () => {
    expect(selectAmericanVoice([{ lang: "en_US-x-local", name: "Basic" }])?.name).toBe("Basic");
    expect(selectAmericanVoice([{ lang: "en-GB", name: "Samantha Premium Natural" }])).toBeNull();
  });
  it("미국 영어가 아닌 음성을 선택하지 않는다", () => {
    expect(selectAmericanVoice([{ lang: "en-GB", name: "Daniel" }])).toBeNull();
  });

  it("일반 미국 영어보다 고품질 이름 힌트를 우선한다", () => {
    const voices = [
      { lang: "en-US", name: "Basic" },
      { lang: "en-US", name: "Microsoft Aria Natural" },
    ];
    expect(selectAmericanVoice(voices)?.name).toBe("Microsoft Aria Natural");
    expect(scoreAmericanVoice(voices[1])).toBeGreaterThan(scoreAmericanVoice(voices[0]));
  });
});
