import { useState } from "react";
import { C } from "../../theme";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import {
  LogOut, RefreshCw, Calendar, ArrowRightLeft, Clock, Wrench,
  UserPlus, Lock, Award, Megaphone, MessageSquare, HelpCircle,
  Bell, ChevronRight, Zap, Crosshair, ArrowRight, AlertTriangle, Users,
} from "lucide-react";

// ── 학생 블루 팔레트 (theme.js C는 아직 모노톤이라 여기서 직접 박음) ──
const BLUE = "#4f8bff", BLUE2 = "#7e9dff", GREEN = "#34D399",
      YELLOW = "#fbbf24", PURPLE = "#a78bfa", TEAL = "#2DD4BF",
      RED = "#FF6B6B", MUTED = "#8A8A92", TXT = "#ECECEE",
      CARD = "#16161c", CARDBG = "#0f0f14", BORDER = "#26262e";

const chev = <ChevronRight size={18} color={MUTED} style={{ flexShrink: 0 }} />;

export default function Dashboard({ setTab }) {
  const { profile, logout } = useAuth();
  const { data: requests }    = useCollection("rentalRequests",     "createdAt");
  const { data: equipments }  = useCollection("equipments",         "createdAt");
  const { data: users }       = useCollection("users",              "createdAt");
  const { data: notices }     = useCollection("notices",            "createdAt");
  const { data: licenseApps } = useCollection("licenseApplications","createdAt");
  const { data: inquiries }   = useCollection("inquiries",          "createdAt");
  const { data: pwResets }    = useCollection("pwResetRequests",    "createdAt");
  const { data: faqs }        = useCollection("faqs",               "createdAt");

  // 통계
  const pending      = requests.filter(r => r.status === "승인대기").length;
  const overdue      = requests.filter(r => r.status === "연체").length;
  const pendingUsers = users.filter(u => u.status === "pending").length;
  const pwResetPend  = pwResets.filter(r => r.status === "pending").length;
  const licensePend  = licenseApps.filter(a => a.status === "대기").length;
  const unanswered   = inquiries.filter(i => i.status !== "답변완료").length;
  const repairUnits  = equipments.filter(e => e.status === "수리중").length;

  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const retStatuses    = ["승인됨", "대여중"];
  const todayRentEquip = requests.filter(r => r.startDate === today    && r.status === "승인됨").length;
  const todayRetEquip  = requests.filter(r => r.endDate   === today    && retStatuses.includes(r.status)).length;
  const tmrRentEquip   = requests.filter(r => r.startDate === tomorrow && r.status === "승인됨").length;
  const tmrRetEquip    = requests.filter(r => r.endDate   === tomorrow && retStatuses.includes(r.status)).length;

  // 날짜 표기 (오늘 / 내일)
  const WD = ["일","월","화","수","목","금","토"];
  const fmtDate = (d) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} (${WD[d.getDay()]})`;
  const dateStr  = fmtDate(new Date());
  const dateStr2 = fmtDate(new Date(Date.now() + 86400000));

  // 현황 캐러셀 (오늘 / 내일)
  const todayTiles = [
    { Icon: Calendar,       label:"오늘 대여", n: todayRentEquip, col: BLUE },
    { Icon: ArrowRightLeft, label:"오늘 반납", n: todayRetEquip,  col: GREEN },
    { Icon: Clock,          label:"승인 대기", n: pending,        col: YELLOW },
    { Icon: Wrench,         label:"정비 필요", n: repairUnits,    col: PURPLE },
  ];
  const tmrTiles = [
    { Icon: Calendar,       label:"내일 대여", n: tmrRentEquip, col: BLUE },
    { Icon: ArrowRightLeft, label:"내일 반납", n: tmrRetEquip,  col: GREEN },
    { Icon: Clock,          label:"승인 대기", n: pending,      col: YELLOW },
    { Icon: Wrench,         label:"정비 필요", n: repairUnits,  col: PURPLE },
  ];

  // 최근 알림 피드 (연체 + 신규 대여신청, 최신순)
  const timeAgo = (ts) => {
    const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds * 1000) : null);
    if (!d) return "";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)    return "방금 전";
    if (s < 3600)  return `${Math.floor(s/60)}분 전`;
    if (s < 86400) return `${Math.floor(s/3600)}시간 전`;
    return `${Math.floor(s/86400)}일 전`;
  };
  const itemsLabel = (r) => {
    const first = r.items?.[0]?.equipName || "장비";
    const more  = (r.items?.length || 0) > 1 ? ` 외 ${r.items.length - 1}건` : "";
    return first + more;
  };
  const feedItems = [
    ...requests.filter(r => r.status === "연체").map(r => ({
      dot: RED, tag: "연체 알림", tagCol: RED, ts: r.createdAt,
      text: `${itemsLabel(r)}이(가) 연체되었습니다.`,
    })),
    ...requests.filter(r => r.status === "승인대기").map(r => ({
      dot: BLUE, tag: "대여 신청", tagCol: BLUE2, ts: r.createdAt,
      text: `${r.studentName || "학생"}님이 ${itemsLabel(r)} 대여를 신청했습니다.`,
    })),
  ].sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0)).slice(0, 4);

  const roleName = profile?.adminRole === "teacher"   ? "교사" :
                   profile?.adminRole === "assistant" ? "조교" :
                   profile?.adminRole === "professor" ? "교수" : "관리자";

  const canSwitch = !!profile?.linkedEmail;
  const storageKey = `linked_creds_${profile?.uid}`;
  const savedCreds = (() => {
    try { return JSON.parse(atob(localStorage.getItem(storageKey) || "")); } catch { return null; }
  })();
  const [switchModal,   setSwitchModal]   = useState(false);
  const [setupPw,       setSetupPw]       = useState("");
  const [switchErr,     setSwitchErr]     = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);
  const [curPage,       setCurPage]       = useState(0); // 현황 캐러셀 페이지

  const handleSaveCreds = async () => {
    if (!setupPw.trim()) { setSwitchErr("비밀번호를 입력해주세요"); return; }
    setSwitchLoading(true); setSwitchErr("");
    try {
      await signInWithEmailAndPassword(auth, profile?.linkedEmail, setupPw.trim());
      localStorage.setItem(storageKey, btoa(JSON.stringify({ email: profile?.linkedEmail, pw: setupPw.trim() })));
      setSwitchModal(false); setSetupPw("");
    } catch {
      setSwitchErr("이메일 또는 비밀번호가 맞지 않아요");
    } finally { setSwitchLoading(false); }
  };
  const doSwitch = async () => {
    if (savedCreds) {
      setSwitchLoading(true);
      try { await signInWithEmailAndPassword(auth, savedCreds.email, savedCreds.pw); }
      catch { localStorage.removeItem(storageKey); setSwitchModal(true); }
      finally { setSwitchLoading(false); }
    } else { setSwitchModal(true); }
  };

  // ── 재사용 렌더 조각 ──
  const iconChip = (Icon, col, size = 30, isz = 16) => (
    <div style={{ width:size, height:size, borderRadius:9, background:`${col}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <Icon size={isz} color={col} />
    </div>
  );
  const cardTitle = (Icon, col, label, onClick) => (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, fontWeight:800, color:TXT }}>
        <Icon size={18} color={col} /> {label}
      </span>
      {onClick && chev}
    </div>
  );
  const statTile = ({ Icon, label, n, col }) => (
    <div key={label} style={{ background:CARDBG, border:`1px solid ${BORDER}`, borderRadius:12, padding:"10px 8px" }}>
      {iconChip(Icon, col, 28, 16)}
      <div style={{ fontSize:10, color:MUTED, fontWeight:600, marginTop:8 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:900, color:TXT, marginTop:1 }}>{n}<span style={{ fontSize:11, fontWeight:600, color:MUTED }}>건</span></div>
    </div>
  );
  // 현황 캐러셀 한 페이지 (제목 + 날짜 + 4타일)
  const statPage = (title, dstr, tiles) => (
    <div key={title} style={{ minWidth:"100%", boxSizing:"border-box", scrollSnapAlign:"start" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <span style={{ fontSize:14, fontWeight:800, color:TXT }}>{title}</span>
        <span style={{ fontSize:12, color:MUTED, display:"flex", alignItems:"center", gap:5 }}>{dstr} <Calendar size={14} color={MUTED} /></span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>{tiles.map(statTile)}</div>
    </div>
  );
  const mgmtRow = ({ Icon, col, label, badge, badgeCol, tab }) => (
    <div key={label} onClick={() => setTab?.(tab)} style={{ display:"flex", alignItems:"center", gap:10, minHeight:48, boxSizing:"border-box", padding:"9px 0", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
      {iconChip(Icon, col, 30, 16)}
      <span style={{ flex:1, minWidth:0, fontSize:13, fontWeight:700, color:TXT, textAlign:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</span>
      <span style={{ background:`${badgeCol}22`, color:badgeCol, borderRadius:6, padding:"2px 7px", fontSize:10.5, fontWeight:700, whiteSpace:"nowrap", flexShrink:0 }}>{badge}</span>
      {chev}
    </div>
  );
  const newsRow = ({ Icon, col, label, n, nCol, tab }) => (
    <div key={label} onClick={() => setTab?.(tab)} style={{ display:"flex", alignItems:"center", gap:10, minHeight:48, boxSizing:"border-box", padding:"9px 0", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
      {iconChip(Icon, col, 30, 16)}
      <span style={{ flex:1, fontSize:13, fontWeight:700, color:TXT, textAlign:"center" }}>{label}</span>
      <span style={{ background:`${nCol}22`, color:nCol, borderRadius:6, padding:"2px 9px", fontSize:12, fontWeight:800, flexShrink:0 }}>{n}</span>
    </div>
  );
  const opRow = ({ Icon, col, label, n }) => (
    <div key={label} onClick={() => setTab?.("rental")} style={{ display:"flex", alignItems:"center", gap:10, minHeight:48, boxSizing:"border-box", padding:"9px 0", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
      {iconChip(Icon, col, 30, 16)}
      <span style={{ flex:1, fontSize:13, fontWeight:700, color:TXT, textAlign:"center" }}>{label}</span>
      <span style={{ fontSize:15, fontWeight:900, color:TXT, flexShrink:0 }}>{n}<span style={{ fontSize:10, color:MUTED, fontWeight:600 }}>건</span></span>
    </div>
  );

  return (
    <div>
      {/* 헤더 — 아바타 + 인사 + 역할 + (전환/로그아웃) */}
      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:14 }}>
        {profile?.photoURL
          ? <img src={profile.photoURL} alt="" style={{ width:44, height:44, borderRadius:99, objectFit:"cover", flexShrink:0, border:`1px solid ${BORDER}` }} />
          : <div style={{ width:44, height:44, borderRadius:99, background:"linear-gradient(135deg,#3b82f6,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#fff", flexShrink:0 }}>{(profile?.name || "?").slice(0,1)}</div>
        }
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:TXT, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{profile?.name}님, 반갑습니다! 👋</div>
          <span style={{ display:"inline-block", marginTop:5, background:`${BLUE}26`, color:BLUE2, border:`1px solid ${BLUE}55`, borderRadius:7, padding:"2px 9px", fontSize:11, fontWeight:700 }}>{roleName}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {canSwitch && (
            <button onClick={doSwitch} disabled={switchLoading} title="계정 전환"
              style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", display:"flex", padding:4, opacity:switchLoading?0.5:1 }}>
              <RefreshCw size={18} style={{ animation: switchLoading ? "spin 1s linear infinite" : "none" }} />
            </button>
          )}
          <button onClick={logout} title="로그아웃" style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", display:"flex", padding:4 }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* 연체 긴급 */}
      {overdue > 0 && (
        <div onClick={() => setTab?.("rental")} style={{ background:"linear-gradient(135deg,#3a1a1e,#2a1216)", border:`1px solid ${RED}66`, borderRadius:16, padding:"13px 15px", marginBottom:14, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#ff5b5b,#e03b3b)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <AlertTriangle size={22} color="#fff" />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:"#ff9a9a", fontWeight:700 }}>즉시 확인 필요</div>
            <div style={{ fontSize:16, fontWeight:900, color:"#fff", marginTop:1 }}>연체 {overdue}건 <span style={{ color:"#ff9a9a", fontWeight:600, fontSize:13 }}>/ 즉시 확인</span></div>
          </div>
          <div style={{ width:32, height:32, borderRadius:99, background:"rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <ChevronRight size={18} color="#fff" />
          </div>
        </div>
      )}

      {/* 현황 캐러셀 — 좌우로 밀면 오늘 ↔ 내일 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:14, marginBottom:14 }}>
        <style>{`.dash-carousel::-webkit-scrollbar{display:none}`}</style>
        <div className="dash-carousel"
          onScroll={(e) => { const el = e.currentTarget; setCurPage(Math.round(el.scrollLeft / el.clientWidth)); }}
          style={{ display:"flex", overflowX:"auto", scrollSnapType:"x mandatory", scrollbarWidth:"none" }}>
          {statPage("오늘의 현황", dateStr,  todayTiles)}
          {statPage("내일의 현황", dateStr2, tmrTiles)}
        </div>
        <div style={{ display:"flex", gap:5, justifyContent:"center", marginTop:12 }}>
          {[0,1].map(i => (
            <div key={i} style={{ width: curPage===i ? 16 : 5, height:5, borderRadius:99, background: curPage===i ? BLUE : BORDER, transition:"width .2s" }} />
          ))}
        </div>
      </div>

      {/* 빠른 작업 — 컴팩트 가로 바 (한 줄) */}
      <div onClick={() => setTab?.("rental")} style={{ background:"linear-gradient(135deg,#2a3a7a,#3f2f6e)", border:`1px solid ${BLUE}59`, borderRadius:14, padding:"10px 13px", marginBottom:14, display:"flex", alignItems:"center", gap:11, cursor:"pointer" }}>
        <div style={{ width:34, height:34, borderRadius:10, background:"rgba(255,255,255,0.14)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Zap size={18} color="#ffd66b" /></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:800, color:"#fff" }}>빠른 작업 · 대여 승인</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.72)" }}>{pending}건 대기 중</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, background:"linear-gradient(135deg,#4f8bff,#7c5cff)", borderRadius:9, padding:"7px 12px", fontSize:12.5, fontWeight:800, color:"#fff", flexShrink:0 }}>바로가기 <ArrowRight size={14} color="#fff" /></div>
      </div>

      {/* 사용자 관리 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"13px 14px 4px", marginBottom:14 }}>
        {cardTitle(Users, BLUE2, "사용자 관리", () => setTab?.("students"))}
        {mgmtRow({ Icon: UserPlus, col: BLUE,   label:"가입 승인",      badge:`${pendingUsers}건 대기`, badgeCol: pendingUsers>0?BLUE:MUTED,   tab:"students" })}
        {mgmtRow({ Icon: Lock,     col: GREEN,  label:"비밀번호 초기화", badge:`${pwResetPend}건`,      badgeCol: pwResetPend>0?YELLOW:MUTED,  tab:"students" })}
        {mgmtRow({ Icon: Award,    col: PURPLE, label:"라이선스 관리",   badge:`${licensePend}건 대기`, badgeCol: licensePend>0?PURPLE:MUTED,  tab:"license" })}
      </div>

      {/* 소식 & 문의 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"13px 14px 4px", marginBottom:14 }}>
        {cardTitle(MessageSquare, BLUE2, "소식 & 문의", () => setTab?.("inquiry"))}
        {newsRow({ Icon: Megaphone,     col: BLUE,   label:"공지", n: notices.length, nCol: BLUE2, tab:"notices" })}
        {newsRow({ Icon: MessageSquare, col: RED,    label:"문의", n: unanswered,     nCol: unanswered>0?RED:MUTED, tab:"inquiry" })}
        {newsRow({ Icon: HelpCircle,    col: PURPLE, label:"FAQ",  n: faqs.length,    nCol: BLUE2, tab:"inquiry" })}
      </div>

      {/* 대여 운영 — 세로 1열 (오늘/내일 대여·반납 + 전체 일정 보기) */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"13px 14px 4px", marginBottom:14 }}>
        {cardTitle(Calendar, TEAL, "대여 운영", () => setTab?.("calendar"))}
        {opRow({ Icon: Calendar,       col: TEAL,  label:"오늘 대여", n: todayRentEquip })}
        {opRow({ Icon: ArrowRightLeft, col: BLUE,  label:"오늘 반납", n: todayRetEquip })}
        {opRow({ Icon: Calendar,       col: PURPLE,label:"내일 대여", n: tmrRentEquip })}
        {opRow({ Icon: ArrowRightLeft, col: BLUE2, label:"내일 반납", n: tmrRetEquip })}
        <div onClick={() => setTab?.("calendar")} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0 8px", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
          <span style={{ fontSize:12.5, fontWeight:700, color:BLUE2 }}>전체 일정 보기</span>
          <ChevronRight size={16} color={BLUE2} />
        </div>
      </div>

      {/* 최근 알림 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"13px 14px 4px", marginBottom:14 }}>
        {cardTitle(Bell, BLUE2, "최근 알림", () => setTab?.("rental"))}
        {feedItems.length === 0 && (
          <div style={{ padding:"14px 0 16px", fontSize:12.5, color:MUTED, borderTop:`1px solid ${BORDER}` }}>새 알림이 없습니다</div>
        )}
        {feedItems.map((f, i) => (
          <div key={i} onClick={() => setTab?.("rental")} style={{ display:"flex", alignItems:"center", gap:9, minHeight:48, boxSizing:"border-box", padding:"9px 0", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
            <span style={{ width:7, height:7, borderRadius:99, background:f.dot, flexShrink:0 }} />
            <span style={{ fontSize:11.5, fontWeight:800, color:f.tagCol, flexShrink:0 }}>{f.tag}</span>
            <span style={{ flex:1, minWidth:0, fontSize:12, color:"#c8c8cf", textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.text}</span>
            <span style={{ fontSize:11, color:MUTED, flexShrink:0 }}>{timeAgo(f.ts)}</span>
          </div>
        ))}
      </div>

      {/* 계정 연결 설정 모달 (처음 한 번만) */}
      {switchModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={() => { setSwitchModal(false); setSwitchErr(""); }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:C.surface, borderRadius:16, padding:24, width:"100%", maxWidth:360, boxShadow:"0 8px 32px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:4 }}>계정 전환</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>비밀번호를 입력하면 바로 전환돼요</div>
            <div style={{ background:C.bg, borderRadius:9, padding:"9px 12px", marginBottom:12, fontSize:13, color:C.text }}>
              {profile?.linkedEmail}
            </div>
            <div style={{ marginBottom: switchErr ? 8 : 16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4 }}>비밀번호</div>
              <input value={setupPw} onChange={e => setSetupPw(e.target.value)} type="password" placeholder="비밀번호 입력" autoFocus
                onKeyDown={e => e.key === "Enter" && handleSaveCreds()}
                style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:9, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            </div>
            {switchErr && (
              <div style={{ background:C.redLight, color:C.red, borderRadius:8, padding:"7px 12px", fontSize:12, marginBottom:12 }}>{switchErr}</div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { setSwitchModal(false); setSetupPw(""); setSwitchErr(""); }}
                style={{ flex:1, background:"none", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 0", fontSize:13, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>취소</button>
              <button onClick={handleSaveCreds} disabled={switchLoading}
                style={{ flex:2, background:C.navy, border:"none", borderRadius:9, padding:"10px 0", fontSize:13, fontWeight:700, color: C.bg, cursor:"pointer", fontFamily:"inherit", opacity:switchLoading?0.7:1 }}>
                {switchLoading ? "확인 중..." : "계정 저장"}
              </button>
            </div>
            {savedCreds && (
              <button onClick={() => { localStorage.removeItem(storageKey); setSwitchModal(false); }}
                style={{ width:"100%", marginTop:8, background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", textDecoration:"underline" }}>
                저장된 계정 초기화
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
