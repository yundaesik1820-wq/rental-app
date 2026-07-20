import { useState, useRef, useEffect } from "react";
import { ArrowLeft, CalendarDays, Flag, Settings2, Users } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { PS, typeLabel, typeIcon, stageLabel, WORKSPACE_MENUS, canEditProject, isProjectOwner } from "./constants";
import ProjectTasks from "./ProjectTasks";
import ProjectEditModal from "./ProjectEditModal";
import AIManager from "./AIManager";

// 프로젝트 대시보드 (Phase 2 — 기본 정보 + 할 일 + 워크스페이스 메뉴 + 수정/보관)
export default function ProjectDashboard({ project, onBack, onOpenScript, onOpenShots, onOpenSchedule, onOpenMenuScreen }) {
  const { user } = useAuth();
  const canEdit = canEditProject(project, user?.uid); // 소유자 + 참여 팀원 (할일·워크스페이스 작업)
  const isOwner = isProjectOwner(project, user?.uid); // 소유자만 (프로젝트 설정)
  const [showEdit, setShowEdit] = useState(false);
  const [menuToast, setMenuToast] = useState("");
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  if (!project) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center", color: PS.sub, fontSize: 14 }}>
        프로젝트를 찾을 수 없어요.
        <div style={{ marginTop: 14 }}>
          <button onClick={onBack}
            style={{ background: PS.surface, border: `1px solid ${PS.border}`, color: PS.text,
              borderRadius: 10, padding: "10px 18px", minHeight: 44, fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit" }}>
            목록으로
          </button>
        </div>
      </div>
    );
  }

  const Ic = typeIcon(project.type);
  const progress = Math.max(0, Math.min(100, project.progress || 0));
  const fmtDate = (d) => d ? d.replaceAll("-", ".") : "미정";

  const openMenu = (m) => {
    // 시나리오·브레이크다운은 시나리오 화면으로 (브레이크다운은 장면 카드 안에서 편집)
    if (m.key === "script" || m.key === "breakdown") { onOpenScript && onOpenScript(); return; }
    if (m.key === "shots") { onOpenShots && onOpenShots(); return; }
    if (m.key === "schedule") { onOpenSchedule && onOpenSchedule(); return; }
    if (["crew", "equipment", "budget", "casting", "locations", "files", "idea"].includes(m.key)) { onOpenMenuScreen && onOpenMenuScreen(m.key); return; }
    if (!m.ready) {
      setMenuToast(`${m.label}는 다음 업데이트에 추가돼요!`);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setMenuToast(""), 2200);
    }
  };

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack}
        style={{
          background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit",
        }}>
        <ArrowLeft size={17} /> 프로젝트 목록
      </button>

      {/* 상단 정보 */}
      <div style={{
        background: `linear-gradient(150deg, ${PS.primary}22 0%, ${PS.surface} 55%)`,
        border: `1px solid ${PS.primary}33`, borderRadius: 18, padding: 18, marginTop: 6,
        position: "relative",
      }}>
        {canEdit && (
          <button onClick={() => setShowEdit(true)}
            style={{
              position: "absolute", top: 10, right: 10, width: 40, height: 40,
              background: "rgba(255,255,255,0.06)", border: `1px solid ${PS.border}`,
              borderRadius: 11, color: PS.sub, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Settings2 size={17} />
          </button>
        )}
        {!isOwner && (
          <span style={{
            position: "absolute", top: 14, right: canEdit ? 58 : 12, display: "flex", alignItems: "center", gap: 4,
            fontSize: 10.5, fontWeight: 800, color: PS.sub,
            background: "rgba(255,255,255,0.06)", border: `1px solid ${PS.border}`,
            padding: "4px 9px", borderRadius: 999,
          }}>
            <Users size={11} /> 참여 중
          </span>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingRight: 44 }}>
          <Ic size={16} color={PS.primaryLight} />
          <span style={{ fontSize: 12, fontWeight: 700, color: PS.primaryLight }}>
            {typeLabel(project.type)} · {stageLabel(project.stage)}
          </span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 14, wordBreak: "keep-all", paddingRight: 44 }}>
          {project.title}
        </div>

        {/* 진행률 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: PS.sub, fontWeight: 600 }}>전체 진행률</span>
          <span style={{ fontSize: 12.5, color: PS.text, fontWeight: 800 }}>{progress}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: PS.elev, overflow: "hidden" }}>
          <div style={{
            width: `${progress}%`, height: "100%", borderRadius: 999,
            background: `linear-gradient(90deg, ${PS.primary}, ${PS.primaryLight})`,
            transition: "width .3s",
          }} />
        </div>

        {/* 날짜 */}
        <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 12.5, color: PS.sub }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <CalendarDays size={14} /> 촬영 {fmtDate(project.expectedShootDate)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Flag size={14} /> 완성 {fmtDate(project.expectedCompletionDate)}
          </span>
        </div>
      </div>

      {/* 오늘 해야 할 일 */}
      <ProjectTasks projectId={project.id} canEdit={canEdit} />

      {/* 워크스페이스 메뉴 */}
      <div style={{ margin: "18px 0 10px", fontSize: 14.5, fontWeight: 800 }}>워크스페이스</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9 }}>
        {WORKSPACE_MENUS.map(m => {
          const MIc = m.icon;
          return (
            <button key={m.key} onClick={() => openMenu(m)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 7, minHeight: 76, padding: "12px 6px", borderRadius: 14, cursor: "pointer",
                background: PS.surface, border: `1px solid ${PS.border}`,
                color: PS.text, fontFamily: "inherit",
                opacity: m.ready ? 1 : 0.55,
              }}>
              <MIc size={20} color={m.ready ? PS.primaryLight : PS.sub} strokeWidth={1.9} />
              <span style={{ fontSize: 11.5, fontWeight: 700, wordBreak: "keep-all", lineHeight: 1.25 }}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* 메뉴 준비중 토스트 */}
      {menuToast && (
        <div style={{
          position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)",
          background: "rgba(23,26,35,0.97)", border: `1px solid ${PS.border}`,
          color: PS.text, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
          padding: "10px 16px", borderRadius: 999, zIndex: 300,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>{menuToast}</div>
      )}

      {/* 수정 모달 */}
      {showEdit && (
        <ProjectEditModal
          project={project}
          isOwner={isOwner}
          onClose={() => setShowEdit(false)}
          onArchived={() => { setShowEdit(false); onBack(); }}
        />
      )}

      {/* AI 프로덕션 매니저 (플로팅) */}
      <AIManager project={project} canEdit={canEdit} />
    </div>
  );
}
