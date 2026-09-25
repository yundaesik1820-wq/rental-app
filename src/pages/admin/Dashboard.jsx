import { useState } from "react";
import { C } from "../../theme";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import {
  LogOut, RefreshCw, UserPlus, Lock, Megaphone, MessageSquare, HelpCircle,
  Bell, ChevronRight, Users, UserCheck,
} from "lucide-react";

// ── 학생 블루 팔레트 (theme.js C는 아직 모노톤이라 여기서 직접 박음) ──
const BLUE = "#4f8bff", BLUE2 = "#7e9dff", GREEN = "#34D399",
      YELLOW = "#fbbf24", PURPLE = "#a78bfa", TEAL = "#2DD4BF",
      RED = "#FF6B6B", MUTED = "#8A8A92", TXT = "#ECECEE",
      CARD = "#16161c", CARDBG = "#0f0f14", BORDER = "#26262e";

const chev = <ChevronRight size={18} color={MUTED} style={{ flexShrink: 0 }} />;

export default function Dashboard({ setTab }) {
  const { profile, logout } = useAuth();
  const { data: users }             = useCollection("users",             "createdAt");
  const { data: notices }           = useCollection("notices",           "createdAt");
  const { data: inquiries }         = useCollection("inquiries",         "createdAt");
  const { data: pwResets }          = useCollection("pwResetRequests",   "createdAt");
  const { data: faqs }              = useCollection("faqs",              "createdAt");
  const { data: communityPosts }    = useCollection("communityPosts",    "createdAt");

  // 통계
  const studentCnt   = users.filter(u => u.role !== "admin").length;
  const pendingUsers = users.filter(u => u.status === "pending").length;
  const pwResetPend  = pwResets.filter(r => r.status === "pending").length;
  const unanswered   = inquiries.filter(i => i.status !== "답변완료").length;

  const timeAgo = (ts) => {
    const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds * 1000) : null);
    if (!d) return "";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)    return "방금 전";
    if (s < 3600)  return `${Math.floor(s/60)}분 전`;
    if (s < 86400) return `${Math.floor(s/3600)}시간 전`;
    return `${Math.floor(s/86400)}일 전`;
  };

  // 커뮤니티 최근 글 (최신순 4개)
  const recentPosts = [...communityPosts]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 4);

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
    <div onClick={onClick} style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:4, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, fontWeight:800, color:TXT }}>
        <Icon size={18} color={col} /> {label}
      </span>
      {onClick && <span style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", display:"flex" }}>{chev}</span>}
    </div>
  );
  const statTile = ({ Icon, label, n, col }) => (
    <div key={label} style={{ background:CARDBG, border:`1px solid ${BORDER}`, borderRadius:12, padding:"10px 8px" }}>
      {iconChip(Icon, col, 28, 16)}
      <div style={{ fontSize:10, color:MUTED, fontWeight:600, marginTop:8 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:900, color:TXT, marginTop:1 }}>{n}<span style={{ fontSize:11, fontWeight:600, color:MUTED }}>건</span></div>
    </div>
  );
  const mgmtRow = ({ Icon, col, label, badge, badgeCol, tab }) => (
    <div key={label} onClick={() => setTab?.(tab)} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
      {iconChip(Icon, col, 28, 15)}
      <span style={{ flex:1, minWidth:0, fontSize:12.5, fontWeight:700, color:TXT, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</span>
      <span style={{ background:`${badgeCol}22`, color:badgeCol, borderRadius:6, padding:"2px 7px", fontSize:10.5, fontWeight:700, whiteSpace:"nowrap", flexShrink:0 }}>{badge}</span>
      {chev}
    </div>
  );
  const newsRow = ({ Icon, col, label, n, nCol, tab }) => (
    <div key={label} onClick={() => setTab?.(tab)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
      {iconChip(Icon, col, 30, 16)}
      <span style={{ flex:1, fontSize:13, fontWeight:700, color:TXT }}>{label}</span>
      <span style={{ background:`${nCol}22`, color:nCol, borderRadius:6, padding:"2px 9px", fontSize:12, fontWeight:800, flexShrink:0 }}>{n}</span>
    </div>
  );

  const statTiles = [
    { Icon: Users,     label:"전체 회원", n: studentCnt,   col: BLUE },
    { Icon: UserPlus,  label:"가입 대기", n: pendingUsers, col: pendingUsers>0?YELLOW:GREEN },
    { Icon: Lock,      label:"비번 초기화", n: pwResetPend, col: pwResetPend>0?YELLOW:GREEN },
    { Icon: MessageSquare, label:"문의 대기", n: unanswered, col: unanswered>0?RED:GREEN },
  ];

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

      {/* 처리 대기 긴급 배너 (가입/비번/문의 합계 > 0) */}
      {(pendingUsers + pwResetPend + unanswered) > 0 && (
        <div onClick={() => setTab?.(pendingUsers>0 ? "students" : unanswered>0 ? "inquiry" : "students")}
          style={{ background:"linear-gradient(135deg,#2a3a7a,#3f2f6e)", border:`1px solid ${BLUE}59`, borderRadius:16, padding:"13px 15px", marginBottom:14, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#4f8bff,#7c5cff)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <UserCheck size={22} color="#fff" />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:"#b9c6ff", fontWeight:700 }}>처리 대기</div>
            <div style={{ fontSize:15, fontWeight:900, color:"#fff", marginTop:1 }}>
              {pendingUsers>0 && `가입 ${pendingUsers} · `}{pwResetPend>0 && `비번 ${pwResetPend} · `}{unanswered>0 && `문의 ${unanswered}`}
            </div>
          </div>
          <ChevronRight size={20} color="#fff" style={{ flexShrink:0 }} />
        </div>
      )}

      {/* 한눈에 보기 — 4타일 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:14, marginBottom:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>{statTiles.map(statTile)}</div>
      </div>

      {/* 사용자 관리 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"13px 14px 4px", marginBottom:14 }}>
        {cardTitle(Users, BLUE2, "사용자 관리", () => setTab?.("students"))}
        {mgmtRow({ Icon: UserPlus, col: BLUE,   label:"가입 승인",       badge:`${pendingUsers}건 대기`, badgeCol: pendingUsers>0?BLUE:MUTED,   tab:"students" })}
        {mgmtRow({ Icon: Lock,     col: GREEN,  label:"비밀번호 초기화", badge:`${pwResetPend}건`,       badgeCol: pwResetPend>0?YELLOW:MUTED,  tab:"students" })}
      </div>

      {/* 소식 & 문의 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"13px 14px 4px", marginBottom:14 }}>
        {cardTitle(MessageSquare, BLUE2, "소식 & 문의", () => setTab?.("inquiry"))}
        {newsRow({ Icon: Megaphone,     col: BLUE,   label:"공지", n: notices.length, nCol: BLUE2, tab:"notices" })}
        {newsRow({ Icon: MessageSquare, col: RED,    label:"문의", n: unanswered,     nCol: unanswered>0?RED:MUTED, tab:"inquiry" })}
        {newsRow({ Icon: HelpCircle,    col: PURPLE, label:"FAQ",  n: faqs.length,    nCol: BLUE2, tab:"inquiry" })}
      </div>

      {/* 커뮤니티 활동 — 최근 글 */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"13px 14px 4px", marginBottom:14 }}>
        {cardTitle(Bell, BLUE2, "커뮤니티 활동", () => setTab?.("community"))}
        {recentPosts.length === 0 && (
          <div style={{ padding:"14px 0 16px", fontSize:12.5, color:MUTED, borderTop:`1px solid ${BORDER}` }}>최근 글이 없습니다</div>
        )}
        {recentPosts.map((p) => (
          <div key={p.id} onClick={() => setTab?.("community")} style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 0", borderTop:`1px solid ${BORDER}`, cursor:"pointer" }}>
            <span style={{ width:7, height:7, borderRadius:99, background:BLUE, flexShrink:0 }} />
            {p.category && <span style={{ fontSize:11, fontWeight:800, color:BLUE2, flexShrink:0 }}>{p.category}</span>}
            <span style={{ flex:1, minWidth:0, fontSize:12, color:"#c8c8cf", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title || (p.content || "").slice(0, 30) || "새 글"}</span>
            <span style={{ fontSize:11, color:MUTED, flexShrink:0 }}>{timeAgo(p.createdAt)}</span>
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
