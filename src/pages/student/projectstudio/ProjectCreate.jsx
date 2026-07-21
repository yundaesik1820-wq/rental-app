import { useState } from "react";
import { ArrowLeft, Sparkles, FilePlus2, ChevronRight } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { addItem } from "../../../hooks/useFirestore";
import { PS, PROJECT_TYPES, PROJECT_STAGES, newProject } from "./constants";

// 새 프로젝트 생성 화면 — 빈 프로젝트 생성 + AI와 함께 시작(질문 마법사로 이동)
export default function ProjectCreate({ onBack, onCreated, onStartAI }) {
  const { user } = useAuth();

  const [type, setType]   = useState(null);
  const [title, setTitle] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [doneDate, setDoneDate]   = useState("");
  const [stage, setStage] = useState("idea");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  const validate = () => {
    if (!title.trim()) return "프로젝트 제목을 입력해주세요.";
    if (!type) return "프로젝트 유형을 선택해주세요.";
    if (shootDate && doneDate && doneDate < shootDate) return "완성일이 촬영일보다 빠를 수 없어요.";
    return "";
  };

  // AI와 함께 시작 — 기본 정보 검증 후 질문 마법사로
  const startAI = () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr("");
    onStartAI({
      title, type, stage,
      expectedShootDate: shootDate, expectedCompletionDate: doneDate,
    });
  };

  // 빈 프로젝트로 시작
  const createEmpty = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr("");
    setBusy(true);
    try {
      const ref = await addItem("projects", newProject({
        ownerId: user.uid, title, type, stage,
        expectedShootDate: shootDate, expectedCompletionDate: doneDate,
      }));
      onCreated(ref.id);
    } catch (e) {
      console.warn("project create error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", minHeight: 46,
    background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 12,
    color: PS.text, fontSize: 14, padding: "12px 14px", outline: "none",
    fontFamily: "inherit", colorScheme: "dark",
  };
  const labelStyle = { fontSize: 13, fontWeight: 700, color: PS.sub, marginBottom: 7, display: "block" };

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      {/* 뒤로가기 */}
      <button onClick={onBack} disabled={busy}
        style={{
          background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit",
        }}>
        <ArrowLeft size={17} /> 프로젝트 목록
      </button>

      {/* 히어로 */}
      <div style={{ margin: "6px 0 22px" }}>
        <div style={{ fontSize: 21, fontWeight: 900, marginBottom: 6 }}>새 프로젝트를 시작할까요?</div>
        <div style={{ fontSize: 13.5, color: PS.sub }}>아이디어를 작품으로 만드는 첫 단계</div>
      </div>

      {/* 유형 선택 (2열) */}
      <span style={labelStyle}>프로젝트 유형 <b style={{ color: PS.primaryLight }}>*</b></span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {PROJECT_TYPES.map(t => {
          const Ic = t.icon;
          const on = type === t.value;
          return (
            <button key={t.value} onClick={() => setType(t.value)} disabled={busy}
              style={{
                display: "flex", alignItems: "center", gap: 10, minHeight: 54,
                padding: "12px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                background: on ? `${PS.primary}1F` : PS.surface,
                border: `1.5px solid ${on ? PS.primary : PS.border}`,
                boxShadow: on ? `0 0 12px ${PS.primary}40` : "none",
                color: PS.text, fontFamily: "inherit", transition: "border-color .15s, box-shadow .15s",
              }}>
              <Ic size={20} color={on ? PS.primaryLight : PS.sub} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: on ? 800 : 600 }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 기본 정보 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 22 }}>
        <div>
          <span style={labelStyle}>프로젝트 제목 <b style={{ color: PS.primaryLight }}>*</b></span>
          <input style={inputStyle} value={title} maxLength={60} disabled={busy}
            placeholder="예) 완벽한 사과문" onChange={e => setTitle(e.target.value)} />
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
          <span style={labelStyle}>현재 진행 단계</span>
          <div style={{ display: "flex", gap: 5 }}>
            {PROJECT_STAGES.map(s => {
              const on = stage === s.value;
              return (
                <button key={s.value} onClick={() => setStage(s.value)} disabled={busy}
                  style={{
                    flex: 1, minWidth: 0, textAlign: "center",
                    padding: "9px 4px", minHeight: 38, borderRadius: 999, cursor: "pointer",
                    background: on ? PS.primary : PS.surface,
                    border: `1px solid ${on ? PS.primary : PS.border}`,
                    color: on ? "#fff" : PS.sub, fontSize: 9, fontWeight: 700, letterSpacing: "-0.05em",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                  }}>{s.label}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 오류 */}
      {err && (
        <div style={{
          background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
          borderRadius: 12, padding: "11px 14px", fontSize: 13, fontWeight: 600, marginBottom: 14,
        }}>{err}</div>
      )}

      {/* 생성 방법 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* AI와 함께 시작 → 질문 마법사 */}
        <button onClick={startAI} disabled={busy}
          style={{
            display: "flex", alignItems: "center", gap: 12, minHeight: 62, textAlign: "left",
            padding: "14px 16px", borderRadius: 16, cursor: "pointer",
            background: `${PS.primary}14`, border: `1px solid ${PS.primary}44`,
            color: PS.text, fontFamily: "inherit",
          }}>
          <Sparkles size={22} color={PS.primaryLight} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>AI와 함께 시작하기</div>
            <div style={{ fontSize: 12, color: PS.sub, marginTop: 2 }}>질문에 답하면 설명·할 일·예산·팀 초안을 만들어줘요</div>
          </div>
          <ChevronRight size={17} color={PS.primaryLight} />
        </button>

        {/* 빈 프로젝트 */}
        <button onClick={createEmpty} disabled={busy}
          style={{
            display: "flex", alignItems: "center", gap: 12, minHeight: 62, textAlign: "left",
            padding: "14px 16px", borderRadius: 16, cursor: "pointer",
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", fontFamily: "inherit",
            boxShadow: `0 4px 18px ${PS.primary}55`, opacity: busy ? 0.7 : 1,
          }}>
          <FilePlus2 size={22} color="#fff" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>{busy ? "저장 중..." : "빈 프로젝트로 시작하기"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>기본 정보만 저장하고 바로 시작해요</div>
          </div>
          <ChevronRight size={17} color="rgba(255,255,255,0.8)" />
        </button>
      </div>
    </div>
  );
}
