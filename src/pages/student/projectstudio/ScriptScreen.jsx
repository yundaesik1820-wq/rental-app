import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, Plus, ClipboardPaste, FileUp, X, Sparkles, ListTree,
  Pencil, Trash2, ChevronDown, AlertTriangle, Clapperboard, FileText,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../../hooks/useFirestore";
import {
  PS, SCENE_LOCATION_TYPES, SCENE_TIMES, SCENE_STATUS,
  locTypeLabel, sceneStatus, newScene,
} from "./constants";
import { analyzeScene } from "./aiService";
import SceneBreakdownModal from "./SceneBreakdownModal";

const ts = (doc) => doc?.updatedAt?.seconds || doc?.createdAt?.seconds || 0;

// ===== 장면 추가/수정 모달 =====
function SceneFormModal({ scene, nextNumber, projectId, uid, onClose }) {
  const isEdit = !!scene;
  const [num, setNum]           = useState(scene?.sceneNumber ?? nextNumber);
  const [heading, setHeading]   = useState(scene?.heading || "");
  const [locType, setLocType]   = useState(scene?.locationType || "INT");
  const [locName, setLocName]   = useState(scene?.locationName || "");
  const [time, setTime]         = useState(scene?.timeOfDay || "낮");
  const [desc, setDesc]         = useState(scene?.description || "");
  const [dialogue, setDialogue] = useState(scene?.dialogue || "");
  const [minutes, setMinutes]   = useState(scene?.estimatedMinutes ?? "");
  const [status, setStatus]     = useState(scene?.status || "draft");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!String(num) || Number(num) < 1) { setErr("장면 번호는 1 이상이어야 해요."); return; }
    if (!heading.trim() && !locName.trim()) { setErr("장면 제목 또는 장소를 입력해주세요."); return; }
    if (minutes !== "" && (isNaN(Number(minutes)) || Number(minutes) < 0)) { setErr("예상 시간은 0 이상의 숫자로 입력해주세요."); return; }
    setErr("");
    setBusy(true);
    const data = {
      sceneNumber: Number(num), heading: heading.trim(),
      locationType: locType, locationName: locName.trim(), timeOfDay: time,
      description: desc.trim(), dialogue: dialogue.trim(),
      estimatedMinutes: minutes === "" ? null : Number(minutes), status,
    };
    try {
      if (isEdit) await updateItem("scenes", scene.id, data);
      else await addItem("scenes", { ...newScene({ projectId, ownerId: uid, sceneNumber: Number(num) }), ...data });
      onClose();
    } catch (e) {
      console.warn("scene save error:", e);
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
    padding: "8px 12px", minHeight: 38, borderRadius: 999, cursor: "pointer",
    background: on ? PS.primary : PS.elev, border: `1px solid ${on ? PS.primary : PS.border}`,
    color: on ? "#fff" : PS.sub, fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
  });

  return (
    // 입력 모달 — 실수로 바깥 탭 시 작성 내용이 날아가지 않도록 backdrop 닫기 없음 (X로만 닫기)
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{isEdit ? "장면 수정" : "장면 추가"}</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>번호</span>
              <input type="number" min={1} style={inputStyle} value={num} disabled={busy}
                onChange={e => setNum(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>장면 제목</span>
              <input style={inputStyle} value={heading} maxLength={60} disabled={busy}
                placeholder="예) 현우, 작업실에서 밤샘" onChange={e => setHeading(e.target.value)} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>장소 구분</span>
            <div style={{ display: "flex", gap: 7 }}>
              {SCENE_LOCATION_TYPES.map(t => (
                <button key={t.value} onClick={() => setLocType(t.value)} disabled={busy} style={chip(locType === t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>장소 이름</span>
              <input style={inputStyle} value={locName} maxLength={40} disabled={busy}
                placeholder="예) 작업실" onChange={e => setLocName(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>시간대</span>
              <div style={{ display: "flex", gap: 5 }}>
                {SCENE_TIMES.map(t => (
                  <button key={t} onClick={() => setTime(t)} disabled={busy}
                    style={{ ...chip(time === t), flex: 1, padding: "8px 2px" }}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span style={labelStyle}>장면 설명</span>
            <textarea value={desc} maxLength={2000} disabled={busy} rows={4}
              placeholder="장면에서 일어나는 일을 적어주세요"
              onChange={e => setDesc(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <span style={labelStyle}>대사 (선택)</span>
            <textarea value={dialogue} maxLength={2000} disabled={busy} rows={3}
              placeholder={"현우: 이번엔 진짜 끝낸다.\n(형식 자유)"}
              onChange={e => setDialogue(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>예상 촬영(분)</span>
              <input type="number" min={0} step={5} style={inputStyle} value={minutes} disabled={busy}
                placeholder="예) 90" onChange={e => setMinutes(e.target.value)} />
            </div>
            <div>
              <span style={labelStyle}>상태</span>
              <select value={status} disabled={busy} onChange={e => setStatus(e.target.value)}
                style={{ ...inputStyle, appearance: "none" }}>
                {SCENE_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
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
          {busy ? "저장 중..." : isEdit ? "수정 저장" : "장면 추가"}
        </button>
      </div>
    </div>
  );
}

// ===== 텍스트 붙여넣기 모달 (붙여넣은 글 → 장면 1개 생성) =====
function PasteModal({ projectId, uid, nextNumber, onClose }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const create = async () => {
    const t = text.trim();
    if (!t) { setErr("내용을 붙여넣어주세요."); return; }
    setErr("");
    setBusy(true);
    try {
      const firstLine = t.split("\n")[0].slice(0, 40);
      await addItem("scenes", {
        ...newScene({ projectId, ownerId: uid, sceneNumber: nextNumber }),
        heading: firstLine, description: t,
      });
      onClose();
    } catch (e) {
      console.warn("scene paste error:", e);
      setErr("저장에 실패했어요.");
      setBusy(false);
    }
  };

  return (
    // 입력 모달 — backdrop 닫기 없음 (X로만 닫기)
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{ width: "100%", maxWidth: 560, background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>텍스트로 장면 추가</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: PS.sub, marginBottom: 12 }}>
          붙여넣은 내용이 S#{nextNumber} 장면 설명으로 저장돼요. 첫 줄이 장면 제목이 돼요.
        </div>
        <textarea value={text} maxLength={5000} disabled={busy} rows={8} autoFocus
          placeholder="시나리오 텍스트를 붙여넣어주세요"
          onChange={e => setText(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", resize: "vertical",
            background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
            color: PS.text, fontSize: 13.5, padding: "10px 12px", outline: "none", fontFamily: "inherit" }} />
        {err && (
          <div style={{ background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
            borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 12 }}>{err}</div>
        )}
        <button onClick={create} disabled={busy}
          style={{ width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer", marginTop: 14,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
            opacity: busy ? 0.7 : 1 }}>
          {busy ? "저장 중..." : "장면으로 저장"}
        </button>
      </div>
    </div>
  );
}

// ===== AI 분석 결과 모달 =====
function AnalysisModal({ scene, result, breakdown, uid, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const merge = (a = [], b = []) => [...new Set([...a, ...b])];

  const saveToBreakdown = async () => {
    setBusy(true);
    try {
      if (breakdown) {
        await updateItem("sceneBreakdowns", breakdown.id, {
          castNames:      merge(breakdown.castNames, result.cast),
          propNames:      merge(breakdown.propNames, result.props),
          costumeNotes:   merge(breakdown.costumeNotes, result.costumes),
          equipmentNames: merge(breakdown.equipmentNames, result.equipment),
          estimatedMinutes: breakdown.estimatedMinutes ?? result.estimatedMinutes,
        });
      } else {
        await addItem("sceneBreakdowns", {
          projectId: scene.projectId, sceneId: scene.id, ownerId: uid,
          castNames: result.cast, propNames: result.props,
          costumeNotes: result.costumes, equipmentNames: result.equipment,
          estimatedMinutes: result.estimatedMinutes,
          difficulty: "normal", notes: "",
          castIds: [], propIds: [], equipmentIds: [], locationId: null,
        });
      }
      onClose();
    } catch (e) {
      console.warn("analysis save error:", e);
      setErr("저장에 실패했어요.");
      setBusy(false);
    }
  };

  const Section = ({ title, items }) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: PS.sub, marginBottom: 5 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: PS.sub, opacity: 0.6 }}>감지된 항목 없음</div>
      ) : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {items.map(v => (
            <span key={v} style={{ padding: "5px 10px", background: `${PS.primary}1A`,
              border: `1px solid ${PS.primary}44`, borderRadius: 999,
              color: PS.primaryLight, fontSize: 12, fontWeight: 700 }}>{v}</span>
          ))}
        </div>
      )}
    </div>
  );

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
          <Sparkles size={17} color={PS.primaryLight} />
          <span style={{ fontSize: 16, fontWeight: 900 }}>장면 분석 결과</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer",
              padding: 8, display: "flex", marginLeft: "auto" }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: PS.sub, marginBottom: 16 }}>
          S#{scene.sceneNumber} · 규칙 기반 자동 분석 (추후 AI 연동 예정)
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Section title="등장인물" items={result.cast} />
          <Section title="장소" items={result.location ? [result.location] : []} />
          <Section title="소품" items={result.props} />
          <Section title="의상" items={result.costumes} />
          <Section title="필요 장비" items={result.equipment} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: PS.sub, marginBottom: 5 }}>예상 촬영 시간</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{result.estimatedMinutes}분</div>
          </div>
        </div>

        {err && (
          <div style={{ background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
            borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 14 }}>{err}</div>
        )}

        <button onClick={saveToBreakdown} disabled={busy}
          style={{ width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer", marginTop: 18,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
            opacity: busy ? 0.7 : 1 }}>
          {busy ? "저장 중..." : breakdown ? "브레이크다운에 합치기" : "브레이크다운으로 저장"}
        </button>
      </div>
    </div>
  );
}

// ===== 시나리오 메인 화면 =====
export default function ScriptScreen({ project, onBack, onOpenShots }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const { data: scenes, loading } = useCollection(
    "scenes", null,
    uid ? { where: [["projectId", "==", project.id], ["ownerId", "==", uid]] } : { enabled: false }
  );
  const { data: breakdowns } = useCollection(
    "sceneBreakdowns", null,
    uid ? { where: [["projectId", "==", project.id], ["ownerId", "==", uid]] } : { enabled: false }
  );

  const [expanded, setExpanded]   = useState(null);   // 펼친 장면 id
  const [formScene, setFormScene] = useState(null);   // null | "new" | scene 객체
  const [showPaste, setShowPaste] = useState(false);
  const [bdScene, setBdScene]     = useState(null);   // 브레이크다운 편집 대상 장면
  const [analysis, setAnalysis]   = useState(null);   // { scene, result }
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  const sorted = [...scenes].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  const nextNumber = scenes.reduce((m, s) => Math.max(m, s.sceneNumber || 0), 0) + 1;
  const bdOf = (sceneId) => breakdowns.find(b => b.sceneId === sceneId);

  const removeScene = async (s) => {
    if (!window.confirm(`S#${s.sceneNumber} 장면을 삭제할까요?\n브레이크다운도 함께 삭제돼요.`)) return;
    try {
      const bd = bdOf(s.id);
      await deleteItem("scenes", s.id);
      if (bd) await deleteItem("sceneBreakdowns", bd.id);
    } catch (e) {
      console.warn("scene delete error:", e);
      alert("삭제에 실패했어요.");
    }
  };

  const totalMinutes = sorted.reduce((sum, s) => {
    const bd = bdOf(s.id);
    return sum + (bd?.estimatedMinutes ?? s.estimatedMinutes ?? 0);
  }, 0);

  const actionBtn = {
    display: "flex", alignItems: "center", gap: 5, minHeight: 40,
    background: PS.surface, border: `1px solid ${PS.border}`, borderRadius: 11,
    color: PS.text, fontSize: 12.5, fontWeight: 700, padding: "9px 12px",
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
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
          <div style={{ fontSize: 19, fontWeight: 900 }}>시나리오</div>
          <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
            장면 {sorted.length}개{totalMinutes > 0 && ` · 예상 촬영 ${Math.floor(totalMinutes / 60) > 0 ? `${Math.floor(totalMinutes / 60)}시간 ` : ""}${totalMinutes % 60 > 0 ? `${totalMinutes % 60}분` : ""}`}
          </div>
        </div>
      </div>

      {/* 액션 바 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setFormScene("new")}
          style={{ ...actionBtn, background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff" }}>
          <Plus size={15} /> 장면 추가
        </button>
        <button onClick={() => setShowPaste(true)} style={actionBtn}>
          <ClipboardPaste size={15} /> 붙여넣기
        </button>
        <button onClick={() => showToast("파일 불러오기는 다음 업데이트에 추가돼요!")} style={{ ...actionBtn, opacity: 0.55 }}>
          <FileUp size={15} /> 파일
        </button>
      </div>

      {/* 장면 목록 */}
      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: PS.sub }}>불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div style={{ background: PS.surface, border: `1px dashed ${PS.border}`, borderRadius: 18,
          padding: "38px 20px", textAlign: "center" }}>
          <FileText size={28} color={PS.sub} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>아직 장면이 없어요</div>
          <div style={{ fontSize: 12.5, color: PS.sub }}>장면 추가 또는 붙여넣기로 시나리오를 시작해보세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {sorted.map(s => {
            const st = sceneStatus(s.status);
            const bd = bdOf(s.id);
            const outdated = bd && ts(s) > ts(bd);
            const open = expanded === s.id;
            return (
              <div key={s.id}
                style={{ background: PS.surface, border: `1px solid ${open ? PS.primary + "55" : PS.border}`,
                  borderRadius: 15, overflow: "hidden" }}>
                {/* 카드 헤더 */}
                <div onClick={() => setExpanded(open ? null : s.id)}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 14px",
                    cursor: "pointer", minHeight: 52 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: PS.primaryLight, flexShrink: 0 }}>
                    S#{s.sceneNumber}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, wordBreak: "keep-all",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.heading || s.locationName || "(제목 없음)"}
                    </div>
                    <div style={{ fontSize: 11, color: PS.sub, marginTop: 2 }}>
                      {locTypeLabel(s.locationType)}{s.locationName && ` · ${s.locationName}`} · {s.timeOfDay}
                      {bd && !outdated && " · 브레이크다운 ✓"}
                    </div>
                  </div>
                  {outdated && <AlertTriangle size={15} color={PS.warning} style={{ flexShrink: 0 }} />}
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, flexShrink: 0,
                    background: `${st.color}1A`, border: `1px solid ${st.color}44`,
                    padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                  <ChevronDown size={15} color={PS.sub}
                    style={{ flexShrink: 0, transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
                </div>

                {/* 펼침 상세 */}
                {open && (
                  <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${PS.border}` }}>
                    {outdated && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12,
                        background: `${PS.warning}12`, border: `1px solid ${PS.warning}44`,
                        borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, color: PS.warning }}>
                        <AlertTriangle size={14} /> 시나리오가 변경되었어요. 브레이크다운 내용을 확인해주세요.
                      </div>
                    )}
                    {s.description && (
                      <div style={{ fontSize: 13, color: PS.text, lineHeight: 1.65, marginTop: 12, whiteSpace: "pre-wrap" }}>
                        {s.description}
                      </div>
                    )}
                    {s.dialogue && (
                      <div style={{ fontSize: 12.5, color: PS.sub, lineHeight: 1.6, marginTop: 10,
                        whiteSpace: "pre-wrap", borderLeft: `2px solid ${PS.border}`, paddingLeft: 10 }}>
                        {s.dialogue}
                      </div>
                    )}
                    {(bd?.estimatedMinutes ?? s.estimatedMinutes) != null && (
                      <div style={{ fontSize: 12, color: PS.sub, marginTop: 10 }}>
                        예상 촬영 {bd?.estimatedMinutes ?? s.estimatedMinutes}분
                      </div>
                    )}

                    {/* 브레이크다운 요약 */}
                    {bd && (
                      <div style={{ marginTop: 12, background: PS.elev, borderRadius: 11, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: PS.primaryLight, marginBottom: 6 }}>브레이크다운</div>
                        {[["인물", bd.castNames], ["소품", bd.propNames], ["의상", bd.costumeNotes], ["장비", bd.equipmentNames]]
                          .filter(([, arr]) => arr?.length > 0)
                          .map(([k, arr]) => (
                            <div key={k} style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}>
                              <b style={{ color: PS.text }}>{k}</b> {arr.join(", ")}
                            </div>
                          ))}
                        {bd.notes && <div style={{ fontSize: 12, color: PS.sub, marginTop: 3 }}><b style={{ color: PS.text }}>메모</b> {bd.notes}</div>}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 13 }}>
                      <button onClick={() => setAnalysis({ scene: s, result: analyzeScene(s) })}
                        style={{ ...actionBtn, background: `${PS.primary}1A`, border: `1px solid ${PS.primary}55`, color: PS.primaryLight }}>
                        <Sparkles size={14} /> AI 분석
                      </button>
                      <button onClick={() => setBdScene(s)} style={actionBtn}>
                        <ListTree size={14} /> 브레이크다운
                      </button>
                      <button onClick={() => onOpenShots && onOpenShots(s)} style={actionBtn}>
                        <Clapperboard size={14} /> 콘티 만들기
                      </button>
                      <button onClick={() => setFormScene(s)} style={actionBtn}>
                        <Pencil size={14} /> 수정
                      </button>
                      <button onClick={() => removeScene(s)}
                        style={{ ...actionBtn, border: `1px solid ${PS.danger}44`, color: PS.danger }}>
                        <Trash2 size={14} /> 삭제
                      </button>
                    </div>
                  </div>
                )}
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
      {formScene && (
        <SceneFormModal
          scene={formScene === "new" ? null : formScene}
          nextNumber={nextNumber} projectId={project.id} uid={uid}
          onClose={() => setFormScene(null)} />
      )}
      {showPaste && (
        <PasteModal projectId={project.id} uid={uid} nextNumber={nextNumber}
          onClose={() => setShowPaste(false)} />
      )}
      {bdScene && (
        <SceneBreakdownModal scene={bdScene} breakdown={bdOf(bdScene.id)} uid={uid}
          onClose={() => setBdScene(null)} />
      )}
      {analysis && (
        <AnalysisModal scene={analysis.scene} result={analysis.result}
          breakdown={bdOf(analysis.scene.id)} uid={uid}
          onClose={() => setAnalysis(null)} />
      )}
    </div>
  );
}
