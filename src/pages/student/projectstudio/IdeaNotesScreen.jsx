import { useState } from "react";
import { ArrowLeft, Plus, X, Lightbulb, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import { PS, newIdeaNote, canEditProject } from "./constants";

// ===== 노트 추가/수정 모달 (backdrop 닫기 없음) =====
function NoteFormModal({ note, projectId, uid, onClose }) {
  const isEdit = !!note;
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!content.trim()) { setErr("내용을 입력해주세요."); return; }
    setErr("");
    setBusy(true);
    const data = { title: title.trim(), content: content.trim() };
    try {
      if (isEdit) await updateItem("ideaNotes", note.id, data);
      else await addItem("ideaNotes", { ...newIdeaNote({ projectId, ownerId: uid }), ...data });
      onClose();
    } catch (e) {
      console.warn("idea note save error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
    color: PS.text, fontSize: 13.5, padding: "10px 12px", outline: "none", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "노트 수정" : "새 노트"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>제목 (선택)</span>
            <input style={{ ...inputStyle, minHeight: 42 }} value={title} maxLength={60} disabled={busy}
              placeholder="예) 오프닝 아이디어, 톤 레퍼런스" onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <span style={labelStyle}>내용 <b style={{ color: PS.primaryLight }}>*</b></span>
            <textarea value={content} maxLength={4000} disabled={busy} rows={8} autoFocus
              placeholder="떠오른 아이디어, 참고 링크, 컨셉, 메모 등 자유롭게 적어보세요"
              onChange={e => setContent(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.65 }} />
          </div>
        </div>

        {err && (
          <div style={{ background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
            borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 14 }}>{err}</div>
        )}

        <button onClick={save} disabled={busy}
          style={{ width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer", marginTop: 18,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
            opacity: busy ? 0.7 : 1 }}>
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "노트 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 기획 노트 화면 =====
export default function IdeaNotesScreen({ project, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const canEdit = canEditProject(project, uid);

  const { data: notes, loading } = useCollection(
    "ideaNotes", null,
    uid ? { where: [["projectId", "==", project.id]] } : { enabled: false }
  );

  const [formNote, setFormNote] = useState(null); // null | "new" | note

  const sorted = [...notes].sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));

  const removeNote = async (n) => {
    if (!window.confirm("이 노트를 삭제할까요?")) return;
    try { await deleteItem("ideaNotes", n.id); }
    catch (e) { console.warn("idea note delete error:", e); alert("삭제에 실패했어요."); }
  };

  return (
    <div style={{ padding: "4px 2px 24px", color: PS.text }}>
      <button onClick={onBack}
        style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
          padding: "8px 4px", minHeight: 44, fontFamily: "inherit" }}>
        <ArrowLeft size={17} /> {project.title}
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "6px 0 14px" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900 }}>기획 노트</div>
          <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
            {notes.length > 0 ? `노트 ${notes.length}개` : "아이디어·레퍼런스·컨셉을 자유롭게 적어보세요"}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setFormNote("new")}
            style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 42, flexShrink: 0,
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", borderRadius: 11, color: "#fff", fontSize: 12.5, fontWeight: 800,
              padding: "9px 13px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <Plus size={15} /> 새 노트
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <Lightbulb size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 노트가 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>작품 아이디어와 참고 자료를 메모해두세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {sorted.map(n => (
            <div key={n.id}
              style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 15, padding: "14px 15px" }}>
              {n.title && (
                <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 6, wordBreak: "keep-all" }}>{n.title}</div>
              )}
              <div style={{ fontSize: 13, color: PS.text, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {n.content}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
                  <button onClick={() => setFormNote(n)}
                    style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                      background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
                      color: PS.text, fontSize: 11.5, fontWeight: 700, padding: "7px 11px",
                      cursor: "pointer", fontFamily: "inherit" }}>
                    <Pencil size={12} /> 수정
                  </button>
                  <button onClick={() => removeNote(n)}
                    style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                      background: PS.elev, border: `1px solid ${PS.danger}44`, borderRadius: 10,
                      color: PS.danger, fontSize: 11.5, fontWeight: 700, padding: "7px 11px",
                      cursor: "pointer", fontFamily: "inherit" }}>
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formNote && (
        <NoteFormModal note={formNote === "new" ? null : formNote}
          projectId={project.id} uid={uid} onClose={() => setFormNote(null)} />
      )}
    </div>
  );
}
