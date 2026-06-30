import React, { useState, useEffect } from "react";
import { getThemeMode, setTheme } from "./theme";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { useCollection as useCollectionHook } from "./hooks/useFirestore";
import { useFCM } from "./hooks/useFCM.js";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { Spinner } from "./components/UI";
import { db } from "./firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

// Admin pages
import Dashboard  from "./pages/admin/Dashboard";
import Equipment  from "./pages/admin/Equipment";
import Rental     from "./pages/admin/Rental";
import Students   from "./pages/admin/Students";
import CalendarPage from "./pages/admin/Calendar";
import Stats      from "./pages/admin/Stats";
import GroupHub   from "./components/GroupHub";
import Notices    from "./pages/admin/Notices";
import Settings   from "./pages/admin/Settings";
import AdminInquiry  from "./pages/admin/Inquiry";
import LicenseAdmin  from "./pages/admin/LicenseAdmin.jsx";
import License          from "./pages/student/License.jsx";
import FacilityReserve from "./pages/student/FacilityReserve.jsx";
import GuideReserve  from "./pages/student/GuideReserve.jsx";
import FacilityAdmin  from "./pages/admin/FacilityAdmin.jsx";
import Community     from "./pages/student/Community.jsx";
import SNSManager    from "./pages/admin/SNSManager";
import ExternalRental from "./pages/admin/ExternalRental";

// Student pages
import StudentHome    from "./pages/student/Home";
import EquipList      from "./pages/student/EquipList";
import History        from "./pages/student/History";
import Reserve        from "./pages/student/Reserve";
import Profile         from "./pages/student/Profile";
import StudentInquiry from "./pages/student/Inquiry";

// Shared
import { useCollection } from "./hooks/useFirestore";

const NOTIF_CC = { red:"#F05252", redLight:"#FEF2F2", yellow:"#F59E0B", yellowLight:"#FFFBEB", blue:"#3B6CF8", blueLight:"#EEF2FF", green:"#10B981", greenLight:"#ECFDF5", purple:"#8B5CF6", purpleLight:"#F5F3FF", orange:"#F97316", orangeLight:"#FFF7ED", navy:"#1A2B6B", text:"#1E293B", muted:"#94A3B8", border:"#E2E8F0", teal:"#0ABFA3", tealLight:"#E6FAF7" };

function notifLabel(r) {
  if (!r.items || r.items.length === 0) return r.equipName || "-";
  const names = r.items.map(i => i.modelName || i.equipName || "").filter(Boolean);
  return names.length > 1 ? `${names[0]} 외 ${names.length-1}건` : names[0] || "-";
}

