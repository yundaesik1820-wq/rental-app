import { useState } from "react";
import { Plus, Check, X, ListTodo } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import { PS } from "./constants";

// 오늘 해야 할 일 — 체크 즉시 Firestore 저장 (요청서 14번 ProjectTask의 Phase 2 축소판)
// status: "todo" | "done" ("doing"·priority·dueDate 필드는 모델에 있고 UI는 추후)
export default function ProjectTasks({ projectId }) {
  const { user } = useAuth();
  const uid = user?.uid;

  // 규칙이 ownerId 검사를 하므로 쿼리에도 ownerId 조건 필수 (equality 2개 — 복합 인덱스 불필요)
  const { data: tasks, loading } = useCollection(
    "projectTasks", null,
    uid ? { where: [["projectId", "==", projectId], ["ownerId", "==", uid]] } : { enabled: false }
  );

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState(null); // 체크 저장 중인 항목

  const sorted = [...tasks].sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1; // 미완료 먼저
    return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  });

  const add = async () => {
    const title = input.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await addItem("projectTasks", {
        projectId, ownerId: uid, title,
        description: "", status: "todo", priority: "normal", dueDate: null,
        relatedType: null, relatedId: null,
      });
      setInput("");
    } catch (e) {
      console.warn("task add error:", e);
      alert("할 일 추가에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
    setBusy(false);
  };

  const toggle = async (t) => {
    if (savingId) return;
    setSavingId(t.id);
    try {
      await updateItem("projectTasks", t.id, { status: t.status === "done" ? "todo" : "done" });
    } catch (e) {
      console.warn("task toggle error:", e);
      alert("저장에 실패했어요.");
    }
    setSavingId(null);
  };

  const remove = async (t) => {
    try {
      await deleteItem("projectTasks", t.id);
    } catch (e) {
      console.warn("task delete error:", e);
      alert("삭제에 실패했어요.");
    }
  };

  const doneCount = tasks.filter(t => t.status === "done").length;

  return (
    <div style={{ marginTop: 14, background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <ListTodo size={16} color={PS.primaryLight} />
        <span style={{ fontSize: 14.5, fontWeight: 800 }}>오늘 해야 할 일</span>
        {tasks.length > 0 && (
          <span style={{ fontSize: 11.5, color: PS.sub, fontWeight: 700, marginLeft: "auto" }}>
            {doneCount}/{tasks.length} 완료
          </span>
        )}
      </div>

      {/* 추가 입력 */}
      <div style={{ display: "flex", gap: 8, marginBottom: tasks.length ? 12 : 0 }}>
        <input value={input} maxLength={80} disabled={busy}
          placeholder="할 일 추가 (예: 시놉시스 초안 작성)"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          style={{
            flex: 1, minWidth: 0, minHeight: 44, boxSizing: "border-box",
            background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 11,
            color: PS.text, fontSize: 13.5, padding: "10px 13px", outline: "none", fontFamily: "inherit",
          }} />
        <button onClick={add} disabled={busy || !input.trim()}
          style={{
            width: 44, minHeight: 44, flexShrink: 0, borderRadius: 11, cursor: "pointer",
            background: input.trim() ? PS.primary : PS.elev,
            border: `1px solid ${input.trim() ? PS.primary : PS.border}`,
            color: input.trim() ? "#fff" : PS.sub,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: busy ? 0.6 : 1,
          }}>
          <Plus size={19} />
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ padding: "14px 0 4px", fontSize: 12.5, color: PS.sub, textAlign: "center" }}>불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: "14px 0 4px", fontSize: 12.5, color: PS.sub, textAlign: "center" }}>
          아직 할 일이 없어요. 첫 할 일을 추가해보세요!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {sorted.map(t => {
            const done = t.status === "done";
            return (
              <div key={t.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, minHeight: 46,
                  background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 11,
                  padding: "9px 12px", opacity: savingId === t.id ? 0.55 : 1,
                }}>
                <button onClick={() => toggle(t)}
                  style={{
                    width: 22, height: 22, flexShrink: 0, borderRadius: 7, cursor: "pointer", padding: 0,
                    background: done ? PS.success : "transparent",
                    border: `1.5px solid ${done ? PS.success : PS.sub}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {done && <Check size={14} color="#08090D" strokeWidth={3} />}
                </button>
                <span onClick={() => toggle(t)}
                  style={{
                    flex: 1, fontSize: 13.5, cursor: "pointer", wordBreak: "keep-all",
                    color: done ? PS.sub : PS.text,
                    textDecoration: done ? "line-through" : "none", fontWeight: done ? 500 : 600,
                  }}>{t.title}</span>
                <button onClick={() => remove(t)}
                  style={{
                    background: "none", border: "none", color: PS.sub, cursor: "pointer",
                    padding: 6, display: "flex", flexShrink: 0,
                  }}>
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
