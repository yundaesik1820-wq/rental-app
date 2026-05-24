// 한국 공휴일 데이터 + 유틸
// 새로운 임시공휴일/대체공휴일 발표 시 이 파일만 업데이트하면 됨
// 데이터는 'YYYY-MM-DD': '공휴일명' 형식

const HOLIDAYS = {
  // ===== 2025년 =====
  "2025-01-01": "신정",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-01": "삼일절",
  "2025-03-03": "삼일절 대체공휴일",
  "2025-05-05": "어린이날·부처님오신날",
  "2025-05-06": "어린이날 대체공휴일",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-06": "추석 연휴",
  "2025-10-07": "추석",
  "2025-10-08": "추석 연휴",
  "2025-10-09": "한글날",
  "2025-12-25": "성탄절",

  // ===== 2026년 =====
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "삼일절 대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "부처님오신날 대체공휴일",
  "2026-06-03": "제9회 전국동시지방선거",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "광복절 대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-09-28": "추석 대체공휴일",
  "2026-10-03": "개천절",
  "2026-10-05": "개천절 대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",

  // ===== 2027년 =====
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "설날 대체공휴일",
  "2027-03-01": "삼일절",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-08-15": "광복절",
  "2027-08-16": "광복절 대체공휴일",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절",
  "2027-10-04": "개천절 대체공휴일",
  "2027-10-09": "한글날",
  "2027-10-11": "한글날 대체공휴일",
  "2027-12-25": "성탄절",
};

// 날짜를 YYYY-MM-DD 문자열로 변환
function toDateStr(date) {
  if (typeof date === "string") return date.slice(0, 10);
  if (!(date instanceof Date)) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 공휴일 여부 확인 — 다양한 입력 형태 지원
// isKoreanHoliday(new Date(2026, 5, 3))
// isKoreanHoliday("2026-06-03")
// isKoreanHoliday(2026, 6, 3)
export function isKoreanHoliday(dateOrYear, month, day) {
  if (typeof dateOrYear === "number" && typeof month === "number" && typeof day === "number") {
    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return !!HOLIDAYS[`${dateOrYear}-${m}-${d}`];
  }
  const key = toDateStr(dateOrYear);
  return !!HOLIDAYS[key];
}

// 공휴일명 반환 (없으면 null)
export function getKoreanHolidayName(dateOrYear, month, day) {
  if (typeof dateOrYear === "number" && typeof month === "number" && typeof day === "number") {
    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return HOLIDAYS[`${dateOrYear}-${m}-${d}`] || null;
  }
  const key = toDateStr(dateOrYear);
  return HOLIDAYS[key] || null;
}

// 평일도 휴일도 아닌 평일 = 영업일
export function isBusinessDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dow = d.getDay(); // 0=일, 6=토
  if (dow === 0 || dow === 6) return false;
  return !isKoreanHoliday(d);
}

// 지정 년도의 모든 공휴일 목록 반환
export function getHolidaysOfYear(year) {
  const prefix = `${year}-`;
  return Object.entries(HOLIDAYS)
    .filter(([k]) => k.startsWith(prefix))
    .map(([date, name]) => ({ date, name }));
}
