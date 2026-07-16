import { useState, useEffect, useRef } from "react";
import { C } from "../theme";
import { Modal, Btn } from "./UI";
import { groupEquipments } from "../utils/groupEquipments";
import { updateItem } from "../hooks/useFirestore";

/* 장비 표시 순서 편집 (카테고리별, 드래그 재정렬)
   - 학생 화면은 모델 단위로 보이므로 순서도 모델 단위.
   - 저장 시 각 모델의 모든 개체 문서에 같은 sortOrder(0,1,2…)를 기록한다.
   - 드래그는 라이브러리 없이 pointer 이벤트로. touch 암묵 캡처를 피하려고
     move/up 은 window 리스너로 받는다. */
const ROW_H = 48;   // 행 높이
const ROW_GAP = 6;  // 행 간격
const ROW_STEP = ROW_H + ROW_GAP;

export default function EquipReorderModal({ equipments, onClose }) {
  const cats = [...new Set(equipments.filter(e => !e.isSet).map(e => e.majorCategory).filter(Boolean))].sort();
  const [cat, setCat] = useState(cats[0] || "");
  const [order, setOrder] = useState([]);   // 모델명 배열 (현재 편집 중 순서)
  const [dragIdx, setDragIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const listRef = useRef(null);

  // 선택 카테고리의 모델을 현재 저장된 순서(groupEquipments가 sortOrder로 정렬)대로 로드
  useEffect(() => {
    if (!cat) { setOrder([]); return; }
    const models = groupEquipments(equipments.filter(e => e.majorCategory === cat && !e.isSet))
      .map(m => m.modelName);
    setOrder(models);
    setDone(false);
  }, [cat, equipments]);

  const move = (from, to, len) => {
    if (to < 0 || to >= len || from === to) return;
    setOrder(prev => {
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };

  // 드래그 중에만 window 리스너 (터치 캡처와 무관하게 이동 좌표를 받는다)
  useEffect(() => {
    if (dragIdx == null) return;
    const onMove = (e) => {
      if (!listRef.current) return;
      const rect = listRef.current.getBoundingClientRect();
      const to = Math.max(0, Math.min(order.length - 1, Math.floor((e.clientY - rect.top) / ROW_STEP)));
      setDragIdx(cur => {
        if (cur != null && to !== cur) { move(cur, to, order.length); return to; }
        return cur;
      });
    };
    const onUp = () => setDragIdx(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragIdx, order.length]);

  const save = async () => {
    if (order.length === 0) return;
    setSaving(true);
    // 모델명 → 그 모델의 모든 개체
    const byModel = {};
    equipments.forEach(e => {
      if (e.majorCategory === cat && !e.isSet) {
        (byModel[e.modelName] = byModel[e.modelName] || []).push(e);
      }
    });
    const writes = [];
    order.forEach((modelName, idx) => {
      (byModel[modelName] || []).forEach(e => {
        if (e.sortOrder !== idx) writes.push(updateItem("equipments", e.id, { sortOrder: idx }));
      });
    });
    await Promise.all(writes);
    setSaving(false);
    setDone(true);
  };

  return (
    <Modal onClose={onClose} width={460}>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 12 }}>장비 순서 편집</div>

      {/* 카테고리 선택 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ padding: "5px 12px", borderRadius: 14, border: `1px solid ${cat === c ? C.teal : C.border}`,
              background: cat === c ? C.teal : "transparent", color: cat === c ? "#fff" : C.muted,
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>≡ 를 잡고 위아래로 끌어 순서를 바꿔요. 학생 화면에 이 순서대로 보여요.</div>

      {/* 드래그 리스트 */}
      <div ref={listRef} style={{ touchAction: dragIdx != null ? "none" : "auto", maxHeight: "50vh", overflowY: "auto" }}>
        {order.map((modelName, i) => (
          <div key={modelName}
            style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
              background: dragIdx === i ? C.tealLight : C.surface,
              border: `1px solid ${dragIdx === i ? C.teal : C.border}`, borderRadius: 10, marginBottom: ROW_GAP,
              boxSizing: "border-box", opacity: dragIdx != null && dragIdx !== i ? 0.55 : 1, userSelect: "none" }}>
            <span onPointerDown={() => setDragIdx(i)}
              style={{ cursor: "grab", fontSize: 18, color: C.muted, touchAction: "none", padding: "0 4px", lineHeight: 1 }}>≡</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, minWidth: 22, textAlign: "center" }}>{i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modelName}</span>
          </div>
        ))}
        {order.length === 0 && (
          <div style={{ fontSize: 12, color: C.muted, padding: "24px 0", textAlign: "center" }}>이 카테고리에 장비가 없어요</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn full outline color={C.muted} onClick={onClose}>닫기</Btn>
        <Btn full color={C.teal} text="#fff" onClick={save} disabled={saving || order.length === 0}>
          {done ? "저장됨 ✓" : saving ? "저장 중…" : "순서 저장"}
        </Btn>
      </div>
    </Modal>
  );
}
