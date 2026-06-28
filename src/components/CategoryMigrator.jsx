import { useState, useMemo } from "react";
import { C } from "../theme";
import { Modal, Btn } from "./UI";
import { useCollection, updateItem } from "../hooks/useFirestore";

// 학생 화면 카테고리 그리드와 똑같은 이름 (외부 렌탈샵/NEW는 장비 분류가 아니라 제외)
const ASSIGNABLE = ["캠코더", "카메라", "렌즈", "ACC", "삼각대/그립", "모니터", "조명", "음향", "편집", "기타"];

export default function CategoryMigrator({ onClose }) {
  const { data: equipments } = useCollection("equipments", "createdAt");

  // 현재 장비에 쓰인 대분류별 개수 (많은 순)
  const groups = useMemo(() => {
    const m = {};
    equipments.forEach((e) => {
      const k = e.majorCategory || "(비어있음)";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [equipments]);

  const [mapping, setMapping]   = useState({}); // { 옛값: 새값 }
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });

  const changeCount = equipments.filter((e) => {
    const k = e.majorCategory || "(비어있음)";
    return mapping[k] && mapping[k] !== (e.majorCategory || "");
  }).length;

  const apply = async () => {
    const targets = equipments.filter((e) => {
      const k = e.majorCategory || "(비어있음)";
      return mapping[k] && mapping[k] !== (e.majorCategory || "");
    });
    if (targets.length === 0) { alert("바꿀 카테고리를 하나 이상 선택해줘"); return; }
    setRunning(true);
    setProgress({ cur: 0, total: targets.length });
    let cur = 0;
    for (const e of targets) {
      const k = e.majorCategory || "(비어있음)";
      try { await updateItem("equipments", e.id, { majorCategory: mapping[k] }); }
      catch (err) { console.error("카테고리 변경 실패:", e.id, err); }
      cur++;
      setProgress({ cur, total: targets.length });
    }
    setRunning(false);
    setDone(true);
  };

  return (
    <Modal onClose={running ? () => {} : onClose} width={560}>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 6 }}>🗂️ 카테고리 일괄 정리</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
        지금 장비에 쓰인 대분류를 새 카테고리로 바꿔. 학생 화면의 카테고리 그리드는 아래 새 이름으로만 매칭돼.
      </div>

      {done ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>완료! 카테고리가 정리됐어</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>학생 화면에서 카테고리 눌러서 장비가 뜨는지 확인해봐</div>
          <Btn onClick={onClose} color={C.navy} full>닫기</Btn>
        </div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: C.muted, fontSize: 13 }}>등록된 장비가 없어</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "48vh", overflowY: "auto" }}>
            {groups.map(([oldCat, count]) => {
              const already = ASSIGNABLE.includes(oldCat); // 이미 새 이름과 일치
              return (
                <div key={oldCat} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: C.bg, borderRadius: 9, border: `1px solid ${already ? C.tealLight : C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {oldCat} {already && <span style={{ fontSize: 10, color: C.teal, fontWeight: 700 }}>✓ 일치</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{count}개</div>
                  </div>
                  <div style={{ fontSize: 13, color: C.muted }}>→</div>
                  <select
                    value={mapping[oldCat] || ""}
                    onChange={(e) => setMapping((p) => ({ ...p, [oldCat]: e.target.value }))}
                    disabled={running}
                    style={{ flex: 1, maxWidth: 160, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 8, color: mapping[oldCat] ? C.text : C.muted, padding: "8px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                    <option value="">{already ? "그대로 둠" : "변경 안 함"}</option>
                    {ASSIGNABLE.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          {running && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, textAlign: "center" }}>변경 중... {progress.cur} / {progress.total}</div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress.total ? (progress.cur / progress.total * 100) : 0}%`, background: C.teal, transition: "width .2s" }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <Btn onClick={onClose} color={C.muted} outline full disabled={running}>취소</Btn>
            <Btn onClick={apply} color={C.teal} full disabled={running}>{running ? "변경 중..." : changeCount > 0 ? `${changeCount}개 적용` : "적용"}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
