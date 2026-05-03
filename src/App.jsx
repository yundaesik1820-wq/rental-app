import React, { useState, useEffect } from "react";
import { getThemeMode, setTheme } from "./theme";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { useCollection as useCollectionHook } from "./hooks/useFirestore";
import { useFCM } from "./hooks/useFCM.js";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { Spinner } from "./components/UI";

// Admin pages
import Dashboard  from "./pages/admin/Dashboard";
import Equipment  from "./pages/admin/Equipment";
import Rental     from "./pages/admin/Rental";
import Students   from "./pages/admin/Students";
import CalendarPage from "./pages/admin/Calendar";
import Stats      from "./pages/admin/Stats";
import Notices    from "./pages/admin/Notices";
import Settings   from "./pages/admin/Settings";
import AdminInquiry  from "./pages/admin/Inquiry";
import LicenseAdmin  from "./pages/admin/LicenseAdmin.jsx";
import License          from "./pages/student/License.jsx";
import FacilityReserve from "./pages/student/FacilityReserve.jsx";
import GuideReserve  from "./pages/student/GuideReserve.jsx";
import FacilityAdmin  from "./pages/admin/FacilityAdmin.jsx";
import Community     from "./pages/student/Community.jsx";

// Student pages
import StudentHome    from "./pages/student/Home";
import EquipList      from "./pages/student/EquipList";
import History        from "./pages/student/History";
import Reserve        from "./pages/student/Reserve";
import Profile         from "./pages/student/Profile";
import StudentInquiry from "./pages/student/Inquiry";

// Shared
import { useCollection } from "./hooks/useFirestore";

