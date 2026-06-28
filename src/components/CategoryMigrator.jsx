import { useState, useMemo } from "react";
import { C } from "../theme";
import { Modal, Btn } from "./UI";
import { useCollection, updateItem } from "../hooks/useFirestore";

// 학생 화면 카테고리 그리드와 똑같은 이름 (외부 렌탈샵/NEW는 장비 분류가 아니라 제외)
const ASSIGNABLE = ["캠코더", "카메라", "렌즈", "ACC", "삼각대/그립", "모니터", "조명", "음향", "편집", "기타"];

export default function CategoryMigrator({ onClose }) {
  const { data: equipments } = useCollection("equipments", "createdAt");
  const [mode, setMode] = useState("minor"); // minor(중분류 기준) | major(대분류 기준)

  // 기준에 따라 그룹 집계 (개수 + 현재 대분류 목록)
  const groups = useMemo(() => {
    const m = {};
    equipments.forEach((e) => {
      const key = (mode === "minor" ? e.minorCategory : e.majorCategory) || "(비어있음)";
      if (!m[key]) m[key] = { count: 0, majors: new Set() };
      m[key].count++;
      if (e.majorCategory) m[key].majors.add(e.majorCategory);
    });
    return Object.entries(m).sort((a, b) => b[1].count - a[1].count);
  }, [equipments, mode]);

  const [mapping, setMapping]   = useState({});
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });

  const switchMode = (m) => { if (running) return; setMode(m); setMapping({}); };

  const matchKey = (e) => (mode === "minor" ? e.minorCategory : e.majorCategory) || "(비어있음)";

  // 실제로 바뀔 장비 (선택했고, 현재 majorCategory와 다른 것)
  const targets = equipments.filter((e) => {
    const k = matchKey(e);
    return mapping[k] && mapping[k] !== (e.majorCategory || "");
  });

  const apply = async () => {
    if (targets.length === 0) { alert("바꿀 항목을 하나 이상 선택해줘"); return; }
    setRunning(true);
    setProgress({ cur: 0, total: targets.length });
    let cur = 0;
    for (const e of targets) {
      const k = matchKey(e);
      try { await updateItem("equipments", e.id, { majorCategory: mapping[k] }); }
      catch (err) { console.error("변경 실패:", e.id, err); }
      cur++;
      setProgress({ cur, total: targets.length });
    }
    setRunning(false);
    setDone(true);
  };

  return (
    <Modal onClose={running ? () => {} : onClose} width={580}>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 6 }}>🗂️ 카테고리 일괄 정리</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
        장비를 새 카테고리(대분류)로 분류해. 학생 화면 카테고리 그리드는 아래 새 이름으로 매칭돼.
      </div>

      {!done && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, background: C.bg, padding: 4, borderRadius: 10 }}>
          {[["minor", "중분류 기준"], ["major", "대분류 기준"]].map(([v, label]) => (
            <button key={v} onClick={() => switchMode(v)} disabled={running}
              style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                background: mode === v ? C.navy : "transparent", color: mode === v ? "#fff" : C.muted }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {done ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>완료! 카테고리가 정리됐어</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>학생 화면에서 카테고리 눌러서 확인해봐</div>
          <Btn onClick={onClose} color={C.navy} full>닫기</Btn>
        </div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: C.muted, fontSize: 13 }}>등록된 장비가 없어</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
            {mode === "minor" ? "중분류별로 새 카테고리 지정" : "대분류별로 새 카테고리 지정"} · 총 {groups.length}개 항목
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "42vh", overflowY: "auto" }}>
            {groups.map(([key, info]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: C.bg, borderRadius: 9, border: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key}</div>
                  <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {info.count}개{mode === "minor" && info.majors.size > 0 ? ` · 현재 대분류: ${[...info.majors].join(", ")}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>→</div>
                <select
                  value={mapping[key] || ""}
                  onChange={(e) => setMapping((p) => ({ ...p, [key]: e.target.value }))}
                  disabled={running}
                  style={{ flex: 1, maxWidth: 150, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 8, color: mapping[key] ? C.text : C.muted, padding: "8px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  <option value="">변경 안 함</option>
                  {ASSIGNABLE.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
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
            <Btn onClick={apply} color={C.teal} full disabled={running}>{running ? "변경 중..." : targets.length > 0 ? `${targets.length}개 적용` : "적용"}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
