import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Plus, X, UserPlus, Megaphone, Pencil, Trash2, Phone, BadgeCheck } from "lucide-react";
import { getDocs, collection, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import {
  PS, CREW_ROLES, CREW_STATUS, crewStatus, newCrewMember, typeLabel, stageLabel,
} from "./constants";
import { createCommunityRecruitmentAdapter } from "./adapters";

// ===== 팀원 추가/수정 모달 (backdrop 닫기 없음) =====
// 이름 입력 → 가입 학생 자동완성 (본인 포함, 수기 입력도 허용).
// 가입 학생을 선택하면 userId가 연동돼 알림 + 프로젝트 입장 권한이 생긴다.
function CrewFormModal({ member, project, crew, uid, profile, onClose }) {
  const isEdit = !!member;
  const [role, setRole] = useState(member?.role || null);
  const [customRole, setCustomRole] = useState(
    member && !CREW_ROLES.includes(member.role) ? member.role : ""
  );
  const [name, setName]     = useState(member?.name || "");
  const [userId, setUserId] = useState(member?.userId || null);
  const [status, setStatus] = useState(member?.status || "confirmed");
  const [contact, setContact] = useState(member?.contact || "");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  // 가입 사용자 목록 (모달 열릴 때 1회 로드 → 키 입력마다 클라 필터)
  const [allUsers, setAllUsers] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  useEffect(() => {
    let alive = true;
    getDocs(collection(db, "users")).then(snap => {
      if (alive) setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(e => console.warn("users load error:", e));
    return () => { alive = false; };
  }, []);

  const kw = name.trim().toLowerCase();
  const suggestions = (!kw || userId) ? [] : allUsers
    .filter(u =>
      ((u.role === "student" && u.status === "approved") || u.id === uid) && // 승인된 학생 + 본인(관리자여도)
      (u.name || "").toLowerCase().includes(kw)
    )
    .slice(0, 6);

  const pickUser = (u) => {
    setName(u.name || "");
    setUserId(u.id);
    if (!contact && (u.phone || u.phoneNumber)) setContact(u.phone || u.phoneNumber);
    setShowSuggest(false);
  };

  const save = async () => {
    const finalRole = role === "기타" ? customRole.trim() : role;
    if (!finalRole) { setErr("포지션을 선택해주세요."); return; }
    if (status !== "recruiting" && !name.trim()) { setErr("이름을 입력해주세요. (모집 중이면 비워도 돼요)"); return; }
    setErr("");
    setBusy(true);
    const data = {
      role: finalRole, name: name.trim(), status,
      contact: contact.trim(),
      userId: userId || null,
      // 알림 문구용 비정규화 (초대받은 쪽이 프로젝트를 읽기 전에 표시)
      projectTitle: project.title, inviterName: profile?.name || "",
    };
    try {
      if (isEdit) await updateItem("crewMembers", member.id, data);
      else await addItem("crewMembers", { ...newCrewMember({ projectId: project.id, ownerId: uid, role: finalRole }), ...data });

      // 🔑 입장 권한 동기화 (projects.memberIds)
      const projRef = doc(db, "projects", project.id);
      if (userId && userId !== uid) {
        await updateDoc(projRef, { memberIds: arrayUnion(userId) });
      }
      const prevUserId = member?.userId;
      if (isEdit && prevUserId && prevUserId !== userId) {
        // 바뀐 이전 사용자가 다른 팀원 항목에도 없으면 권한 회수
        const stillUsed = crew.some(c => c.id !== member.id && c.userId === prevUserId);
        if (!stillUsed && prevUserId !== uid) {
          await updateDoc(projRef, { memberIds: arrayRemove(prevUserId) });
        }
      }
      onClose();
    } catch (e) {
      console.warn("crew save error:", e);
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
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "팀원 수정" : "팀원 추가"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>포지션 <b style={{ color: PS.primaryLight }}>*</b></span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CREW_ROLES.map(r => (
                <button key={r} onClick={() => setRole(r)} disabled={busy} style={chip(role === r)}>{r}</button>
              ))}
            </div>
            {role === "기타" && (
              <input style={{ ...inputStyle, marginTop: 8 }} value={customRole} maxLength={20} disabled={busy}
                placeholder="포지션 직접 입력" onChange={e => setCustomRole(e.target.value)} />
            )}
          </div>

          <div>
            <span style={labelStyle}>상태</span>
            <div style={{ display: "flex", gap: 6 }}>
              {CREW_STATUS.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value)} disabled={busy}
                  style={{ ...chip(status === s.value), flex: 1 }}>{s.label}</button>
              ))}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <span style={labelStyle}>이름 {status !== "recruiting" && <b style={{ color: PS.primaryLight }}>*</b>}</span>
            <input style={inputStyle} value={name} maxLength={20} disabled={busy}
              placeholder={status === "recruiting" ? "모집 중이면 비워도 돼요" : "이름 검색 또는 직접 입력"}
              onChange={e => { setName(e.target.value); setUserId(null); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)} />
            {userId && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6,
                fontSize: 11.5, fontWeight: 800, color: PS.success }}>
                <BadgeCheck size={13} /> 가입 학생 연동됨 — 추가하면 알림과 입장 권한이 생겨요
              </div>
            )}
            {/* 자동완성 드롭다운 */}
            {showSuggest && suggestions.length > 0 && (
              <div style={{
                position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20,
                background: PS.elev, border: `1px solid ${PS.primary}55`, borderRadius: 11,
                overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}>
                {suggestions.map(u => (
                  <button key={u.id} onClick={() => pickUser(u)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44,
                      background: "none", border: "none", borderBottom: `1px solid ${PS.border}`,
                      color: PS.text, fontSize: 13, fontWeight: 700, padding: "9px 13px",
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <span>{u.name}</span>
                    <span style={{ fontSize: 11, color: PS.sub, fontWeight: 600 }}>
                      {u.studentId || ""}{u.dept ? ` · ${u.dept}` : ""}{u.id === uid ? " · 나" : ""}
                    </span>
                    <BadgeCheck size={13} color={PS.primaryLight} style={{ marginLeft: "auto", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <span style={labelStyle}>연락처 (선택)</span>
            <input style={inputStyle} value={contact} maxLength={40} disabled={busy}
              placeholder="전화번호 입력 시 바로 전화 걸 수 있어요" inputMode="tel"
              onChange={e => setContact(e.target.value)} />
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
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "팀원 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 모집글 미리보기 모달 (요청서 12번 — 프로젝트 정보 자동 입력 → 커뮤니티 실제 등록) =====
function RecruitModal({ member, project, scenes, days, profile, onClose, onRegistered }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const alreadyPosted = !!member.recruitPostId;

  const locations = [...new Set(scenes.map(s => s.locationName).filter(Boolean))];
  const dates = days.map(d => d.date).sort();
  const shootDate = dates[0] || project.expectedShootDate;
  const totalMin = scenes.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);

  // 자동 채워지는 요약 정보(구조화 필드로 등록됨 — 읽기 전용)
  const metaLines = [
    `🎬 [${typeLabel(project.type)}] ${project.title}`,
    `📌 모집 포지션: ${member.role}`,
    shootDate ? `📅 촬영 예정일: ${shootDate}${dates.length > 1 ? ` 외 ${dates.length - 1}일` : ""}` : null,
    locations.length > 0 ? `📍 촬영 장소: ${locations.join(", ")}` : null,
    totalMin > 0 ? `⏱ 예상 촬영 시간: 약 ${Math.ceil(totalMin / 60)}시간` : null,
    `📈 프로젝트 진행: ${stageLabel(project.stage)} · ${Math.max(0, Math.min(100, project.progress || 0))}%`,
  ].filter(v => v !== null);

  // 소개글 — 수정 가능 (실제 글의 본문/로그라인으로 저장됨)
  const defaultIntro = `${(project.description || "").trim() || `함께 작품을 완성할 ${member.role} 팀원을 찾고 있어요!`}\n\n관심 있으신 분은 댓글이나 지원버튼으로 연락주세요!`;
  const [intro, setIntro] = useState(defaultIntro);

  const register = async () => {
    if (alreadyPosted) return;
    if (!intro.trim()) { alert("소개글을 입력해주세요."); return; }
    setBusy(true);
    try {
      const adapter = createCommunityRecruitmentAdapter({ profile });
      const { postId } = await adapter.createRecruitmentPost(project, member.role, {
        shootDate, extraDays: Math.max(0, dates.length - 1), locations, totalMinutes: totalMin,
        intro: intro.trim(),
      });
      // 중복 등록 방지 — 팀원 항목에 생성된 글 id 기록
      await updateItem("crewMembers", member.id, { recruitPostId: postId });
      onRegistered();
    } catch (e) {
      console.warn("recruit post error:", e);
      alert("모집글 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <Megaphone size={16} color={PS.primaryLight} />
          <span style={{ fontSize: 16, fontWeight: 900 }}>크루 모집글 미리보기</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
              padding: 8, display: "flex", marginLeft: "auto" }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: PS.sub, marginBottom: 14 }}>
          프로젝트 정보가 자동으로 채워졌어요
        </div>

        {/* 자동 요약 (읽기 전용) */}
        <div style={{ background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 13,
          padding: "13px 15px", fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>
          {metaLines.join("\n")}
        </div>

        {/* 소개글 (수정 가능) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 7px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: PS.sub }}>소개글</span>
          {!alreadyPosted && (
            <button onClick={() => setEditing(e => !e)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
                color: PS.primaryLight, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>
              <Pencil size={12} /> {editing ? "미리보기" : "수정"}
            </button>
          )}
        </div>
        {editing ? (
          <textarea value={intro} maxLength={1000} disabled={busy} rows={6} autoFocus
            onChange={e => setIntro(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical",
              background: PS.elev, border: `1px solid ${PS.primary}66`, borderRadius: 12,
              color: PS.text, fontSize: 13.5, padding: "12px 14px", outline: "none",
              fontFamily: "inherit", lineHeight: 1.65 }} />
        ) : (
          <div style={{ background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 12,
            padding: "13px 15px", fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "keep-all",
            color: intro.trim() ? PS.text : PS.sub }}>
            {intro.trim() || "소개글을 입력해주세요."}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: PS.sub, marginTop: 10, lineHeight: 1.55 }}>
          등록하면 커뮤니티 <b style={{ color: PS.primaryLight }}>크루 메이커스</b>에 협업모집 글로 올라가요.
        </div>

        {/* 하단 버튼: [수정] [등록] */}
        <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
          {!alreadyPosted && (
            <button onClick={() => setEditing(e => !e)} disabled={busy}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                minHeight: 48, padding: "0 18px", borderRadius: 12, cursor: "pointer",
                background: "transparent", border: `1px solid ${PS.border}`, color: PS.text,
                fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              <Pencil size={14} /> {editing ? "완료" : "수정"}
            </button>
          )}
          <button onClick={register} disabled={busy || alreadyPosted}
            style={{ flex: 1, minHeight: 48, borderRadius: 12, cursor: alreadyPosted ? "default" : "pointer",
              background: alreadyPosted ? PS.elev : `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: alreadyPosted ? `1px solid ${PS.border}` : "none",
              color: alreadyPosted ? PS.success : "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
              opacity: busy ? 0.7 : 1 }}>
            {alreadyPosted ? "✓ 이미 커뮤니티에 등록됨" : busy ? "등록 중..." : "크루 메이커스에 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 팀원 화면 =====
export default function CrewScreen({ project, onBack }) {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const canEdit = project.ownerId === uid; // 멤버(참여자)는 조회만

  const opts = () => uid ? { where: [["projectId", "==", project.id]] } : { enabled: false };
  const { data: crew, loading } = useCollection("crewMembers", null, opts());
  const { data: scenes } = useCollection("scenes", null, opts());
  const { data: days }   = useCollection("shootDays", null, opts());

  const [formMember, setFormMember] = useState(null); // null | "new" | member
  const [recruitFor, setRecruitFor] = useState(null); // 모집글 미리보기 대상 member
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  // 포지션 순서 → 등록순
  const sorted = [...crew].sort((a, b) => {
    const ai = CREW_ROLES.indexOf(a.role), bi = CREW_ROLES.indexOf(b.role);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  });

  const removeMember = async (m) => {
    if (!window.confirm(`${m.role}${m.name ? ` ${m.name}` : ""} 항목을 삭제할까요?`)) return;
    try {
      await deleteItem("crewMembers", m.id);
      // 같은 사용자가 다른 항목에 없으면 입장 권한 회수
      if (m.userId && m.userId !== uid && !crew.some(c => c.id !== m.id && c.userId === m.userId)) {
        await updateDoc(doc(db, "projects", project.id), { memberIds: arrayRemove(m.userId) });
      }
    }
    catch (e) { console.warn("crew delete error:", e); alert("삭제에 실패했어요."); }
  };

  const telHref = (contact) => {
    const digits = (contact || "").replace(/[^0-9+]/g, "");
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
          <div style={{ fontSize: 19, fontWeight: 900 }}>팀원</div>
          <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
            {crew.length > 0
              ? `확정 ${crew.filter(m => m.status === "confirmed").length} · 섭외 중 ${crew.filter(m => m.status === "invited").length} · 모집 중 ${crew.filter(m => m.status === "recruiting").length}`
              : "함께할 크루를 정리해보세요"}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setFormMember("new")}
            style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 42, flexShrink: 0,
              background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
              border: "none", borderRadius: 11, color: "#fff", fontSize: 12.5, fontWeight: 800,
              padding: "9px 13px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <Plus size={15} /> 팀원 추가
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <UserPlus size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 팀원이 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>포지션별로 확정 팀원과 모집할 자리를 정리해보세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(m => {
            const st = crewStatus(m.status);
            const tel = telHref(m.contact);
            return (
              <div key={m.id}
                style={{ background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 14,
                  padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: PS.primaryLight, flexShrink: 0, minWidth: 60 }}>
                    {m.role}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700,
                    color: m.name ? PS.text : PS.sub, display: "flex", alignItems: "center", gap: 5,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name || "미정"}
                    {m.userId && <BadgeCheck size={13} color={PS.success} style={{ flexShrink: 0 }} />}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, flexShrink: 0,
                    background: `${st.color}1A`, border: `1px solid ${st.color}44`,
                    padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                </div>
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
                  {canEdit && m.status === "recruiting" && (
                    <button onClick={() => setRecruitFor(m)}
                      style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36,
                        background: m.recruitPostId ? `${PS.success}14` : `${PS.primary}1A`,
                        border: `1px solid ${m.recruitPostId ? PS.success + "55" : PS.primary + "55"}`, borderRadius: 10,
                        color: m.recruitPostId ? PS.success : PS.primaryLight, fontSize: 11.5, fontWeight: 800, padding: "7px 11px",
                        cursor: "pointer", fontFamily: "inherit" }}>
                      <Megaphone size={13} /> {m.recruitPostId ? "모집글 등록됨" : "모집글 등록"}
                    </button>
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

      {/* 토스트 */}
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)",
          background: "rgba(23,26,35,0.97)", border: `1px solid ${PS.border}`,
          color: PS.text, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
          padding: "10px 16px", borderRadius: 999, zIndex: 300,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{toast}</div>
      )}

      {/* 모달들 */}
      {formMember && (
        <CrewFormModal member={formMember === "new" ? null : formMember}
          project={project} crew={crew} uid={uid} profile={profile}
          onClose={() => setFormMember(null)} />
      )}
      {recruitFor && (
        <RecruitModal member={recruitFor} project={project} scenes={scenes} days={days} profile={profile}
          onClose={() => setRecruitFor(null)}
          onRegistered={() => { setRecruitFor(null); showToast("크루 메이커스에 모집글을 등록했어요! 🎬"); }} />
      )}
    </div>
  );
}
