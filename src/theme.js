// 다크 테마
const DARK = {
  bg:      "#0F172A",
  surface: "#1E293B",
  card:    "#1E293B",
  navy:    "#60A5FA",
  blue:    "#60A5FA",   blueLight:   "#1E3A5F",
  teal:    "#2DD4BF",   tealLight:   "#0F3D38",
  red:     "#F87171",   redLight:    "#3B1515",
  yellow:  "#FBBF24",   yellowLight: "#3B2A00",
  green:   "#34D399",   greenLight:  "#0F3028",
  purple:  "#A78BFA",   purpleLight: "#2D1F5E",
  orange:  "#FB923C",   orangeLight: "#3B1F00",
  text:    "#F1F5F9",
  muted:   "#64748B",
  border:  "#334155",
  shadow:  "0 2px 12px rgba(0,0,0,0.4)",
};

// 라이트 테마
const LIGHT = {
  bg:      "#F8FAFC",
  surface: "#FFFFFF",
  card:    "#FFFFFF",
  navy:    "#1B2B6B",
  blue:    "#3B6CF8",   blueLight:   "#EEF2FF",
  teal:    "#0D9488",   tealLight:   "#CCFBF1",
  red:     "#EF4444",   redLight:    "#FEE2E2",
  yellow:  "#F59E0B",   yellowLight: "#FEF9C3",
  green:   "#10B981",   greenLight:  "#D1FAE5",
  purple:  "#7C3AED",   purpleLight: "#EDE9FE",
  orange:  "#F97316",   orangeLight: "#FFEDD5",
  text:    "#1E293B",
  muted:   "#94A3B8",
  border:  "#E2E8F0",
  shadow:  "0 2px 12px rgba(0,0,0,0.08)",
};

// localStorage에서 테마 읽기 (기본: dark)
const getSavedTheme = () => {
  try { return localStorage.getItem("kbas_theme") || "dark"; } catch { return "dark"; }
};

// 현재 테마 객체
let _currentTheme = getSavedTheme() === "light" ? LIGHT : DARK;

// body 배경색 동기화
const syncBodyBg = () => {
  try { document.body.style.background = _currentTheme.bg; } catch {}
};
syncBodyBg();

export let C = { ..._currentTheme };

export const setTheme = (mode) => {
  localStorage.setItem("kbas_theme", mode);
  _currentTheme = mode === "light" ? LIGHT : DARK;
  Object.assign(C, _currentTheme);
  syncBodyBg();
  // 앱 리렌더 트리거 (커스텀 이벤트)
  window.dispatchEvent(new CustomEvent("kbas-theme-change", { detail: { mode } }));
};

export const getThemeMode = () => getSavedTheme();

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
