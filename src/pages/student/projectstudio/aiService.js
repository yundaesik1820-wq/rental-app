// 🤖 Project Studio AI 서비스 (요청서 3·15번)
// MVP: 규칙 기반 mock. 추후 실제 AI API 호출로 이 파일 내부만 교체하면 됨 —
// 호출부는 전부 이 모듈의 함수만 사용하고 결과 형태(shape)는 유지할 것.

// 소품 사전 (설명/대사에서 키워드 매칭)
const PROP_DICT = [
  "노트북", "컵라면", "라면", "담배", "핸드폰", "휴대폰", "커피", "책", "가방", "우산",
  "술", "소주", "맥주", "와인", "편지", "사진", "꽃", "케이크", "칼", "총", "돈", "지갑",
  "열쇠", "안경", "시계", "텀블러", "마이크", "기타", "피아노", "티비", "TV", "리모컨",
];

// 의상 사전
const COSTUME_DICT = ["후드", "교복", "정장", "드레스", "한복", "코트", "모자", "안경", "유니폼", "앞치마"];

/**
 * 장면 분석 (규칙 기반)
 * @returns {{ cast: string[], location: string, props: string[], costumes: string[], equipment: string[], estimatedMinutes: number }}
 */
export function analyzeScene(scene) {
  const text = `${scene.description || ""}\n${scene.dialogue || ""}`;

  // 등장인물: "이름:" / "이름 :" 대사 패턴에서 추출 (2~4자 한글)
  const cast = [...new Set(
    [...text.matchAll(/(^|\n)\s*([가-힣]{2,4})\s*[:：]/g)].map(m => m[2])
  )];

  // 소품/의상: 사전 키워드 매칭 (긴 단어 우선 — "컵라면" 매칭 시 "라면" 중복 제거)
  const matchDict = (dict) => {
    const found = [];
    for (const w of [...dict].sort((a, b) => b.length - a.length)) {
      if (text.includes(w) && !found.some(f => f.includes(w))) found.push(w);
    }
    return found;
  };
  const props    = matchDict(PROP_DICT);
  const costumes = matchDict(COSTUME_DICT);

  // 장비: 기본 + 조건부
  const equipment = ["카메라", "삼각대"];
  const night = scene.timeOfDay === "밤" || scene.timeOfDay === "저녁";
  if (scene.locationType !== "EXT" || night) equipment.push("조명 2대");
  if (scene.locationType === "EXT" && !night) equipment.push("반사판");
  if ((scene.dialogue || "").trim()) equipment.push("붐마이크");

  // 예상 촬영 시간: 입력값 우선, 없으면 규모 기반 추정 (30~180분, 15분 단위)
  let minutes = scene.estimatedMinutes;
  if (!minutes) {
    minutes = 30 + cast.length * 15 + props.length * 10 + (night ? 15 : 0);
    minutes = Math.min(180, Math.max(30, Math.round(minutes / 15) * 15));
  }

  return { cast, location: scene.locationName || "", props, costumes, equipment, estimatedMinutes: minutes };
}
