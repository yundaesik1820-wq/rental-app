import { useState, useEffect } from "react";
import { C } from "../../theme";
import { Card, Badge, Empty, PageTitle, Modal } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import RentalTimeline from "../../components/RentalTimeline";
import ExternalRentalView from "./ExternalRentalView";
import PdfViewer from "../../components/PdfViewer";

// ✏️ 히어로 슬라이드 — 여기 내용만 바꾸면 상단 배너가 바뀝니다.
//    (title=제목, desc=설명, emoji=오른쪽 그림, grad=배경색 그라데이션)
//    link: "notices" 를 넣으면 클릭 시 공지사항으로 이동합니다. (빼면 클릭 안 됨)
//    슬라이드를 더하거나 빼려면 { } 블록을 추가/삭제하면 됩니다.
const HERO_SLIDES = [
  { emoji: "📋", title: "장비 대여 규칙", desc: "평일 09:00–17:30 운영 · 최소 3일 전 신청", grad: "linear-gradient(120deg,#3d4370,#5b6191)", link: "notices", pdfKeyword: "대여가이드" },
  { emoji: "⏰", title: "연체 주의 안내", desc: "반납이 늦으면 일정 기간 대여가 제한돼요", grad: "linear-gradient(120deg,#7f1d2e,#be3144)" },
  { emoji: "🎓", title: "장비 교육 안내", desc: "라이센스 이수 후 전문 장비 대여가 열려요", grad: "linear-gradient(120deg,#14532d,#1f9d57)" },
];

// 🗂️ 카테고리 — 이름/아이콘/순서를 여기서 바꾸면 그리드가 바뀝니다. (4열로 자동 배치)
//    👉 직접 만든 아이콘 이미지로 바꾸려면 각 항목에 img를 추가하세요.
//       예: { name: "카메라", icon: "📷", img: "/cat-icons/camera.png" }
//       img가 있으면 이미지를, 없으면 icon(이모지)을 표시합니다.
const RENTAL_CATEGORIES = [
  { name: "외부 렌탈샵", icon: "🏬", img: "/cat-icons/external.png" },
  { name: "NEW",          icon: "🆕", img: "/cat-icons/new.png" },
  { name: "캠코더",        icon: "📹", img: "/cat-icons/camcorder.png" },
  { name: "카메라",        icon: "📷", img: "/cat-icons/camera.png" },
  { name: "렌즈",          icon: "🔭", img: "/cat-icons/lens.png" },
  { name: "ACC",          icon: "🔌", img: "/cat-icons/acc.png" },
  { name: "삼각대/그립",    icon: "📐", img: "/cat-icons/tripod.png" },
  { name: "모니터",        icon: "🖥️", img: "/cat-icons/monitor.png" },
  { name: "조명",          icon: "💡", img: "/cat-icons/light.png" },
  { name: "음향",          icon: "🎤", img: "/cat-icons/audio.png" },
  { name: "편집",          icon: "✂️", img: "/cat-icons/edit.png" },
  { name: "기타",          icon: "📦", img: "/cat-icons/etc.png" },
];
import { groupEquipments } from "../../utils/groupEquipments";
import { youtubeEmbedUrl } from "../../utils/youtube";

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

