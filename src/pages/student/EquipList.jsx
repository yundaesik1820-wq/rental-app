import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Empty, PageTitle, Modal } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import RentalTimeline from "../../components/RentalTimeline";
import { groupEquipments } from "../../utils/groupEquipments";

// 세트 그룹화
function groupSets(equipments) {
  const map = {};
  equipments.filter(e => e.isSet).forEach(e => {
    const key = e.modelName || "";
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        modelName:     key,
        itemName:      e.itemName      || "",
        majorCategory: e.majorCategory || "",
        minorCategory: e.minorCategory || "",
        manufacturer:  e.manufacturer  || "",
        setItems:      e.setItems      || "",
        description:   e.description   || "",
        photoUrls:       e.photoUrls     || [],
        displayPhotoUrl: e.displayPhotoUrl || "",
        units: [], total: 0, available: 0,
      };
    }
    map[key].units.push(e);
    map[key].total++;
    if ((e.status || "대여가능") === "대여가능") map[key].available++;
    if (!map[key].setItems && e.setItems) map[key].setItems = e.setItems;
    if (map[key].photoUrls.length === 0 && e.photoUrls?.length > 0) map[key].photoUrls = e.photoUrls;
    if (!map[key].displayPhotoUrl && e.displayPhotoUrl) map[key].displayPhotoUrl = e.displayPhotoUrl;
    if (!map[key].description && e.description) map[key].description = e.description;
  });
  return Object.values(map);
}

const licenseToNum = (lic) => {
  if (!lic || lic === "없음") return 0;
  const n = parseInt(lic);
  return isNaN(n) ? 0 : n;
};

