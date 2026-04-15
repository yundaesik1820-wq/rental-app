import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";

// ── 점검 이력 모달 ─────────────────────────────────────────
function InspModal({ item, inspections, onAdd, onClose }) {
  const [form, setForm] = useState({ type: "정기점검", note: "", result: "정상" });
  const mine = inspections.filter(i => i.equipId === item.id)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const handleAdd = async () => {
    if (!form.note) return;
    await onAdd({ equipId: item.id, equipName: item.modelName || item.name, date: new Date().toISOString().slice(0, 10), inspector: "관리자", ...form });
    setForm({ type: "정기점검", note: "", result: "정상" });
  };

  return (
    <Modal onClose={onClose} width={500}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 4 }}>🔧 점검 이력</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{item.modelName} · {item.itemName}</div>
      <div style={{ background: C.bg, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["정기점검","수리","파손확인"].map(t => (
            <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} style={{ flex: 1, background: form.type === t ? C.navy : C.surface, color: form.type === t ? "#fff" : C.muted, border: `1px solid ${form.type === t ? C.navy : C.border}`, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t}</button>
          ))}
        </div>
        <Inp placeholder="점검 내용" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["정상","수리필요","폐기"].map(r => (
            <button key={r} onClick={() => setForm(p => ({ ...p, result: r }))} style={{ flex: 1, background: form.result === r ? C.green : C.surface, color: form.result === r ? "#fff" : C.muted, border: `1px solid ${form.result === r ? C.green : C.border}`, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{r}</button>
          ))}
        </div>
        <Btn onClick={handleAdd} color={C.teal} full>기록 추가</Btn>
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {mine.length === 0 && <Empty icon="📋" text="점검 이력이 없습니다" />}
        {mine.map(i => (
          <div key={i.id} style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{i.type}</span>
              <Badge label={i.result} />
            </div>
            <div style={{ fontSize: 12, color: C.text }}>{i.note}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{i.date} · {i.inspector}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><Btn onClick={onClose} color={C.navy} full>닫기</Btn></div>
    </Modal>
  );
}

// ── 세부사항 모달 ──────────────────────────────────────────
function DetailModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    location:   item.location   || "",
    photoUrl:   item.photoUrl   || "",
    serialNo:   item.serialNo   || "",
    note:       item.note       || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(item.id, form);
    setSaving(false);
    onClose();
  };

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 4 }}>📋 세부사항</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{item.modelName} · {item.itemName}</div>

      {/* 제품사진 미리보기 */}
      {form.photoUrl && (
        <div style={{ marginBottom: 14, textAlign: "center" }}>
          <img src={form.photoUrl} alt="제품사진" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 10, objectFit: "contain", border: `1px solid ${C.border}` }}
            onError={e => e.target.style.display = "none"} />
        </div>
      )}

      <Inp label="보관 위치" placeholder="예: A동 101호 3번 선반" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
      <Inp label="제품 사진 URL" placeholder="https://..." value={form.photoUrl} onChange={e => setForm(p => ({ ...p, photoUrl: e.target.value }))} />
      <Inp label="S/N (시리얼 넘버)" placeholder="예: SN-20240001" value={form.serialNo} onChange={e => setForm(p => ({ ...p, serialNo: e.target.value }))} />
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>특이사항</div>
        <textarea
          placeholder="특이사항 또는 관리 메모 입력"
          value={form.note}
          onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
          style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 80, boxSizing: "border-box" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn onClick={onClose} color={C.muted} outline full>취소</Btn>
        <Btn onClick={handleSave} full disabled={saving}>{saving ? "저장 중..." : "저장"}</Btn>
      </div>
    </Modal>
  );
}

