export const C = {
  bg: "#F0F4FF", surface: "#FFFFFF", card: "#FFFFFF",
  navy: "#1A2B6B", blue: "#3B6CF8", blueLight: "#EEF2FF",
  teal: "#0ABFA3", tealLight: "#E6FAF7",
  red: "#F05252", redLight: "#FEF2F2",
  yellow: "#F59E0B", yellowLight: "#FFFBEB",
  green: "#10B981", greenLight: "#ECFDF5",
  purple: "#8B5CF6", purpleLight: "#F5F3FF",
  orange: "#F97316", orangeLight: "#FFF7ED",
  text: "#1E293B", muted: "#94A3B8", border: "#E2E8F0",
  shadow: "0 2px 12px rgba(59,108,248,0.08)",
};

const STATUS_COLOR = {
  대여가능: "#10B981", 대여중: "#3B6CF8", 수리중: "#F59E0B",
  연체: "#F05252", 반납완료: "#94A3B8", 승인대기: "#F59E0B",
  승인됨: "#10B981", 거절됨: "#F05252",
  정상: "#10B981", 수리필요: "#F97316", 폐기: "#F05252", 신청중: "#8B5CF6",
};
const STATUS_BG = {
  대여가능: "#ECFDF5", 대여중: "#EEF2FF", 수리중: "#FFFBEB",
  연체: "#FEF2F2", 반납완료: "#F8FAFC", 승인대기: "#FFFBEB",
  승인됨: "#ECFDF5", 거절됨: "#FEF2F2",
  정상: "#ECFDF5", 수리필요: "#FFF7ED", 폐기: "#FEF2F2", 신청중: "#F5F3FF",
};

export const sc = (s) => STATUS_COLOR[s] || "#94A3B8";
export const sb = (s) => STATUS_BG[s]    || "#F8FAFC";

export const NOTICE_CAT = {
  공지:    { bg: "#EEF2FF", col: "#3B6CF8" },
  신규장비: { bg: "#ECFDF5", col: "#10B981" },
  휴무:    { bg: "#FEF2F2", col: "#F05252" },
};
