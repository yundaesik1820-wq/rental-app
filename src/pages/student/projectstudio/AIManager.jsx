import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Check } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem } from "../../../hooks/useFirestore";
import { PS, typeLabel, stageLabel, fmtWon } from "./constants";
import { answerProjectQuestion } from "./aiService";

// 프로젝트 데이터를 Claude에 보낼 압축 요약으로 (토큰 절약)
function buildContext(ctx) {
  const { project, scenes, breakdowns, days, tasks, budget, crew } = ctx;
  const bdOf = (sid) => breakdowns.find(b => b.sceneId === sid);
  const L = [];
  L.push(`프로젝트: ${project.title} (${typeLabel(project.type)}) · 단계 ${stageLabel(project.stage)} · 진행 ${project.progress || 0}%`);
  if (project.expectedShootDate) L.push(`예상 촬영일 ${project.expectedShootDate}, 완성일 ${project.expectedCompletionDate || "미정"}`);
  if (project.budgetLimit != null) L.push(`총 예산 ${fmtWon(project.budgetLimit)}`);

  const sortedScenes = [...scenes].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  L.push(`\n[장면 ${scenes.length}개]`);
  sortedScenes.slice(0, 30).forEach(s => {
    const bd = bdOf(s.id);
    const min = bd?.estimatedMinutes ?? s.estimatedMinutes;
    L.push(`S#${s.sceneNumber} ${s.heading || s.locationName || ""} · 장소 ${s.locationName || "미정"} · ${s.timeOfDay || ""} · 상태 ${s.status || "draft"}${min ? ` · ${min}분` : ""}${bd ? " · 브레이크다운O" : " · 브레이크다운X"}`);
  });

  const allProps = [...new Set(breakdowns.flatMap(b => b.propNames || []))];
  const allEquip = [...new Set(breakdowns.flatMap(b => b.equipmentNames || []))];
  if (allProps.length) L.push(`\n소품: ${allProps.join(", ")}`);
  if (allEquip.length) L.push(`장비: ${allEquip.join(", ")}`);

  if (days.length) {
    L.push(`\n[촬영일 ${days.length}개]`);
    [...days].sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach(d => {
      const names = (d.sceneIds || []).map(id => scenes.find(s => s.id === id)?.sceneNumber).filter(Boolean).map(n => `S#${n}`);
      L.push(`${d.date}${d.title ? ` (${d.title})` : ""}${d.callTime ? ` ${d.callTime}~${d.wrapTime || "?"}` : ""} · 장면 ${names.join(",") || "없음"}`);
    });
  }

  const doneTasks = tasks.filter(t => t.status === "done").length;
  L.push(`\n[할 일] ${doneTasks}/${tasks.length} 완료`);
  tasks.filter(t => t.status !== "done").slice(0, 15).forEach(t => L.push(`- ${t.title}`));

  if (budget.length) {
    const planned = budget.reduce((s, b) => s + (b.plannedAmount || 0), 0);
    const actual = budget.reduce((s, b) => s + (b.actualAmount ?? b.plannedAmount ?? 0), 0);
    L.push(`\n[예산] 예정 ${fmtWon(planned)} · 집행기준 ${fmtWon(actual)}${project.budgetLimit != null ? ` · 남음 ${fmtWon(project.budgetLimit - actual)}` : ""}`);
    budget.slice(0, 15).forEach(b => L.push(`- ${b.category} ${b.title}: ${fmtWon(b.plannedAmount)}${b.status === "paid" ? " (지출)" : ""}`));
  }

  if (crew.length) {
    L.push(`\n[팀원 ${crew.length}명]`);
    crew.slice(0, 20).forEach(c => L.push(`- ${c.role}: ${c.name || "미정"} (${c.status})`));
  }
  return L.join("\n");
}

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
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);
  const bump = useRef(0);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open, thinking]);

  const ctx = { project, scenes, breakdowns, days, tasks, budget, crew };

  const ask = async (text) => {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", text: q }]);
    setThinking(true);
    try {
      // 실제 Claude API 호출 (Cloud Function)
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const fn = httpsCallable(getFunctions(undefined, "us-central1"), "projectStudioAssistant");
      const { data } = await fn({ context: buildContext(ctx), message: q });
      const id = `m${bump.current++}`;
      const suggested = Array.isArray(data.suggestedTasks) ? data.suggestedTasks.filter(Boolean) : [];
      // 이미 있는 할 일은 제안에서 제외
      const existing = new Set(tasks.map(t => t.title));
      const fresh = suggested.filter(t => !existing.has(t));
      const proposal = fresh.length ? { type: "addTasks", tasks: fresh, label: `할 일 ${fresh.length}개 추가` } : null;
      setMsgs(m => [...m, { role: "ai", text: data.answer || "(응답 없음)", proposal, id }]);
    } catch (e) {
      console.warn("AI assistant error, 규칙기반 폴백:", e);
      // API 실패 시 규칙 기반으로 폴백 (오프라인/함수 미배포에도 동작)
      const res = answerProjectQuestion(ctx, q);
      const id = `m${bump.current++}`;
      setMsgs(m => [...m, { role: "ai", text: res.text, proposal: res.proposal, id }]);
    }
    setThinking(false);
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
                <div style={{ fontSize: 11, color: PS.sub }}>Claude AI · 프로젝트 데이터를 읽어요</div>
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
              {thinking && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 14px", borderRadius: 15,
                    background: PS.surface, border: `1px solid ${PS.border}`, color: PS.sub, fontSize: 13, fontWeight: 600 }}>
                    <Sparkles size={14} color={PS.primaryLight} /> 생각 중...
                  </div>
                </div>
              )}
            </div>

            {/* 빠른 질문 */}
            <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "8px 14px", flexShrink: 0,
              WebkitOverflowScrolling: "touch", borderTop: `1px solid ${PS.border}` }}>
              {QUICK.map(q => (
                <button key={q} onClick={() => ask(q)} disabled={thinking}
                  style={{ flexShrink: 0, minHeight: 34, background: PS.surface, border: `1px solid ${PS.border}`,
                    borderRadius: 999, color: PS.sub, fontSize: 11.5, fontWeight: 700, padding: "6px 12px",
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: thinking ? 0.5 : 1 }}>{q}</button>
              ))}
            </div>

            {/* 입력 */}
            <div style={{ display: "flex", gap: 8, padding: "10px 14px 18px", flexShrink: 0 }}>
              <input value={input} placeholder="질문을 입력해보세요" disabled={thinking}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") ask(); }}
                style={{ flex: 1, minWidth: 0, minHeight: 46, boxSizing: "border-box",
                  background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 13,
                  color: PS.text, fontSize: 14, padding: "11px 14px", outline: "none", fontFamily: "inherit" }} />
              <button onClick={() => ask()} disabled={!input.trim() || thinking}
                style={{ width: 46, minHeight: 46, flexShrink: 0, borderRadius: 13, cursor: "pointer",
                  background: (input.trim() && !thinking) ? PS.primary : PS.surface,
                  border: `1px solid ${(input.trim() && !thinking) ? PS.primary : PS.border}`,
                  color: (input.trim() && !thinking) ? "#fff" : PS.sub,
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
