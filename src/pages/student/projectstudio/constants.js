// 🎬 Project Studio 공통 상수
// 이 화면군은 theme.js(모노톤)와 별개로 로컬 디자인 토큰을 쓴다 (블루/퍼플 리디자인 흐름).
import {
  Clapperboard, Music2, Megaphone, Film, Youtube, Shapes,
  Lightbulb, FileText, ListTree, Camera, CalendarDays, Users, MapPin, Wrench, Wallet, UserPlus, FolderOpen,
} from "lucide-react";

// 디자인 토큰 (요청서 19번 기준)
export const PS = {
  bg: "#08090D",
  surface: "#11131A",
  elev: "#171A23",
  border: "#292D3A",
  primary: "#7357FF",
  primaryLight: "#967FFF",
  text: "#F7F7FA",
  sub: "#A8ABB7",
  danger: "#FF5364",
  success: "#2BD9A0",
  warning: "#FFB84D",
};

// 프로젝트 유형 (value = Firestore 저장값)
export const PROJECT_TYPES = [
  { value: "short_film",  label: "단편영화",   icon: Clapperboard },
  { value: "music_video", label: "뮤직비디오", icon: Music2 },
  { value: "commercial",  label: "광고영상",   icon: Megaphone },
  { value: "documentary", label: "다큐멘터리", icon: Film },
  { value: "youtube",     label: "유튜브",     icon: Youtube },
  { value: "other",       label: "기타",       icon: Shapes },
];

// 진행 단계 (value = Firestore 저장값)
export const PROJECT_STAGES = [
  { value: "idea",           label: "아이디어" },
  { value: "planning",       label: "기획" },
  { value: "preproduction",  label: "프리프로덕션" },
  { value: "production",     label: "프로덕션" },
  { value: "postproduction", label: "포스트프로덕션" },
  { value: "completed",      label: "완료" },
];

// 워크스페이스 빠른 메뉴 (key = 추후 화면 라우팅 키, ready=false면 "준비 중")
export const WORKSPACE_MENUS = [
  { key: "idea",      label: "기획 노트",       icon: Lightbulb,    ready: false },
  { key: "script",    label: "시나리오",        icon: FileText,     ready: true },
  { key: "breakdown", label: "씬 브레이크다운", icon: ListTree,     ready: true },
  { key: "shots",     label: "콘티 / 샷리스트", icon: Camera,       ready: true },
  { key: "schedule",  label: "촬영 일정",       icon: CalendarDays, ready: true },
  { key: "casting",   label: "캐스팅",          icon: Users,        ready: false },
  { key: "locations", label: "로케이션",        icon: MapPin,       ready: false },
  { key: "equipment", label: "장비",            icon: Wrench,       ready: false },
  { key: "budget",    label: "예산",            icon: Wallet,       ready: false },
  { key: "crew",      label: "팀원",            icon: UserPlus,     ready: false },
  { key: "files",     label: "파일 보관함",     icon: FolderOpen,   ready: false },
];

export const typeLabel  = (v) => PROJECT_TYPES.find(t => t.value === v)?.label || v;
export const typeIcon   = (v) => PROJECT_TYPES.find(t => t.value === v)?.icon || Shapes;
export const stageLabel = (v) => PROJECT_STAGES.find(s => s.value === v)?.label || v;

// ===== 시나리오/장면 (Phase 3) =====
export const SCENE_LOCATION_TYPES = [
  { value: "INT",     label: "실내" },
  { value: "EXT",     label: "야외" },
  { value: "INT_EXT", label: "실내+야외" },
];
export const SCENE_TIMES = ["아침", "낮", "저녁", "밤"];
export const SCENE_STATUS = [
  { value: "draft",     label: "초안",     color: "#A8ABB7" },
  { value: "ready",     label: "준비완료", color: "#2BD9A0" },
  { value: "scheduled", label: "일정확정", color: "#7357FF" },
  { value: "completed", label: "촬영완료", color: "#FFB84D" },
];
export const BREAKDOWN_DIFFICULTY = [
  { value: "easy",   label: "쉬움" },
  { value: "normal", label: "보통" },
  { value: "hard",   label: "어려움" },
];
export const locTypeLabel  = (v) => SCENE_LOCATION_TYPES.find(t => t.value === v)?.label || v;
export const sceneStatus   = (v) => SCENE_STATUS.find(s => s.value === v) || SCENE_STATUS[0];

/** Scene 문서 기본값 팩토리 (요청서 6번 Scene 모델의 JS 버전) */
export function newScene({ projectId, ownerId, sceneNumber }) {
  return {
    projectId, ownerId, sceneNumber,
    heading: "", locationType: "INT", locationName: "", timeOfDay: "낮",
    description: "", dialogue: "",
    status: "draft", estimatedMinutes: null,
  };
}

// ===== 콘티/샷리스트 (Phase 4) =====
export const SHOT_SIZES  = ["익스트림 와이드", "와이드", "풀샷", "미디엄", "바스트", "클로즈업", "익스트림 클로즈업"];
export const SHOT_ANGLES = ["아이레벨", "하이앵글", "로우앵글", "버드아이", "더치앵글"];
export const SHOT_MOVES  = ["픽스", "팬", "틸트", "달리", "트래킹", "핸드헬드", "짐벌", "크레인", "줌"];
export const SHOT_STATUS = [
  { value: "planned", label: "예정",     color: "#A8ABB7" },
  { value: "ready",   label: "준비완료", color: "#2BD9A0" },
  { value: "shot",    label: "촬영완료", color: "#FFB84D" },
];
export const shotStatus = (v) => SHOT_STATUS.find(s => s.value === v) || SHOT_STATUS[0];

/** Shot 문서 기본값 팩토리 (요청서 8번 Shot 모델의 JS 버전) */
export function newShot({ projectId, ownerId, sceneId, shotNumber }) {
  return {
    projectId, ownerId, sceneId, shotNumber,
    title: "", description: "",
    shotSize: null, cameraAngle: null, cameraMovement: null, lens: "",
    dialogue: "", estimatedSeconds: null, referenceImageUrl: null,
    status: "planned",
  };
}

/** ShootDay 문서 기본값 팩토리 (요청서 10번 ShootDay 모델의 JS 버전) */
export function newShootDay({ projectId, ownerId, date }) {
  return {
    projectId, ownerId, date,          // "YYYY-MM-DD"
    title: "", callTime: "", wrapTime: "",
    locationIds: [], sceneIds: [], notes: "",
  };
}

/**
 * Project 문서 기본값 팩토리 (요청서 16번 Project 모델의 JS 버전)
 * createdAt/updatedAt은 addItem/updateItem이 serverTimestamp로 채움.
 */
export function newProject({ ownerId, title, type, stage, expectedShootDate, expectedCompletionDate }) {
  return {
    ownerId,
    title: title.trim(),
    description: "",
    type,                                   // short_film | music_video | commercial | documentary | youtube | other
    stage: stage || "idea",                 // idea | planning | preproduction | production | postproduction | completed
    status: "active",                       // active | archived (soft delete)
    expectedShootDate: expectedShootDate || null,       // "YYYY-MM-DD"
    expectedCompletionDate: expectedCompletionDate || null,
    progress: 0,                            // 0~100, 사용자가 직접 수정 (추후 자동 계산)
    budgetLimit: null,
    coverImageUrl: null,
  };
}
