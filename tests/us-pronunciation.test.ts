import { describe, expect, it } from "vitest";

import { scoreAmericanVoice, selectAmericanVoice } from "@/lib/us-pronunciation";

describe("미국 영어 음성 선택", () => {
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
