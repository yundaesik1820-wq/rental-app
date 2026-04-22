import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { groupEquipments } from "../../utils/groupEquipments";
import RentalTimeline from "../../components/RentalTimeline";

const PURPOSE_OPTIONS = ["강의", "개인스터디", "동아리스터디", "수업과제", "작품제작", "학교행사"];
const CLUBS = ["라온", "올드보이", "행가레", "클리퍼", "마스터보이스", "유성우", "직접입력"];
const CLOUD_NAME    = "dnotsiasc";
const UPLOAD_PRESET = "equipment_photos";
async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method:"POST", body:fd });
  const data = await res.json();
  if (!data.secure_url) throw new Error("업로드 실패");
  return { url: data.secure_url, name: file.name };
}

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

// 파일 첨부 컴포넌트
function FileAttachSection({ form, f }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      f("attachments", [...(form.attachments || []), result]);
    } catch(err) { alert("파일 업로드 실패: " + err.message); }
    finally { setUploading(false); e.target.value = ""; }
  };
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>📎 파일 첨부 (일일촬영표, 시나리오 등)</div>
      <label style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.bg, border:`1.5px dashed ${C.border}`, borderRadius:10, padding:"8px 16px", cursor:"pointer", fontSize:13, color:C.muted }}>
        <span>{uploading ? "⏳ 업로드 중..." : "+ 파일 추가"}</span>
        <input type="file" accept=".pdf,.doc,.docx,.hwp,.jpg,.jpeg,.png" onChange={handleFile} style={{ display:"none" }} disabled={uploading} />
      </label>
      {(form.attachments || []).length > 0 && (
        <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
          {form.attachments.map((att, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.bg, borderRadius:8, padding:"6px 12px", border:`1px solid ${C.border}` }}>
              <a href={att.url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:C.blue, textDecoration:"none" }}>📄 {att.name}</a>
              <button onClick={() => f("attachments", form.attachments.filter((_,j)=>j!==i))}
                style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  const [showNotice, setShowNotice]         = useState(false);
  const [agreed, setAgreed]                 = useState(false);
  const [showWeekendNotice, setShowWeekendNotice] = useState(false);
  const [weekendAgreed, setWeekendAgreed]   = useState(false);
  const [showStoragePlan, setShowStoragePlan] = useState(false);
  const [storageForm, setStorageForm] = useState({
    keeper1: { name:"", dept:"", studentId:"", phone:"" },
    keeper2: { name:"", dept:"", studentId:"", phone:"" },
    days: [],  // [{ day:"금", date:"", keeper:"", equipment:"", location:"", storageTime:"", outTime:"" }, ...]
  });
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [errors, setErrors]       = useState({});

  const [form, setForm] = useState({
    emergencyContact:"", participants:"", location:"", locationType:"", purpose:"", purposeDetail:"", club:"", clubDirect:"", courseName:"", professorName:"", eventName:"", eventProfessor:"", attachments:[],
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

  // 주말 포함 여부 + 해당 요일 반환
  const getWeekendDays = () => {
    if (!form.startDate || !form.endDate) return [];
    const DAY_NAMES = ["일","월","화","수","목","금","토"];
    const days = [];
    const start = new Date(form.startDate);
    const end   = new Date(form.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 5 || dow === 6) { // 일,금,토
        days.push({
          day:  DAY_NAMES[dow],
          date: d.toISOString().slice(0,10),
        });
      }
    }
    return days;
  };

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
    // ── 기간 겹침 기반 재고 체크 ────────────────────────────
    if (form.startDate && form.endDate) {
      const toStr = (date, time) => `${date} ${time || "00:00"}`;
      const myS   = toStr(form.startDate, form.startTime);
      const myE   = toStr(form.endDate,   form.endTime);


      const calcAvail = (modelName, isSet) => {
        const units      = equipments.filter(e =>
          (e.modelName || e.name) === modelName && (isSet ? !!e.isSet : !e.isSet)
        );
        const totalUnits = units.length;
        const usedQty = allRequests
          .filter(r => ["승인대기","승인됨","대여중"].includes(r.status))
          .reduce((sum, r) => {
            const rS = toStr(r.startDate, r.startTime);
            const rE = toStr(r.endDate,   r.endTime);
            const overlaps = myS < rE && rS < myE;
            const found = r.items?.find(i => (i.modelName || i.equipName) === modelName);
            if (!overlaps) return sum;
            return sum + (found?.quantity || 0);
          }, 0);
        return Math.max(0, totalUnits - usedQty);
      };

      cartUnitItems.forEach(item => {
        const avail  = calcAvail(item.modelName, false);
        const reqQty = cart[item.modelName] || 0;
        if (reqQty > avail) {
          errs.cart = `${item.modelName}: 해당 기간 대여 가능 수량은 ${avail}대입니다 (신청 ${reqQty}대)`;
        }
      });
      cartSetItems.forEach(item => {
        const avail = calcAvail(item.modelName, true);
        if (avail <= 0) {
          errs.cart = `${item.modelName} 세트: 해당 기간 대여 가능한 세트가 없습니다`;
        }
      });
    }
    // ─────────────────────────────────────────────────────────

    if (!form.participants.trim()) errs.participants = "참여인원 학번 및 이름을 입력하세요";
    if (!form.emergencyContact.trim()) errs.emergencyContact = "비상연락처를 입력하세요";
    if (!form.locationType)       errs.location = "교내/교외를 선택하세요";
    else if (!form.location.trim()) errs.location = form.locationType==="교내" ? "층/호실을 입력하세요" : "정확한 주소를 입력하세요";
    if (!form.purpose)            errs.purpose = "사용 목적을 선택하세요";
    if (form.purpose === "강의" && profile?.role !== "professor") errs.purpose = "강의는 교수님만 선택 가능합니다";
    if (form.purpose === "동아리스터디" && !form.club) errs.purposeDetail = "동아리를 선택하세요";
    if (form.purpose === "동아리스터디" && form.club === "직접입력" && !form.clubDirect.trim()) errs.purposeDetail = "동아리명을 입력하세요";
    if (form.purpose === "수업과제" && !form.courseName.trim()) errs.purposeDetail = "수업명을 입력하세요";
    if (form.purpose === "수업과제" && !form.professorName.trim()) errs.purposeDetail = "교수님 성함을 입력하세요";
    if (form.purpose === "학교행사" && !form.eventName.trim()) errs.purposeDetail = "행사명을 입력하세요";
    if (form.purpose === "학교행사" && !form.eventProfessor.trim()) errs.purposeDetail = "담당교수님 성함을 입력하세요";
    if (!["강의","학교행사","수업과제"].includes(form.purpose) && !form.purposeDetail.trim()) errs.purposeDetail = "세부 내용을 입력하세요";
    if (!form.startDate)          errs.startDate = "대여 시작일을 선택하세요";
    if (!form.endDate)            errs.endDate = "반납일을 선택하세요";
    if (form.startDate && form.endDate && form.startDate > form.endDate) errs.endDate = "반납일이 대여일보다 빠릅니다";
    // 비상연락처는 항상 필수 (위에서 처리)
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    // 주말 포함 시 보관계획서 먼저
    const weekendDays = getWeekendDays();
    if (weekendDays.length > 0 && !showStoragePlan) {
      setStorageForm(prev => ({
        ...prev,
        days: weekendDays.map(d => ({
          day: d.day, date: d.date,
          keeper:"", equipment:"", location:"", storageTime:"", outTime:"",
        })),
      }));
      setWeekendAgreed(false);
      setShowForm(false);        // 신청서 모달 먼저 닫기
      setShowWeekendNotice(true); // 그 다음 주말 주의사항 열기
      return;
    }
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
        studentId:   profile.role === "professor" ? (profile.profId || profile.email) : (profile.studentId || ""),
        studentName: profile.name,
        role:        profile.role || "student",
        phone:       profile.phone || "",
        dept:        profile.role === "professor" ? "교수" : (profile.dept || ""),
        license:     profile.role === "professor" ? "교수" : (profile.license || "없음"),
        items, storageForm: getWeekendDays().length > 0 ? storageForm : null, emergencyContact: form.emergencyContact,
        locationType: form.locationType,
        participants: form.participants, location: form.location, purpose: form.purpose,
        club: form.club === "직접입력" ? form.clubDirect : form.club,
        courseName: form.courseName, professorName: form.professorName,
        eventName: form.eventName, eventProfessor: form.eventProfessor,
        attachments: form.attachments,
        purposeDetail: form.purposeDetail,
        startDate: form.startDate, startTime: form.startTime,
        endDate: form.endDate, endTime: form.endTime,
        status: "승인대기", reason: "",
      });
      setCart({}); setCartSets({});
      setForm({ emergencyContact:"", participants:"", location:"", locationType:"", purpose:"", purposeDetail:"", club:"", clubDirect:"", courseName:"", professorName:"", eventName:"", eventProfessor:"", attachments:[], startDate:"", startTime:"09:00", endDate:"", endTime:"18:00" });
      setShowForm(false); setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch(e) {
      console.error(e);
      alert("신청 중 오류가 발생했습니다: " + e.message);
    }
    finally { setSubmitting(false); }
  };

  const cats = tabView === "단품" ? unitCats : setCats;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>📅 장비 예약 신청</PageTitle>
        {cartTotal > 0 && (
          <button onClick={() => { setAgreed(false); setShowNotice(true); }} style={{ background:C.teal, color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" }}>
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
            <Btn onClick={() => { setAgreed(false); setShowNotice(true); }} color={C.teal} full>신청서 작성 →</Btn>
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
            // status 기반 + 승인대기 차감
            const rawUnits   = equipments.filter(eq => (eq.modelName || eq.name) === e.modelName && !eq.isSet);
            const statusAvail = rawUnits.filter(u => (u.status || "대여가능") === "대여가능").length;
            const pendingUsed = allRequests.filter(r => r.status === "승인대기").reduce((sum, r) => {
              const f = r.items?.find(i => (i.modelName || i.equipName) === e.modelName);
              return sum + (f?.quantity || 0);
            }, 0);
            const avail = Math.max(0, statusAvail - pendingUsed) || e.available;
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

      {/* 주의사항 모달 */}
      {showNotice && (
        <Modal onClose={() => setShowNotice(false)} width={580}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>📋 대여 안내사항</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>아래 내용을 끝까지 읽고 동의 후 진행해주세요</div>

          <div style={{ maxHeight:400, overflowY:"auto", background:C.bg, borderRadius:12, padding:"16px 18px", marginBottom:16, fontSize:13, lineHeight:1.9, color:C.text, border:`1px solid ${C.border}` }}>
            <p style={{ marginBottom:12 }}>안녕하세요 장비대여실입니다.<br/>원활한 장비 대여 및 반납을 위해 아래 안내사항을 반드시 확인해주시기 바랍니다.</p>

            <div style={{ fontWeight:800, color:C.navy, marginBottom:8 }}>[신청 관련 주의사항]</div>
            {[
              "장비대여실 운영시간은 평일 09:00~18:00이며, 운영시간 외에는 빠른 업무처리가 어려울 수 있습니다.",
              "장비 대여 가능 시간은 평일 09:00~17:00입니다.",
              "주말 대여는 금요일 17:00부터 월요일 09:00 반납 기준으로만 운영되며, 대여 및 반납 시간 조정은 불가합니다.",
              "평일 중 연일 대여는 불가하며, 당일 반납 후 익일 대여로만 가능합니다.",
              "장비는 최소 7일 전 신청해야 하며, 학교 행사 관련 장비는 최소 2일 전까지 신청해야 합니다.",
              "모든 장비의 우선 사용 순위는 학생 여러분의 강의이며, 교수님의 수업 관련 장비 신청이 우선될 수 있습니다.",
            ].map((t,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                <span style={{ color:C.blue, fontWeight:700, flexShrink:0 }}>{i+1}.</span>
                <span>{t}</span>
              </div>
            ))}

            <div style={{ fontWeight:800, color:C.navy, margin:"14px 0 8px" }}>[대여/반납 시 주의사항]</div>
            {[
              "대여 및 반납은 반드시 대여자 본인 주도 하에 진행되어야 합니다.",
              "대여 시 대여자는 대여하려는 장비의 점검을 1층에서 마친 뒤 수령해야 하며, 문제 발견 시 즉시 보고해야 합니다.",
              "반납 시 대여자는 반납 장비의 점검이 끝날 때까지 대기해야 하며, 점검 완료 후 이동이 가능합니다.",
              "반납은 대여 당시와 동일한 구성으로만 가능하며, 가방에 임의로 넣거나 세트 장비를 각개로 반납하는 것은 불가합니다.",
              "대여/반납 시간 초과 시 10분당 1,000원의 장비 유지비 패널티가 부여됩니다.",
              "개인 과실로 인한 분실 및 파손 시 대여자에게 변상 책임이 부여됩니다.",
            ].map((t,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                <span style={{ color:C.blue, fontWeight:700, flexShrink:0 }}>{i+1}.</span>
                <span>{t}</span>
              </div>
            ))}
          </div>

          {/* 동의 체크박스 */}
          <label style={{ display:"flex", alignItems:"flex-start", gap:12, cursor:"pointer", background: agreed ? C.greenLight : C.bg, borderRadius:12, padding:"12px 16px", border:`2px solid ${agreed ? C.green : C.border}`, marginBottom:16, transition:"all 0.2s" }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              style={{ width:20, height:20, cursor:"pointer", marginTop:1, flexShrink:0, accentColor:C.green }} />
            <span style={{ fontSize:13, color: agreed ? C.green : C.text, fontWeight: agreed ? 700 : 400, lineHeight:1.6 }}>
              위 안내사항을 모두 확인하였으며, 미숙지로 인해 발생하는 책임은 대여자 본인에게 있음을 확인합니다.
            </span>
          </label>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowNotice(false)} color={C.muted} outline full>닫기</Btn>
            <Btn onClick={() => { if (!agreed) { alert("안내사항에 동의해주세요"); return; } setShowNotice(false); setShowForm(true); }} color={agreed ? C.teal : C.muted} full disabled={!agreed}>
              동의 후 신청서 작성 →
            </Btn>
          </div>
        </Modal>
      )}

      {/* 주말보관 주의사항 모달 */}
      {showWeekendNotice && (
        <Modal onClose={() => setShowWeekendNotice(false)} width={540}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>🏠 주말 장비 보관 안내</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>신청 기간에 주말이 포함되어 있습니다. 아래 안내사항을 확인해주세요.</div>
          <div style={{ background:C.bg, borderRadius:12, padding:"16px 18px", marginBottom:16, fontSize:13, lineHeight:1.9, color:C.text, border:`1px solid ${C.border}` }}>
            {[
              "해당 계획서는 주말 대여를 하는 경우 반드시 작성해야 합니다.",
              "보관은 최대 2명이 나눠서 진행하며, 대여된 모든 장비에 대한 보관 계획을 상세히 기재하여야 합니다.",
              "주말의 경우 장비 대여 업무가 진행되지 않으므로 조기반납은 불가하며, 반드시 월요일 9시까지 반납해야 합니다.",
              "장비 보관 과정에서 장비가 파손되거나 분실되는 경우, 대여자 및 보관자에게 변상 책임을 부여합니다.",
            ].map((t,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                <span style={{ color:C.red, fontWeight:700, flexShrink:0 }}>{i+1}.</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <label style={{ display:"flex", alignItems:"flex-start", gap:12, cursor:"pointer", background:weekendAgreed?C.greenLight:C.bg, borderRadius:12, padding:"12px 16px", border:`2px solid ${weekendAgreed?C.green:C.border}`, marginBottom:16, transition:"all 0.2s" }}>
            <input type="checkbox" checked={weekendAgreed} onChange={e => setWeekendAgreed(e.target.checked)}
              style={{ width:20, height:20, cursor:"pointer", marginTop:1, flexShrink:0, accentColor:C.green }} />
            <span style={{ fontSize:13, color:weekendAgreed?C.green:C.text, fontWeight:weekendAgreed?700:400, lineHeight:1.6 }}>
              위 안내사항을 모두 확인하였으며, 보관 중 발생된 문제에 대한 책임은 대여자 및 보관자에게 있음을 확인합니다.
            </span>
          </label>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowWeekendNotice(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={() => { if(!weekendAgreed){alert("안내사항에 동의해주세요"); return;} setShowWeekendNotice(false); setShowForm(false); setShowStoragePlan(true); }} color={weekendAgreed?C.blue:C.muted} full disabled={!weekendAgreed}>
              동의 후 보관계획서 작성 →
            </Btn>
          </div>
        </Modal>
      )}

      {/* 장비보관계획서 모달 */}
      {showStoragePlan && (
        <Modal onClose={() => setShowStoragePlan(false)} width={620}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>📋 장비보관계획서</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>주말 보관 계획을 상세히 입력해주세요</div>

          {/* 대여자 */}
          <div style={{ background:C.bg, borderRadius:10, padding:"10px 14px", marginBottom:16, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:6 }}>대여자 (자동입력)</div>
            <div style={{ fontSize:13, color:C.text }}>{profile?.name} · {profile?.dept} · {profile?.studentId} · {profile?.phone}</div>
          </div>

          {/* 보관자 2명 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>보관자 정보</div>
            {[1,2].map(n => {
              const key = `keeper${n}`;
              const k   = storageForm[key];
              return (
                <div key={n} style={{ background:C.bg, borderRadius:10, padding:"12px 14px", marginBottom:10, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:8 }}>보관자 {n}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {[["name","이름"],["dept","계열"],["studentId","학번"],["phone","연락처"]].map(([field,label]) => (
                      <div key={field}>
                        <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{label}</div>
                        <input placeholder={label} value={k[field]} onChange={e => setStorageForm(p=>({...p,[key]:{...p[key],[field]:e.target.value}}))}
                          style={{ display:"block", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"7px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 요일별 보관 계획 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>일자별 보관 계획</div>
            {storageForm.days.map((day, i) => (
              <div key={i} style={{ background:C.bg, borderRadius:10, padding:"12px 14px", marginBottom:10, border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <span style={{ background:day.day==="일"?"#FEF2F2":day.day==="토"?"#EFF6FF":"#F0FDF4", color:day.day==="일"?C.red:day.day==="토"?C.blue:C.green, borderRadius:8, padding:"3px 12px", fontWeight:800, fontSize:14 }}>{day.day}</span>
                  <span style={{ fontSize:12, color:C.muted }}>{day.date}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>보관자</div>
                    <select value={day.keeper} onChange={e => setStorageForm(p=>({...p,days:p.days.map((d,j)=>j===i?{...d,keeper:e.target.value}:d)}))}
                      style={{ display:"block", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:day.keeper?C.text:C.muted, padding:"7px 10px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                      <option value="">보관자 선택</option>
                      {storageForm.keeper1.name && <option value={storageForm.keeper1.name}>{storageForm.keeper1.name} (보관자1)</option>}
                      {storageForm.keeper2.name && <option value={storageForm.keeper2.name}>{storageForm.keeper2.name} (보관자2)</option>}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>보관 장소</div>
                    <input placeholder="보관 장소" value={day.location} onChange={e => setStorageForm(p=>({...p,days:p.days.map((d,j)=>j===i?{...d,location:e.target.value}:d)}))}
                      style={{ display:"block", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"7px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>보관 장비</div>
                    <input placeholder="보관할 장비명" value={day.equipment} onChange={e => setStorageForm(p=>({...p,days:p.days.map((d,j)=>j===i?{...d,equipment:e.target.value}:d)}))}
                      style={{ display:"block", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"7px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>보관 일시</div>
                    <input placeholder="예: 18:00" value={day.storageTime} onChange={e => setStorageForm(p=>({...p,days:p.days.map((d,j)=>j===i?{...d,storageTime:e.target.value}:d)}))}
                      style={{ display:"block", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"7px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <div style={{ gridColumn:"1/-1" }}>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>불출 일시</div>
                    <input placeholder="예: 09:00" value={day.outTime} onChange={e => setStorageForm(p=>({...p,days:p.days.map((d,j)=>j===i?{...d,outTime:e.target.value}:d)}))}
                      style={{ display:"block", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"7px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            ⚠️ 모든 안내사항을 확인하였으며 보관 중 발생된 문제에 대한 책임은 대여자 및 보관자에게 있음을 확인합니다.
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowStoragePlan(false); setWeekendAgreed(false); setShowWeekendNotice(true); }} color={C.muted} outline full>이전</Btn>
            <Btn onClick={async () => { setShowStoragePlan(false); await new Promise(r=>setTimeout(r,50)); handleSubmit(); }} color={C.blue} full disabled={submitting}>
              {submitting ? "신청 중..." : "✅ 최종 제출"}
            </Btn>
          </div>
        </Modal>
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
              {(profile?.role === "professor"
                ? [["이름", profile?.name ? profile.name + " 교수님" : "-"], ["구분", "교수"], ["연락처", profile?.phone || "-"]]
                : [["이름",profile?.name],["학번",profile?.studentId],["연락처",profile?.phone||"-"],["계열",profile?.dept||"-"],["라이선스",profile?.license||"없음"]]
              ).map(([k,v]) => (
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

          {/* 참여인원 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>참여인원 학번 및 이름 * <span style={{ color:C.muted, fontWeight:400, fontSize:11 }}>(본인 제외)</span></div>
            <textarea placeholder={"예:\n20210001 홍길동\n20220042 이서연"} value={form.participants} onChange={e => f("participants",e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.participants?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
            {errors.participants && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.participants}</div>}
          </div>

          {/* 비상연락처 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>비상연락처 *</div>
            <input placeholder="예: 010-0000-0000" value={form.emergencyContact} onChange={e => f("emergencyContact",e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.emergencyContact?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            {errors.emergencyContact && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.emergencyContact}</div>}
          </div>

          {/* 사용 장소 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>사용 장소 *</div>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              {["교내","교외"].map(t => (
                <button key={t} onClick={() => { f("locationType",t); f("location",""); }}
                  style={{ flex:1, padding:"10px 0", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                    background: form.locationType===t ? C.navy : C.bg,
                    color:      form.locationType===t ? "#fff"  : C.muted,
                    border:    `1.5px solid ${form.locationType===t ? C.navy : C.border}` }}>
                  {t === "교내" ? "🏫 교내" : "🌍 교외"}
                </button>
              ))}
            </div>
            {form.locationType === "교내" && (
              <input placeholder="예: 3층 301호, 1층 스튜디오" value={form.location} onChange={e => f("location",e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.location?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            )}
            {form.locationType === "교외" && (
              <input placeholder="정확한 주소를 입력해주세요 (예: 서울시 강남구 테헤란로 123)" value={form.location} onChange={e => f("location",e.target.value)}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.location?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            )}
            {errors.location && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.location}</div>}
          </div>

          {/* 사용 목적 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>사용 목적 *</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
              {PURPOSE_OPTIONS.map(p => {
                const isProf   = profile?.role === "professor";
                const disabled = p === "강의" && !isProf;
                return (
                  <button key={p} onClick={() => { if(disabled) return; f("purpose",p); f("club",""); f("clubDirect",""); f("courseName",""); f("professorName",""); f("eventName",""); f("eventProfessor",""); f("purposeDetail",""); f("attachments",[]); }}
                    style={{ background:form.purpose===p?C.navy:disabled?"#F3F4F6":C.bg, color:form.purpose===p?"#fff":disabled?C.muted:C.text, border:`1.5px solid ${form.purpose===p?C.navy:C.border}`, borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:600, cursor:disabled?"not-allowed":"pointer", fontFamily:"inherit", opacity:disabled?0.5:1 }}>
                    {p}{disabled?" (교수님 전용)":""}
                  </button>
                );
              })}
            </div>
            {errors.purpose && <div style={{ color:C.red, fontSize:11, marginBottom:8 }}>⚠️ {errors.purpose}</div>}

            {/* 강의: 세부내용 없음 */}
            {form.purpose === "강의" && (
              <div style={{ background:C.blueLight, borderRadius:10, padding:"10px 14px", fontSize:13, color:C.blue }}>
                📚 강의 목적 대여입니다. 별도 세부내용 없이 신청 가능합니다.
              </div>
            )}

            {/* 개인스터디: 세부내용만 */}
            {form.purpose === "개인스터디" && (
              <>
                <textarea placeholder="세부 내용을 입력해주세요" value={form.purposeDetail} onChange={e => f("purposeDetail",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.purposeDetail?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
                {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.purposeDetail}</div>}
              </>
            )}

            {/* 동아리스터디: 동아리 선택 + 세부내용 */}
            {form.purpose === "동아리스터디" && (
              <>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>동아리 선택 *</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:8 }}>
                    {CLUBS.map(c => (
                      <button key={c} onClick={() => { f("club",c); if(c!=="직접입력") f("clubDirect",""); }}
                        style={{ background:form.club===c?C.navy:C.bg, color:form.club===c?"#fff":C.muted, border:`1.5px solid ${form.club===c?C.navy:C.border}`, borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                        {c}
                      </button>
                    ))}
                  </div>
                  {form.club === "직접입력" && (
                    <input placeholder="동아리명을 입력하세요" value={form.clubDirect} onChange={e => f("clubDirect",e.target.value)}
                      style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:8 }} />
                  )}
                  {errors.purposeDetail && !form.purposeDetail && <div style={{ color:C.red, fontSize:11 }}>⚠️ {errors.purposeDetail}</div>}
                </div>
                <textarea placeholder="세부 내용을 입력해주세요" value={form.purposeDetail} onChange={e => f("purposeDetail",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
              </>
            )}

            {/* 수업과제: 수업명 + 교수님 + 파일첨부 */}
            {form.purpose === "수업과제" && (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>수업명 *</div>
                    <input placeholder="예: 영상제작실습" value={form.courseName} onChange={e => f("courseName",e.target.value)}
                      style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>교수님 성함 *</div>
                    <input placeholder="예: 홍길동 교수님" value={form.professorName} onChange={e => f("professorName",e.target.value)}
                      style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                </div>
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>세부 내용</div>
                  <textarea placeholder="세부 내용을 입력해주세요" value={form.purposeDetail} onChange={e => f("purposeDetail",e.target.value)}
                    style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
                </div>
                {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>⚠️ {errors.purposeDetail}</div>}
                <FileAttachSection form={form} f={f} />
              </>
            )}

            {/* 작품제작: 세부내용 + 파일첨부 */}
            {form.purpose === "작품제작" && (
              <>
                <textarea placeholder="세부 내용을 입력해주세요" value={form.purposeDetail} onChange={e => f("purposeDetail",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${errors.purposeDetail?C.red:C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box", marginBottom:10 }} />
                {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginBottom:6 }}>⚠️ {errors.purposeDetail}</div>}
                <FileAttachSection form={form} f={f} />
              </>
            )}

            {/* 학교행사: 행사명 + 담당교수님 + 세부내용 */}
            {form.purpose === "학교행사" && (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>행사명 *</div>
                    <input placeholder="예: 졸업작품 발표회" value={form.eventName} onChange={e => f("eventName",e.target.value)}
                      style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>담당교수님 성함 *</div>
                    <input placeholder="예: 홍길동 교수님" value={form.eventProfessor} onChange={e => f("eventProfessor",e.target.value)}
                      style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                </div>
                {errors.purposeDetail && <div style={{ color:C.red, fontSize:11, marginBottom:6 }}>⚠️ {errors.purposeDetail}</div>}
                <textarea placeholder="세부 내용을 입력해주세요" value={form.purposeDetail} onChange={e => f("purposeDetail",e.target.value)}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
              </>
            )}
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

          {errors.cart && (
            <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"12px 16px", fontSize:13, fontWeight:600, marginBottom:12, border:`1px solid ${C.red}30` }}>
              ⚠️ {errors.cart}
            </div>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleSubmit} color={C.teal} full disabled={submitting}>{submitting?"신청 중...":"✅ 신청 완료"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
