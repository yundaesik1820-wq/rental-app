import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle, Select } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";

const EMOJIS = ["📦","📷","📸","💻","📱","🎥","🚁","🎙️","📽️","🔬","🖨️","🎛️"];

function InspModal({ item, inspections, onClose }) {
  const [form, setForm] = useState({ type: "정기점검", note: "", result: "정상" });
  const mine = inspections.filter(i => i.equipId === item.id).sort((a, b) => b.date?.localeCompare(a.date));

  const handleAdd = async () => {
    if (!form.note) return;
    await addItem("inspections", { equipId: item.id, equipName: item.name, date: new Date().toISOString().slice(0, 10), inspector: "관리자", ...form });
    setForm({ type: "정기점검", note: "", result: "정상" });
  };

  return (
    <Modal onClose={onClose} width={500}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginBottom: 4 }}>🔧 점검 이력</div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>{item.img} {item.name}</div>

      <div style={{ background: C.bg, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>새 점검 기록</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["정기점검", "수리", "파손확인"].map(t => (
            <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} style={{ flex: 1, background: form.type === t ? C.navy : C.surface, color: form.type === t ? "#fff" : C.muted, border: `1px solid ${form.type === t ? C.navy : C.border}`, borderRadius: 8, padding: "7px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t}</button>
          ))}
        </div>
        <Inp placeholder="점검 내용을 입력하세요" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["정상", "수리필요", "폐기"].map(r => (
            <button key={r} onClick={() => setForm(p => ({ ...p, result: r }))} style={{ flex: 1, background: form.result === r ? C.green : C.surface, color: form.result === r ? "#fff" : C.muted, border: `1px solid ${form.result === r ? C.green : C.border}`, borderRadius: 8, padding: "7px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{r}</button>
          ))}
        </div>
        <Btn onClick={handleAdd} color={C.teal} full>기록 추가</Btn>
      </div>

      <div>
        {mine.length === 0 && <Empty icon="📋" text="점검 이력이 없습니다" />}
        {mine.map(i => (
          <div key={i.id} style={{ background: C.surface, borderRadius: 12, padding: "12px 16px", marginBottom: 10, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{i.type}</span>
              <Badge label={i.result} />
            </div>
            <div style={{ fontSize: 13, color: C.text }}>{i.note}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{i.date} · {i.inspector}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}><Btn onClick={onClose} color={C.navy} full>닫기</Btn></div>
    </Modal>
  );
}

export default function Equipment() {
  const { data: equipments } = useCollection("equipments", "name");
  const { data: inspections } = useCollection("inspections", "createdAt");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const [showAdd, setShowAdd] = useState(false);
  const [inspItem, setInspItem] = useState(null);
  const [form, setForm] = useState({ name: "", category: "", total: "", img: "📦", desc: "" });

  const cats = ["전체", ...new Set(equipments.map(e => e.category))];
  const filtered = equipments.filter(e =>
    (filter === "전체" || e.category === filter) &&
    (e.name?.includes(search) || e.category?.includes(search))
  );

  const addEquip = async () => {
    if (!form.name || !form.category || !form.total) return;
    await addItem("equipments", { ...form, status: "대여가능", total: +form.total, available: +form.total });
    setForm({ name: "", category: "", total: "", img: "📦", desc: "" }); setShowAdd(false);
  };

  const cycleStatus = async (e) => {
    const cycle = ["대여가능", "수리중"];
    const next = cycle[(cycle.indexOf(e.status) + 1) % cycle.length];
    await updateItem("equipments", e.id, { status: next });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>🔧 장비 관리</PageTitle>
        <Btn onClick={() => setShowAdd(true)}>+ 장비 추가</Btn>
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>새 장비 등록</div>
          <Inp label="장비명" placeholder="예: 캐논 EOS R5" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Inp label="카테고리" placeholder="예: 카메라" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
          <Inp label="보유 수량" placeholder="예: 5" value={form.total} onChange={e => setForm(p => ({ ...p, total: e.target.value }))} />
          <Inp label="설명" placeholder="간단한 설명" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>아이콘</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {EMOJIS.map(em => (
                <span key={em} onClick={() => setForm(p => ({ ...p, img: em }))} style={{ fontSize: 24, cursor: "pointer", opacity: form.img === em ? 1 : 0.35, transition: "opacity 0.15s" }}>{em}</span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={addEquip} full>등록</Btn>
          </div>
        </Modal>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <input placeholder="🔍 장비명 또는 카테고리 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? C.navy : C.surface, color: filter === c ? "#fff" : C.muted, border: `1px solid ${filter === c ? C.navy : C.border}`, borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {filtered.map(e => (
          <Card key={e.id}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <span style={{ fontSize: 36 }}>{e.img || "📦"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{e.name}</div>
                  <Badge label={e.status} />
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{e.category} · {e.desc}</div>
                <div style={{ background: C.border, borderRadius: 6, height: 6, marginTop: 10, overflow: "hidden" }}>
                  <div style={{ width: `${((e.available || 0) / (e.total || 1)) * 100}%`, background: (e.available || 0) === 0 ? C.red : C.teal, height: "100%", borderRadius: 6 }} />
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{e.available}/{e.total} 대여가능</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Btn onClick={() => setInspItem(e)} small color={C.purple}>점검이력</Btn>
                  <Btn onClick={() => cycleStatus(e)} small color={C.yellow} text={C.text} outline>상태변경</Btn>
                  <Btn onClick={() => deleteItem("equipments", e.id)} small color={C.red} outline>삭제</Btn>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && <Empty icon="🔧" text="장비가 없습니다" />}
      {inspItem && <InspModal item={inspItem} inspections={inspections} onClose={() => setInspItem(null)} />}
    </div>
  );
}
