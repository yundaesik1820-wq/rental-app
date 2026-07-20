import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Check } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem } from "../../../hooks/useFirestore";
import { PS } from "./constants";
import { answerProjectQuestion } from "./aiService";

const QUICK = [
  "촬영 준비 상태 알려줘",
  "예산 얼마나 남았어?",
  "필요한 소품 정리해줘",
  "촬영 순서 추천해줘",
  "뭐부터 해야 해?",
];

// AI 프로덕션 매니저 — 플로팅 버튼 + 바텀시트 채팅 (요청서 15번)
// 프로젝트 데이터를 읽어 규칙 기반 답변. 변경은 반드시 사용자 확인 후 적용(AI가 직접 수정 안 함).
export default function AIManager({ project, canEdit }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [open, setOpen] = useState(false);

  const opts = () => uid ? { where: [["projectId", "==", project.id]] } : { enabled: false };
  const { data: scenes }     = useCollection("scenes", null, opts());
  const { data: breakdowns } = useCollection("sceneBreakdowns", null, opts());
  const { data: days }       = useCollection("shootDays", null, opts());
  const { data: tasks }      = useCollection("projectTasks", null, opts());
  const { data: budget }     = useCollection("budgetItems", null, opts());
  const { data: crew }       = useCollection("crewMembers", null, opts());

  const [msgs, setMsgs] = useState([
    { role: "ai", text: `안녕하세요! '${project.title}' 프로덕션 매니저예요.\n촬영 준비, 예산, 소품, 일정 등 뭐든 물어보세요 🎬` },
  ]);
  const [input, setInput] = useState("");
  const [applyingId, setApplyingId] = useState(null);
  const scrollRef = useRef(null);
  const bump = useRef(0);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

  const ctx = { project, scenes, breakdowns, days, tasks, budget, crew };

  const ask = (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    const res = answerProjectQuestion(ctx, q);
    const id = `m${bump.current++}`;
    setMsgs(m => [...m, { role: "user", text: q }, { role: "ai", text: res.text, proposal: res.proposal, id }]);
  };

  // 변경 제안 적용 (사용자가 눌러야만 실행)
  const applyProposal = async (msg) => {
    if (!canEdit) return;
    setApplyingId(msg.id);
    try {
      if (msg.proposal.type === "addTasks") {
        const existing = new Set(tasks.map(t => t.title));
        await Promise.all(msg.proposal.tasks.filter(t => !existing.has(t)).map(title =>
          addItem("projectTasks", {
            projectId: project.id, ownerId: uid, title,
            description: "", status: "todo", priority: "normal", dueDate: null,
            relatedType: null, relatedId: null,
          })
        ));
      }
      setMsgs(m => m.map(x => x.id === msg.id ? { ...x, applied: true } : x));
    } catch (e) {
      console.warn("proposal apply error:", e);
      setMsgs(m => [...m, { role: "ai", text: "적용에 실패했어요. 잠시 후 다시 시도해주세요." }]);
    }
    setApplyingId(null);
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!open && (
        <button onClick={() => setOpen(true)}
          style={{
            position: "fixed", right: 16, bottom: 84, zIndex: 260,
            width: 56, height: 56, borderRadius: "50%", cursor: "pointer",
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 6px 22px ${PS.primary}70`,
          }}>
          <Sparkles size={24} />
        </button>
      )}

      {/* 채팅 시트 */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9600, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 560, height: "82vh", display: "flex", flexDirection: "column",
              background: PS.bg, borderRadius: "20px 20px 0 0",
              border: `1px solid ${PS.border}`, borderBottom: "none",
              color: PS.text, boxSizing: "border-box", overflow: "hidden" }}>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px",
              borderBottom: `1px solid ${PS.border}`, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={17} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 900 }}>AI 프로덕션 매니저</div>
                <div style={{ fontSize: 11, color: PS.sub }}>규칙 기반 · 프로젝트 데이터를 읽어요</div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
                <X size={19} />
              </button>
            </div>

            {/* 메시지 */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              {msgs.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "82%", padding: "11px 14px", borderRadius: 15, fontSize: 13.5, lineHeight: 1.6,
                    whiteSpace: "pre-wrap", wordBreak: "keep-all",
                    background: msg.role === "user" ? PS.primary : PS.surface,
                    border: msg.role === "user" ? "none" : `1px solid ${PS.border}`,
                    color: msg.role === "user" ? "#fff" : PS.text,
                    borderBottomRightRadius: msg.role === "user" ? 4 : 15,
                    borderBottomLeftRadius: msg.role === "user" ? 15 : 4,
                  }}>
                    {msg.text}
                    {/* 변경 제안 */}
                    {msg.proposal && canEdit && !msg.applied && (
                      <button onClick={() => applyProposal(msg)} disabled={applyingId === msg.id}
                        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, minHeight: 40,
                          width: "100%", justifyContent: "center",
                          background: `${PS.primary}22`, border: `1px solid ${PS.primary}66`, borderRadius: 10,
                          color: PS.primaryLight, fontSize: 12.5, fontWeight: 800, padding: "8px 12px",
                          cursor: "pointer", fontFamily: "inherit", opacity: applyingId === msg.id ? 0.6 : 1 }}>
                        <Check size={14} /> {applyingId === msg.id ? "적용 중..." : `변경 적용 · ${msg.proposal.label}`}
                      </button>
                    )}
                    {msg.applied && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8,
                        fontSize: 12, fontWeight: 800, color: PS.success }}>
                        <Check size={13} /> 적용됐어요
                      </div>
                    )}
                    {msg.proposal && !canEdit && (
                      <div style={{ fontSize: 11.5, color: PS.sub, marginTop: 8 }}>
                        (참여 팀원은 제안을 적용할 수 없어요)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 빠른 질문 */}
            <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "8px 14px", flexShrink: 0,
              WebkitOverflowScrolling: "touch", borderTop: `1px solid ${PS.border}` }}>
              {QUICK.map(q => (
                <button key={q} onClick={() => ask(q)}
                  style={{ flexShrink: 0, minHeight: 34, background: PS.surface, border: `1px solid ${PS.border}`,
                    borderRadius: 999, color: PS.sub, fontSize: 11.5, fontWeight: 700, padding: "6px 12px",
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{q}</button>
              ))}
            </div>

            {/* 입력 */}
            <div style={{ display: "flex", gap: 8, padding: "10px 14px 18px", flexShrink: 0 }}>
              <input value={input} placeholder="질문을 입력해보세요"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") ask(); }}
                style={{ flex: 1, minWidth: 0, minHeight: 46, boxSizing: "border-box",
                  background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 13,
                  color: PS.text, fontSize: 14, padding: "11px 14px", outline: "none", fontFamily: "inherit" }} />
              <button onClick={() => ask()} disabled={!input.trim()}
                style={{ width: 46, minHeight: 46, flexShrink: 0, borderRadius: 13, cursor: "pointer",
                  background: input.trim() ? PS.primary : PS.surface,
                  border: `1px solid ${input.trim() ? PS.primary : PS.border}`,
                  color: input.trim() ? "#fff" : PS.sub,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
