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

// ===== AI 프로젝트 생성 (요청서 3번) =====
// 6개 질문 응답 → 규칙 기반 프로젝트 초안. 추후 실제 AI로 이 함수만 교체.
// answers: { mood, story, runtime, crewSize, budget, priority }
export function generateProjectDraft(answers = {}) {
  const { mood = "", story = "", runtime = "", crewSize = "", budget = "", priority = "" } = answers;

  const runtimeMin = parseInt(String(runtime).replace(/[^0-9]/g, ""), 10) || 0;
  const crewNum    = parseInt(String(crewSize).replace(/[^0-9]/g, ""), 10) || 0;
  const budgetNum  = parseInt(String(budget).replace(/[^0-9]/g, ""), 10) || 0;

  // 프로젝트 설명
  const descParts = [];
  if (story.trim())  descParts.push(story.trim());
  if (mood.trim())   descParts.push(`분위기: ${mood.trim()}`);
  if (runtimeMin)    descParts.push(`예상 러닝타임 약 ${runtimeMin}분`);
  const description = descParts.join("\n") || "새 영상 프로젝트";

  // 기본 할 일 (priority를 첫 항목으로 반영)
  const tasks = [];
  if (priority.trim()) tasks.push(`먼저 준비: ${priority.trim()}`);
  tasks.push("시놉시스 초안 작성", "주요 등장인물 정리", "촬영 장소 후보 찾기", "필요한 팀 포지션 확인");
  if (budgetNum) tasks.push("예산 항목 정리");
  if (runtimeMin >= 10) tasks.push("장면(씬) 구성 나누기");

  // 예산 카테고리 (기본 세트, 예산 규모 있으면 장비/식비 우선)
  const budgetCats = budgetNum
    ? ["장비", "로케이션", "식비", "교통", "미술"]
    : ["장비", "로케이션", "미술"];

  // 기본 팀 포지션 (촬영 인원 규모에 따라)
  let crewRoles = ["연출", "촬영", "편집/D.I"];
  if (crewNum >= 4)  crewRoles = ["제작", "연출", "촬영", "조명", "동시녹음/음향", "편집/D.I"];
  else if (crewNum >= 2) crewRoles = ["연출", "촬영", "조명", "편집/D.I"];

  // 추천 워크스페이스 (준비 우선순위)
  const recommendedMenus = ["script", "breakdown", "schedule", "budget", "crew"];

  // 진행 단계는 항상 기획부터 시작
  return {
    description,
    stage: "planning",
    tasks,
    budgetCategories: budgetCats,
    crewRoles,
    recommendedMenus,
    meta: { runtimeMin, crewNum, budgetNum },
  };
}