export default function EquipList({ setTab }) {
  const { profile } = useAuth();
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: requests }   = useCollection("rentalRequests", "createdAt");
  const { data: notices }    = useCollection("notices", "createdAt");
  const [pdfView, setPdfView] = useState(null); // 풀스크린 PDF {url, title}

  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("카메라");
  const [minorFilter, setMinorFilter] = useState("전체");
  const [tabView, setTabView] = useState("단품"); // "단품" | "세트"
  const [expandedSet, setExpandedSet] = useState(null);
  const [showDescModel, setShowDescModel] = useState(null); // 설명 보기
  const [photoIdx, setPhotoIdx] = useState({});
  // 🎞️ 히어로 자동 슬라이드 (3.5초마다)
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    if (HERO_SLIDES.length <= 1) return;
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_SLIDES.length), 3500);
    return () => clearInterval(t);
  }, []);

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

  // 선택된 대분류의 중분류 목록
  const minorList = ["전체", ...new Set([
    ...grouped.filter(e => e.majorCategory === filter).map(e => e.minorCategory),
    ...setEquips.filter(e => e.majorCategory === filter).map(e => e.minorCategory),
  ].filter(Boolean))];

  const filteredUnits = grouped.filter(e =>
    (!filter || e.majorCategory === filter) &&
    (minorFilter === "전체" || e.minorCategory === minorFilter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.manufacturer?.includes(search))
  );
  const filteredSets = setEquips.filter(e =>
    (!filter || e.majorCategory === filter) &&
    (minorFilter === "전체" || e.minorCategory === minorFilter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search))
  );

  const getIdx = (key) => photoIdx[key] || 0;
  const setIdx = (key, val, max) => setPhotoIdx(p => ({ ...p, [key]: Math.max(0, Math.min(val, max - 1)) }));

  return (
    <div>
      {/* 🎞️ 자동 슬라이드 히어로 (내용은 상단 HERO_SLIDES에서 수정) */}
      <div style={{ position:"relative", borderRadius:16, overflow:"hidden", marginBottom:18 }}>
        <div style={{ display:"flex", transition:"transform .55s cubic-bezier(.4,0,.2,1)", transform:`translateX(-${heroIdx*100}%)` }}>
          {HERO_SLIDES.map((s, i) => (
            <div key={i} onClick={() => {
                if (s.pdfKeyword) {
                  const hit = notices.find(n => n.pdfUrl && n.title?.replace(/\s/g, "").includes(s.pdfKeyword));
                  if (hit) { setPdfView({ url: hit.pdfUrl, title: hit.title }); return; }
                }
                if (s.link && setTab) setTab(s.link);
              }}
              style={{ minWidth:"100%", background:s.grad, padding:"20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, minHeight:96, cursor: s.link ? "pointer" : "default" }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:"#fff" }}>{s.title}</div>
                <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.9)", marginTop:6, lineHeight:1.45 }}>{s.desc}</div>
              </div>
              <div style={{ fontSize:40, flexShrink:0 }}>{s.emoji}</div>
            </div>
          ))}
        </div>
        {HERO_SLIDES.length > 1 && (
          <div style={{ position:"absolute", bottom:10, left:0, right:0, display:"flex", gap:5, justifyContent:"center" }}>
            {HERO_SLIDES.map((_, i) => (
              <div key={i} onClick={() => setHeroIdx(i)}
                style={{ width: i===heroIdx?16:6, height:6, borderRadius:99, background: i===heroIdx?"#fff":"rgba(255,255,255,0.45)", transition:"all .3s", cursor:"pointer" }} />
            ))}
          </div>
        )}
      </div>

      {/* 카테고리 아이콘 그리드 (4열, 내용은 상단 RENTAL_CATEGORIES에서 수정) */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px 4px", marginBottom:18 }}>
        {RENTAL_CATEGORIES.map(c => {
          const on = filter === c.name;
          return (
            <div key={c.name} role="button" onClick={() => { setFilter(c.name); setMinorFilter("전체"); setSearch(""); }}
              style={{ textAlign:"center", cursor:"pointer" }}>
              <div style={{ width:54, height:54, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto", overflow:"hidden",
                background: on ? C.navy : C.surface, border:`1px solid ${on ? C.navy : C.border}`, transition:"all .15s", boxShadow: on ? `0 4px 12px ${C.navy}40` : "none" }}>
                {c.img
                  ? <img src={c.img} alt={c.name} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                  : <span>{c.icon}</span>}
              </div>
              <div style={{ fontSize:11, color: on ? C.text : C.muted, marginTop:7, fontWeight: on ? 700 : 600, wordBreak:"keep-all", lineHeight:1.25 }}>{c.name}</div>
            </div>
          );
        })}
      </div>

      {/* 외부 렌탈샵 카테고리면 업체 목록, 그 외엔 장비 목록 */}
      {filter === "외부 렌탈샵" && <ExternalRentalView />}

      {filter !== "외부 렌탈샵" && (<>

      {/* 1.5행: 중분류 */}
      {minorList.length > 1 && (
        <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"nowrap", overflowX:"auto", paddingBottom:2, WebkitOverflowScrolling:"touch" }}>
          {minorList.map(m => (
            <button key={m} onClick={() => setMinorFilter(m)}
              style={{ background:minorFilter===m?C.teal:"transparent", color:minorFilter===m?"#fff":C.muted, border:`1px solid ${minorFilter===m?C.teal:C.border}`, borderRadius:14, padding:"3px 10px", fontSize:10, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
              {m}
            </button>
          ))}
        </div>
      )}

      {/* 2행: 검색 */}
      <input placeholder="🔍 장비명, 제조사 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ display: "block", width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

      {/* 3행: 단품 / 세트 탭 */}
      <div style={{ display: "flex", background: C.surface, borderRadius: 12, padding: 4, marginBottom: 16, border: `1px solid ${C.border}`, width: "fit-content" }}>
        {[["단품", "🔧"], ["세트", "📦"]].map(([v, icon]) => (
          <button key={v} onClick={() => setTabView(v)}
            style={{ background: tabView === v ? C.navy : "transparent", color: tabView === v ? C.bg : C.muted, border: "none", borderRadius: 9, padding: "8px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
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
                        style={{ display: "flex", alignItems: "center", gap: 6, background: isExpand ? C.navy : C.bg, color: isExpand ? C.bg : C.navy, border: `1px solid ${isExpand ? C.navy : C.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%", justifyContent: "center", marginBottom: isExpand ? 12 : 0 }}>
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
      </>)}

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
          {youtubeEmbedUrl(showDescModel.guideVideoUrl) && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:6 }}>🎬 사용 매뉴얼 영상</div>
              <div style={{ position:"relative", paddingBottom:"56.25%", height:0, borderRadius:10, overflow:"hidden", background:"#000" }}>
                <iframe
                  src={youtubeEmbedUrl(showDescModel.guideVideoUrl)}
                  title="사용 매뉴얼"
                  style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}
          <div style={{ marginTop:16, textAlign:"right" }}>
            <button onClick={() => setShowDescModel(null)}
              style={{ background:C.navy, color: C.bg, border:"none", borderRadius:10, padding:"9px 20px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              확인
            </button>
          </div>
        </Modal>
      )}

      {pdfView && <PdfViewer url={pdfView.url} title={pdfView.title} onClose={() => setPdfView(null)} />}
    </div>
  );
}