// 모든 알림을 만드는 단일 소스 — 배지 카운트와 패널 목록이 공유 (최신순 정렬)
function buildAlerts(isAdmin, profile, data) {
  const { rentalRequests=[], facilityRequests=[], allUsers=[], pwResets=[], notices=[], licenseSchedules=[], articles=[], communityPosts=[], communityComments=[] } = data || {};
  const CC = NOTIF_CC, L = notifLabel;
  const today    = new Date().toISOString().slice(0,10);
  const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10);
  const myId     = profile?.studentId || "";
  const uid      = profile?.uid || "";
  let alerts;
  if (isAdmin) {
    alerts = [
      ...rentalRequests.filter(r=>r.status==="연체").map(r=>({ id:`연체_${r.id}`, cat:"대여/반납", color:CC.red, bg:CC.redLight, icon:"⚠️", title:`연체 발생: ${L(r)}`, desc:`${r.studentName} · 반납예정 ${r.endDate}`, time:r.updatedAt||r.createdAt, rentalId:r.id })),
      ...rentalRequests.filter(r=>r.status==="승인대기").map(r=>({ id:`승인대기_${r.id}`, cat:"대여/반납", color:CC.yellow, bg:CC.yellowLight, icon:"📋", title:`승인 대기: ${L(r)}`, desc:`${r.studentName}`, time:r.createdAt, rentalId:r.id })),
      ...facilityRequests.filter(r=>r.status==="승인대기").map(r=>({ id:`시설대기_${r.id}`, cat:"시설", color:CC.teal, bg:CC.tealLight, icon:"🏢", title:`시설 대여 승인 대기: ${r.facilityName}`, desc:`${r.studentName} · ${r.date}`, time:r.createdAt, facilityReqId:r.id })),
      ...allUsers.filter(u=>u.status==="pending").map(u=>({ id:`가입_${u.id}`, cat:"회원", color:CC.blue, bg:CC.blueLight, icon:"👤", title:`가입 승인 대기: ${u.name}`, desc:`${u.dept} · ${u.studentId}`, time:u.createdAt, userId:u.id })),
      ...pwResets.filter(r=>r.status==="pending").map(r=>({ id:`비번_${r.id}`, cat:"회원", color:CC.orange, bg:CC.orangeLight, icon:"🔑", title:`비밀번호 초기화 요청: ${r.studentName}`, desc:`학번 ${r.studentId}`, time:r.createdAt, userId:r.id })),
    ];
  } else {
    const myRentals  = rentalRequests.filter(r=>r.studentId===myId||r.studentId===profile?.uid);
    const myFacility = facilityRequests.filter(r=>r.studentId===myId);
    const upcoming = licenseSchedules.filter(s=>s.date>=today && s.status!=="완료");
    alerts = [
      ...myRentals.filter(r=>r.status==="승인됨").map(r=>({ id:`승인됨_${r.id}`, cat:"대여/반납", color:CC.green, bg:CC.greenLight, icon:"✅", title:`대여 승인됨: ${L(r)}`, desc:`${r.startDate} ~ ${r.endDate}`, time:r.updatedAt||r.createdAt, rentalId:r.id })),
      ...myRentals.filter(r=>r.status==="거절됨").map(r=>({ id:`거절됨_${r.id}`, cat:"대여/반납", color:CC.red, bg:CC.redLight, icon:"❌", title:`대여 거절됨: ${L(r)}`, desc:r.reason||"", time:r.updatedAt||r.createdAt, rentalId:r.id })),
      ...myRentals.filter(r=>r.status==="대여중"&&r.endDate===tomorrow).map(r=>({ id:`반납D1_${r.id}`, cat:"대여/반납", color:CC.orange, bg:CC.orangeLight, icon:"⏰", title:`반납 D-1: ${L(r)}`, desc:`내일(${r.endDate})까지 반납해주세요`, time:r.updatedAt||r.createdAt, rentalId:r.id })),
      ...myRentals.filter(r=>r.status==="연체").map(r=>({ id:`연체_${r.id}`, cat:"대여/반납", color:CC.red, bg:CC.redLight, icon:"⚠️", title:`연체 중: ${L(r)}`, desc:`반납예정일 ${r.endDate} 초과`, time:r.updatedAt||r.createdAt, rentalId:r.id })),
      ...myFacility.filter(r=>r.status==="승인됨").map(r=>({ id:`시설승인_${r.id}`, cat:"시설", color:CC.teal, bg:CC.tealLight, icon:"🏢", title:`시설 대여 승인됨: ${r.facilityName}`, desc:`${r.date} ${r.startTime}~${r.endTime}`, time:r.updatedAt||r.createdAt })),
      ...myFacility.filter(r=>r.status==="거절됨").map(r=>({ id:`시설거절_${r.id}`, cat:"시설", color:CC.red, bg:CC.redLight, icon:"❌", title:`시설 대여 거절됨: ${r.facilityName}`, desc:r.reason||"", time:r.updatedAt||r.createdAt })),
      ...upcoming.map(s=>({ id:`라이센스_${s.id}`, cat:"라이센스", color:CC.purple, bg:CC.purpleLight, icon:"🎖️", title:`라이센스 수업 신청 가능: ${s.title||s.equipName}`, desc:`${s.date} ${s.time||""} · ${s.location||""}`, time:s.createdAt, licenseId:s.id })),
    ];
  }
  // 공지 알림 (공통) — 관리자·학생 모두 표시, 30일 윈도우 예외(아래 필터에서 제외)
  alerts.push(
    ...notices.map(n=>({ id:`공지_${n.id}`, cat:"공지", color:CC.blue, bg:CC.blueLight, icon:"📌", title:n.title, desc:n.date, time:n.createdAt||n.date, noticeId:n.id })),
  );
  // SNS 알림 (공통) — 새 씬스패치 기사 + 내 글에 달린 댓글
  const myPostIds = new Set(communityPosts.filter(p=>p.authorId===uid).map(p=>p.id));
  alerts.push(
    ...articles.filter(a=>a.authorUid!==uid).map(a=>({ id:`기사_${a.id}`, cat:"SNS", color:CC.purple, bg:CC.purpleLight, icon:"📰", title:`새 기사: ${a.title||"제목 없음"}`, desc:a.tag||"씬스패치", time:a.createdAt, room:"scenepatch", articleId:a.id })),
    ...communityComments.filter(c=>myPostIds.has(c.postId) && c.authorId!==uid).map(c=>({ id:`댓글_${c.id}`, cat:"SNS", color:CC.teal, bg:CC.tealLight, icon:"💬", title:"내 글에 새 댓글이 달렸어요", desc:(c.content||"").slice(0,40), time:c.createdAt, tab:"community", postId:c.postId })),
  );
  // 30일 윈도우 + 최신순 정렬
  const ts = (t) => t?.seconds ? t.seconds*1000 : (t ? new Date(t).getTime() : 0);
  const cutoff = Date.now() - 30*86400000;
  return alerts.filter(a => { if (a.cat === "공지") return true; const t = ts(a.time); return t===0 || t>=cutoff; }).sort((a,b) => ts(b.time) - ts(a.time));
}

