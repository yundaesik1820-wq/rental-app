import { C } from "../../theme";
import { Card, Badge, StatBox, SectionTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { PauseCircle, LogOut } from "lucide-react";

export default function Dashboard() {
  const { profile, logout } = useAuth();
  const { data: requests }     = useCollection("rentalRequests", "createdAt");
  const { data: equipments }   = useCollection("equipments", "createdAt");

  // rentalRequests 기반 통계
  const renting  = requests.filter(r => r.status === "승인됨").length;
  const overdue  = requests.filter(r => r.status === "연체").length;
  const avail    = equipments.reduce((a, e) => a + (e.available || 0), 0);
  const pending  = requests.filter(r => r.status === "승인대기").length;
  const held     = requests.filter(r => r.status === "보류").length;

  // 대시보드용 rentals = requests 별칭
  const rentals = requests;

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ background:`linear-gradient(135deg,#1B2B6B,#2D9B8A)`, borderRadius:20, padding:"18px 20px", marginBottom:20, position:"relative" }}>
        <button onClick={logout} style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:8, padding:"6px 10px", color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          <LogOut size={14} /> 로그아웃
        </button>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginBottom:3, display:"flex", alignItems:"center", gap:6 }}>
          {profile?.adminRole === "teacher"   ? "교사" :
           profile?.adminRole === "assistant" ? "조교" :
           profile?.adminRole === "professor" ? "교수" : "관리자"}
          <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>
            {profile?.adminRole === "teacher"   ? "교사" :
             profile?.adminRole === "assistant" ? "조교" :
             profile?.adminRole === "professor" ? "교수" : "관리자"}
          </span>
        </div>
        <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>
          안녕하세요, {profile?.name}님 👋
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox icon="✅" label="승인됨 (대여중)" value={renting} color={C.blue}   bg={C.blueLight}  />
        <StatBox icon="⏳" label="승인 대기"       value={pending} color={C.yellow} bg={C.yellowLight}/>
        <StatBox icon={PauseCircle} label="보류"            value={held}    color={C.orange} bg={C.orangeLight}/>
        <StatBox icon="📦" label="총 대여가능"     value={avail}   color={C.green}  bg={C.greenLight} />
      </div>

      {/* Alerts */}
      {overdue > 0 && (
        <div style={{ background: C.redLight, borderRadius: 14, padding: "14px 18px", marginBottom: 16, border: `1px solid ${C.red}30`, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>연체 {overdue}건 발생 — 즉시 확인이 필요합니다</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>대여/반납 탭에서 처리하세요</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Recent Rentals */}
        <div>
          <SectionTitle>📋 최근 대여 현황</SectionTitle>
          {requests.filter(r => r.status !== "반납완료" && r.status !== "거절됨").slice(0, 5).map(r => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.equipName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>👤 {r.studentName} · {r.studentId}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>반납예정: {r.dueDate}</div>
                </div>
                <Badge label={r.status} />
              </div>
            </Card>
          ))}
          {rentals.filter(r => r.status !== "반납완료").length === 0 && (
            <div style={{ fontSize: 13, color: C.muted, padding: "20px 0" }}>대여 중인 장비 없음</div>
          )}
        </div>

        {/* Equipment Status */}
        <div>
          <SectionTitle>🔧 장비 재고 현황</SectionTitle>
          {equipments.slice(0, 6).map(e => (
            <Card key={e.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{e.img || "📦"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.modelName || e.name}</div>
                      {e.itemName && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{e.itemName}</div>}
                      {(e.majorCategory || e.category) && <div style={{ fontSize: 11, color: C.muted }}>{[e.majorCategory, e.manufacturer].filter(Boolean).join(" · ")}</div>}
                    </div>
                    <Badge label={e.status} />
                  </div>
                  <div style={{ background: C.border, borderRadius: 6, height: 6, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${((e.available || 0) / (e.total || 1)) * 100}%`, background: (e.available || 0) === 0 ? C.red : C.teal, height: "100%", borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{e.available}/{e.total} 대여가능</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