function NotifPanel({ onClose, isAdmin, profile, rentalRequests, facilityRequests, allUsers, pwResets, notices, licenseSchedules }) {
  const CC = { red:"#F05252", redLight:"#FEF2F2", yellow:"#F59E0B", yellowLight:"#FFFBEB", blue:"#3B6CF8", blueLight:"#EEF2FF", green:"#10B981", greenLight:"#ECFDF5", purple:"#8B5CF6", purpleLight:"#F5F3FF", orange:"#F97316", orangeLight:"#FFF7ED", navy:"#1A2B6B", text:"#1E293B", muted:"#94A3B8", border:"#E2E8F0", teal:"#0ABFA3", tealLight:"#E6FAF7" };
  const [selCat, setSelCat] = React.useState("전체");

  // 읽은 알림 관리 (localStorage)
  const SEEN_KEY = `seen_notifs_${profile?.uid || "guest"}`;
  const [seenIds, setSeenIds] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); }
    catch { return new Set(); }
  });
  const markSeen = (id) => {
    const next = new Set([...seenIds, id]);
    setSeenIds(next);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
  };

  // 시간 포맷
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d)) return "";
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)   return "방금 전";
    if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  const getLabel = (r) => {
    if (!r.items || r.items.length === 0) return r.equipName || "-";
    const names = r.items.map(i => i.modelName || i.equipName || "").filter(Boolean);
    return names.length > 1 ? `${names[0]} 외 ${names.length-1}건` : names[0] || "-";
  };

  const today    = new Date().toISOString().slice(0,10);
  const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10);
  const myId     = profile?.studentId || "";

  // ── 관리자 알림 ──
  const adminAlerts = isAdmin ? [
    ...rentalRequests.filter(r=>r.status==="연체").map(r=>({ id:`연체_${r.id}`, cat:"대여/반납", color:CC.red,    bg:CC.redLight,    icon:"⚠️", title:`연체 발생: ${getLabel(r)}`, desc:`${r.studentName} · 반납예정 ${r.endDate}`, time:r.updatedAt||r.createdAt })),
    ...rentalRequests.filter(r=>r.status==="승인대기").map(r=>({ id:`승인대기_${r.id}`, cat:"대여/반납", color:CC.yellow, bg:CC.yellowLight, icon:"📋", title:`승인 대기: ${getLabel(r)}`, desc:`${r.studentName}`, time:r.createdAt })),
    ...facilityRequests.filter(r=>r.status==="승인대기").map(r=>({ id:`시설대기_${r.id}`, cat:"시설", color:CC.teal, bg:CC.tealLight, icon:"🏢", title:`시설 대여 승인 대기: ${r.facilityName}`, desc:`${r.studentName} · ${r.date}`, time:r.createdAt })),
    ...allUsers.filter(u=>u.status==="pending").map(u=>({ id:`가입_${u.id}`, cat:"회원", color:CC.blue, bg:CC.blueLight, icon:"👤", title:`가입 승인 대기: ${u.name}`, desc:`${u.dept} · ${u.studentId}`, time:u.createdAt })),
    ...pwResets.filter(r=>r.status==="pending").map(r=>({ id:`비번_${r.id}`, cat:"회원", color:CC.orange, bg:CC.orangeLight, icon:"🔑", title:`비밀번호 초기화 요청: ${r.studentName}`, desc:`학번 ${r.studentId}`, time:r.createdAt })),
  ] : [];

  // ── 학생 알림 ──
  const myRentals  = rentalRequests.filter(r=>r.studentId===myId||r.studentId===profile?.uid);
  const myFacility = facilityRequests.filter(r=>r.studentId===myId);
  const recentNotices = [...notices].sort((a,b)=>b.date>a.date?1:-1).slice(0,3);
  const upcoming = licenseSchedules.filter(s=>s.date>=today&&s.status!=="완료").slice(0,3);

  const studentAlerts = !isAdmin ? [
    ...myRentals.filter(r=>r.status==="승인됨").map(r=>({ id:`승인됨_${r.id}`, cat:"대여/반납", color:CC.green, bg:CC.greenLight, icon:"✅", title:`대여 승인됨: ${getLabel(r)}`, desc:`${r.startDate} ~ ${r.endDate}`, time:r.updatedAt||r.createdAt })),
    ...myRentals.filter(r=>r.status==="거절됨").map(r=>({ id:`거절됨_${r.id}`, cat:"대여/반납", color:CC.red, bg:CC.redLight, icon:"❌", title:`대여 거절됨: ${getLabel(r)}`, desc:r.reason||"", time:r.updatedAt||r.createdAt })),
    ...myRentals.filter(r=>r.status==="대여중"&&r.endDate===tomorrow).map(r=>({ id:`반납D1_${r.id}`, cat:"대여/반납", color:CC.orange, bg:CC.orangeLight, icon:"⏰", title:`반납 D-1: ${getLabel(r)}`, desc:`내일(${r.endDate})까지 반납해주세요`, time:r.updatedAt||r.createdAt })),
    ...myRentals.filter(r=>r.status==="연체").map(r=>({ id:`연체_${r.id}`, cat:"대여/반납", color:CC.red, bg:CC.redLight, icon:"⚠️", title:`연체 중: ${getLabel(r)}`, desc:`반납예정일 ${r.endDate} 초과`, time:r.updatedAt||r.createdAt })),
    ...myFacility.filter(r=>r.status==="승인됨").map(r=>({ id:`시설승인_${r.id}`, cat:"시설", color:CC.teal, bg:CC.tealLight, icon:"🏢", title:`시설 대여 승인됨: ${r.facilityName}`, desc:`${r.date} ${r.startTime}~${r.endTime}`, time:r.updatedAt||r.createdAt })),
    ...myFacility.filter(r=>r.status==="거절됨").map(r=>({ id:`시설거절_${r.id}`, cat:"시설", color:CC.red, bg:CC.redLight, icon:"❌", title:`시설 대여 거절됨: ${r.facilityName}`, desc:r.reason||"", time:r.updatedAt||r.createdAt })),
    ...recentNotices.map(n=>({ id:`공지_${n.id}`, cat:"공지", color:CC.blue, bg:CC.blueLight, icon:"📌", title:n.title, desc:n.date, time:n.createdAt })),
    ...upcoming.map(s=>({ id:`라이센스_${s.id}`, cat:"라이센스", color:CC.purple, bg:CC.purpleLight, icon:"🎖️", title:`라이센스 수업 신청 가능: ${s.title||s.equipName}`, desc:`${s.date} ${s.time||""} · ${s.location||""}`, time:s.createdAt })),
  ] : [];

  const allAlerts = (isAdmin ? adminAlerts : studentAlerts).filter(a => !seenIds.has(a.id));
  const cats = ["전체", ...new Set(allAlerts.map(a=>a.cat))];
  const filtered = selCat === "전체" ? allAlerts : allAlerts.filter(a=>a.cat===selCat);

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:500 }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", top:0, right:0, bottom:0, width:360, background:"#fff", boxShadow:"-10px 0 40px rgba(0,0,0,0.15)", display:"flex", flexDirection:"column" }}>
        {/* 헤더 */}
        <div style={{ padding:"20px 20px 12px", borderBottom:`1px solid ${CC.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:18, fontWeight:800, color:CC.navy }}>🔔 알림 {allAlerts.length > 0 && <span style={{ background:CC.red, color:"#fff", borderRadius:20, padding:"2px 8px", fontSize:12, marginLeft:6 }}>{allAlerts.length}</span>}</div>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:CC.muted }}>✕</button>
          </div>
          {/* 카테고리 탭 */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {cats.map(c=>(
              <button key={c} onClick={()=>setSelCat(c)}
                style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${selCat===c?CC.navy:CC.border}`, background:selCat===c?CC.navy:"transparent", color:selCat===c?"#fff":CC.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                {c} {c!=="전체" && `(${allAlerts.filter(a=>a.cat===c).length})`}
              </button>
            ))}
          </div>
        </div>
        {/* 알림 목록 */}
        <div style={{ flex:1, overflowY:"auto", padding:16 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign:"center", padding:"60px 0", color:CC.muted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              새 알림 없음
            </div>
          )}
          {filtered.map((a,i) => (
            <div key={i} onClick={() => markSeen(a.id)}
              style={{ background:a.bg, borderRadius:12, padding:"12px 14px", marginBottom:8, borderLeft:`4px solid ${a.color}`, cursor:"pointer", transition:"opacity 0.2s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:16 }}>{a.icon}</span>
                  <span style={{ fontSize:11, background:a.color+"20", color:a.color, borderRadius:4, padding:"1px 6px", fontWeight:700 }}>{a.cat}</span>
                </div>
                <span style={{ fontSize:10, color:CC.muted, flexShrink:0, marginLeft:8, marginTop:2 }}>탭하여 닫기</span>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:CC.text, marginBottom:2 }}>{a.title}</div>
              {a.desc && <div style={{ fontSize:11, color:CC.muted, marginBottom:4 }}>{a.desc}</div>}
              {a.time && <div style={{ fontSize:10, color:CC.muted+"aa" }}>{fmtTime(a.time)}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 학생용 대여 목록 통합 (장비/시설/소품목록)
function StudentRentalList() {
  const [view, setView] = React.useState("equip");
  return (
    <div>
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[["equip","🎬 장비 목록"],["facility","🏢 시설 목록"],["props","🎭 소품목록"]].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding:"6px 14px", borderRadius:10, border:"none", fontSize:12, fontWeight:700, cursor:"pointer",
              background: view===v ? "#1B2B6B" : "#1E293B",
              color: view===v ? "#fff" : "#64748B" }}>
            {l}
          </button>
        ))}
      </div>
      {view === "equip"    && <EquipList />}
      {view === "facility" && <StudentFacilityList />}
      {view === "props"    && <StudentPropsList />}
    </div>
  );
}

