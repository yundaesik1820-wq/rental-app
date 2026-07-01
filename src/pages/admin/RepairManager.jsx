import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 수리 상태 4단계
const STATUS = ["접수", "수리중", "수리불가", "수리완료"];
const ST_COLOR = {
  접수:     { c: C.blue,   bg: C.blueLight },
  수리중:   { c: C.yellow, bg: C.yellowLight },
  수리불가: { c: C.red,    bg: C.redLight },
  수리완료: { c: C.green,  bg: C.greenLight },
};
// 수리 상태 → 장비(equipments) 상태 자동 동기화 매핑
const EQUIP_STATUS = { 접수: "수리중", 수리중: "수리중", 수리불가: "대여불가", 수리완료: "대여가능" };
// 완료일(처리일)이 찍히는 종료 상태
const DONE_STATES = ["수리불가", "수리완료"];

const EMPTY = () => ({
  equipId: "", equipName: "", unitNo: "", itemNo: "", issue: "", status: "접수",
  vendor: "", cost: "", requestDate: todayStr(), doneDate: "", note: "",
});

const equipLabel = (e) =>
  `${e.modelName || "(이름없음)"}${e.unitNo ? ` ${e.unitNo}` : ""}${e.itemNo ? ` #${e.itemNo}` : ""}`;

