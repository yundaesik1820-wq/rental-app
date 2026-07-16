import { useState, useEffect, useRef } from "react";
import { C } from "../theme";
import { Modal, Btn } from "./UI";
import { groupEquipments } from "../utils/groupEquipments";
import { updateItem } from "../hooks/useFirestore";

/* 장비 표시 순서 편집 (카테고리별, 드래그 재정렬)
   - 학생 화면은 모델 단위로 보이므로 순서도 모델 단위.
   - 저장 시 각 모델의 모든 개체 문서에 같은 sortOrder(0,1,2…)를 기록한다.
   - 매끄러운 슬라이딩: 잡은 행은 손가락을 실시간으로 따라 움직이고(transform, transition 없음),
     나머지 행은 비켜줄 자리로 부드럽게 슬라이드(transition). 배열 재정렬은 놓는 순간에만.
   - pointer 이벤트를 window에서 받아 터치 암묵 캡처 문제를 피한다. */
const ROW_H = 48;
const ROW_GAP = 6;
const ROW_STEP = ROW_H + ROW_GAP;

export default function EquipReorderModal({ equipments, onClose }) {
  const cats = [...new Set(equipments.filter(e => !e.isSet).map(e => e.majorCategory).filter(Boolean))].sort();
  const [cat, setCat] = useState(cats[0] || "");
  const [order, setOrder] = useState([]);       // 모델명 배열 (편집 중 순서)
  const [drag, setDrag] = useState(null);        // { idx, startY, dy } — 잡은 행
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!cat) { setOrder([]); return; }
    const models = groupEquipments(equipments.filter(e => e.majorCategory === cat && !e.isSet))
      .map(m => m.modelName);
    setOrder(models);
    setDone(false);
  }, [cat, equipments]);

  // 드래그 중에만 window 리스너. dy(델타)만 갱신하고, 놓을 때 최종 위치로 재정렬.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => setDrag(d => (d ? { ...d, dy: e.clientY - d.startY } : d));
    const onUp = () => setDrag(d => {
      if (!d) return null;
      const target = Math.max(0, Math.min(order.length - 1, d.idx + Math.round(d.dy / ROW_STEP)));
      if (target !== d.idx) {
        setOrder(prev => {
          const next = [...prev];
          const [x] = next.splice(d.idx, 1);
          next.splice(target, 0, x);
          return next;
        });
      }
      return null;
    });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag?.idx ?? null, drag?.startY ?? null, order.length]);

  // 잡은 행이 지금 놓이면 갈 목표 인덱스
  const targetIdx = drag
    ? Math.max(0, Math.min(order.length - 1, drag.idx + Math.round(drag.dy / ROW_STEP)))
    : null;

  const save = async () => {
    if (order.length === 0) return;
    setSaving(true);
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
      <div style={{ touchAction: drag ? "none" : "auto", maxHeight: "50vh", overflowY: drag ? "hidden" : "auto", position: "relative" }}>
        {order.map((modelName, i) => {
          const dragging = drag && i === drag.idx;
          let ty = 0;
          if (drag && !dragging) {
            // 잡은 행이 지나가는 자리를 비켜준다
            if (drag.idx < i && i <= targetIdx) ty = -ROW_STEP;        // 아래로 끌 때: 위로 슬라이드
            else if (targetIdx <= i && i < drag.idx) ty = ROW_STEP;    // 위로 끌 때: 아래로 슬라이드
          } else if (dragging) {
            ty = drag.dy;  // 잡은 행은 손가락을 그대로 따라감
          }
          return (
            <div key={modelName}
              style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
                background: dragging ? C.tealLight : C.surface,
                border: `1px solid ${dragging ? C.teal : C.border}`, borderRadius: 10, marginBottom: ROW_GAP,
                boxSizing: "border-box", userSelect: "none", position: "relative",
                transform: `translateY(${ty}px)`,
                transition: dragging ? "none" : "transform 0.18s cubic-bezier(0.2,0,0,1)",
                zIndex: dragging ? 5 : 1,
                boxShadow: dragging ? "0 8px 20px rgba(0,0,0,0.45)" : "none" }}>
              <span onPointerDown={(e) => setDrag({ idx: i, startY: e.clientY, dy: 0 })}
                style={{ cursor: "grab", fontSize: 18, color: C.muted, touchAction: "none", padding: "0 4px", lineHeight: 1 }}>≡</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, minWidth: 22, textAlign: "center" }}>{(dragging ? targetIdx : i) + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modelName}</span>
            </div>
          );
        })}
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
