import React, { useState, useEffect } from "react";
import { getThemeMode, setTheme } from "./theme";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
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
    const [mode, setMode]           = React.useState(null); // null=선택화면, "guide"=초보자, "expert"=전문가
    const [reserveTab, setReserveTab] = React.useState("equip");

    // 선택 화면
    if (!mode) return (
      <div>
        {/* 상단 배너 */}
        <div style={{ background:"linear-gradient(135deg,#1B2B6B,#0D9488)", borderRadius:16, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/mascot/curious.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
            <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
              <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
              <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 예약 신청 페이지야!</div>
              <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>어떻게 장비를 고를지 선택해봐.<br/>초보자라면 렌토리랑 같이 골라봐 🎓</div>
            </div>
          </div>
        </div>

        {/* 선택 버튼 */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <button onClick={() => setMode("guide")}
            style={{ background:"linear-gradient(135deg,#1B2B6B,#0D9488)", borderRadius:16, padding:"20px", border:"none", cursor:"pointer", textAlign:"left", boxShadow:"0 4px 16px rgba(27,43,107,0.2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <img src="/mascot/hi.png" alt="" style={{ width:72, height:72, objectFit:"contain", flexShrink:0 }} />
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:"#fff", marginBottom:4 }}>초보자</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)" }}>저와 함께 장비를 골라요!</div>
              </div>
            </div>
          </button>
          <button onClick={() => setMode("expert")}
            style={{ background:"#1E293B", borderRadius:16, padding:"20px", border:"2px solid #334155", cursor:"pointer", textAlign:"left" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <img src="/mascot/shrug.png" alt="" style={{ width:72, height:72, objectFit:"contain", flexShrink:0 }} />
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:"#F1F5F9", marginBottom:4 }}>전문가</div>
                <div style={{ fontSize:13, color:"#64748B" }}>직접 장비를 고릅니다!</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    );

    // 전문가 모드 (기존)
    if (mode === "expert") return (
      <div>
        <button onClick={() => setMode(null)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#94A3B8", fontSize:13, cursor:"pointer", marginBottom:16 }}>
          ← 뒤로가기
        </button>
        <div style={{ display:"flex", background:"#F1F5F9", borderRadius:12, padding:4, marginBottom:20, width:"fit-content", border:"1px solid #E2E8F0" }}>
          {[["equip","장비 대여"],["facility","시설 대여"]].map(([v,l]) => (
            <button key={v} onClick={() => setReserveTab(v)}
              style={{ padding:"8px 24px", borderRadius:9, border:"none", fontSize:14, fontWeight:700, cursor:"pointer", background:reserveTab===v?"#1B2B6B":"transparent", color:reserveTab===v?"#fff":"#94A3B8", transition:"all 0.2s" }}>{l}</button>
          ))}
        </div>
        {reserveTab === "equip" ? <Reserve /> : <FacilityReserve />}
      </div>
    );

    // 초보자 가이드 모드
    return (
      <div>
        <button onClick={() => setMode(null)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#94A3B8", fontSize:13, cursor:"pointer", marginBottom:16 }}>
          ← 뒤로가기
        </button>
        <GuideReserve />
      </div>
    );
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
        case "equip":    return <EquipList />;
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
