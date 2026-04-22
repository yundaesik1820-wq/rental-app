import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { groupEquipments } from "../../utils/groupEquipments";
import RentalTimeline from "../../components/RentalTimeline";

const PURPOSE_OPTIONS = ["과제 및 스터디", "동아리", "작품제작", "학교행사"];

// 라이센스 문자열 → 숫자
const licenseToNum = (lic) => {
  if (!lic || lic === "없음") return 0;
  const n = parseInt(lic);
  return isNaN(n) ? 0 : n;
};

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  }
}

// 세트 그룹화 (modelName 기준)
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

export default function Reserve() {
  const { profile } = useAuth();
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: allRequests } = useCollection("rentalRequests", "createdAt");

  const [tabView, setTabView] = useState("단품"); // "단품" | "세트"
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("전체");

  // 단품 장비 (세트 아닌 것)
  const unitEquips = equipments.filter(e => !e.isSet);
  const grouped    = groupEquipments(unitEquips);

  // 세트 장비
  const setEquips  = groupSets(equipments);

  // 카테고리
  const unitCats = ["전체", ...new Set(grouped.map(e => e.majorCategory).filter(Boolean))];
  const setCats  = ["전체", ...new Set(setEquips.map(e => e.majorCategory).filter(Boolean))];

  const filteredUnits = grouped.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search))
  );
  const filteredSets = setEquips.filter(e =>
    (filter === "전체" || e.majorCategory === filter) &&
    (e.modelName?.includes(search) || e.itemName?.includes(search))
  );

  // 장바구니 { modelName: qty } (단품), { modelName: true } (세트)
  const [cart, setCart]         = useState({});
  const [cartSets, setCartSets] = useState({});
  const [expandedSet, setExpandedSet] = useState(null);
  const [photoIdx, setPhotoIdx]       = useState({});
  const getIdx = (key) => photoIdx[key] || 0;
  const setIdx = (key, val, max) => setPhotoIdx(p => ({ ...p, [key]: Math.max(0, Math.min(val, max-1)) }));

  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [errors, setErrors]       = useState({});

  const [form, setForm] = useState({
    emergencyContact:"", participants:"", purpose:"", purposeDetail:"",
    startDate:"", startTime:"09:00", endDate:"", endTime:"18:00",
  });

  const setQty = (modelName, qty, max) => {
    const c = Math.max(0, Math.min(qty, max));
    setCart(p => ({ ...p, [modelName]: c }));
  };
  const toggleSet = (modelName) => {
    const isProf   = profile?.role === "professor";
    const myLicNum = licenseToNum(profile?.license);
    const rawEquip = equipments.find(eq => (eq.modelName || eq.name) === modelName);
    const eqLic    = rawEquip?.licenseLevel || 0;
    if (!isProf && myLicNum < eqLic) return; // 라이센스 부족 시 차단
    setCartSets(p => ({ ...p, [modelName]: !p[modelName] }));
  };

  const cartUnitItems = grouped.filter(e => (cart[e.modelName] || 0) > 0);
  const cartSetItems  = setEquips.filter(e => cartSets[e.modelName]);
  const cartTotal     = Object.values(cart).reduce((a,b)=>a+b,0) + cartSetItems.length;

  const f = (key, val) => { setForm(p=>({...p,[key]:val})); setErrors(p=>({...p,[key]:""})); };

  const validate = () => {
    const errs = {};
    if (cartTotal === 0)          errs.cart = "장비를 1개 이상 선택하세요";
    // 라이센스 체크 - 원본 equipments 데이터 기반
    const myLicNum = licenseToNum(profile?.license);
    const isProf   = profile?.role === "professor";
    if (!isProf) {
      const lockedNames = [];
      cartUnitItems.forEach(item => {
        const raw = equipments.find(e => (e.modelName || e.name) === item.modelName);
        const eqLic = raw?.licenseLevel || 0;
        if (eqLic > myLicNum) lockedNames.push(`${item.modelName}(${eqLic}단계 필요)`);
      });
      // 세트 라이센스 체크
      cartSetItems.forEach(item => {
        const raw = equipments.find(e => (e.modelName || e.name) === item.modelName);
        const eqLic = raw?.licenseLevel || 0;
        if (eqLic > myLicNum) lockedNames.push(`${item.modelName}(${eqLic}단계 필요)`);
      });
      if (lockedNames.length > 0) {
        errs.cart = `라이센스 부족: ${lockedNames.join(", ")}`;
      }
    }
    if (!form.purpose)            errs.purpose = "사용 목적을 선택하세요";
    if (!form.purposeDetail)      errs.purposeDetail = "세부 내용을 입력하세요";
    if (!form.startDate)          errs.startDate = "대여 시작일을 선택하세요";
    if (!form.endDate)            errs.endDate = "반납일을 선택하세요";
    if (form.startDate && form.endDate && form.startDate > form.endDate) errs.endDate = "반납일이 대여일보다 빠릅니다";
    if (cartTotal >= 2 && !form.emergencyContact) errs.emergencyContact = "2인 이상 대여 시 비상연락처 필수";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const items = [
        ...cartUnitItems.map(e => ({
          modelName: e.modelName, equipName: e.modelName,
          itemName: e.itemName, category: e.majorCategory,
          quantity: cart[e.modelName], isSet: false,
        })),
        ...cartSetItems.map(e => ({
          modelName: e.modelName, equipName: e.modelName,
          itemName: e.itemName, category: e.majorCategory,
          quantity: 1, isSet: true,
          setItems: e.setItems,
        })),
      ];
      await addItem("rentalRequests", {
        studentId: profile.studentId, studentName: profile.name,
        phone: profile.phone || "", dept: profile.dept || "",
        license: profile.license || "없음",
        items, emergencyContact: form.emergencyContact,
        participants: form.participants, purpose: form.purpose,
        purposeDetail: form.purposeDetail,
        startDate: form.startDate, startTime: form.startTime,
        endDate: form.endDate, endTime: form.endTime,
        status: "승인대기", reason: "",
      });
      setCart({}); setCartSets({});
      setForm({ emergencyContact:"", participants:"", purpose:"", purposeDetail:"", startDate:"", startTime:"09:00", endDate:"", endTime:"18:00" });
      setShowForm(false); setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch(e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const cats = tabView === "단품" ? unitCats : setCats;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>📅 장비 예약 신청</PageTitle>
        {cartTotal > 0 && (
          <button onClick={() => setShowForm(true)} style={{ background:C.teal, color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" }}>
            📋 신청서 작성
            <span style={{ background:"rgba(255,255,255,0.25)", borderRadius:20, padding:"2px 10px" }}>{cartTotal}개</span>
          </button>
        )}
      </div>

      {done && <div style={{ background:C.greenLight, color:C.green, borderRadius:12, padding:"14px 18px", marginBottom:16, fontWeight:700, fontSize:14, border:`1px solid ${C.green}30` }}>✅ 대여 신청이 완료됐어요! 관리자 승인을 기다려 주세요.</div>}

      {/* 선택 장바구니 */}
      {cartTotal > 0 && (
        <Card style={{ border:`2px solid ${C.teal}40`, marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.teal, marginBottom:12 }}>📋 선택한 장비</div>
          {cartUnitItems.map(e => (
            <div key={e.modelName} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
              <div><div style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName}</div><div style={{ fontSize:11, color:C.muted }}>{e.majorCategory}</div></div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={() => setQty(e.modelName,(cart[e.modelName]||0)-1,e.available)} style={{ width:28,height:28,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,cursor:"pointer",fontSize:16,fontWeight:700 }}>−</button>
                <span style={{ fontSize:14,fontWeight:700,color:C.navy,minWidth:24,textAlign:"center" }}>{cart[e.modelName]}</span>
                <button onClick={() => setQty(e.modelName,(cart[e.modelName]||0)+1,e.available)} style={{ width:28,height:28,borderRadius:8,border:`1px solid ${C.teal}`,background:C.tealLight,cursor:"pointer",fontSize:16,fontWeight:700,color:C.teal }}>+</button>
                <span style={{ fontSize:11,color:C.muted }}>/ {e.available}대</span>
              </div>
            </div>
          ))}
          {cartSetItems.map(e => (
            <div key={e.modelName} style={{ padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ background:C.orangeLight, color:C.orange, borderRadius:6, padding:"1px 7px", fontSize:10, fontWeight:700 }}>세트</span>
                    <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName}</span>
                  </div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{e.majorCategory}</div>
                </div>
                <button onClick={() => toggleSet(e.modelName)} style={{ background:C.redLight, color:C.red, border:"none", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:600, cursor:"pointer" }}>취소</button>
              </div>
            </div>
          ))}
          <div style={{ display:"flex", gap:10, marginTop:12 }}>
            <Btn onClick={() => { setCart({}); setCartSets({}); }} color={C.muted} outline full small>전체 취소</Btn>
            <Btn onClick={() => setShowForm(true)} color={C.teal} full>신청서 작성 →</Btn>
          </div>
        </Card>
      )}

      {/* 단품 / 세트 탭 */}
      <div style={{ display:"flex", background:C.surface, borderRadius:12, padding:4, marginBottom:16, border:`1px solid ${C.border}`, width:"fit-content" }}>
        {["단품", "세트"].map(t => (
          <button key={t} onClick={() => { setTabView(t); setFilter("전체"); setSearch(""); }} style={{ padding:"8px 28px", borderRadius:9, border:"none", fontSize:14, fontWeight:700, cursor:"pointer", background:tabView===t?C.navy:"transparent", color:tabView===t?"#fff":C.muted, transition:"all 0.2s" }}>{t} {t==="세트" ? `(${setEquips.length})` : `(${grouped.length})`}</button>
        ))}
      </div>

      {/* 검색 + 카테고리 */}
      <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <input placeholder="🔍 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:180, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ background:filter===c?C.navy:C.surface, color:filter===c?"#fff":C.muted, border:`1px solid ${filter===c?C.navy:C.border}`, borderRadius:20, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{c}</button>
          ))}
        </div>
      </div>

      {errors.cart && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>⚠️ {errors.cart}</div>}

      {/* ── 단품 목록 ── */}
      {tabView === "단품" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:14 }}>
          {filteredUnits.map(e => {
            const avail      = e.available;
            const qty        = cart[e.modelName] || 0;
            const myLicNum   = licenseToNum(profile?.license);
            const isProf     = profile?.role === "professor";
            // 원본 equipments에서 직접 licenseLevel 읽기
            const rawEquip   = equipments.find(eq => (eq.modelName || eq.name) === e.modelName);
            const eqLicNum   = rawEquip?.licenseLevel || 0;
            const isLocked   = !isProf && myLicNum < eqLicNum;
            return (
              <Card key={e.modelName} style={{ border:`2px solid ${isLocked ? "#FCA5A5" : qty>0?C.teal:C.border}`, transition:"border 0.15s", opacity: isLocked ? 0.75 : 1 }}>
                <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                  {e.majorCategory && <span style={{ background:C.blueLight, color:C.blue, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{e.majorCategory}</span>}
                  {e.minorCategory && <span style={{ background:C.bg, color:C.muted, borderRadius:6, padding:"2px 8px", fontSize:11, border:`1px solid ${C.border}` }}>{e.minorCategory}</span>}
                  {eqLicNum > 0 && <span style={{ background: isLocked?"#FEF2F2":"#EEF2FF", color: isLocked?"#EF4444":"#3B6CF8", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{isLocked?"🔒":"✅"} {eqLicNum}단계 필요</span>}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>{e.modelName}</div>
                  <Badge label={isLocked ? "대여불가" : avail>0?"대여가능":"대여불가"} />
                </div>
                {e.itemName && <div style={{ fontSize:13, color:C.text, marginBottom:2 }}>{e.itemName}</div>}
                {e.manufacturer && <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>🏭 {e.manufacturer}</div>}
                {/* 라이센스 단계 표시 */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, padding:"6px 10px", borderRadius:8, background: eqLicNum===0 ? "#F0FDF4" : isLocked ? "#FEF2F2" : "#EFF6FF", border:`1px solid ${eqLicNum===0?"#BBF7D0":isLocked?"#FECACA":"#BFDBFE"}` }}>
                  <span style={{ fontSize:13 }}>{eqLicNum===0?"🟢":isLocked?"🔴":"🔵"}</span>
                  <span style={{ fontSize:12, fontWeight:700, color: eqLicNum===0?"#16A34A":isLocked?"#DC2626":"#2563EB" }}>
                    {eqLicNum===0 ? "라이센스 제한 없음" : `${eqLicNum}단계 이상 필요`}
                  </span>
                  {eqLicNum > 0 && !isLocked && <span style={{ fontSize:11, color:"#2563EB" }}>(대여 가능)</span>}
                  {isLocked && <span style={{ fontSize:11, color:"#DC2626" }}>(내 라이센스: {profile?.license || "없음"})</span>}
                </div>
                {/* 대표사진 */}
                {(() => { const photos = e.photoUrls || []; const idx = getIdx(e.modelName); return photos.length > 0 ? (
                  <div style={{ position:"relative", paddingTop:"60%", borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, marginBottom:10 }}>
                    <img src={photos[idx]} alt="제품사진" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain" }} />
                    {photos.length > 1 && (<>
                      <button onClick={ev => { ev.stopPropagation(); setIdx(e.modelName, idx-1, photos.length); }} style={{ position:"absolute", left:4, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.4)", color:"#fff", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", fontSize:13 }}>‹</button>
                      <button onClick={ev => { ev.stopPropagation(); setIdx(e.modelName, idx+1, photos.length); }} style={{ position:"absolute", right:4, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.4)", color:"#fff", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", fontSize:13 }}>›</button>
                      <div style={{ position:"absolute", bottom:4, right:6, background:"rgba(0,0,0,0.45)", color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10 }}>{idx+1}/{photos.length}</div>
                    </>)}
                  </div>
                ) : null; })()}
                <div style={{ background:C.border, borderRadius:6, height:5, overflow:"hidden", marginBottom:4 }}>
                  <div style={{ width:`${(avail/e.total)*100}%`, background:avail===0?C.red:C.teal, height:"100%", borderRadius:6 }} />
                </div>
                <div style={{ fontSize:12, color:avail===0?C.red:C.muted, fontWeight:avail===0?700:400, marginBottom:6 }}>
                  대여 가능 {avail}대 / 전체 {e.total}대
                </div>
                <RentalTimeline modelName={e.modelName} requests={allRequests} />
                {isLocked ? (
                  <div style={{ background:"#FEF2F2", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#EF4444", fontWeight:600 }}>
                    🔒 라이센스 {eqLicNum}단계 이상 필요 (현재: {profile?.license || "없음"})
                  </div>
                ) : avail === 0 ? (
                  <span style={{ fontSize:12, color:C.muted }}>재고 없음</span>
                ) : qty > 0 ? (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={() => setQty(e.modelName, qty-1, avail)} style={{ width:34,height:34,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,cursor:"pointer",fontSize:18,fontWeight:700 }}>−</button>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:20,fontWeight:800,color:C.teal,minWidth:36 }}>{qty}</div>
                      <div style={{ fontSize:9,color:C.muted }}>최대 {avail}대</div>
                    </div>
                    <button onClick={() => setQty(e.modelName, qty+1, avail)} style={{ width:34,height:34,borderRadius:8,border:`1px solid ${C.teal}`,background:C.tealLight,cursor:"pointer",fontSize:18,fontWeight:700,color:C.teal }}>+</button>
                    <button onClick={() => setQty(e.modelName, 0, avail)} style={{ marginLeft:4,background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",textDecoration:"underline" }}>취소</button>
                  </div>
                ) : (
                  <Btn onClick={() => setQty(e.modelName,1,avail)} color={C.teal} small>+ 선택</Btn>
                )}
              </Card>
            );
          })}
          {filteredUnits.length === 0 && <Empty icon="🔍" text="단품 장비가 없습니다" />}
        </div>
      )}

      {/* ── 세트 목록 ── */}
      {tabView === "세트" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:14 }}>
          {filteredSets.map(e => {
            const avail    = e.available;
            const selected = !!cartSets[e.modelName];
            const items    = (e.setItems || "").split("\n").filter(Boolean);
            const expanded = expandedSet === e.modelName;
            const myLicNum = licenseToNum(profile?.license);
            const isProf   = profile?.role === "professor";
            const rawEquip = equipments.find(eq => (eq.modelName || eq.name) === e.modelName);
            const eqLicNum = rawEquip?.licenseLevel || 0;
            const isLocked = !isProf && myLicNum < eqLicNum;
            return (
              <Card key={e.modelName} style={{ border:`2px solid ${isLocked?"#FCA5A5":selected?C.orange:C.border}`, transition:"border 0.15s", opacity: isLocked ? 0.75 : 1 }}>
                {/* 세트 배지 */}
                <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                  <span style={{ background:C.orangeLight, color:C.orange, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, border:`1px solid ${C.orange}40` }}>📦 세트</span>
                  {e.majorCategory && <span style={{ background:C.blueLight, color:C.blue, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{e.majorCategory}</span>}
                  {eqLicNum > 0 && <span style={{ background:isLocked?"#FEF2F2":"#EEF2FF", color:isLocked?"#EF4444":"#3B6CF8", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{isLocked?"🔒":"✅"} {eqLicNum}단계 필요</span>}
                </div>

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>{e.modelName}</div>
                  <Badge label={avail>0?"대여가능":"대여불가"} />
                </div>
                {e.itemName && <div style={{ fontSize:13, color:C.text, marginBottom:2 }}>{e.itemName}</div>}
                {e.manufacturer && <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>🏭 {e.manufacturer}</div>}
                {/* 라이센스 단계 표시 */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, padding:"6px 10px", borderRadius:8, background: eqLicNum===0 ? "#F0FDF4" : isLocked ? "#FEF2F2" : "#EFF6FF", border:`1px solid ${eqLicNum===0?"#BBF7D0":isLocked?"#FECACA":"#BFDBFE"}` }}>
                  <span style={{ fontSize:13 }}>{eqLicNum===0?"🟢":isLocked?"🔴":"🔵"}</span>
                  <span style={{ fontSize:12, fontWeight:700, color: eqLicNum===0?"#16A34A":isLocked?"#DC2626":"#2563EB" }}>
                    {eqLicNum===0 ? "라이센스 제한 없음" : `${eqLicNum}단계 이상 필요`}
                  </span>
                  {eqLicNum > 0 && !isLocked && <span style={{ fontSize:11, color:"#2563EB" }}>(대여 가능)</span>}
                  {isLocked && <span style={{ fontSize:11, color:"#DC2626" }}>(내 라이센스: {profile?.license || "없음"})</span>}
                </div>
                {/* 대표사진 */}
                {(() => { const photos = e.photoUrls || []; const idx = getIdx(e.modelName+"_set"); return photos.length > 0 ? (
                  <div style={{ position:"relative", paddingTop:"60%", borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg, marginBottom:10 }}>
                    <img src={photos[idx]} alt="세트사진" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain" }} />
                    {photos.length > 1 && (<>
                      <button onClick={ev => { ev.stopPropagation(); setIdx(e.modelName+"_set", idx-1, photos.length); }} style={{ position:"absolute", left:4, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.4)", color:"#fff", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", fontSize:13 }}>‹</button>
                      <button onClick={ev => { ev.stopPropagation(); setIdx(e.modelName+"_set", idx+1, photos.length); }} style={{ position:"absolute", right:4, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.4)", color:"#fff", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", fontSize:13 }}>›</button>
                      <div style={{ position:"absolute", bottom:4, right:6, background:"rgba(0,0,0,0.45)", color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10 }}>{idx+1}/{photos.length}</div>
                    </>)}
                  </div>
                ) : null; })()}
                <div style={{ background:C.border, borderRadius:6, height:5, overflow:"hidden", marginBottom:4 }}>
                  <div style={{ width:`${(avail/e.total)*100}%`, background:avail===0?C.red:C.orange, height:"100%", borderRadius:6 }} />
                </div>
                <div style={{ fontSize:12, color:avail===0?C.red:C.muted, fontWeight:avail===0?700:400, marginBottom:6 }}>
                  대여 가능 {avail}세트 / 전체 {e.total}세트
                </div>
                <RentalTimeline modelName={e.modelName} requests={allRequests} />

                {/* 구성품 보기 */}
                {items.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <button onClick={() => setExpandedSet(expanded ? null : e.modelName)} style={{ background:"none", border:"none", color:C.blue, fontSize:12, fontWeight:600, cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:4 }}>
                      📋 구성품 {items.length}개 {expanded?"▲":"▼"}
                    </button>
                    {expanded && (
                      <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>
                        {items.map((item, i) => (
                          <span key={i} style={{ background:C.orangeLight, color:"#92400E", borderRadius:6, padding:"2px 8px", fontSize:11, border:`1px solid ${C.orange}30` }}>{item.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 선택 버튼 */}
                {isLocked ? (
                  <div style={{ background:"#FEF2F2", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#EF4444", fontWeight:600 }}>
                    🔒 라이센스 {eqLicNum}단계 이상 필요 (현재: {profile?.license || "없음"})
                  </div>
                ) : avail === 0 ? (
                  <span style={{ fontSize:12, color:C.muted }}>재고 없음</span>
                ) : selected ? (
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ flex:1, background:C.orangeLight, borderRadius:10, padding:"8px 14px", textAlign:"center", border:`1px solid ${C.orange}40` }}>
                      <span style={{ fontSize:13, fontWeight:700, color:C.orange }}>✅ 선택됨</span>
                    </div>
                    <button onClick={() => toggleSet(e.modelName)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 14px", fontSize:12, color:C.muted, cursor:"pointer" }}>취소</button>
                  </div>
                ) : (
                  <Btn onClick={() => toggleSet(e.modelName)} color={C.orange} full>📦 세트 선택</Btn>
                )}
              </Card>
            );
          })}
          {filteredSets.length === 0 && <Empty icon="📦" text="세트 장비가 없습니다" />}
        </div>
      )}

      {/* 신청서 모달 */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} width={580}>
          <div style={{ fontSize:18, fontWeight:800, color:C.navy, marginBottom:4 }}>📋 장비 대여 신청서</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>아래 정보를 확인하고 신청해주세요</div>

          {/* 신청자 정보 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:12 }}>👤 신청자 정보 (자동입력)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[["이름",profile?.name],["학번",profile?.studentId],["연락처",profile?.phone||"-"],["계열",profile?.dept||"-"],["라이선스",profile?.license||"없음"]].map(([k,v]) => (
                <div key={k} style={{ background:C.surface, borderRadius:8, padding:"8px 12px", border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 신청 장비 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:10 }}>🔧 신청 장비</div>
            {cartUnitItems.map(e => (
              <div key={e.modelName} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName}</div>
                  <div style={{ fontSize:11, color:C.muted }}>가능 {e.available}대 중</div>
                </div>
                <span style={{ fontSize:15, fontWeight:800, color:C.teal }}>{cart[e.modelName]}대</span>
              </div>
            ))}
            {cartSetItems.map(e => (
              <div key={e.modelName} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ background:C.orangeLight, color:C.orange, borderRadius:6, padding:"1px 7px", fontSize:10, fontWeight:700 }}>세트</span>
                    <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.modelName}</span>
                  </div>
                  <span style={{ fontSize:15, fontWeight:800, color:C.orange }}>1세트</span>
                </div>
                {e.setItems && (
                  <div style={{ fontSize:11, color:C.muted, paddingLeft:4 }}>
                    {e.setItems.split("\n").filter(Boolean).map((i,idx) => (
                      <span key={idx}>{i.trim()}{idx < e.setItems.split("\n").filter(Boolean).length-1 ? " · " : ""}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 비상연락처 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
              비상연락처 <span style={{ color:cartTotal>=2?C.red:C.muted, fontSize:11 }}>{cartTotal>=2?"* 2인 이상 필수":"(선택)"}</span>
            </div>
            <input placeholder="예: 010-0000-0000" value={form.emergencyContact} onChange={e => f("emergencyContact",e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.emergencyContact?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            {errors.emergencyContact && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.emergencyContact}</div>}
          </div>

          {/* 참여인원 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>참여인원 학번 및 이름 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
            <textarea placeholder={"예:\n20210001 홍길동\n20220042 이서연"} value={form.participants} onChange={e => f("participants",e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
          </div>

          {/* 사용 목적 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>사용 목적 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {PURPOSE_OPTIONS.map(p => (
                <button key={p} onClick={() => f("purpose",p)} style={{ background:form.purpose===p?C.navy:C.bg, color:form.purpose===p?"#fff":C.muted, border:`1.5px solid ${form.purpose===p?C.navy:C.border}`, borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{p}</button>
              ))}
            </div>
            {errors.purpose && <div style={{ color:C.red, fontSize:11, marginBottom:8 }}>⚠️ {errors.purpose}</div>}
            <textarea placeholder="세부 내용을 입력해주세요" value={form.purposeDetail} onChange={e => f("purposeDetail",e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.purposeDetail?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
            {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.purposeDetail}</div>}
          </div>

          {/* 대여 기간 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>대여 기간 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📅 대여 시작</div>
                <input type="date" value={form.startDate} onChange={e => f("startDate",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.startDate?C.red:C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
                <select value={form.startTime} onChange={e => f("startTime",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  {TIME_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                {errors.startDate && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.startDate}</div>}
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📅 반납</div>
                <input type="date" value={form.endDate} onChange={e => f("endDate",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.endDate?C.red:C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
                <select value={form.endTime} onChange={e => f("endTime",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  {TIME_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                {errors.endDate && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.endDate}</div>}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting}>{submitting?"신청 중...":"✅ 신청 완료"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
