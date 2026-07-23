// 문의 · FAQ 공용 카테고리 (학생 Inquiry / 관리자 Inquiry·FAQ 관리가 같이 씀)
// id 는 Firestore 에 저장되는 값이라 바꾸면 기존 문서와 어긋남 — 추가만 할 것.
export const INQ_CATEGORIES = [
  { id: "대여 문의",      short: "대여",      icon: "📦", desc: "예약 신청, 대여 기간, 긴급 신청 관련" },
  { id: "반납·연체 문의", short: "반납·연체", icon: "🔄", desc: "반납 방법, 반납 사진, 연체 처리 관련" },
  { id: "라이선스 문의",  short: "라이선스",  icon: "🎖️", desc: "라이선스 취득, 등급 변경 관련" },
  { id: "계정 문의",      short: "계정",      icon: "👤", desc: "가입 승인, 비밀번호, 개인정보 관련" },
  { id: "기타 문의",      short: "기타",      icon: "📝", desc: "위 항목에 해당하지 않는 기타 문의" },
];

// 옛 표기 보정 — 과거에 저장된 문의 문서가 새 목록에 안 걸리는 걸 막음
const LEGACY = {
  "라이센스 문의": "라이선스 문의",
};
export const normCat = (c) => LEGACY[c] || c || "";

const BY_ID = Object.fromEntries(INQ_CATEGORIES.map(c => [c.id, c]));

// 목록에 없는 옛 카테고리("일반 문의" 등)도 아이콘·라벨은 나오게 폴백
export const catInfo = (c) => BY_ID[normCat(c)] || { id: c, short: c, icon: "📝", desc: "" };
export const catIcon = (c) => catInfo(c).icon;

// 관리자 필터용 — 데이터에 남아 있는 옛 카테고리까지 칩으로 노출
export function catFilterList(docs = []) {
  const known = INQ_CATEGORIES.map(c => c.id);
  const legacy = [...new Set(docs.map(d => normCat(d.category)).filter(c => c && !known.includes(c)))];
  return ["전체", ...known, ...legacy];
}
