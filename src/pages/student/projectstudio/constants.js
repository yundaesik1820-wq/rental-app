// 🎬 Project Studio 공통 상수
// 이 화면군은 theme.js(모노톤)와 별개로 로컬 디자인 토큰을 쓴다 (블루/퍼플 리디자인 흐름).
import { Clapperboard, Music2, Megaphone, Film, Youtube, Shapes } from "lucide-react";

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

export const typeLabel  = (v) => PROJECT_TYPES.find(t => t.value === v)?.label || v;
export const typeIcon   = (v) => PROJECT_TYPES.find(t => t.value === v)?.icon || Shapes;
export const stageLabel = (v) => PROJECT_STAGES.find(s => s.value === v)?.label || v;

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