// 학생용 시설 목록
function StudentFacilityList() {
  const { data: facilities } = useCollectionHook("facilities", "createdAt");
  return (
    <div>
      {/* 시설 목록 배너 */}
      <div style={{ background:"linear-gradient(135deg,#1B2B6B,#0D9488)", borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img src="/mascot/curious.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
          <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
            <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
            <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 시설 목록 페이지야!</div>
            <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>대여 가능한 시설을 미리 확인해봐.<br/>촬영 스튜디오, 편집실 등을 예약할 수 있어 🏢</div>
          </div>
        </div>
      </div>
      {facilities.length === 0
        ? <div style={{ textAlign:"center", padding:"40px 0", color:"#64748B" }}>등록된 시설이 없습니다</div>
        : facilities.map(f => (
          <div key={f.id} style={{ background:"#1E293B", borderRadius:12, overflow:"hidden", marginBottom:10, border:"1px solid #334155" }}>
            {f.displayPhotoUrl && (
              <div style={{ height:160, overflow:"hidden" }}>
                <img src={f.displayPhotoUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
            )}
            <div style={{ padding:"12px 14px" }}>
              <div style={{ fontSize:11, color:"#64748B", marginBottom:3 }}>{f.location}</div>
              <div style={{ fontSize:15, fontWeight:800, color:"#F1F5F9", marginBottom:4 }}>{f.name}</div>
              {f.capacity && <div style={{ fontSize:12, color:"#64748B" }}>수용 {f.capacity}명</div>}
              {f.desc && <div style={{ fontSize:12, color:"#94A3B8", marginTop:4 }}>{f.desc}</div>}
            </div>
          </div>
        ))
      }
    </div>
  );
}

// 학생용 소품목록
function StudentPropsList() {
  const { data: equipments } = useCollectionHook("equipments", "createdAt");
  const PROP_CATS = ["의상", "소도구", "대도구"];
  const [propCat, setPropCat] = React.useState("");
  const allProps = equipments.filter(e => e.majorCategory === "소품" || PROP_CATS.includes(e.majorCategory));
  const filtered = propCat ? allProps.filter(e => e.majorCategory === propCat || e.minorCategory === propCat) : allProps;
  return (
    <div>
      {/* 소품목록 배너 */}
      <div style={{ background:"linear-gradient(135deg,#1B2B6B,#7C3AED)", borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img src="/mascot/curious.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
          <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
            <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
            <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 소품 목록 페이지야!</div>
            <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>촬영에 필요한 소품들을 확인해봐.<br/>의상, 소도구, 대도구를 빌릴 수 있어 🎭</div>
          </div>
        </div>
      </div>
      {/* 대분류 카테고리 버튼 */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"nowrap", overflowX:"auto", paddingBottom:2 }}>
        <button onClick={() => setPropCat("")}
          style={{ background:!propCat?"#1B2B6B":"#1E293B", color:!propCat?"#fff":"#64748B", border:"none", borderRadius:20, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
          전체
        </button>
        {PROP_CATS.map(c => (
          <button key={c} onClick={() => setPropCat(c)}
            style={{ background:propCat===c?"#1B2B6B":"#1E293B", color:propCat===c?"#fff":"#64748B", border:"none", borderRadius:20, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
            {c}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <div style={{ textAlign:"center", padding:"40px 20px", color:"#64748B" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎭</div>
            <div>등록된 소품이 없습니다</div>
            <div style={{ fontSize:12, marginTop:4 }}>관리자가 소품을 등록하면 여기에 표시돼요</div>
          </div>
        : filtered.map(e => (
          <div key={e.id} style={{ background:"#1E293B", borderRadius:12, padding:"14px 16px", marginBottom:10, border:"1px solid #334155" }}>
            <div style={{ fontSize:14, fontWeight:800, color:"#F1F5F9", marginBottom:4 }}>{e.modelName}</div>
            <div style={{ fontSize:12, color:"#64748B" }}>{e.majorCategory} · {e.minorCategory} · {e.status||"대여가능"}</div>
          </div>
        ))
      }
    </div>
  );
}

// 학생용 문의 + 내정보 통합
function StudentMyPage() {
  const [view, setView] = React.useState("profile");
  return (
    <div>
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[["profile","👤 내 정보"],["inquiry","💬 문의"]].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding:"6px 18px", borderRadius:10, border:"none", fontSize:13, fontWeight:700, cursor:"pointer",
              background: view===v ? "#1B2B6B" : "#1E293B",
              color: view===v ? "#fff" : "#64748B" }}>
            {l}
          </button>
        ))}
      </div>
      {view === "profile" && <Profile />}
      {view === "inquiry" && <StudentInquiry />}
    </div>
  );
}

// 학생용 대여이력 + 캘린더 통합
function StudentCalendarHistory({ profile }) {
  const [view, setView] = React.useState("history");
  return (
    <div>
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[["history","📋 대여이력"],["calendar","📅 캘린더"]].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding:"6px 18px", borderRadius:10, border:"none", fontSize:13, fontWeight:700, cursor:"pointer",
              background: view===v ? "#1B2B6B" : "#1E293B",
              color: view===v ? "#fff" : "#64748B" }}>
            {l}
          </button>
        ))}
      </div>
      {view === "history"  && <History />}
      {view === "calendar" && <CalendarPage isAdmin={false} userId={profile?.studentId} userEmail={profile?.email} userName={profile?.name} />}
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  useFCM(profile?.uid);
  const [tab,       setTab]       = useState("home");
  const [themeMode, setThemeMode] = useState(getThemeMode());

  // 테마 변경 이벤트 구독 → 리렌더 트리거
  useEffect(() => {
    const handler = (e) => setThemeMode(e.detail.mode);
    window.addEventListener("kbas-theme-change", handler);
    return () => window.removeEventListener("kbas-theme-change", handler);
  }, []);
  const [showNotif, setShowNotif] = useState(false);

  const { data: rentalRequests }   = useCollection("rentalRequests",   "createdAt");
  const { data: facilityRequests } = useCollection("facilityRequests", "createdAt");
  const { data: allUsers }         = useCollection("users",            "createdAt");
  const { data: pwResets }         = useCollection("pwResetRequests",  "createdAt");
  const { data: notices }          = useCollection("notices",          "createdAt");
  const { data: licenseSchedules } = useCollection("licenseSchedules", "date");

  if (loading) return <Spinner />;
  if (!user || !profile) return <Login />;

  const isAdmin    = profile.role === "admin";
  const adminRole  = profile.adminRole || "super"; // super | teacher | assistant
  const isSuper    = isAdmin && adminRole === "super";
  const isSubAdmin = isAdmin && (adminRole === "teacher" || adminRole === "assistant");

  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const myId     = profile?.studentId || "";

  // 읽은 알림 ID 목록 (useMemo 대신 직접 계산 - hooks 규칙 준수)
  const seenNotifIds = (() => {
    try { return new Set(JSON.parse(localStorage.getItem(`seen_notifs_${profile?.uid}`) || "[]")); }
    catch { return new Set(); }
  })();

  const notSeen = (id) => !seenNotifIds.has(id);

  // 학생용 대여/시설 데이터
  const myRentals  = rentalRequests.filter(r => r.studentId === myId || r.studentId === profile?.uid);
  const myFacility = facilityRequests.filter(r => r.studentId === myId);
  const recentNotices    = notices.filter(n => n.date >= new Date(Date.now() - 3*86400000).toISOString().slice(0,10));
  const upcomingLicense  = licenseSchedules.filter(s => s.date >= today && s.status !== "완료");

  // 관리자 notifCount (seenIds 반영)
  const adminNotifCount = isAdmin ? [
    ...rentalRequests.filter(r=>r.status==="연체").map(r=>`연체_${r.id}`),
    ...rentalRequests.filter(r=>r.status==="승인대기").map(r=>`승인대기_${r.id}`),
    ...facilityRequests.filter(r=>r.status==="승인대기").map(r=>`시설대기_${r.id}`),
    ...allUsers.filter(u=>u.status==="pending").map(u=>`가입_${u.id}`),
    ...pwResets.filter(r=>r.status==="pending").map(r=>`비번_${r.id}`),
  ].filter(notSeen).length : 0;

  // 학생 notifCount (seenIds 반영)
  const studentNotifCount = !isAdmin ? [
    ...myRentals.filter(r=>r.status==="승인됨").map(r=>`승인됨_${r.id}`),
    ...myRentals.filter(r=>r.status==="거절됨").map(r=>`거절됨_${r.id}`),
    ...myRentals.filter(r=>r.status==="대여중"&&r.endDate===tomorrow).map(r=>`반납D1_${r.id}`),
    ...myRentals.filter(r=>r.status==="연체").map(r=>`연체_${r.id}`),
    ...myFacility.filter(r=>r.status==="승인됨").map(r=>`시설승인_${r.id}`),
    ...myFacility.filter(r=>r.status==="거절됨").map(r=>`시설거절_${r.id}`),
    ...recentNotices.map(n=>`공지_${n.id}`),
    ...upcomingLicense.map(s=>`라이센스_${s.id}`),
  ].filter(notSeen).length : 0;

  const notifCount = isAdmin ? adminNotifCount : studentNotifCount;

  // 장비/시설 탭 전환 래퍼
  const ReserveWrapper = () => {
    const [page, setPage] = React.useState("main"); // main | equip | equip-guide | equip-expert | facility | props

    const Back = ({ to="main" }) => (
      <button onClick={() => setPage(to)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#94A3B8", fontSize:13, cursor:"pointer", marginBottom:16 }}>
        ← 뒤로가기
      </button>
    );

    const BannerCard = ({ onClick, mascot, gradient, title, desc, dark }) => (
      <button onClick={onClick} style={{ background: dark ? "#1E293B" : `linear-gradient(135deg,${gradient})`, borderRadius:16, padding:"18px 20px", border: dark ? "2px solid #334155" : "none", cursor:"pointer", textAlign:"left", width:"100%", boxShadow: dark ? "none" : "0 4px 16px rgba(27,43,107,0.2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <img src={`/mascot/${mascot}`} alt="" style={{ width:72, height:72, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.25))" }} />
          <div>
            <div style={{ fontSize:17, fontWeight:800, color: dark ? "#F1F5F9" : "#fff", marginBottom:4 }}>{title}</div>
            <div style={{ fontSize:13, color: dark ? "#64748B" : "rgba(255,255,255,0.8)" }}>{desc}</div>
          </div>
        </div>
      </button>
    );

    // 메인 선택 화면
    if (page === "main") return (
      <div>
        <div style={{ background:"linear-gradient(135deg,#1B2B6B,#0D9488)", borderRadius:16, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/mascot/curious.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
            <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
              <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
              <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>무엇을 예약할까?</div>
              <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>장비, 시설, 소품 중에서 선택해봐!<br/>필요한 걸 골라서 신청하면 돼 📋</div>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <BannerCard onClick={() => setPage("equip")} mascot="camera.png" gradient="#1B2B6B,#3B6CF8" title="🎬 장비 예약" desc="카메라, 렌즈, 조명 등 장비를 빌려요" />
          <BannerCard onClick={() => setPage("facility")} mascot="curious.png" gradient="#0D9488,#0891B2" title="🏢 시설 예약" desc="스튜디오, 편집실 등 시설을 예약해요" />
          <BannerCard onClick={() => setPage("props")} mascot="rental.png" gradient="#7C3AED,#DB2777" title="🎭 소품 예약" desc="의상, 소도구, 대도구를 빌려요" dark={false} />
        </div>
      </div>
    );

    // 장비 예약 - 초보자/전문가 선택
    if (page === "equip") return (
      <div>
        <Back />
        <div style={{ background:"linear-gradient(135deg,#1B2B6B,#3B6CF8)", borderRadius:16, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/mascot/hi.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
            <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
              <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
              <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>장비 예약이구나!</div>
              <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>처음이라면 렌토리와 함께 골라봐.<br/>익숙하다면 직접 선택해도 돼 📷</div>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <BannerCard onClick={() => setPage("equip-guide")} mascot="hi.png" gradient="#1B2B6B,#0D9488" title="🌱 초보자" desc="렌토리랑 같이 장비를 골라요!" />
          <BannerCard onClick={() => setPage("equip-expert")} mascot="shrug.png" gradient="#334155,#1E293B" title="⚡ 전문가" desc="직접 장비를 선택합니다!" dark />
        </div>
      </div>
    );

    // 장비 - 초보자 가이드
    if (page === "equip-guide") return (
      <div>
        <Back to="equip" />
        <GuideReserve />
      </div>
    );

    // 장비 - 전문가
    if (page === "equip-expert") return (
      <div>
        <Back to="equip" />
        <Reserve />
      </div>
    );

    // 시설 예약
    if (page === "facility") return (
      <div>
        <Back />
        <FacilityReserve />
      </div>
    );

    // 소품 예약
    if (page === "props") return (
      <div>
        <Back />
        <div style={{ background:"linear-gradient(135deg,#7C3AED,#DB2777)", borderRadius:16, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/mascot/rental.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
            <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
              <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
              <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>소품 예약이구나!</div>
              <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>필요한 소품을 확인하고 대여 신청을 해봐 🎭</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign:"center", padding:"40px 20px", color:"#64748B" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🎭</div>
          <div style={{ fontSize:14, fontWeight:600 }}>소품 예약 준비 중이에요</div>
          <div style={{ fontSize:12, marginTop:6 }}>곧 이용할 수 있어요!</div>
        </div>
      </div>
    );

    return null;
  };

  const renderPage = () => {
    if (isAdmin) {
      switch (tab) {
        case "home":     return <Dashboard setTab={setTab} />;
        case "equip":    return <Equipment />;
        case "rental":   return <Rental subAdmin={!isSuper} />;
        case "students": return isSuper ? <Students /> : <Students readOnly={true} />;
        case "calendar": return <CalendarPage isAdmin={true} />;
        case "notices":  return <Notices isAdmin={true} />;
        case "settings": return <Settings />;
        case "inquiry":  return <AdminInquiry canDelete={isSuper} />;
        case "license":  return <LicenseAdmin />;
        case "community": return <Community />;
        default:         return <Dashboard setTab={setTab} />;
      }
    } else {
      switch (tab) {
        case "home":     return <StudentHome />;
        case "equip":    return <StudentRentalList />;
        case "reserve":  return <ReserveWrapper />;
        case "calendar": return <StudentCalendarHistory profile={profile} />;
        case "notices":  return <Notices isAdmin={false} />;
        case "license":  return <License />;
        case "community": return <Community />;
        case "mypage":   return <StudentMyPage />;
        default:         return <StudentHome />;
      }
    }
  };

  return (
    <>
      <Layout tab={tab} setTab={setTab} notifCount={notifCount} onNotif={() => setShowNotif(true)}>
        {renderPage()}
      </Layout>
      {showNotif && (
        <NotifPanel
          onClose={() => setShowNotif(false)}
          isAdmin={isAdmin}
          profile={profile}
          rentalRequests={rentalRequests}
          facilityRequests={facilityRequests}
          allUsers={allUsers}
          pwResets={pwResets}
          notices={notices}
          licenseSchedules={licenseSchedules}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
