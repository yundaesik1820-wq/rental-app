import { useState } from "react";
import { X, Archive } from "lucide-react";
import { updateItem } from "../../../hooks/useFirestore";
import { PS, PROJECT_TYPES, PROJECT_STAGES } from "./constants";

// 프로젝트 수정 모달 — 제목/유형/날짜/단계/진행률 + 보관(soft delete)
export default function ProjectEditModal({ project, isOwner = true, onClose, onArchived }) {
  const [title, setTitle] = useState(project.title || "");
  const [type, setType]   = useState(project.type);
  const [stage, setStage] = useState(project.stage || "idea");
  const [shootDate, setShootDate] = useState(project.expectedShootDate || "");
  const [doneDate, setDoneDate]   = useState(project.expectedCompletionDate || "");
  const [progress, setProgress]   = useState(Math.max(0, Math.min(100, project.progress || 0)));
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) { setErr("프로젝트 제목을 입력해주세요."); return; }
    if (shootDate && doneDate && doneDate < shootDate) { setErr("완성일이 촬영일보다 빠를 수 없어요."); return; }
    setErr("");
    setBusy(true);
    try {
      await updateItem("projects", project.id, {
        title: title.trim(), type, stage,
        expectedShootDate: shootDate || null,
        expectedCompletionDate: doneDate || null,
        progress: Number(progress),
      });
      onClose();
    } catch (e) {
      console.warn("project update error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!window.confirm(`"${project.title}" 프로젝트를 보관할까요?\n보관하면 목록에서 사라져요.`)) return;
    setBusy(true);
    try {
      await updateItem("projects", project.id, { status: "archived" });
      onArchived();
    } catch (e) {
      console.warn("project archive error:", e);
      setErr("보관에 실패했어요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", minHeight: 44,
    background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 11,
    color: PS.text, fontSize: 14, padding: "11px 13px", outline: "none",
    fontFamily: "inherit", colorScheme: "dark",
  };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" };

  return (
    // 입력 모달 — backdrop 닫기 없음 (X로만 닫기)
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}>
      <div
        style={{
          width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>프로젝트 수정</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>제목</span>
            <input style={inputStyle} value={title} maxLength={60} disabled={busy}
              onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <span style={labelStyle}>유형</span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {PROJECT_TYPES.map(t => {
                const on = type === t.value;
                return (
                  <button key={t.value} onClick={() => setType(t.value)} disabled={busy}
                    style={{
                      padding: "8px 12px", minHeight: 38, borderRadius: 999, cursor: "pointer",
                      background: on ? `${PS.primary}1F` : PS.elev,
                      border: `1px solid ${on ? PS.primary : PS.border}`,
                      color: on ? PS.primaryLight : PS.sub, fontSize: 12.5, fontWeight: 700,
                      fontFamily: "inherit", whiteSpace: "nowrap",
                    }}>{t.label}</button>
                );
              })}
            </div>
          </div>

          <div>
            <span style={labelStyle}>진행 단계</span>
            <div style={{ display: "flex", gap: 5 }}>
              {PROJECT_STAGES.map(s => {
                const on = stage === s.value;
                return (
                  <button key={s.value} onClick={() => setStage(s.value)} disabled={busy}
                    style={{
                      flex: 1, minWidth: 0, textAlign: "center",
                      padding: "8px 4px", minHeight: 38, borderRadius: 999, cursor: "pointer",
                      background: on ? PS.primary : PS.elev,
                      border: `1px solid ${on ? PS.primary : PS.border}`,
                      color: on ? "#fff" : PS.sub, fontSize: 9, fontWeight: 700, letterSpacing: "-0.05em",
                      fontFamily: "inherit", whiteSpace: "nowrap",
                    }}>{s.label}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>예상 촬영일</span>
              <input type="date" style={inputStyle} value={shootDate} disabled={busy}
                onChange={e => setShootDate(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>예상 완성일</span>
              <input type="date" style={inputStyle} value={doneDate} disabled={busy}
                onChange={e => setDoneDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>전체 진행률</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: PS.primaryLight }}>{progress}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={progress} disabled={busy}
              onChange={e => setProgress(e.target.value)}
              style={{ width: "100%", accentColor: PS.primary, minHeight: 30 }} />
          </div>
        </div>

        {err && (
          <div style={{
            background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
            borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 14,
          }}>{err}</div>
        )}

        <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
          {isOwner && (
            <button onClick={archive} disabled={busy}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                minHeight: 48, padding: "0 16px", borderRadius: 12, cursor: "pointer",
                background: "transparent", border: `1px solid ${PS.danger}55`, color: PS.danger,
                fontSize: 13, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
              }}>
              <Archive size={15} /> 보관
            </button>
          )}
          <button onClick={save} disabled={busy}
            style={{
              flex: 1, minHeight: 48, borderRadius: 12, cursor: "pointer",
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
