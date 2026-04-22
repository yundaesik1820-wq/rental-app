import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Empty, PageTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
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
        photoUrls:     e.photoUrls     || [],
        units: [], total: 0, available: 0,
      };
    }
    map[key].units.push(e);
    map[key].total++;
    if ((e.status || "대여가능") === "대여가능") map[key].available++;
    if (!map[key].setItems && e.setItems) map[key].setItems = e.setItems;
    if (map[key].photoUrls.length === 0 && e.photoUrls?.length > 0) map[key].photoUrls = e.photoUrls;
  });
  return Object.values(map);
}

export default function EquipList() {
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: requests }   = useCollection("rentalRequests", "createdAt");

  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("전체");
  const [tabView, setTabView] = useState("단품"); // "단품" | "세트"
  const [expandedSet, setExpandedSet] = useState(null);
  const [photoIdx, setPhotoIdx] = useState({});

  // 단품 / 세트 분리
  const unitEquips = equipments.filter(e => !e.isSet);
  const grouped    = groupEquipments(unitEquips);
  const setEquips  = groupSets(equipments);

  const unitCats = ["전체", ...new Set(grouped.map(e => e.majorCategory).filter(Boolean))];
  const setCats  = ["전체", ...new Set(setEquips.map(e => e.majorCategory).filter(Boolean))];
  const cats     = tabView === "단품" ? unitCats : setCats;

  const filteredUnits = grouped.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.manufacturer?.includes(search))
  );
  const filteredSets = setEquips.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search))
  );

  const getIdx = (key) => photoIdx[key] || 0;
  const setIdx = (key, val, max) => setPhotoIdx(p => ({ ...p, [key]: Math.max(0, Math.min(val, max - 1)) }));

  return (
    <div>
      <PageTitle>🔍 장비 목록</PageTitle>

      {/* 단품 / 세트 탭 */}
      <div style={{ display: "flex", background: C.surface, borderRadius: 12, padding: 4, marginBottom: 16, border: `1px solid ${C.border}`, width: "fit-content" }}>
        {[["단품", "🔧"], ["세트", "📦"]].map(([v, icon]) => (
          <button key={v} onClick={() => { setTabView(v); setFilter("전체"); setSearch(""); }}
            style={{ background: tabView === v ? C.navy : "transparent", color: tabView === v ? "#fff" : C.muted, border: "none", borderRadius: 9, padding: "8px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
            {icon} {v} 장비
            <span style={{ background: tabView === v ? "rgba(255,255,255,0.25)" : C.bg, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
              {v === "단품" ? grouped.length : setEquips.length}
            </span>
          </button>
        ))}
      </div>

      {/* 검색 + 카테고리 필터 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="🔍 장비명, 제조사 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? C.navy : C.surface, color: filter === c ? "#fff" : C.muted, border: `1px solid ${filter === c ? C.navy : C.border}`, borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      {/* ── 단품 목록 ── */}
      {tabView === "단품" && (
        <>
          {filteredUnits.length === 0 && <Empty icon="🔍" text="해당하는 장비가 없습니다" />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 16 }}>
            {filteredUnits.map(e => {
              const photos = e.photoUrls || [];
              const idx    = getIdx(e.modelName);
              return (
                <Card key={e.modelName}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {e.majorCategory && <span style={{ background: C.blueLight, color: C.blue, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{e.majorCategory}</span>}
                    {e.minorCategory && <span style={{ background: C.bg, color: C.muted, borderRadius: 6, padding: "2px 8px", fontSize: 11, border: `1px solid ${C.border}` }}>{e.minorCategory}</span>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{e.modelName}</div>
                    <Badge label={e.available > 0 ? "대여가능" : "대여불가"} />
                  </div>
                  {e.itemName     && <div style={{ fontSize: 13, color: C.text, marginBottom: 2 }}>{e.itemName}</div>}
                  {e.manufacturer && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>🏭 {e.manufacturer}</div>}

                  {photos.length > 0 && (
                    <div style={{ position: "relative", paddingTop: "65%", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg, marginBottom: 12 }}>
                      <img src={photos[idx]} alt="제품사진" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                      {photos.length > 1 && (
                        <>
                          <button onClick={() => setIdx(e.modelName, idx - 1, photos.length)} style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer" }}>‹</button>
                          <button onClick={() => setIdx(e.modelName, idx + 1, photos.length)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer" }}>›</button>
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ background: C.border, borderRadius: 6, height: 5, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ width: `${(e.available / e.total) * 100}%`, background: e.available === 0 ? C.red : C.teal, height: "100%", borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 12, color: e.available === 0 ? C.red : C.muted, fontWeight: e.available === 0 ? 700 : 400 }}>
                    대여 가능 {e.available}대 / 전체 {e.total}대{e.available === 0 ? " · 현재 대여 불가" : ""}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filteredSets.map(e => {
              const photos    = e.photoUrls || [];
              const idx       = getIdx(e.modelName);
              const isExpand  = expandedSet === e.modelName;
              const setList   = e.setItems ? e.setItems.split("\n").filter(Boolean) : [];

              return (
                <Card key={e.modelName} style={{ border: `2px solid ${C.orange || "#F97316"}20` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      {/* 태그 */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ background: "#FFF7ED", color: "#EA580C", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, border: "1px solid #FED7AA" }}>📦 세트</span>
                        {e.majorCategory && <span style={{ background: C.blueLight, color: C.blue, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{e.majorCategory}</span>}
                      </div>

                      <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 4 }}>{e.modelName}</div>
                      {e.itemName     && <div style={{ fontSize: 13, color: C.text, marginBottom: 2 }}>{e.itemName}</div>}
                      {e.manufacturer && <div style={{ fontSize: 12, color: C.muted }}>🏭 {e.manufacturer}</div>}
                    </div>

                    {/* 사진 */}
                    {photos.length > 0 && (
                      <div style={{ position: "relative", width: 120, height: 90, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 }}>
                        <img src={photos[idx]} alt="세트사진" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        {photos.length > 1 && (
                          <>
                            <button onClick={() => setIdx(e.modelName, idx - 1, photos.length)} style={{ position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11 }}>‹</button>
                            <button onClick={() => setIdx(e.modelName, idx + 1, photos.length)} style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11 }}>›</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 재고 */}
                  <div style={{ background: C.border, borderRadius: 6, height: 5, overflow: "hidden", margin: "12px 0 4px" }}>
                    <div style={{ width: `${(e.available / e.total) * 100}%`, background: e.available === 0 ? C.red : C.teal, height: "100%", borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 12, color: e.available === 0 ? C.red : C.muted, fontWeight: e.available === 0 ? 700 : 400, marginBottom: 12 }}>
                    대여 가능 {e.available}세트 / 전체 {e.total}세트{e.available === 0 ? " · 현재 대여 불가" : ""}
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
    </div>
  );
}