export default function EquipList() {
  const { profile } = useAuth();
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: requests }   = useCollection("rentalRequests", "createdAt");

  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("");
  const [tabView, setTabView] = useState("단품"); // "단품" | "세트"
  const [expandedSet, setExpandedSet] = useState(null);
  const [showDescModel, setShowDescModel] = useState(null); // 설명 보기
  const [photoIdx, setPhotoIdx] = useState({});

  // 단품 / 세트 분리
  const unitEquips = equipments.filter(e => !e.isSet);
  const grouped    = groupEquipments(unitEquips);
  const setEquips  = groupSets(equipments);

  // 카테고리 커스텀 순서
  const CAT_ORDER = ["촬영", "렌즈", "ACC", "트라이포드/그립", "모니터", "조명", "음향"];
  const rawCats = [...new Set([
    ...grouped.map(e => e.majorCategory),
    ...setEquips.map(e => e.majorCategory),
  ].filter(Boolean))];
  const sortedCats = [
    ...CAT_ORDER.filter(c => rawCats.includes(c)),
    ...rawCats.filter(c => !CAT_ORDER.includes(c)), // 지정 안된 카테고리는 뒤에
  ];
  const allCats = sortedCats; // 전체 제거

  const filteredUnits = grouped.filter(e =>
    (!filter || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.manufacturer?.includes(search))
  );
  const filteredSets = setEquips.filter(e =>
    (!filter || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search))
  );

  const getIdx = (key) => photoIdx[key] || 0;
  const setIdx = (key, val, max) => setPhotoIdx(p => ({ ...p, [key]: Math.max(0, Math.min(val, max - 1)) }));

  return (
    <div>
      {/* 장비목록 안내 배너 */}
      <div style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img src="/mascot/equippp.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
          <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
            <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
            <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 장비 목록 페이지야!</div>
            <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>대여 가능한 장비를 미리 확인해봐.<br/>카테고리별로 필터링도 할 수 있어 📷</div>
          </div>
        </div>
      </div>

      {/* 1행: 대분류 카테고리 (전체 제외, 1행 스크롤) */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"nowrap", overflowX:"auto", paddingBottom:2, WebkitOverflowScrolling:"touch" }}>
        <button onClick={() => { setFilter(""); setSearch(""); }}
          style={{ background:!filter?C.navy:C.surface, color:!filter?"#fff":C.muted, border:`1px solid ${!filter?C.navy:C.border}`, borderRadius:20, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
          전체
        </button>
        {allCats.map(c => (
          <button key={c} onClick={() => { setFilter(c); setSearch(""); }}
            style={{ background:filter===c?C.navy:C.surface, color:filter===c?"#fff":C.muted, border:`1px solid ${filter===c?C.navy:C.border}`, borderRadius:20, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
            {c}
          </button>
        ))}
      </div>

      {/* 2행: 검색 */}
      <input placeholder="🔍 장비명, 제조사 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ display: "block", width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

      {/* 3행: 단품 / 세트 탭 */}
      <div style={{ display: "flex", background: C.surface, borderRadius: 12, padding: 4, marginBottom: 16, border: `1px solid ${C.border}`, width: "fit-content" }}>
        {[["단품", "🔧"], ["세트", "📦"]].map(([v, icon]) => (
          <button key={v} onClick={() => setTabView(v)}
            style={{ background: tabView === v ? C.navy : "transparent", color: tabView === v ? "#fff" : C.muted, border: "none", borderRadius: 9, padding: "8px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
            {icon} {v}
            <span style={{ background: tabView === v ? "rgba(255,255,255,0.25)" : C.bg, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
              {v === "단품" ? filteredUnits.length : filteredSets.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── 단품 목록 ── */}
      {tabView === "단품" && (
        <>
          {filteredUnits.length === 0 && <Empty icon="🔍" text="해당하는 장비가 없습니다" />}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filteredUnits.map(e => {
              const photos = e.displayPhotoUrl ? [e.displayPhotoUrl] : (e.photoUrls || []);
              const myLic  = licenseToNum(profile?.license);
              const eqLic  = e.licenseLevel || 0;
              const locked = profile?.role !== "professor" && myLic < eqLic;
              const avail  = e.available > 0;
              return (
                <Card key={e.modelName} style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    {/* 썸네일 */}
                    {photos.length > 0 && (
                      <div style={{ width:46, height:46, borderRadius:7, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
                        <img src={photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                      </div>
                    )}
                    {/* 정보 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:4, marginBottom:2 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:C.navy, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.modelName}</div>
                        <span style={{ flexShrink:0, background:avail?C.greenLight:C.redLight, color:avail?C.green:C.red, borderRadius:5, padding:"1px 6px", fontSize:10, fontWeight:700 }}>
                          {avail ? "대여가능" : "대여불가"}
                        </span>
                      </div>
                      {e.manufacturer && <div style={{ fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{e.manufacturer}</div>}
                      <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
                        {e.minorCategory && <span style={{ background:C.blueLight, color:C.blue, borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>{e.minorCategory}</span>}
                        {eqLic > 0 && (
                          <span style={{ background:locked?C.redLight:C.blueLight, color:locked?C.red:C.blue, borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>
                            {locked ? `🔴 Lv.${eqLic}` : `🔵 Lv.${eqLic}`}
                          </span>
                        )}
                        <span style={{ fontSize:9, color:C.muted }}>{e.available}/{e.total}대</span>
                        <button onClick={ev => { ev.stopPropagation(); setShowDescModel(e); }}
                          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, padding:"1px 6px", fontSize:9, color:C.muted, cursor:"pointer", marginLeft:"auto", flexShrink:0, whiteSpace:"nowrap" }}>
                          🔍 장비가 궁금하다면?
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* 재고 바 */}
                  <div style={{ background:C.border, borderRadius:4, height:2, overflow:"hidden", marginTop:6 }}>
                    <div style={{ width:`${(e.available/e.total)*100}%`, background:avail?C.teal:C.red, height:"100%", borderRadius:4 }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── 세트 목록 ── */}
      {tabView === "세트" && (
        <>
          {filteredSets.length === 0 && <Empty icon="📦" text="등록된 세트 장비가 없습니다" />}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filteredSets.map(e => {
              const photos   = e.displayPhotoUrl ? [e.displayPhotoUrl] : (e.photoUrls || []);
              const isExpand = expandedSet === e.modelName;
              const setList  = e.setItems ? e.setItems.split("\n").filter(Boolean) : [];
              const avail    = e.available > 0;
              return (
                <Card key={e.modelName} style={{ padding:"12px 14px", border:`1.5px solid ${C.orange}20` }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    {/* 썸네일 */}
                    {photos.length > 0 && (
                      <div style={{ width:46, height:46, borderRadius:7, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
                        <img src={photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                      </div>
                    )}
                    {/* 정보 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:6, marginBottom:2 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:C.navy, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.modelName}</div>
                        <span style={{ flexShrink:0, background:avail?C.greenLight:C.redLight, color:avail?C.green:C.red, borderRadius:6, padding:"2px 7px", fontSize:11, fontWeight:700 }}>
                          {avail ? "대여가능" : "대여불가"}
                        </span>
                      </div>
                      {e.manufacturer && <div style={{ fontSize:12, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>{e.manufacturer}</div>}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <span style={{ background:"#FFF7ED", color:"#EA580C", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>📦 세트</span>
                        {e.minorCategory && <span style={{ background:C.blueLight, color:C.blue, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{e.minorCategory}</span>}
                        <span style={{ fontSize:10, color:C.muted }}>{e.available}/{e.total}세트</span>
                      </div>
                    </div>
                  </div>
                  {/* 재고 바 */}
                  <div style={{ background:C.border, borderRadius:4, height:3, overflow:"hidden", marginTop:8, marginBottom: setList.length>0?8:0 }}>
                    <div style={{ width:`${(e.available/e.total)*100}%`, background:avail?C.teal:C.red, height:"100%", borderRadius:4 }} />
                  </div>

                  {/* 구성품 목록 펼치기 */}
                  {setList.length > 0 && (
                    <>
                      <button
                        onClick={() => setExpandedSet(isExpand ? null : e.modelName)}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: isExpand ? C.navy : C.bg, color: isExpand ? "#fff" : C.navy, border: `1px solid ${isExpand ? C.navy : C.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%", justifyContent: "center", marginBottom: isExpand ? 12 : 0 }}>
                        📋 구성품 보기 ({setList.length}개) {isExpand ? "▲" : "▼"}
                      </button>

                      {isExpand && (
                        <div style={{ background: C.bg, borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>📦 세트 구성품 목록</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 6 }}>
                            {setList.map((item, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, borderRadius: 8, padding: "7px 10px", border: `1px solid ${C.border}` }}>
                                <span style={{ fontSize: 16, flexShrink: 0 }}>•</span>
                                <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{item.trim()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* 장비 설명 모달 */}
      {showDescModel && (
        <Modal onClose={() => setShowDescModel(null)} width={400}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            {showDescModel.displayPhotoUrl && (
              <img src={showDescModel.displayPhotoUrl} alt="" style={{ width:60, height:60, objectFit:"contain", borderRadius:8, border:`1px solid ${C.border}`, flexShrink:0 }} />
            )}
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>{showDescModel.modelName}</div>
              {showDescModel.manufacturer && <div style={{ fontSize:12, color:C.muted }}>{showDescModel.manufacturer}</div>}
            </div>
          </div>
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", fontSize:13, lineHeight:1.7, whiteSpace:"pre-wrap" }}>
            {showDescModel.description
              ? <span style={{ color:C.text }}>{showDescModel.description}</span>
              : <span style={{ color:C.muted }}>아직 장비 설명이 등록되지 않았어요.<br/>관리자에게 문의해주세요.</span>
            }
          </div>
          <div style={{ marginTop:16, textAlign:"right" }}>
            <button onClick={() => setShowDescModel(null)}
              style={{ background:C.navy, color:"#fff", border:"none", borderRadius:10, padding:"9px 20px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              확인
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}