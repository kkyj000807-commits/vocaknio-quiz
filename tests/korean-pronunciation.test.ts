import { describe, expect, it } from "vitest";
import { getKoreanPronunciation } from "../lib/korean-pronunciation";

describe("optional Hangul approximation from trusted US IPA", () => {
  it.each([
    ["/kəˈprɪʃəs/", "커프리셔스"],
    ["/ˈboʊst/", "보우스트"],
    ["/prəˈpraɪətɚ/", "프러프라이어터"],
    ["/ˌsupɚˈsid/", "수퍼시드"],
    ["/səˈplænt/", "서플랜트"],
    ["/ˈɔrdəˌnɛri/", "오더네리"],
    ["/əˈbɪləti/", "어빌러티"],
    ["/kəmˈpjuːtɚ/", "컴퓨터"],
    ["/ˌɪnfɚˈmeɪʃən/", "인퍼메이션"],
    ["/ˈdɪkʃəˌnɛri/", "딕셔네리"],
    ["/ˈbjuːtəfəl/", "뷰터펄"],
    ["/wɝld/", "월드"],
    ["/strɛŋθ/", "스트렝스"],
    ["/ækt/", "액트"],
    ["/kæt/", "캣"],
    ["/keɪt/", "케이트"],
    ["/ˈtʃælɪndʒ/", "챌린지"],
    ["[ˈt͡ʃælɪnd͡ʒ]", "챌린지"],
    ["/ˌæbɚˈeɪʃən/", "애버레이션"],
    ["/ˌæbɚˈɪdʒənəl/", "애버리저널"],
    ["/bəˈlɪdʒɚənt/", "벌리저런트"],
    ["/ˈbɝɡlɚi/", "버글러리"],
    ["/ˈhɛtɚəˌdɑks/", "헤터러다크스"],
    ["/ˌlæbɚˈɪnˌθin/", "래버린신"],
    ["/ˈsmætɚɪŋ/", "스매터링"],
    ["/əˈkwɪzətɪv/", "어퀴저티브"],
    ["/əˈkwɪt/", "어큇"],
    ["/ɪˈkwɪp/", "이큅"],
    ["/ˈswɪft/", "스위프트"],
    ["/ˈswɛltɚ/", "스웰터"],
    ["/ˈpɪr/", "피어"],
    ["/ˈtʃɪr/", "치어"],
    ["/ˌvɑlənˈtɪr/", "발런티어"],
    ["/ˈwɪrd/", "위어드"],
  ])("renders %s as a reading aid, not an authoritative pronunciation", (ipa, expected) => {
    expect(getKoreanPronunciation(ipa)).toBe(expected);
  });

  it("normalizes common IPA glyph variants without consulting English spelling", () => {
    expect(getKoreanPronunciation("/ɡriːn/")).toBe("그린");
    expect(getKoreanPronunciation("/gɹiːn/")).toBe("그린");
    expect(getKoreanPronunciation("  /ˌkəmˈpjuːtɚ/  ")).toBe("컴퓨터");
  });

  it.each([
    null, undefined, "", "boast", "capricious", "/cat/", "/hello/", "/kæt", "kæt/",
    "/kæt/ or /kɑt/", "/kæt kɑt/", "/kæt,kɑt/", "/fɑ(r)/", "/bʌtn̩/",
    "/bʌɾɚ/", "/kʰæt/", "/kæ̃t/", "/bɫu/", "/œ/", "/ŋɑ/", "/ʃw/",
    "/ˈˌ/", "/ptksnɪ/", "/ʌh/", "/ːi/", "/iːː/", "/<script>/",
    "/ˈækjɚəsi/", "/kjɚ/",
  ])("declines unsupported or ambiguous input: %s", ipa => {
    expect(getKoreanPronunciation(ipa)).toBeNull();
  });

  it("bounds input and output rather than processing arbitrarily large strings", () => {
    expect(getKoreanPronunciation(`/${"ka".repeat(1000)}/`)).toBeNull();
    expect(getKoreanPronunciation(`/${"ka".repeat(13)}/`)).toBeNull();
  });
});
