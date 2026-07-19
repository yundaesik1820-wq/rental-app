import { useState, useEffect } from "react";
import { C } from "../../theme";
import { Card, Badge, Empty, PageTitle, Modal } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useCart } from "../../hooks/useCart.jsx";
import { isCameraLike, isLens } from "../../utils/equipCompat";
import EquipDetail from "./EquipDetail";
import RentalTimeline from "../../components/RentalTimeline";
import ExternalRentalView from "./ExternalRentalView";
import PdfViewer from "../../components/PdfViewer";

// ✏️ 히어로 슬라이드 — 여기 내용만 바꾸면 상단 배너가 바뀝니다.
//    (title=제목, desc=설명, emoji=오른쪽 그림, grad=배경색 그라데이션)
//    🖼️ img: "/hero/xxx.png" 를 넣으면 직접 디자인한 통이미지로 카드를 꽉 채웁니다.
//       (img가 있으면 grad/title/desc/emoji 는 무시됨. 카드 비율은 3:1 고정 — 1080x360px 권장)
//       이미지 파일은 public/hero/ 폴더에 넣으세요.
//    link: "notices" 를 넣으면 클릭 시 공지사항으로 이동합니다. (빼면 클릭 안 됨)
//    url: "https://..." 를 넣으면 클릭 시 외부 링크(유튜브 채널 등)를 새 탭/앱으로 엽니다.
//    슬라이드를 더하거나 빼려면 { } 블록을 추가/삭제하면 됩니다.
const HERO_SLIDES = [
  { img: "/hero/hero1.png", link: "notices", pdfKeyword: "대여가이드" },
  { img: "/hero/hero2.png", link: "license" },
  { img: "/hero/hero3.png", url: "https://www.youtube.com/@%ED%95%9C%EA%B5%AD%EB%B0%A9%EC%86%A1%EC%98%88%EC%88%A0%EC%A7%84%ED%9D%A5%EC%9B%90%EC%98%81" },
];

// 🗂️ 카테고리 — 이름/아이콘/순서를 여기서 바꾸면 그리드가 바뀝니다. (4열로 자동 배치)
//    👉 직접 만든 아이콘 이미지로 바꾸려면 각 항목에 img를 추가하세요.
//       예: { name: "카메라", icon: "📷", img: "/cat-icons/camera.png" }
//       img가 있으면 이미지를, 없으면 icon(이모지)을 표시합니다.
const RENTAL_CATEGORIES = [
  { name: "카메라",        icon: "📷", img: "/cat-icons/camera.png" },
  { name: "캠코더",        icon: "📹", img: "/cat-icons/camcorder.png" },
  { name: "액션캠/드론",    icon: "🚁", img: "/cat-icons/actioncam-drone.png" },
  { name: "렌즈",          icon: "🔭", img: "/cat-icons/lens.png" },
  { name: "ACC",          icon: "🔌", img: "/cat-icons/acc.png" },
  { name: "삼각대/그립",    icon: "📐", img: "/cat-icons/tripod.png" },
  { name: "모니터",        icon: "🖥️", img: "/cat-icons/monitor.png" },
  { name: "조명",          icon: "💡", img: "/cat-icons/light.png" },
  { name: "음향",          icon: "🎤", img: "/cat-icons/audio.png" },
  { name: "기타",          icon: "📦", img: "/cat-icons/etc.png" },
  { name: "편집",          icon: "✂️", img: "/cat-icons/edit.png" },
  { name: "외부 렌탈샵", icon: "🏬", img: "/cat-icons/external.png" },
];

// 카테고리 아이콘 — img가 있으면 이미지, 없거나 로드 실패하면 이모지로 폴백.
// (이미지 파일을 아직 안 올렸을 때 깨진 이미지 대신 이모지가 보이게 한다)
function CatIcon({ c }) {
  const [err, setErr] = useState(false);
  return c.img && !err
    ? <img src={c.img} alt={c.name} onError={() => setErr(true)} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
    : <span>{c.icon}</span>;
}
import { groupEquipments } from "../../utils/groupEquipments";
import { youtubeEmbedUrl } from "../../utils/youtube";
import SpecTable from "../../components/SpecTable";

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
        guideVideoUrl: e.guideVideoUrl || "",
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
    if (!map[key].guideVideoUrl && e.guideVideoUrl) map[key].guideVideoUrl = e.guideVideoUrl;
  });
  return Object.values(map);
}