export default function RepairManager() {
  const { data: repairs, loading }   = useCollection("repairs", "createdAt");
  const { data: equipments }         = useCollection("equipments", "createdAt");
  const [filter, setFilter]     = useState("전체");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY());
  const [equipSearch, setEquipSearch] = useState("");
  const [saving, setSaving]     = useState(false);

  const openNew  = () => { setEditing(null); setForm(EMPTY()); setEquipSearch(""); setShowForm(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...EMPTY(), ...r }); setEquipSearch(""); setShowForm(true); };

  // 연결된 장비 status 자동 동기화
  const syncEquip = async (equipId, repairStatus) => {
    if (!equipId) return;
    const es = EQUIP_STATUS[repairStatus];
    if (!es) return;
    try { await updateItem("equipments", equipId, { status: es }); } catch (err) { /* 장비 문서 없으면 무시 */ }
  };

  const pickEquip = (e) => {
    setForm((p) => ({ ...p, equipId: e.id, equipName: e.modelName || "", unitNo: e.unitNo || "", itemNo: e.itemNo || "" }));
    setEquipSearch("");
  };
  const clearEquip = () => setForm((p) => ({ ...p, equipId: "", equipName: "", unitNo: "", itemNo: "" }));

  const handleSave = async () => {
    if (!form.equipId) { alert("연결할 장비를 선택해줘 (장비 관리에 등록된 장비만 가능)"); return; }
    if (!form.issue.trim()) { alert("증상/고장 내용을 입력해줘"); return; }
    setSaving(true);
    try {
      const doneDate = DONE_STATES.includes(form.status) ? (form.doneDate || todayStr()) : (form.doneDate || "");
      const payload = {
        equipId: form.equipId,
        equipName: form.equipName || "",
        unitNo: form.unitNo || "",
        itemNo: form.itemNo || "",
        issue: form.issue.trim(),
        status: form.status,
        vendor: form.vendor.trim(),
        cost: form.cost.trim(),
        requestDate: form.requestDate || "",
        doneDate,
        note: form.note.trim(),
      };
      if (editing) await updateItem("repairs", editing.id, payload);
      else await addItem("repairs", payload);
      await syncEquip(form.equipId, form.status);
      setShowForm(false);
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
    setSaving(false);
  };

  // 카드에서 상태 바로 변경 (다음 단계로 순환)
  const cycleStatus = async (r) => {
    const next = STATUS[(STATUS.indexOf(r.status) + 1) % STATUS.length];
    const patch = { status: next };
    if (DONE_STATES.includes(next) && !r.doneDate) patch.doneDate = todayStr();
    if (!DONE_STATES.includes(next)) patch.doneDate = "";
    try {
      await updateItem("repairs", r.id, patch);
      await syncEquip(r.equipId, next);
    } catch (err) { alert("변경 실패: " + err.message); }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`'${r.equipName}' 수리 기록을 삭제할까?\n(장비 상태는 그대로 유지돼. 필요하면 장비 관리에서 직접 바꿔줘)`)) return;
    try { await deleteItem("repairs", r.id); } catch (err) { alert("삭제 실패: " + err.message); }
  };

  const counts = STATUS.reduce((a, s) => { a[s] = repairs.filter(r => r.status === s).length; return a; }, {});
  const shown  = filter === "전체" ? repairs : repairs.filter(r => r.status === filter);

  // 장비 선택 검색 결과
  const eqQuery = equipSearch.trim().toLowerCase();
  const eqList = (eqQuery
    ? equipments.filter(e => equipLabel(e).toLowerCase().includes(eqQuery))
    : equipments
  ).slice(0, 30);

  return (
    <div>
      <PageTitle>장비 수리 관리</PageTitle>
      <div style={{ marginBottom: 12 }}>
        <Btn onClick={openNew} color={C.teal} full>+ 수리 등록</Btn>
      </div>

      {/* 상태 필터 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {["전체", ...STATUS].map(s => {
          const active = filter === s;
          const n = s === "전체" ? repairs.length : (counts[s] || 0);
          return (
            <button key={s} onClick={() => setFilter(s)}
              style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 20, border: `1px solid ${active ? C.teal : C.border}`,
                background: active ? C.teal : "transparent", color: active ? "#fff" : C.muted,
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {s} {n}
            </button>
          );
        })}
      </div>

      {loading && <Empty icon="⏳" text="불러오는 중..." />}
      {!loading && shown.length === 0 && <Empty icon="🔧" text={filter === "전체" ? "등록된 수리 기록이 없어" : `'${filter}' 상태인 기록이 없어`} />}

      {shown.map((r) => {
        const sc = ST_COLOR[r.status] || { c: C.muted, bg: C.bg };
        return (
          <Card key={r.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: C.text }}>
                  {r.equipName}{r.unitNo ? <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>  {r.unitNo}</span> : null}
                  {r.itemNo ? <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, fontFamily: "monospace" }}>  #{r.itemNo}</span> : null}
                </div>
              </div>
              <button onClick={() => cycleStatus(r)}
                style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: sc.c, background: sc.bg, padding: "4px 11px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {r.status} ⟳
              </button>
            </div>

            <div style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.5 }}>🔧 {r.issue}</div>
            {r.vendor && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }}>🏭 {r.vendor}</div>}
            {r.cost   && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>💰 {r.cost}</div>}
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>
              📅 접수 {r.requestDate || "-"}{r.doneDate ? `  ·  완료 ${r.doneDate}` : ""}
            </div>
            {r.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, background: C.surface, borderRadius: 8, padding: "7px 10px", lineHeight: 1.45 }}>📝 {r.note}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn onClick={() => openEdit(r)} color={C.navy} small full>수정</Btn>
              <Btn onClick={() => handleDelete(r)} color={C.red} small full outline>삭제</Btn>
            </div>
          </Card>
        );
      })}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} width={480}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 14 }}>
            {editing ? "수리 기록 수정" : "수리 등록"}
          </div>

          {/* 장비 선택 (필수) */}
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>장비 선택 *</div>
          {form.equipId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: C.surface, border: `1.5px solid ${C.teal}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                🔩 {form.equipName}{form.unitNo ? ` ${form.unitNo}` : ""}{form.itemNo ? ` #${form.itemNo}` : ""}
              </div>
              <button onClick={clearEquip} style={{ flexShrink: 0, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 11, fontWeight: 700, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>변경</button>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <input value={equipSearch} onChange={(e) => setEquipSearch(e.target.value)} placeholder="장비명·물품번호로 검색"
                style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
              <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {eqList.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "16px 0" }}>일치하는 장비가 없어</div>
                ) : eqList.map((e) => {
                  const sc = { 대여가능: C.green, 대여중: C.blue, 수리중: C.yellow, 대여불가: C.red }[e.status] || C.muted;
                  return (
                    <button key={e.id} onClick={() => pickEquip(e)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: "none", borderBottom: `1px solid ${C.border}`, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <span style={{ fontSize: 13, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{equipLabel(e)}</span>
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: sc }}>{e.status || "대여가능"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Inp label="증상 / 고장 내용 *" placeholder="예: 전원이 안 켜짐 / 렌즈 마운트 헐거움" value={form.issue} onChange={(e) => setForm((p) => ({ ...p, issue: e.target.value }))} />

          {/* 상태 */}
          <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 6px" }}>상태 (장비 상태 자동 반영)</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {STATUS.map(s => {
              const active = form.status === s;
              const sc = ST_COLOR[s];
              return (
                <button key={s} onClick={() => setForm((p) => ({ ...p, status: s }))}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1.5px solid ${active ? sc.c : C.border}`,
                    background: active ? sc.bg : "transparent", color: active ? sc.c : C.muted,
                    fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  {s}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
            → 장비: {EQUIP_STATUS[form.status]} 로 자동 변경
          </div>

          <Inp label="수리업체" placeholder="예: OO카메라 서비스센터" value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} />
          <Inp label="비용" placeholder="예: 80,000원" value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} />

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 6px" }}>접수일</div>
              <input type="date" value={form.requestDate} onChange={(e) => setForm((p) => ({ ...p, requestDate: e.target.value }))}
                style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 6px" }}>완료일</div>
              <input type="date" value={form.doneDate} onChange={(e) => setForm((p) => ({ ...p, doneDate: e.target.value }))}
                style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>메모</div>
            <textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="추가 메모 (선택)"
              style={{ width: "100%", minHeight: 70, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSave} color={C.teal} full disabled={saving}>{saving ? "저장 중..." : "저장"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
