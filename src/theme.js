export const C = {
  // 다크 배경
  bg:      "#0F172A",   // 메인 배경 (딥 네이비)
  surface: "#1E293B",   // 카드/패널 배경
  card:    "#1E293B",

  // 포인트 색상 (밝게 유지)
  navy:   "#60A5FA",    // 기존 네이비 → 밝은 블루로
  blue:   "#60A5FA",    blueLight:   "#1E3A5F",
  teal:   "#2DD4BF",    tealLight:   "#0F3D38",
  red:    "#F87171",    redLight:    "#3B1515",
  yellow: "#FBBF24",    yellowLight: "#3B2A00",
  green:  "#34D399",    greenLight:  "#0F3028",
  purple: "#A78BFA",    purpleLight: "#2D1F5E",
  orange: "#FB923C",    orangeLight: "#3B1F00",

  // 텍스트
  text:   "#F1F5F9",    // 기본 텍스트 (밝은 흰색)
  muted:  "#64748B",    // 보조 텍스트
  border: "#334155",    // 테두리

  shadow: "0 2px 12px rgba(0,0,0,0.4)",
};

const STATUS_COLOR = {
  대여가능: "#34D399", 대여중: "#60A5FA", 수리중: "#FBBF24",
  연체: "#F87171", 반납완료: "#64748B", 승인대기: "#FBBF24",
  승인됨: "#34D399", 거절됨: "#F87171",
  정상: "#34D399", 수리필요: "#FB923C", 폐기: "#F87171", 신청중: "#A78BFA",
};
const STATUS_BG = {
  대여가능: "#0F3028", 대여중: "#1E3A5F", 수리중: "#3B2A00",
  연체: "#3B1515", 반납완료: "#1E293B", 승인대기: "#3B2A00",
  승인됨: "#0F3028", 거절됨: "#3B1515",
  정상: "#0F3028", 수리필요: "#3B1F00", 폐기: "#3B1515", 신청중: "#2D1F5E",
};

export const sc = (s) => STATUS_COLOR[s] || "#64748B";
export const sb = (s) => STATUS_BG[s]    || "#1E293B";

export const NOTICE_CAT = {
  공지:    { bg: "#1E3A5F", col: "#60A5FA" },
  신규장비: { bg: "#0F3028", col: "#34D399" },
  휴무:    { bg: "#3B1515", col: "#F87171" },
};