function NotifPanel({ onClose, isAdmin, profile, onNavigate, rentalRequests, facilityRequests, allUsers, pwResets, notices, licenseSchedules, articles, communityPosts, communityComments }) {
  const CC = NOTIF_CC;
  const [selCat, setSelCat] = React.useState("전체");

  // 읽은 알림 관리 (localStorage)
  const SEEN_KEY = `seen_notifs_${profile?.uid || "guest"}`;
  const [seenIds, setSeenIds] = React.useState(() => {
    let local = [];
    try { local = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch {}
    return new Set([...local, ...(profile?.seenNotifs || [])]);
  });
  const markSeen = (id) => {
    if (seenIds.has(id)) return;
    const next = new Set([...seenIds, id]);
    setSeenIds(next);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
    // 서버 동기화 — 기기 간 읽음 공유 (실패해도 로컬은 유지)
    if (profile?.uid) {
      updateDoc(doc(db, "users", profile.uid), { seenNotifs: arrayUnion(id) }).catch(() => {});
    }
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

  // 당근식 4탭 묶음 — 대여/반납·시설·라이센스·회원 → "상태"
  const groupOf = (a) => (a.cat === "공지" || a.cat === "SNS") ? a.cat : "상태";
  const TABS = ["전체", "상태", "공지", "SNS"];

  // 클릭 시 이동할 페이지 + 실제 글까지 여는 딥링크 타깃
  const navTarget = (a) => {
    if (a.cat === "공지")     return { tab: "notices", noticeId: a.noticeId };
    if (a.cat === "SNS" && a.articleId) return { tab: "community", room: "scenepatch", articleId: a.articleId };
    if (a.cat === "SNS" && a.postId)    return { tab: "community", postId: a.postId };
    if (a.cat === "SNS")      return { tab: "community" };
    if (a.cat === "회원")     return { tab: "students", userId: a.userId };
    if (a.cat === "라이센스") return { tab: "license", licenseId: a.licenseId };
    if (a.cat === "시설")     return { tab: isAdmin ? "rental" : "calendar", facilityReqId: a.facilityReqId };
    return { tab: isAdmin ? "rental" : "calendar", rentalId: a.rentalId }; // 대여/반납
  };
  const handleClick = (a) => { markSeen(a.id); onNavigate?.(navTarget(a)); };

  const allAlerts = buildAlerts(isAdmin, profile, { rentalRequests, facilityRequests, allUsers, pwResets, notices, licenseSchedules, articles, communityPosts, communityComments });
  const unreadIn = (g) => allAlerts.filter(a => !seenIds.has(a.id) && (g === "전체" || groupOf(a) === g)).length;
  const filtered = selCat === "전체" ? allAlerts : allAlerts.filter(a => groupOf(a) === selCat);

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:500 }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", top:0, right:0, bottom:0, width:360, background:"#fff", boxShadow:"-10px 0 40px rgba(0,0,0,0.15)", display:"flex", flexDirection:"column" }}>
        {/* 헤더 */}
        <div style={{ padding:"20px 20px 12px", borderBottom:`1px solid ${CC.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:18, fontWeight:800, color:CC.navy }}>🔔 알림 {unreadIn("전체") > 0 && <span style={{ background:CC.red, color:"#fff", borderRadius:20, padding:"2px 8px", fontSize:12, marginLeft:6 }}>{unreadIn("전체")}</span>}</div>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:CC.muted }}>✕</button>
          </div>
          {/* 카테고리 탭 (당근식 4탭) */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {TABS.map(c=>{
              const n = unreadIn(c);
              return (
                <button key={c} onClick={()=>setSelCat(c)}
                  style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${selCat===c?CC.navy:CC.border}`, background:selCat===c?CC.navy:"transparent", color:selCat===c?"#fff":CC.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  {c}{n>0 && <span style={{ marginLeft:4, color:selCat===c?"#fff":CC.red, fontWeight:800 }}>{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
        {/* 알림 목록 */}
        <div style={{ flex:1, overflowY:"auto", padding:16 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign:"center", padding:"60px 0", color:CC.muted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
              알림이 없어요
            </div>
          )}
          {filtered.map((a) => {
            const read = seenIds.has(a.id);
            const skin = read
              ? { background:"#fff", border:`1px solid ${CC.border}`, opacity:0.6 }
              : { background:a.bg, borderLeft:`4px solid ${a.color}` };
            return (
              <div key={a.id} onClick={() => handleClick(a)} className="tap-spring"
                style={{ ...skin, borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer", transition:"background 0.2s, opacity 0.2s, box-shadow 0.2s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    {!read && <span style={{ width:7, height:7, borderRadius:"50%", background:a.color, flexShrink:0 }} />}
                    <span style={{ fontSize:16 }}>{a.icon}</span>
                    <span style={{ fontSize:11, background:(read?CC.muted:a.color)+"20", color:read?CC.muted:a.color, borderRadius:4, padding:"1px 6px", fontWeight:700 }}>{a.cat}</span>
                  </div>
                  <span style={{ fontSize:10, color:CC.muted, flexShrink:0, marginLeft:8, marginTop:2 }}>{read ? "읽음" : "새 알림 ›"}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:read?CC.muted:CC.text, marginBottom:2 }}>{a.title}</div>
                {a.desc && <div style={{ fontSize:11, color:CC.muted, marginBottom:4 }}>{a.desc}</div>}
                {a.time && <div style={{ fontSize:10, color:CC.muted+"aa" }}>{fmtTime(a.time)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 학생용 대여 목록 통합 (장비/시설/소품목록)
function StudentRentalList({ setTab }) {
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
      {view === "equip"    && <EquipList setTab={setTab} />}
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
          <img src="/mascot/object.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
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
          <img src="/mascot/police.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
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

// 학생용 더보기 (프로필 요약 + 메뉴 허브, 카톡 더보기식)
function StudentMyPage() {
  const { profile } = useAuth();
  const [view, setView] = React.useState("menu"); // menu | profile | inquiry | license | notices

  const Back = () => (
    <button onClick={() => setView("menu")}
      style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#94A3B8", fontSize:13, cursor:"pointer", marginBottom:16 }}>
      ← 더보기
    </button>
  );

  if (view === "profile") return (<div><Back /><Profile /></div>);
  if (view === "inquiry") return (<div><Back /><StudentInquiry /></div>);
  if (view === "license") return (<div><Back /><License /></div>);
  if (view === "notices") return (<div><Back /><Notices isAdmin={false} /></div>);

  const MenuRow = ({ icon, label, sub, onClick }) => (
    <button onClick={onClick} style={{
      width:"100%", textAlign:"left", cursor:"pointer",
      background:"#1E293B", border:"1px solid #334155", borderRadius:12,
      padding:"15px 16px", marginBottom:10,
      display:"flex", alignItems:"center", justifyContent:"space-between",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:13 }}>
        <span style={{ fontSize:20 }}>{icon}</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:"#F1F5F9" }}>{label}</div>
          {sub && <div style={{ fontSize:11.5, color:"#64748B", marginTop:2 }}>{sub}</div>}
        </div>
      </div>
      <span style={{ fontSize:18, color:"#475569" }}>›</span>
    </button>
  );

  return (
    <div>
      {/* 프로필 요약 카드 */}
      <div style={{ background:"linear-gradient(135deg,#3d4370,#5b6191)", borderRadius:16, padding:"20px", marginBottom:18, display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:54, height:54, borderRadius:"50%", background:"rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>👤</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{profile?.name || "학생"}</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.82)", marginTop:3 }}>
            {[profile?.studentId, profile?.dept].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* 메뉴 리스트 */}
      <MenuRow icon="👤" label="내 정보" sub="프로필·계정 정보 확인" onClick={() => setView("profile")} />
      <MenuRow icon="💬" label="문의하기" sub="궁금한 점을 물어봐요" onClick={() => setView("inquiry")} />
      <MenuRow icon="🎓" label="라이센스" sub="내 장비 사용 등급" onClick={() => setView("license")} />
      <MenuRow icon="📢" label="공지사항" sub="대여실 소식·안내" onClick={() => setView("notices")} />
    </div>
  );
}

// 학생용 대여이력 + 캘린더 통합
function StudentCalendarHistory({ profile, focusId, onConsumed }) {
  const [view, setView] = React.useState("history");
  // 🔔 알림 딥링크 — 대여이력 뷰로 강제 전환 후 History에 위임
  React.useEffect(() => { if (focusId) setView("history"); }, [focusId]);
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
      {view === "history"  && <History focusId={focusId} onConsumed={onConsumed} />}
      {view === "calendar" && <CalendarPage isAdmin={false} userId={profile?.studentId} userEmail={profile?.email} userName={profile?.name} />}
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  useFCM(profile?.uid);
  const [tab,       setTab]       = useState("home");
  const [communityRoom, setCommunityRoom] = useState(null);
  const openCommunityRoom = (roomId) => { setCommunityRoom(roomId); setTab("community"); };
  // 알림 클릭 시 실제 글까지 여는 딥링크 타깃 { postId?, articleId?, noticeId? }
  const [notifTarget, setNotifTarget] = useState(null);
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
  const { data: articles }          = useCollection("scenepatchArticles", "createdAt");
  const { data: communityPosts }    = useCollection("communityPosts",     "createdAt");
  const { data: communityComments } = useCollection("communityComments",  "createdAt");

  if (loading) return <Spinner />;
  if (!user || !profile) return <Login />;

  const isAdmin    = profile.role === "admin";
  const adminRole  = profile.adminRole || "super"; // super | teacher | assistant
  const isSuper       = isAdmin && (adminRole === "super" || adminRole === "assistant"); // 슈퍼+조교: 모든 기능
  const isTeacherProf = isAdmin && (adminRole === "teacher" || adminRole === "professor"); // 교사+교수: 제한됨
  const isSubAdmin    = isTeacherProf; // 하위 호환


  // 읽은 알림 ID 목록 (useMemo 대신 직접 계산 - hooks 규칙 준수)
  const seenNotifIds = (() => {
    let local = [];
    try { local = JSON.parse(localStorage.getItem(`seen_notifs_${profile?.uid}`) || "[]"); } catch {}
    return new Set([...local, ...(profile?.seenNotifs || [])]);
  })();

  const notSeen = (id) => !seenNotifIds.has(id);

  // 배지 카운트 — 패널과 동일한 buildAlerts 사용 (배지·목록 불일치 방지)
  const notifCount = buildAlerts(isAdmin, profile, { rentalRequests, facilityRequests, allUsers, pwResets, notices, licenseSchedules, articles, communityPosts, communityComments }).filter(a => notSeen(a.id)).length;

  // 장비/시설 탭 전환 래퍼
  const ReserveWrapper = () => {
    const [page, setPage] = React.useState("main"); // main | equip | equip-guide | equip-expert | facility | props
    const [guideItems, setGuideItems] = React.useState(null);

    const Back = ({ to="main", onClick }) => (
      <button onClick={() => { if(onClick) onClick(); setPage(to); }} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#94A3B8", fontSize:13, cursor:"pointer", marginBottom:16 }}>
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
          <BannerCard onClick={() => setPage("facility")} mascot="object.png" gradient="#0D9488,#0891B2" title="🏢 시설 예약" desc="스튜디오, 편집실 등 시설을 예약해요" />
          <BannerCard onClick={() => setPage("props")} mascot="police.png" gradient="#7C3AED,#DB2777" title="🎭 소품 예약" desc="의상, 소도구, 대도구를 빌려요" dark={false} />
        </div>

        {/* 대여이력 · 캘린더 바로가기 */}
        <button onClick={() => setPage("history")} style={{
          marginTop:18, width:"100%", textAlign:"left", cursor:"pointer",
          background:"#1E293B", borderRadius:14, padding:"15px 18px", border:"1px solid #334155",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:13 }}>
            <span style={{ fontSize:24 }}>📋</span>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:"#F1F5F9", marginBottom:2 }}>대여이력 · 캘린더</div>
              <div style={{ fontSize:12, color:"#64748B" }}>내 대여 기록과 예약 일정을 확인해요</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:"#475569" }}>›</span>
        </button>
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

    if (page === "equip-guide" && !guideItems) return (
      <div>
        <Back to="equip" />
        <GuideReserve onComplete={(items) => setGuideItems(items)} />
      </div>
    );

    // 초보자 가이드 완료 → Reserve 신청서로 이동
    if (page === "equip-guide" && guideItems) return (
      <div>
        <Back to="equip-guide" onClick={() => setGuideItems(null)} />
        <Reserve initialItems={guideItems} />
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

    // 대여이력 · 캘린더
    if (page === "history") return (
      <div>
        <Back />
        <StudentCalendarHistory profile={profile} />
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
        case "rental":   return <Rental subAdmin={isTeacherProf} focusId={notifTarget?.rentalId} facilityFocusId={notifTarget?.facilityReqId} onConsumed={() => setNotifTarget(null)} />;
        case "g_equip":   return <GroupHub groupId="g_equip" setTab={setTab} />;
        case "g_student": return <GroupHub groupId="g_student" setTab={setTab} />;
        case "g_sns":     return <GroupHub groupId="g_sns" setTab={setTab} />;
        case "g_more":    return <GroupHub groupId="g_more" setTab={setTab} />;
        case "equip":    return <Equipment />;
        case "facility": return <Equipment initialTab="facility" />;
        case "students": return <Students focusId={notifTarget?.userId} onConsumed={() => setNotifTarget(null)} />;
        case "calendar": return <CalendarPage isAdmin={true} />;
        case "stats":    return <Stats isAdmin={true} />;
        case "notices":  return <Notices isAdmin={true} initialNoticeId={notifTarget?.noticeId} onConsumed={() => setNotifTarget(null)} />;
        case "settings": return <Settings />;
        case "inquiry":  return <AdminInquiry canDelete={isSuper} />;
        case "license":  return <LicenseAdmin />;
        case "sns":      return <SNSManager />;
        case "external": return <ExternalRental />;
        case "community":
          // 교수·교사도 에브리타임 진입 허용 (학생 전용 룸은 Community 내부에서 차단 모달 처리)
          return <Community onExit={() => setTab("home")} initialRoom={communityRoom} initialPostId={notifTarget?.postId} initialArticleId={notifTarget?.articleId} onRoomConsumed={() => { setCommunityRoom(null); setNotifTarget(null); }} />;
        default:         return <Dashboard setTab={setTab} />;
      }
    } else {
      switch (tab) {
        case "home":     return <StudentHome onOpenRoom={openCommunityRoom} />;
        case "equip":    return <StudentRentalList setTab={setTab} />;
        case "reserve":  return <ReserveWrapper />;
        case "calendar": return <StudentCalendarHistory profile={profile} focusId={notifTarget?.rentalId} onConsumed={() => setNotifTarget(null)} />;
        case "notices":  return <Notices isAdmin={false} initialNoticeId={notifTarget?.noticeId} onConsumed={() => setNotifTarget(null)} />;
        case "license":  return <License focusId={notifTarget?.licenseId} onConsumed={() => setNotifTarget(null)} />;
        case "community": return <Community onExit={() => setTab("home")} initialRoom={communityRoom} initialPostId={notifTarget?.postId} initialArticleId={notifTarget?.articleId} onRoomConsumed={() => { setCommunityRoom(null); setNotifTarget(null); }} />;
        case "mypage":   return <StudentMyPage />;
        default:         return <StudentHome onOpenRoom={openCommunityRoom} />;
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
          onNavigate={(t) => {
            setShowNotif(false);
            if (t.tab) setTab(t.tab);
            // 페이지 먼저 전환 → 살짝 텀 두고 대상(글/공지/기사/상태 카드) 등장 (모든 알림 공통)
            setTimeout(() => { setCommunityRoom(t.room || null); setNotifTarget(t); }, 450);
          }}
          rentalRequests={rentalRequests}
          facilityRequests={facilityRequests}
          allUsers={allUsers}
          pwResets={pwResets}
          notices={notices}
          licenseSchedules={licenseSchedules}
          articles={articles}
          communityPosts={communityPosts}
          communityComments={communityComments}
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
