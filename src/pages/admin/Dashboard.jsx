import { C } from "../../theme";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { LogOut } from "lucide-react";

function DashRow({ icon, label, onClick, alerts = [] }) {
  const totalCount = alerts.reduce((s, a) => s + a.count, 0);
  return (
    <div onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:12, background:C.surface, borderRadius:12, padding:"12px 14px", marginBottom:8, cursor: onClick ? "pointer" : "default", border:`1px solid ${C.border}` }}>
      <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
      <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>{label}</span>
      <div style={{ display:"flex", gap:5, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
        {alerts.filter(a => a.count > 0).map((a, i) => (
          <span key={i} style={{ background: a.color || C.red, color:"#fff", borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
            {a.label} {a.count}
          </span>
        ))}
        {totalCount === 0 && (
          <span style={{ background:C.greenLight, color:C.green, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700 }}>정상</span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ setTab }) {
  const { profile, logout } = useAuth();
  const { data: requests }         = useCollection("rentalRequests",    "createdAt");
  const { data: facilityRequests } = useCollection("facilityRequests",  "createdAt");
  const { data: equipments }       = useCollection("equipments",        "createdAt");
  const { data: users }            = useCollection("users",             "createdAt");
  const { data: notices }          = useCollection("notices",           "createdAt");
  const { data: licenseApps }      = useCollection("licenseApplications","createdAt");
  const { data: inquiries }        = useCollection("inquiries",         "createdAt");
  const { data: communityPosts }   = useCollection("communityPosts",    "createdAt");
  const { data: pwResets }         = useCollection("pwResetRequests",   "createdAt");

  // 통계
  const pending       = requests.filter(r => r.status === "승인대기").length;
  const overdue       = requests.filter(r => r.status === "연체").length;
  const held          = requests.filter(r => r.status === "보류").length;
  const facilityPend  = facilityRequests.filter(r => r.status === "승인대기").length;
  const pendingUsers  = users.filter(u => u.status === "pending").length;
  const pwResetPend   = pwResets.filter(r => r.status === "pending").length;
  const lowStock      = equipments.filter(e => (e.available || 0) === 0).length;
  const licensePend   = licenseApps.filter(a => a.status === "대기").length;
  const unanswered    = inquiries.filter(i => !i.answered).length;
  const today         = new Date().toISOString().slice(0, 10);
  const newNotices    = notices.filter(n => n.date === today).length;

  const roleName = profile?.adminRole === "teacher"   ? "교사" :
                   profile?.adminRole === "assistant" ? "조교" :
                   profile?.adminRole === "professor" ? "교수" : "관리자";

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ background:`linear-gradient(135deg,#1B2B6B,#2D9B8A)`, borderRadius:20, padding:"18px 20px", marginBottom:20, position:"relative" }}>
        <button onClick={logout} style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:8, padding:"6px 10px", color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          <LogOut size={14} /> 로그아웃
        </button>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginBottom:3, display:"flex", alignItems:"center", gap:6 }}>
          {roleName}
          <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{roleName}</span>
        </div>
        <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>
          안녕하세요, {profile?.name}님 👋
        </div>
      </div>

      {/* 연체 긴급 알림 */}
      {overdue > 0 && (
        <div style={{ background:C.redLight, borderRadius:14, padding:"12px 16px", marginBottom:16, border:`1px solid ${C.red}30`, display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.red }}>연체 {overdue}건 — 즉시 확인 필요</div>
            <div style={{ fontSize:11, color:C.muted }}>대여/반납 탭에서 처리하세요</div>
          </div>
        </div>
      )}

      {/* 업무별 현황 */}
      <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>📋 업무 현황</div>

      {/* 공지 관리 */}
      <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div onClick={() => setTab?.("notices")}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
          <span style={{ fontSize:20 }}>📢</span>
          <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>공지 관리</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
        </div>
        {notices.slice(0,3).map(n => (
          <div key={n.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 14px", borderTop:`1px solid ${C.border}`, gap:10 }}>
            <span style={{ fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{n.title}</span>
            <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{n.date}</span>
          </div>
        ))}
        {notices.length === 0 && (
          <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.border}`, fontSize:12, color:C.muted }}>등록된 공지가 없습니다</div>
        )}
      </div>

      {/* 학생 관리 */}
      <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div onClick={() => setTab?.("students")}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
          <span style={{ fontSize:20 }}>👥</span>
          <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>학생 관리</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
        </div>
        <div style={{ display:"flex", borderTop:`1px solid ${C.border}` }}>
          <div style={{ flex:1, padding:"10px 14px", borderRight:`1px solid ${C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color: pendingUsers>0 ? C.orange : C.green }}>{pendingUsers}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>승인 대기</div>
          </div>
          <div style={{ flex:1, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color: pwResetPend>0 ? C.yellow : C.green }}>{pwResetPend}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>비밀번호 초기화 요청</div>
          </div>
        </div>
      </div>

      <DashRow icon="📦" label="장비/시설 관리"
        alerts={[
          { label:"재고없음", count:lowStock, color:C.red },
        ]} />

      <DashRow icon="📅" label="장비/시설 대여관리"
        alerts={[
          { label:"장비대기", count:pending, color:C.yellow },
          { label:"시설대기", count:facilityPend, color:C.teal },
          { label:"보류", count:held, color:C.orange },
          { label:"연체", count:overdue, color:C.red },
        ]} />

      <DashRow icon="🎖️" label="라이센스 관리"
        alerts={[{ label:"신청대기", count:licensePend, color:C.purple }]} />

      <DashRow icon="💬" label="에브리타임 관리"
        alerts={[{ label:"전체글", count:communityPosts.length, color:C.blue }]} />

      <DashRow icon="📩" label="문의 관리"
        alerts={[{ label:"미답변", count:unanswered, color:C.red }]} />
    </div>
  );
}
