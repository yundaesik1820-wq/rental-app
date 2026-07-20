import { useState } from "react";
import { X, Plus } from "lucide-react";
import { addItem, updateItem } from "../../../hooks/useFirestore";
import { PS, BREAKDOWN_DIFFICULTY } from "./constants";

// 칩 입력 (텍스트 → 추가 → 칩 목록, 칩 탭하면 제거)
function ChipInput({ label, values, onChange, placeholder, disabled }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v || values.includes(v)) { setInput(""); return; }
    onChange([...values, v]);
    setInput("");
  };
  return (
    <div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" }}>{label}</span>
      <div style={{ display: "flex", gap: 7 }}>
        <input value={input} maxLength={30} disabled={disabled} placeholder={placeholder}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          style={{
            flex: 1, minWidth: 0, minHeight: 42, boxSizing: "border-box",
            background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
            color: PS.text, fontSize: 13.5, padding: "9px 12px", outline: "none", fontFamily: "inherit",
          }} />
        <button onClick={add} disabled={disabled || !input.trim()}
          style={{
            width: 42, minHeight: 42, flexShrink: 0, borderRadius: 10, cursor: "pointer",
            background: input.trim() ? PS.primary : PS.elev,
            border: `1px solid ${input.trim() ? PS.primary : PS.border}`,
            color: input.trim() ? "#fff" : PS.sub,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <Plus size={17} />
        </button>
      </div>
      {values.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {values.map(v => (
            <button key={v} onClick={() => onChange(values.filter(x => x !== v))} disabled={disabled}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", minHeight: 32,
                background: `${PS.primary}1A`, border: `1px solid ${PS.primary}44`, borderRadius: 999,
                color: PS.primaryLight, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
              {v} <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 씬 브레이크다운 편집 모달 (장면당 1개 문서 — 있으면 수정, 없으면 생성)
// MVP는 이름 문자열 배열로 저장. *Ids 필드는 요청서 7번 모델 호환용으로 유지(추후 엔티티 연결).
export default function SceneBreakdownModal({ scene, breakdown, uid, onClose }) {
  const [castNames, setCastNames]           = useState(breakdown?.castNames || []);
  const [propNames, setPropNames]           = useState(breakdown?.propNames || []);
  const [costumeNotes, setCostumeNotes]     = useState(breakdown?.costumeNotes || []);
  const [equipmentNames, setEquipmentNames] = useState(breakdown?.equipmentNames || []);
  const [difficulty, setDifficulty] = useState(breakdown?.difficulty || "normal");
  const [minutes, setMinutes] = useState(breakdown?.estimatedMinutes ?? "");
  const [notes, setNotes]     = useState(breakdown?.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const save = async () => {
    if (minutes !== "" && (isNaN(Number(minutes)) || Number(minutes) < 0)) {
      setErr("예상 촬영 시간은 0 이상의 숫자로 입력해주세요."); return;
    }
    setErr("");
    setBusy(true);
    const data = {
      castNames, propNames, costumeNotes, equipmentNames,
      difficulty, notes: notes.trim(),
      estimatedMinutes: minutes === "" ? null : Number(minutes),
    };
    try {
      if (breakdown) {
        await updateItem("sceneBreakdowns", breakdown.id, data);
      } else {
        await addItem("sceneBreakdowns", {
          ...data,
          projectId: scene.projectId, sceneId: scene.id, ownerId: uid,
          castIds: [], propIds: [], equipmentIds: [], locationId: null,
        });
      }
      onClose();
    } catch (e) {
      console.warn("breakdown save error:", e);
      setErr("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto",
          background: PS.surface, borderRadius: "20px 20px 0 0",
          border: `1px solid ${PS.border}`, borderBottom: "none",
          padding: "18px 18px 28px", color: PS.text, boxSizing: "border-box",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>씬 브레이크다운</span>
          <button onClick={onClose} disabled={busy}
            style={{ background: "none", border: "none", color: PS.sub, cursor: "pointer", padding: 8, display: "flex" }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: PS.sub, marginBottom: 16 }}>
          S#{scene.sceneNumber} {scene.heading || scene.locationName}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <ChipInput label="등장인물" values={castNames} onChange={setCastNames} placeholder="예) 현우" disabled={busy} />
          <ChipInput label="소품" values={propNames} onChange={setPropNames} placeholder="예) 노트북" disabled={busy} />
          <ChipInput label="의상" values={costumeNotes} onChange={setCostumeNotes} placeholder="예) 검은 후드" disabled={busy} />
          <ChipInput label="장비" values={equipmentNames} onChange={setEquipmentNames} placeholder="예) 조명 2대" disabled={busy} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" }}>촬영 난이도</span>
              <div style={{ display: "flex", gap: 6 }}>
                {BREAKDOWN_DIFFICULTY.map(d => {
                  const on = difficulty === d.value;
                  return (
                    <button key={d.value} onClick={() => setDifficulty(d.value)} disabled={busy}
                      style={{
                        flex: 1, padding: "8px 4px", minHeight: 38, borderRadius: 10, cursor: "pointer",
                        background: on ? PS.primary : PS.elev,
                        border: `1px solid ${on ? PS.primary : PS.border}`,
                        color: on ? "#fff" : PS.sub, fontSize: 12, fontWeight: 700,
                        fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>{d.label}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" }}>예상 촬영(분)</span>
              <input type="number" min={0} step={5} value={minutes} disabled={busy} placeholder="예) 90"
                onChange={e => setMinutes(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box", minHeight: 38,
                  background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
                  color: PS.text, fontSize: 13.5, padding: "8px 12px", outline: "none", fontFamily: "inherit",
                }} />
            </div>
          </div>

          <div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: PS.sub, marginBottom: 6, display: "block" }}>메모</span>
            <textarea value={notes} maxLength={500} disabled={busy} rows={3}
              placeholder="특수효과, 주의사항 등"
              onChange={e => setNotes(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", resize: "vertical",
                background: PS.elev, border: `1px solid ${PS.border}`, borderRadius: 10,
                color: PS.text, fontSize: 13.5, padding: "10px 12px", outline: "none", fontFamily: "inherit",
              }} />
          </div>
        </div>

        {err && (
          <div style={{
            background: `${PS.danger}14`, border: `1px solid ${PS.danger}55`, color: PS.danger,
            borderRadius: 11, padding: "10px 13px", fontSize: 13, fontWeight: 600, marginTop: 14,
          }}>{err}</div>
        )}

        <button onClick={save} disabled={busy}
          style={{
            width: "100%", minHeight: 48, borderRadius: 12, cursor: "pointer", marginTop: 18,
            background: `linear-gradient(135deg, ${PS.primary} 0%, #5a3fe0 100%)`,
            border: "none", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
            opacity: busy ? 0.7 : 1,
          }}>
          {busy ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
