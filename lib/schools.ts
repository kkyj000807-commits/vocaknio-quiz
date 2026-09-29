export type SchoolId = "all" | "hanyang" | "sungkyunkwan" | "sogang" | "chungang" | "konkuk" | "gachon" | "logic";
export interface SchoolMeta {
  id: SchoolId; label: string; shortLabel: string;
  color: string; glowColor: string;
  tier: "SKY" | "서성한" | "중경외시" | "건동홍" | "기타" | "특수";
  available: boolean; years: number[]; description: string;
}
export const SCHOOLS: SchoolMeta[] = [
  { id: "all", label: "전체", shortLabel: "전체", color: "#4A9EFF", glowColor: "rgba(74,158,255,0.2)", tier: "특수", available: true, years: [], description: "모든 학교 기출 통합" },
  { id: "hanyang", label: "한양대", shortLabel: "한양", color: "#FF6B35", glowColor: "rgba(255,107,53,0.2)", tier: "서성한", available: true, years: [2020,2021,2022,2023,2024,2025], description: "어휘 비중 높음 · 빈칸완성 다수" },
  { id: "sungkyunkwan", label: "성균관대", shortLabel: "성균관", color: "#00C9A7", glowColor: "rgba(0,201,167,0.2)", tier: "서성한", available: true, years: [2021], description: "독해 중심 · 논리완성 포함" },
  { id: "sogang", label: "서강대", shortLabel: "서강", color: "#9B59B6", glowColor: "rgba(155,89,182,0.2)", tier: "서성한", available: false, years: [], description: "준비 중" },
  { id: "chungang", label: "중앙대", shortLabel: "중앙", color: "#E74C3C", glowColor: "rgba(231,76,60,0.2)", tier: "중경외시", available: false, years: [], description: "준비 중" },
  { id: "konkuk", label: "건국대", shortLabel: "건국", color: "#27AE60", glowColor: "rgba(39,174,96,0.2)", tier: "건동홍", available: false, years: [], description: "준비 중" },
  { id: "gachon", label: "가천대", shortLabel: "가천", color: "#F39C12", glowColor: "rgba(243,156,18,0.2)", tier: "기타", available: false, years: [], description: "준비 중" },
  { id: "logic", label: "논리 시리즈", shortLabel: "논리", color: "#A855F7", glowColor: "rgba(168,85,247,0.3)", tier: "특수", available: true, years: [2024], description: "스타일앤톤(논토니오) 논리완성 199문제 · S급 최신기출 포함 · 학교 공통 출제 유형" },
];
export function getSchool(id: SchoolId): SchoolMeta { return SCHOOLS.find((s) => s.id === id) ?? SCHOOLS[0]; }
export function getAvailableSchools(): SchoolMeta[] { return SCHOOLS.filter((s) => s.available); }
export const TIER_ORDER: Record<SchoolMeta["tier"], number> = { SKY: 0, 서성한: 1, 중경외시: 2, 건동홍: 3, 기타: 4, 특수: 5 };
