import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Empty, PageTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";

export default function EquipList() {
  const { data: equipments } = useCollection("equipments", "name");
  const [search, setSearch]  = useState("");
  const [filter, setFilter]  = useState("전체");

  const cats     = ["전체", ...new Set(equipments.map(e => e.category))];
  const filtered = equipments.filter(e =>
    (filter === "전체" || e.category === filter) &&
    (e.name?.includes(search) || e.category?.includes(search))
  );

  return (
    <div>
      <PageTitle>🔍 장비 목록</PageTitle>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <input placeholder="🔍 장비명 또는 카테고리 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? C.navy : C.surface, color: filter === c ? "#fff" : C.muted, border: `1px solid ${filter === c ? C.navy : C.border}`, borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map(e => (
          <Card key={e.id}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <span style={{ fontSize: 38 }}>{e.img || "📦"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{e.name}</div>
                  <Badge label={e.status} />
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{e.category} · {e.desc}</div>
                <div style={{ background: C.border, borderRadius: 6, height: 6, marginTop: 12, overflow: "hidden" }}>
                  <div style={{ width: `${((e.available||0) / (e.total||1)) * 100}%`, background: (e.available||0) === 0 ? C.red : C.teal, height: "100%", borderRadius: 6 }} />
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{e.available}/{e.total} 대여 가능</div>
                <div style={{ marginTop: 12 }}>
                  {(e.available||0) > 0
                    ? <Btn small color={C.teal}>대여 가능 ✓</Btn>
                    : <Btn small color={C.muted} disabled>현재 대여 불가</Btn>
                  }
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && <Empty icon="🔍" text="해당하는 장비가 없습니다" />}
    </div>
  );
}