// ── 장비 카드 ──────────────────────────────────────────────
function EquipCard({ e, onDetail, onInsp, onDelete, onToggleStatus }) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          {/* 분류 태그 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {e.majorCategory && <span style={{ background: C.blueLight, color: C.blue, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{e.majorCategory}</span>}
            {e.minorCategory && <span style={{ background: C.bg, color: C.muted, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}` }}>{e.minorCategory}</span>}
          </div>

          {/* 모델명 + 품명 */}
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{e.modelName}</div>
          <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{e.itemName}</div>

          {/* 제조사 + 물품번호 */}
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            {e.manufacturer && <span style={{ fontSize: 12, color: C.muted }}>🏭 {e.manufacturer}</span>}
            {e.itemNo && <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>#{e.itemNo}</span>}
          </div>

          {/* 세부사항 요약 */}
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {e.location  && <span style={{ fontSize: 11, color: C.muted }}>📍 {e.location}</span>}
            {e.serialNo  && <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>S/N: {e.serialNo}</span>}
          </div>
        </div>
        <Badge label={e.status || "대여가능"} />
      </div>

      {/* 제품 사진 */}
      {e.photoUrl && (
        <div style={{ marginBottom: 10 }}>
          <img src={e.photoUrl} alt="제품사진" style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg }}
            onError={i => i.target.style.display = "none"} />
        </div>
      )}

      {/* 재고 바 */}
      <div style={{ background: C.border, borderRadius: 6, height: 6, marginBottom: 4, overflow: "hidden" }}>
        <div style={{ width: `${((e.available || 0) / (e.total || 1)) * 100}%`, background: (e.available || 0) === 0 ? C.red : C.teal, height: "100%", borderRadius: 6 }} />
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>재고 {e.available || 0} / {e.total || 0}</div>

      {/* 특이사항 */}
      {e.note && (
        <div style={{ background: C.yellowLight, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#92400E" }}>
          💬 {e.note}
        </div>
      )}

      {/* 버튼 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={() => onDetail(e)} small color={C.blue}>📋 세부사항</Btn>
        <Btn onClick={() => onInsp(e)}   small color={C.purple}>🔧 점검이력</Btn>
        <Btn onClick={() => onToggleStatus(e)} small color={C.yellow} text={C.text} outline>상태변경</Btn>
        <Btn onClick={() => onDelete(e.id)}    small color={C.red}   outline>삭제</Btn>
      </div>
    </Card>
  );
}

// ── 메인 ──────────────────────────────────────────────────
const EMPTY_FORM = {
  majorCategory: "", minorCategory: "", manufacturer: "",
  modelName: "", itemName: "", itemNo: "",
  total: "", available: "",
  status: "대여가능",
  // 세부사항
  location: "", photoUrl: "", serialNo: "", note: "",
};

export default function Equipment() {
  const { data: equipments } = useCollection("equipments", "name");
  const { data: inspections } = useCollection("inspections", "createdAt");

  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("전체");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [inspItem, setInspItem]   = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  const majorCats = ["전체", ...new Set(equipments.map(e => e.majorCategory).filter(Boolean))];
  const filtered  = equipments.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.manufacturer?.includes(search) || e.itemNo?.includes(search))
  );

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const addEquip = async () => {
    if (!form.modelName || !form.itemName || !form.total) return;
    const tot = +form.total;
    await addItem("equipments", { ...form, total: tot, available: tot });
    setForm(EMPTY_FORM);
    setShowAdd(false);
  };

  const cycleStatus = async (e) => {
    const cycle = ["대여가능", "수리중", "대여불가"];
    const next  = cycle[(cycle.indexOf(e.status || "대여가능") + 1) % cycle.length];
    await updateItem("equipments", e.id, { status: next });
  };

  const saveDetail = (id, data) => updateItem("equipments", id, data);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>🔧 장비 관리</PageTitle>
        <Btn onClick={() => setShowAdd(true)}>+ 장비 추가</Btn>
      </div>

      {/* 장비 추가 모달 */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} width={520}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>새 장비 등록</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 5 }}>대분류 *</div>
              <input placeholder="예: 카메라, 캠코더" value={form.majorCategory} onChange={e => f("majorCategory", e.target.value)}
                style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 5 }}>소분류</div>
              <input placeholder="예: 미러리스, DSLR" value={form.minorCategory} onChange={e => f("minorCategory", e.target.value)}
                style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ height: 12 }} />
          <Inp label="제조사" placeholder="예: SONY, CANON" value={form.manufacturer} onChange={e => f("manufacturer", e.target.value)} />
          <Inp label="모델명 *" placeholder="예: PXW-Z150" value={form.modelName} onChange={e => f("modelName", e.target.value)} />
          <Inp label="품명 *" placeholder="예: XDCAM 방송용 캠코더" value={form.itemName} onChange={e => f("itemName", e.target.value)} />
          <Inp label="물품번호" placeholder="예: CAM-001" value={form.itemNo} onChange={e => f("itemNo", e.target.value)} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Inp label="보유 수량 *" placeholder="7" value={form.total} onChange={e => f("total", e.target.value)} />
          </div>

          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>세부사항 (선택)</div>
            <Inp label="보관 위치" placeholder="예: A동 101호 3번 선반" value={form.location} onChange={e => f("location", e.target.value)} />
            <Inp label="제품 사진 URL" placeholder="https://..." value={form.photoUrl} onChange={e => f("photoUrl", e.target.value)} />
            <Inp label="S/N" placeholder="예: SN-20240001" value={form.serialNo} onChange={e => f("serialNo", e.target.value)} />
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 5 }}>특이사항</div>
              <textarea placeholder="특이사항 또는 메모" value={form.note} onChange={e => f("note", e.target.value)}
                style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 60, boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={addEquip} full>등록</Btn>
          </div>
        </Modal>
      )}

      {/* 검색 + 필터 */}
      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="🔍 모델명, 품명, 제조사, 물품번호 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {majorCats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? C.navy : C.surface, color: filter === c ? "#fff" : C.muted, border: `1px solid ${filter === c ? C.navy : C.border}`, borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      {/* 장비 목록 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px,1fr))", gap: 16 }}>
        {filtered.map(e => (
          <EquipCard
            key={e.id} e={e}
            onDetail={setDetailItem}
            onInsp={setInspItem}
            onDelete={id => deleteItem("equipments", id)}
            onToggleStatus={cycleStatus}
          />
        ))}
      </div>
      {filtered.length === 0 && <Empty icon="🔧" text="등록된 장비가 없습니다" />}

      {/* 모달들 */}
      {inspItem && (
        <InspModal
          item={inspItem}
          inspections={inspections}
          onAdd={data => addItem("inspections", data)}
          onClose={() => setInspItem(null)}
        />
      )}
      {detailItem && (
        <DetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onSave={saveDetail}
        />
      )}
    </div>
  );
}