const licenseToNum = (lic) => {
  if (!lic || lic === "없음") return 0;
  const n = parseInt(lic);
  return isNaN(n) ? 0 : n;
};

// ── 학생 리디자인 블루 팔레트 (theme.js C는 아직 모노톤이라 여기서 직접 박음) ──
const BOX_CAT = { color:"#93a8e8", bg:"rgba(96,130,246,0.13)", bd:"rgba(96,130,246,0.22)" };
// 라이선스 레벨별 컬러만 다르게 (Lv.1 민트 / Lv.2 블루 / Lv.3+ 퍼플)
const lvStyle = (n) =>
  n >= 3 ? { color:"#b79bff", bg:"rgba(124,58,237,0.18)", bd:"rgba(124,58,237,0.34)" } :
  n === 2 ? { color:"#7e9dff", bg:"rgba(96,130,246,0.15)", bd:"rgba(96,130,246,0.30)" } :
            { color:"#2DD4BF", bg:"rgba(45,212,191,0.13)", bd:"rgba(45,212,191,0.28)" };
const LOCK_BOX = { color:"#FF6B6B", bg:"#2E1414", bd:"rgba(255,107,107,0.30)" };

// 블루 박스 (카테고리 / 라이선스 / 보유대수)
function Box({ s, children }) {
  return <span style={{ fontSize:11, fontWeight:800, padding:"4px 9px", borderRadius:8, whiteSpace:"nowrap",
    color:s.color, background:s.bg, border:`1px solid ${s.bd}` }}>{children}</span>;
}

// 입체 버튼 — 누르면 아래로 쑥 들어가는 모션. 폰트는 기존 그대로(inherit) 유지.
function PressBtn({ children, onClick, variant = "reserve", disabled, style }) {
  const [p, setP] = useState(false);
  const base = { fontSize:12, fontWeight:800, padding:"8px 14px", borderRadius:10, border:"none",
    whiteSpace:"nowrap", fontFamily:"inherit", cursor: disabled ? "default" : "pointer",
    transition:"transform .07s ease, box-shadow .07s ease", flexShrink:0, ...style };
  if (disabled)
    return <button disabled style={{ ...base, color:"#5a5a63", background:"#141419", border:"1px solid #26262e" }}>{children}</button>;
  const reserve = variant === "reserve";
  const sh = reserve
    ? (p ? "0 1px 0 #2a2170, 0 2px 7px rgba(79,139,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)"
         : "0 4px 0 #2a2170, 0 6px 14px rgba(79,139,255,0.40), inset 0 1px 0 rgba(255,255,255,0.35)")
    : (p ? "0 1px 0 #0d0f16, 0 2px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
         : "0 3px 0 #0d0f16, 0 4px 9px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)");
  const vs = reserve
    ? { color:"#fff", background:"linear-gradient(135deg,#4f8bff,#8b5cf6)", textShadow:"0 1px 1px rgba(0,0,0,0.28)", transform:p?"translateY(3px)":"none" }
    : { color:"#cdd7f6", background:"linear-gradient(180deg,#242836,#191c26)", transform:p?"translateY(2px)":"none" };
  return (
    <button onClick={onClick}
      onPointerDown={() => setP(true)} onPointerUp={() => setP(false)}
      onPointerLeave={() => setP(false)} onPointerCancel={() => setP(false)}
      style={{ ...base, ...vs, boxShadow:sh }}>{children}</button>
  );
}

