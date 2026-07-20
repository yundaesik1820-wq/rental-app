import { useState } from "react";
import { ArrowLeft, Plus, X, Users, Pencil, Trash2, Phone } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import { PS, CAST_STATUS, castStatus, newCastMember, canEditProject } from "./constants";
import SceneChecklist from "./SceneChecklist";

// ===== 배역 추가/수정 모달 (backdrop 닫기 없음) =====
function CastFormModal({ member, scenes, projectId, uid, onClose }) {
  const isEdit = !!member;
  const [character, setCharacter] = useState(member?.character || "");
  const [actorName, setActorName] = useState(member?.actorName || "");
  const [status, setStatus] = useState(member?.status || "candidate");
  const [contact, setContact] = useState(member?.contact || "");
  const [sceneIds, setSceneIds] = useState(member?.sceneIds || []);
  const [notes, setNotes] = useState(member?.notes || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!character.trim()) { setErr("배역 이름을 입력해주세요."); return; }
    if (status !== "candidate" && !actorName.trim()) { setErr("배우 이름을 입력해주세요. (후보면 비워도 돼요)"); return; }
    setErr("");
    setBusy(true);
    const data = {
      character: character.trim(), actorName: actorName.trim(), status,
      contact: contact.trim(), sceneIds, notes: notes.trim(),
    };
    try {
      if (isEdit) await updateItem("castMembers", member.id, data);
      else await addItem("castMembers", { ...newCastMember({ projectId, ownerId: uid }), ...data });
      onClose();
    } catch (e) {
      console.warn("cast save error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", minHeight: 42,
    background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
    color: PS.text, fontSize: 13.5, padding: "9px 12px", outline: "none", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" };
  const chip = (on) => ({
    padding: "7px 11px", minHeight: 34, borderRadius: 999, cursor: "pointer",
    background: on ? PS.primary : PS.elev, border: `1px solid ${on ? PS.primary : PS.border}`,
    color: on ? "#fff" : PS.sub, fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
  });

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
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "배역 수정" : "배역 추가"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>배역 이름 <b style={{ color: PS.primaryLight }}>*</b></span>
              <input style={inputStyle} value={character} maxLength={30} disabled={busy}
                placeholder="예) 현우" onChange={e => setCharacter(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>배우 이름</span>
              <input style={inputStyle} value={actorName} maxLength={30} disabled={busy}
                placeholder="캐스팅되면 입력" onChange={e => setActorName(e.target.value)} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>상태</span>
            <div style={{ display: "flex", gap: 6 }}>
              {CAST_STATUS.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value)} disabled={busy}
                  style={{ ...chip(status === s.value), flex: 1 }}>{s.label}</button>
              ))}
            </div>
          </div>

          <div>
            <span style={labelStyle}>연락처 (선택)</span>
            <input style={inputStyle} value={contact} maxLength={40} disabled={busy}
              placeholder="전화번호 입력 시 바로 전화 가능" inputMode="tel"
              onChange={e => setContact(e.target.value)} />
          </div>

          <div>
            <span style={labelStyle}>출연 장면</span>
            <SceneChecklist scenes={scenes} value={sceneIds} onChange={setSceneIds} disabled={busy} />
          </div>

          <div>
            <span style={labelStyle}>메모</span>
            <textarea value={notes} maxLength={300} disabled={busy} rows={2}
              placeholder="분장, 의상, 특이사항 등"
              onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }} />
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
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "배역 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 캐스팅 화면 =====
export default function CastScreen({ project, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const canEdit = canEditProject(project, uid); // 소유자 + 참여 팀원

  const opts = () => uid ? { where: [["projectId", "==", project.id]] } : { enabled: false };
  const { data: cast, loading } = useCollection("castMembers", null, opts());
  const { data: scenes } = useCollection("scenes", null, opts());

  const [formMember, setFormMember] = useState(null);

  const sorted = [...cast].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const sceneNo = (id) => scenes.find(s => s.id === id)?.sceneNumber;

  const removeMember = async (m) => {
    if (!window.confirm(`'${m.character}' 배역을 삭제할까요?`)) return;
    try { await deleteItem("castMembers", m.id); }
    catch (e) { console.warn("cast delete error:", e); alert("삭제에 실패했어요."); }
  };

  const telHref = (c) => {
    const digits = (c || "").replace(/[^0-9+]/g, "");
    return digits.length >= 7 ? `tel:${digits}` : null;
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
          <div style={{ fontSize: 19, fontWeight: 900 }}>캐스팅</div>
          <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
            {cast.length > 0
              ? `확정 ${cast.filter(m => m.status === "confirmed").length} · 섭외 중 ${cast.filter(m => m.status === "casting").length} · 후보 ${cast.filter(m => m.status === "candidate").length}`
              : "배역과 배우를 정리해보세요"}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setFormMember("new")}
            style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 42, flexShrink: 0,
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", borderRadius: 11, color: "#fff", fontSize: 12.5, fontWeight: 800,
              padding: "9px 13px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <Plus size={15} /> 배역 추가
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <Users size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 배역이 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>등장인물(배역)과 캐스팅 상태를 정리해보세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(m => {
            const st = castStatus(m.status);
            const tel = telHref(m.contact);
            return (
              <div key={m.id}
                style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, wordBreak: "keep-all" }}>
                      {m.character}
                      {m.actorName && <span style={{ color: PS.sub, fontWeight: 600 }}> · {m.actorName}</span>}
                    </div>
                    {(m.sceneIds || []).length > 0 && (
                      <div style={{ fontSize: 10.5, color: PS.sub, marginTop: 2 }}>
                        출연 {m.sceneIds.map(id => sceneNo(id)).filter(Boolean).map(n => `S#${n}`).join(", ")}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, flexShrink: 0,
                    background: `${st.color}1A`, border: `1px solid ${st.color}44`,
                    padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                </div>
                {m.notes && <div style={{ fontSize: 12, color: PS.sub, marginTop: 7, whiteSpace: "pre-wrap" }}>{m.notes}</div>}
                <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  {tel && (
                    <a href={tel}
                      style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                        background: `${PS.success}14`, border: `1px solid ${PS.success}55`, borderRadius: 10,
                        color: PS.success, fontSize: 11.5, fontWeight: 800, padding: "7px 11px",
                        textDecoration: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                      <Phone size={13} /> 전화
                    </a>
                  )}
                  {canEdit && (
                    <>
                      <button onClick={() => setFormMember(m)}
                        style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                          background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
                          color: PS.text, fontSize: 11.5, fontWeight: 700, padding: "7px 11px",
                          cursor: "pointer", fontFamily: "inherit" }}>
                        <Pencil size={12} /> 수정
                      </button>
                      <button onClick={() => removeMember(m)}
                        style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                          background: PS.elev, border: `1px solid ${PS.danger}44`, borderRadius: 10,
                          color: PS.danger, fontSize: 11.5, fontWeight: 700, padding: "7px 11px",
                          cursor: "pointer", fontFamily: "inherit" }}>
                        <Trash2 size={12} /> 삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formMember && (
        <CastFormModal member={formMember === "new" ? null : formMember}
          scenes={scenes} projectId={project.id} uid={uid} onClose={() => setFormMember(null)} />
      )}
    </div>
  );
}
