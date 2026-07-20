import { useState } from "react";
import { ArrowLeft, Sparkles, ChevronRight, Check } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { addItem } from "../../../hooks/useFirestore";
import { PS, PROJECT_TYPES, newProject, newBudgetItem, newCrewMember } from "./constants";
import { generateProjectDraft } from "./aiService";

// 단계형 질문 (요청서 3번)
const QUESTIONS = [
  { key: "mood",     q: "어떤 분위기의 작품인가요?",        ph: "예) 잔잔하고 쓸쓸한 청춘물", multiline: false },
  { key: "story",    q: "어떤 이야기를 만들고 싶나요?",     ph: "예) 밤샘 작업하는 영상학도의 하루", multiline: true },
  { key: "runtime",  q: "예상 러닝타임은 몇 분인가요?",     ph: "예) 10", suffix: "분", numeric: true },
  { key: "crewSize", q: "예상 촬영 인원은 몇 명인가요?",    ph: "예) 4", suffix: "명", numeric: true },
  { key: "budget",   q: "사용할 수 있는 예산은 어느 정도인가요?", ph: "예) 300000", suffix: "원", numeric: true },
  { key: "priority", q: "가장 먼저 준비해야 하는 것은?",    ph: "예) 촬영 장소 섭외", multiline: false },
];

// AI 프로젝트 생성 플로우 — 질문 6개 → 규칙 기반 초안 → 프로젝트+할일+예산+팀원 생성
export default function ProjectAICreate({ basic, onBack, onCreated }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cur = QUESTIONS[step];
  const val = answers[cur.key] || "";
  const isLast = step === QUESTIONS.length - 1;
  const typeLabel = PROJECT_TYPES.find(t => t.value === basic.type)?.label || "";

  const setVal = (v) => setAnswers(a => ({ ...a, [cur.key]: cur.numeric ? v.replace(/[^0-9]/g, "") : v }));

  const next = () => { if (step < QUESTIONS.length - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  // 완료 → 초안 생성 후 저장
  const finish = async () => {
    setErr("");
    setBusy(true);
    try {
      const draft = generateProjectDraft(answers);
      // 1) 프로젝트
      const ref = await addItem("projects", {
        ...newProject({
          ownerId: user.uid, title: basic.title, type: basic.type,
          stage: draft.stage,
          expectedShootDate: basic.expectedShootDate, expectedCompletionDate: basic.expectedCompletionDate,
        }),
        description: draft.description,
        budgetLimit: draft.meta.budgetNum || null,
      });
      const pid = ref.id;
      // 2) 기본 할 일
      await Promise.all(draft.tasks.map(title =>
        addItem("projectTasks", {
          projectId: pid, ownerId: user.uid, title,
          description: "", status: "todo", priority: "normal", dueDate: null,
          relatedType: null, relatedId: null,
        })
      ));
      // 3) 예산 카테고리 (빈 플레이스홀더 항목)
      await Promise.all(draft.budgetCategories.map(category =>
        addItem("budgetItems", {
          ...newBudgetItem({ projectId: pid, ownerId: user.uid, category }),
          title: `${category} 비용`, plannedAmount: 0,
        })
      ));
      // 4) 기본 팀 포지션 (모집 중 상태로)
      await Promise.all(draft.crewRoles.map(role =>
        addItem("crewMembers", {
          ...newCrewMember({ projectId: pid, ownerId: user.uid, role }),
          status: "recruiting", projectTitle: basic.title,
        })
      ));
      onCreated(pid);
    } catch (e) {
      console.warn("AI create error:", e);
      setErr("생성에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 12,
    color: PS.text, fontSize: 15, padding: "13px 15px", outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={step === 0 ? onBack : prev} disabled={busy}
        style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit" }}>
        <ArrowLeft size={17} /> {step === 0 ? "생성 방법" : "이전"}
      </button>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "6px 0 4px" }}>
        <Sparkles size={18} color={PS.primaryLight} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: PS.primaryLight }}>
          AI와 함께 · {typeLabel} · {basic.title}
        </span>
      </div>

      {/* 진행률 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 20px" }}>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: PS.elev, overflow: "hidden" }}>
          <div style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%`, height: "100%",
            background: `linear-gradient(90deg, ${PS.primary}, ${PS.primaryLight})`, transition: "width .25s" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: PS.sub, flexShrink: 0 }}>
          질문 {step + 1} / {QUESTIONS.length}
        </span>
      </div>

      {/* 질문 */}
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16, lineHeight: 1.4, wordBreak: "keep-all" }}>
        {cur.q}
      </div>

      {cur.multiline ? (
        <textarea value={val} disabled={busy} rows={4} autoFocus maxLength={500}
          placeholder={cur.ph} onChange={e => setVal(e.target.value)}
          style={{ ...inputStyle, resize: "vertical" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input value={val} disabled={busy} autoFocus maxLength={cur.numeric ? 12 : 60}
            inputMode={cur.numeric ? "numeric" : "text"}
            placeholder={cur.ph} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !isLast && val.trim()) next(); }}
            style={inputStyle} />
          {cur.suffix && <span style={{ fontSize: 15, fontWeight: 700, color: PS.sub, flexShrink: 0 }}>{cur.suffix}</span>}
        </div>
      )}

      {err && (
        <div style={{ background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
          borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 14 }}>{err}</div>
      )}

      {/* 버튼 */}
      <div style={{ display: "flex", gap: 9, marginTop: 22 }}>
        <button onClick={next} disabled={busy || isLast}
          style={{ minHeight: 50, padding: "0 18px", borderRadius: 12,
            background: "transparent", border: `1px solid ${PS.border}`, color: PS.sub,
            fontSize: 13.5, fontWeight: 700, cursor: isLast ? "default" : "pointer",
            fontFamily: "inherit", opacity: isLast ? 0.4 : 1, whiteSpace: "nowrap" }}>
          건너뛰기
        </button>
        {isLast ? (
          <button onClick={finish} disabled={busy}
            style={{ flex: 1, minHeight: 50, borderRadius: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", color: "#fff", fontSize: 14.5, fontWeight: 800, fontFamily: "inherit",
              boxShadow: `0 4px 18px ${PS.primary}55`, opacity: busy ? 0.7 : 1 }}>
            {busy ? "프로젝트 만드는 중..." : <><Check size={17} /> 프로젝트 생성</>}
          </button>
        ) : (
          <button onClick={next} disabled={busy}
            style={{ flex: 1, minHeight: 50, borderRadius: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", color: "#fff", fontSize: 14.5, fontWeight: 800, fontFamily: "inherit" }}>
            다음 <ChevronRight size={17} />
          </button>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: PS.sub, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        답변을 바탕으로 프로젝트 설명·할 일·예산·팀 포지션 초안을 만들어드려요.<br />
        모두 나중에 자유롭게 수정할 수 있어요.
      </div>
    </div>
  );
}