export default function EquipList({ setTab }) {
  const { profile } = useAuth();
  const { cart, setQty, cartSets, setCartSets, cartCount } = useCart();
  const [detailCam, setDetailCam] = useState(null); // 카메라 상세(액세서리 선택) 페이지
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: requests }   = useCollection("rentalRequests", "createdAt");
  const { data: notices }    = useCollection("notices", "createdAt");
  const [pdfView, setPdfView] = useState(null); // 풀스크린 PDF {url, title}

  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("카메라");
  const [minorFilter, setMinorFilter] = useState("전체");
  const [tabView, setTabView] = useState("단품"); // "단품" | "세트"
  // 카메라/캠코더/액션캠·드론은 카드 클릭 → 상세로 담는 흐름이라
  // 중분류 칩·검색창·단품/세트 탭을 숨기고 단품 목록만 바로 보여준다.
  const catIsCameraLike = ["카메라", "캠코더", "액션캠/드론"].includes(filter);
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

  // 카테고리 판정 — 렌즈 계열(XEEN CF 세트 등)은 대분류가 "렌즈"가 아니어도
  // 렌즈 카테고리에서 보이게 한다
  const inCategory = (e) => !filter || e.majorCategory === filter || (filter === "렌즈" && isLens(e));

  // 선택된 대분류의 중분류 목록
  const minorList = ["전체", ...new Set([
    ...grouped.filter(inCategory).map(e => e.minorCategory),
    ...setEquips.filter(inCategory).map(e => e.minorCategory),
  ].filter(Boolean))];

  const filteredUnits = grouped.filter(e =>
    inCategory(e) &&
    (minorFilter === "전체" || e.minorCategory === minorFilter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search) || e.manufacturer?.includes(search))
  );
  const filteredSets = setEquips.filter(e =>
    inCategory(e) &&
    (minorFilter === "전체" || e.minorCategory === minorFilter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search))
  );

  const getIdx = (key) => photoIdx[key] || 0;
  const setIdx = (key, val, max) => setPhotoIdx(p => ({ ...p, [key]: Math.max(0, Math.min(val, max - 1)) }));

  // 카메라/캠코더는 목록에서 바로 담지 않고 상세에서 액세서리까지 고른다
  if (detailCam) return (
    <EquipDetail
      cam={detailCam}
      equipments={equipments}
      onBack={() => setDetailCam(null)}
    />
  );

  return (
    // 장바구니 바(fixed, bottom:78)가 뜨면 마지막 카드를 덮으므로 그만큼 하단 여백을 준다
    <div style={{ paddingBottom: cartCount > 0 ? 96 : 0 }}>
      {/* 🎞️ 자동 슬라이드 히어로 (내용은 상단 HERO_SLIDES에서 수정) */}
      <div style={{ position:"relative", borderRadius:16, overflow:"hidden", marginBottom:18, aspectRatio:"3 / 1", minHeight:96 }}>
        <div style={{ display:"flex", height:"100%", transition:"transform .55s cubic-bezier(.4,0,.2,1)", transform:`translateX(-${heroIdx*100}%)` }}>
          {HERO_SLIDES.map((s, i) => (
            <div key={i} onClick={() => {
                if (s.url) { window.open(s.url, "_blank", "noopener,noreferrer"); return; }
                if (s.pdfKeyword) {
                  const hit = notices.find(n => n.pdfUrl && n.title?.replace(/\s/g, "").includes(s.pdfKeyword));
                  if (hit) { setPdfView({ url: hit.pdfUrl, title: hit.title }); return; }
                }
                if (s.link && setTab) setTab(s.link);
              }}
              style={{ minWidth:"100%", height:"100%", cursor: (s.link||s.pdfKeyword||s.url) ? "pointer" : "default",
                ...(s.img ? {} : { background:s.grad, padding:"20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:14 }) }}>
              {s.img ? (
                <img src={s.img} alt={s.title||""} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              ) : (<>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#fff" }}>{s.title}</div>
                  <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.9)", marginTop:6, lineHeight:1.45 }}>{s.desc}</div>
                </div>
                <div style={{ fontSize:40, flexShrink:0 }}>{s.emoji}</div>
              </>)}
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
                <CatIcon c={c} />
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
      {!catIsCameraLike && minorList.length > 1 && (
        <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"nowrap", overflowX:"auto", paddingBottom:2, WebkitOverflowScrolling:"touch" }}>
          {minorList.map(m => (
            <button key={m} onClick={() => setMinorFilter(m)}
              style={{ background:minorFilter===m?C.teal:"transparent", color:minorFilter===m?"#fff":C.muted, border:`1px solid ${minorFilter===m?C.teal:C.border}`, borderRadius:14, padding:"3px 10px", fontSize:10, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
              {m}
            </button>
          ))}
        </div>
      )}

      {/* 2행: 검색 (카메라류는 숨김) */}
      {!catIsCameraLike && (
      <input placeholder="🔍 장비명, 제조사 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ display: "block", width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
      )}

      {/* 3행: 단품 / 세트 탭 (카메라류는 숨김) */}
      {!catIsCameraLike && (
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
      )}

      {/* ── 단품 목록 (카메라류는 탭 없이 항상 표시) ── */}
      {(catIsCameraLike || tabView === "단품") && (
        <>
          {filteredUnits.length === 0 && <Empty icon="🔍" text="해당하는 장비가 없습니다" />}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filteredUnits.map(e => {
              const photos = e.displayPhotoUrl ? [e.displayPhotoUrl] : (e.photoUrls || []);
              const myLic  = licenseToNum(profile?.license);
              const eqLic  = e.licenseLevel || 0;
              const locked = profile?.role !== "professor" && myLic < eqLic;
              const avail  = e.available > 0;
              const qty    = cart[e.modelName] || 0;
              const cat = e.minorCategory || e.majorCategory;
              return (
                <Card key={e.modelName} style={{ padding:"12px 13px" }}>
                  {/* 상단: 썸네일 · 모델명/제조사 · 대여가능 뱃지 */}
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    {photos.length > 0 && (
                      <div style={{ width:48, height:48, borderRadius:9, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
                        <img src={photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.modelName}</div>
                      {e.manufacturer && <div style={{ fontSize:11.5, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:1 }}>{e.manufacturer}</div>}
                    </div>
                    <span style={{ flexShrink:0, fontSize:10.5, fontWeight:800, padding:"3px 8px", borderRadius:7,
                      color:avail?"#34D399":"#FF6B6B", background:avail?"#0F3028":"#2E1414" }}>
                      {avail ? "대여가능" : "대여불가"}
                    </span>
                  </div>

                  {/* 하단: 블루 박스 3개 · 상세보기/예약하기 */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:11, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", minWidth:0 }}>
                      {cat && <Box s={BOX_CAT}>{cat}</Box>}
                      {eqLic > 0 && <Box s={locked ? LOCK_BOX : lvStyle(eqLic)}>{locked ? `🔒 Lv.${eqLic}` : `Lv.${eqLic}`}</Box>}
                      <Box s={BOX_CAT}>{e.available}/{e.total}대</Box>
                    </div>
                    <div style={{ display:"flex", gap:7, flexShrink:0, alignItems:"center" }}>
                      <PressBtn variant="detail" onClick={() => setShowDescModel(e)}>상세보기</PressBtn>
                      {locked ? (
                        <PressBtn disabled>Lv.{eqLic} 필요</PressBtn>
                      ) : !avail ? (
                        <PressBtn disabled>재고 없음</PressBtn>
                      ) : isCameraLike(e) ? (
                        <PressBtn onClick={() => setDetailCam(e)}>예약하기</PressBtn>
                      ) : qty > 0 ? (
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <button onClick={() => setQty(e.modelName, qty-1, e.available)}
                            style={{ width:30, height:30, borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, cursor:"pointer", fontSize:17, fontWeight:700, color:C.text }}>−</button>
                          <div style={{ fontSize:16, fontWeight:800, color:"#7e9dff", minWidth:22, textAlign:"center" }}>{qty}</div>
                          <button onClick={() => setQty(e.modelName, qty+1, e.available)}
                            style={{ width:30, height:30, borderRadius:8, border:"1px solid #3b5bdb", background:"rgba(96,130,246,0.14)", cursor:"pointer", fontSize:17, fontWeight:700, color:"#7e9dff" }}>+</button>
                        </div>
                      ) : (
                        <PressBtn onClick={() => setQty(e.modelName, 1, e.available)}>예약하기</PressBtn>
                      )}
                    </div>
                  </div>
                  {/* 카메라류는 상세에서 액세서리까지 담으므로 담긴 수량만 표시 */}
                  {isCameraLike(e) && qty > 0 && (
                    <div style={{ fontSize:11, color:"#2DD4BF", fontWeight:800, marginTop:8 }}>✓ 담김 {qty}대</div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── 세트 목록 ── */}
      {!catIsCameraLike && tabView === "세트" && (
        <>
          {filteredSets.length === 0 && <Empty icon="📦" text="등록된 세트 장비가 없습니다" />}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filteredSets.map(e => {
              const photos   = e.displayPhotoUrl ? [e.displayPhotoUrl] : (e.photoUrls || []);
              const isExpand = expandedSet === e.modelName;
              const setList  = e.setItems ? e.setItems.split("\n").filter(Boolean) : [];
              const avail    = e.available > 0;
              const eqLic    = e.licenseLevel || 0;
              const locked   = profile?.role !== "professor" && licenseToNum(profile?.license) < eqLic;
              const picked   = !!cartSets[e.modelName];
              return (
                <Card key={e.modelName} style={{ padding:"12px 13px", border:`1.5px solid rgba(251,146,60,0.20)` }}>
                  {/* 상단: 썸네일 · 모델명/제조사 · 대여가능 뱃지 */}
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    {photos.length > 0 && (
                      <div style={{ width:48, height:48, borderRadius:9, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
                        <img src={photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.modelName}</div>
                      {e.manufacturer && <div style={{ fontSize:11.5, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:1 }}>{e.manufacturer}</div>}
                    </div>
                    <span style={{ flexShrink:0, fontSize:10.5, fontWeight:800, padding:"3px 8px", borderRadius:7,
                      color:avail?"#34D399":"#FF6B6B", background:avail?"#0F3028":"#2E1414" }}>
                      {avail ? "대여가능" : "대여불가"}
                    </span>
                  </div>

                  {/* 하단: 블루 박스 · 상세보기/예약하기 */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:11, marginBottom: setList.length>0?10:0, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", minWidth:0 }}>
                      <Box s={{ color:"#FB923C", bg:"rgba(251,146,60,0.14)", bd:"rgba(251,146,60,0.30)" }}>📦 세트</Box>
                      {e.minorCategory && <Box s={BOX_CAT}>{e.minorCategory}</Box>}
                      {eqLic > 0 && <Box s={locked ? LOCK_BOX : lvStyle(eqLic)}>{locked ? `🔒 Lv.${eqLic}` : `Lv.${eqLic}`}</Box>}
                      <Box s={BOX_CAT}>{e.available}/{e.total}세트</Box>
                    </div>
                    <div style={{ display:"flex", gap:7, flexShrink:0 }}>
                      <PressBtn variant="detail" onClick={() => setShowDescModel(e)}>상세보기</PressBtn>
                      {locked ? (
                        <PressBtn disabled>Lv.{eqLic} 필요</PressBtn>
                      ) : !avail ? (
                        <PressBtn disabled>재고 없음</PressBtn>
                      ) : (
                        <PressBtn variant={picked ? "detail" : "reserve"}
                          onClick={() => setCartSets(p => ({ ...p, [e.modelName]: !p[e.modelName] }))}>
                          {picked ? "담김 ✓" : "예약하기"}
                        </PressBtn>
                      )}
                    </div>
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
          {showDescModel.description
            ? <SpecTable text={showDescModel.description} />
            : <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", fontSize:13, lineHeight:1.7 }}>
                <span style={{ color:C.muted }}>아직 장비 설명이 등록되지 않았어요.<br/>관리자에게 문의해주세요.</span>
              </div>
          }
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

      {/* 장바구니 바 — 하단 탭바(70px) 위에 뜸 */}
      {cartCount > 0 && (
        <div style={{ position:"fixed", left:0, right:0, bottom:78, padding:"0 16px", zIndex:400 }}>
          <button onClick={() => setTab && setTab("reserve")}
            style={{ width:"100%", background:C.teal, color:"#fff", border:"none", borderRadius:14,
              padding:"14px 18px", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              boxShadow:"0 6px 20px rgba(0,0,0,0.35)" }}>
            <span>🛒 {cartCount}개 담음</span>
            <span>예약하러 가기 ›</span>
          </button>
        </div>
      )}
    </div>
  );
}