import { ArrowLeft, CalendarDays, Flag, LayoutGrid } from "lucide-react";
import { PS, typeLabel, typeIcon, stageLabel } from "./constants";

// 프로젝트 대시보드 (Phase 1 — 기본 정보/진행률만. 할일·워크스페이스 메뉴는 Phase 2)
export default function ProjectDashboard({ project, onBack }) {
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
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Ic size={16} color={PS.primaryLight} />
          <span style={{ fontSize: 12, fontWeight: 700, color: PS.primaryLight }}>
            {typeLabel(project.type)} · {stageLabel(project.stage)}
          </span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 14, wordBreak: "keep-all" }}>{project.title}</div>

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

      {/* 워크스페이스 메뉴 — Phase 2 예정 */}
      <div style={{
        marginTop: 14, background: PS.surface, border: `1px dashed ${PS.border}`,
        borderRadius: 16, padding: "26px 16px", textAlign: "center",
      }}>
        <LayoutGrid size={26} color={PS.sub} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>워크스페이스 준비 중</div>
        <div style={{ fontSize: 12.5, color: PS.sub, lineHeight: 1.6 }}>
          할 일 · 시나리오 · 콘티 · 촬영 일정 · 장비 · 예산 메뉴가<br />다음 업데이트에 추가돼요.
        </div>
      </div>
    </div>
  );
}
