import { C } from "../../theme";
import { Card, Badge, StatBox, SectionTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";

export default function Dashboard() {
  const { data: rentals }      = useCollection("rentals", "rentDate");
  const { data: equipments }   = useCollection("equipments", "createdAt");
  const { data: reservations } = useCollection("reservations", "startDate");
  const { data: extensions }   = useCollection("extensions", "createdAt");

  const renting  = rentals.filter(r => r.status === "대여중").length;
  const overdue  = rentals.filter(r => r.status === "연체").length;
  const avail    = equipments.reduce((a, e) => a + (e.available || 0), 0);
  const pending  = reservations.filter(r => r.status === "승인대기").length;
  const extWait  = extensions.filter(e => e.status === "신청중").length;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox icon="🔄" label="현재 대여중" value={renting} color={C.blue}   bg={C.blueLight}  />
        <StatBox icon="⚠️" label="연체"       value={overdue} color={C.red}    bg={C.redLight}   />
        <StatBox icon="✅" label="대여 가능"  value={avail}   color={C.green}  bg={C.greenLight} />
        <StatBox icon="📅" label="예약 대기"  value={pending} color={C.yellow} bg={C.yellowLight}/>
        <StatBox icon="🔄" label="연장 신청"  value={extWait} color={C.purple} bg={C.purpleLight}/>
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
          {rentals.filter(r => r.status !== "반납완료").slice(0, 5).map(r => (
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