// ===== AI 프로덕션 매니저 (요청서 15번) =====
// 프로젝트 데이터를 읽고 질문 유형을 감지해 규칙 기반 답변.
// ctx: { project, scenes, breakdowns, days, tasks, budget, crew }
// 반환: { text, proposal? } — proposal이 있으면 사용자 확인 후 적용
export function answerProjectQuestion(ctx, message) {
  const m = String(message || "").toLowerCase();
  const { project = {}, scenes = [], breakdowns = [], days = [], tasks = [], budget = [], crew = [] } = ctx || {};
  const bdOf = (sid) => breakdowns.find(b => b.sceneId === sid);
  const won = (n) => `${Number(n || 0).toLocaleString()}원`;

  // 1) 준비 상태
  if (/(준비|상태|어디까지|진행)/.test(m)) {
    const ready = scenes.filter(s => s.status !== "draft").length;
    const withBd = scenes.filter(s => bdOf(s.id)).length;
    const doneTasks = tasks.filter(t => t.status === "done").length;
    return {
      text: [
        `📊 '${project.title}' 준비 현황이에요.`,
        `• 장면 ${scenes.length}개 중 ${ready}개 준비 완료, ${withBd}개 브레이크다운 작성됨`,
        `• 촬영일 ${days.length}개 · 팀원 ${crew.length}명`,
        `• 할 일 ${doneTasks}/${tasks.length} 완료`,
        scenes.length && withBd < scenes.length ? `\n💡 브레이크다운이 안 된 장면이 ${scenes.length - withBd}개 있어요. 먼저 채우면 촬영일 준비물이 자동으로 합쳐져요.` : "",
      ].filter(Boolean).join("\n"),
    };
  }

  // 2) 예산
  if (/(예산|비용|돈|금액|얼마)/.test(m)) {
    const planned = budget.reduce((s, b) => s + (b.plannedAmount || 0), 0);
    const actual  = budget.reduce((s, b) => s + (b.actualAmount ?? b.plannedAmount ?? 0), 0);
    const limit = project.budgetLimit;
    const lines = [
      `💰 예산 요약이에요.`,
      `• 예정 지출 합계: ${won(planned)}`,
      limit != null ? `• 총 예산: ${won(limit)} · 남은 예산: ${won(limit - actual)}` : `• 총 예산이 아직 설정 안 됐어요.`,
    ];
    if (limit != null && limit - actual < 0) lines.push(`\n⚠️ 예산을 ${won(actual - limit)} 초과했어요. 장비를 학교 대여로 바꾸면 비용을 줄일 수 있어요.`);
    return { text: lines.join("\n") };
  }

  // 3) 소품 정리
  if (/(소품|준비물|챙길|가져)/.test(m)) {
    const props = [...new Set(breakdowns.flatMap(b => b.propNames || []))];
    const equip = [...new Set(breakdowns.flatMap(b => b.equipmentNames || []))];
    if (!props.length && !equip.length) return { text: "아직 브레이크다운에 소품·장비가 없어요. 시나리오에서 장면 AI 분석을 먼저 돌려보세요!" };
    return {
      text: [
        `📦 이 프로젝트에 필요한 것들이에요.`,
        props.length ? `• 소품: ${props.join(", ")}` : "",
        equip.length ? `• 장비: ${equip.join(", ")}` : "",
      ].filter(Boolean).join("\n"),
    };
  }

  // 4) 촬영 순서 / 일정
  if (/(순서|일정|스케줄|묶|동선)/.test(m)) {
    // 같은 장소끼리 묶기 제안
    const byLoc = {};
    for (const s of scenes) {
      const loc = s.locationName || "미정";
      (byLoc[loc] = byLoc[loc] || []).push(s.sceneNumber);
    }
    const groups = Object.entries(byLoc).filter(([, arr]) => arr.length > 1);
    if (!groups.length) return { text: "같은 장소에서 찍는 장면이 아직 여러 개가 아니에요. 장소가 겹치면 한 번에 찍도록 묶어드릴게요." };
    const text = [
      `🎬 같은 장소끼리 묶으면 이동을 줄일 수 있어요.`,
      ...groups.map(([loc, arr]) => `• ${loc}: S#${arr.sort((a, b) => a - b).join(", S#")}`),
      `\n💡 촬영 일정에서 각 촬영일에 같은 장소 장면을 함께 배치해보세요.`,
    ].join("\n");
    return { text };
  }

  // 5) 할 일 추천 → 실제 변경 제안 (사용자 승인 필요)
  if (/(할 ?일|todo|투두|뭐부터|뭐 해|다음)/.test(m)) {
    const suggest = [];
    if (!scenes.length) suggest.push("시놉시스 초안 작성", "장면 구성 나누기");
    else if (scenes.some(s => !bdOf(s.id))) suggest.push("장면별 브레이크다운 작성");
    if (!days.length && scenes.length) suggest.push("촬영일 정하기");
    if (!crew.length) suggest.push("팀 포지션 정하기");
    if (!budget.length) suggest.push("예산 항목 정리");
    const existing = new Set(tasks.map(t => t.title));
    const fresh = suggest.filter(s => !existing.has(s));
    if (!fresh.length) return { text: "지금 등록된 할 일이면 충분해요! 하나씩 완료해나가면 돼요 💪" };
    return {
      text: `다음 할 일을 추가하는 걸 추천해요:\n${fresh.map(t => `• ${t}`).join("\n")}`,
      proposal: { type: "addTasks", tasks: fresh, label: `할 일 ${fresh.length}개 추가` },
    };
  }

  // 폴백
  return {
    text: [
      "이런 걸 물어볼 수 있어요:",
      "• \"8월 촬영 준비 상태 알려줘\"",
      "• \"예산 얼마나 남았어?\"",
      "• \"필요한 소품 정리해줘\"",
      "• \"촬영 순서 추천해줘\"",
      "• \"뭐부터 해야 해?\"",
    ].join("\n"),
  };
}
