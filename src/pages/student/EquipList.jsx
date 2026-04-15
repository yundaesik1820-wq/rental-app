import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Empty, PageTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { groupEquipments } from "../../utils/groupEquipments";

export default function EquipList() {
  const { data: equipments } = useCollection("equipments", "createdAt");
  const [search, setSearch]  = useState("");
  const [filter, setFilter]  = useState("전체");
  const [photoIdx, setPhotoIdx] = useState({});

  const grouped  = groupEquipments(equipments);
  const cats     = ["전체", ...new Set(grouped.map(e => e.majorCategory).filter(Boolean))];
  const filtered = grouped.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.manufacturer?.includes(search))
  );

  const getIdx = (key) => photoIdx[key] || 0;
  const setIdx = (key, val, max) => setPhotoIdx(p => ({ ...p, [key]: Math.max(0, Math.min(val, max - 1)) }));

  return (
    <div>
      <PageTitle>🔍 장비 목록</PageTitle>

      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <input placeholder="🔍 모델명, 품명, 제조사 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:180, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background:filter===c?C.navy:C.surface, color:filter===c?"#fff":C.muted, border:`1px solid ${filter===c?C.navy:C.border}`, borderRadius:20, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:16 }}>
        {filtered.map(e => {
          const avail  = e.available;
          const photos = e.photoUrls || [];
          const idx    = getIdx(e.modelName);
          return (
            <Card key={e.modelName}>
              <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                {e.majorCategory && <span style={{ background:C.blueLight, color:C.blue, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{e.majorCategory}</span>}
                {e.minorCategory && <span style={{ background:C.bg, color:C.muted, borderRadius:6, padding:"2px 8px", fontSize:11, border:`1px solid ${C.border}` }}>{e.minorCategory}</span>}
              </div>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>{e.modelName}</div>
                <Badge label={avail > 0 ? "대여가능" : "대여불가"} />
              </div>
              {e.itemName     && <div style={{ fontSize:13, color:C.text, marginBottom:2 }}>{e.itemName}</div>}
              {e.manufacturer && <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>🏭 {e.manufacturer}</div>}

              {/* 사진 슬라이드 */}
              {photos.length > 0 && (
                <div style={{ position:"relative", paddingTop:"65%", borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, marginBottom:12 }}>
                  <img src={photos[idx]} alt="제품사진" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain" }} />
                  {photos.length > 1 && (
                    <>
                      <button onClick={() => setIdx(e.modelName, idx-1, photos.length)} style={{ position:"absolute", left:6, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.4)", color:"#fff", border:"none", borderRadius:"50%", width:26, height:26, cursor:"pointer" }}>‹</button>
                      <button onClick={() => setIdx(e.modelName, idx+1, photos.length)} style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.4)", color:"#fff", border:"none", borderRadius:"50%", width:26, height:26, cursor:"pointer" }}>›</button>
                    </>
                  )}
                </div>
              )}

              {/* 재고 바 */}
              <div style={{ background:C.border, borderRadius:6, height:6, overflow:"hidden", marginBottom:4 }}>
                <div style={{ width:`${(avail/e.total)*100}%`, background:avail===0?C.red:C.teal, height:"100%", borderRadius:6 }} />
              </div>
              <div style={{ fontSize:12, color:avail===0?C.red:C.muted, fontWeight:avail===0?700:400, marginBottom:4 }}>
                대여 가능 {avail}대 / 전체 {e.total}대{avail===0?" · 현재 대여 불가":""}
              </div>
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && <Empty icon="🔍" text="해당하는 장비가 없습니다" />}
    </div>
  );
}
