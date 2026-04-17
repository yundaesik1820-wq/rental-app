import { C } from "../../theme";
import { Card, Badge, Empty, PageTitle, StatBox } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";

const STATUS_ICON = { 승인대기: "⏳", 승인됨: "✅", 보류: "⏸️", 거절됨: "❌", 반납완료: "📦" };

export default function History() {
  const { profile } = useAuth();
  const { data: requests } = useCollection("rentalRequests", "createdAt");

  const mine = requests.filter(r => r.studentId === profile?.studentId)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const total    = mine.length;
  const active   = mine.filter(r => r.status === "승인됨").length;
  const pending  = mine.filter(r => r.status === "승인대기").length;
  const returned = mine.filter(r => r.status === "반납완료").length;

  return (
    <div>
      <PageTitle>📖 내 대여 이력</PageTitle>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox icon="📊" label="전체 신청"  value={total}    color={C.blue}   bg={C.blueLight}  />
        <StatBox icon="⏳" label="승인 대기"  value={pending}  color={C.yellow} bg={C.yellowLight} />
        <StatBox icon="✅" label="승인됨"     value={active}   color={C.teal}   bg={C.tealLight}  />
        <StatBox icon="📦" label="반납 완료"  value={returned} color={C.green}  bg={C.greenLight} />
      </div>

      {mine.length === 0 && <Empty icon="📭" text="대여 신청 이력이 없습니다" />}

      {mine.map(r => (
        <Card key={r.id} style={{
          border: `2px solid ${
            r.status === "보류"   ? C.yellow + "60" :
            r.status === "거절됨" ? C.red    + "40" :
            r.status === "승인됨" ? C.teal   + "40" : C.border
          }`
        }}>
          {/* 헤더 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                {r.startDate} ~ {r.endDate}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>
                목적: {r.purpose}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{STATUS_ICON[r.status] || ""}</span>
              <Badge label={r.status} />
            </div>
          </div>

          {/* 장비 목록 */}
          <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: r.reason ? 12 : 0 }}>
            {r.items?.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < r.items.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{item.img}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{item.equipName}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{item.quantity}개</span>
              </div>
            ))}
          </div>

          {/* 보류/거절 사유 */}
          {r.reason && (
            <div style={{
              background: r.status === "보류" ? C.yellowLight : C.redLight,
              borderRadius: 10, padding: "10px 14px",
              borderLeft: `4px solid ${r.status === "보류" ? C.yellow : C.red}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: r.status === "보류" ? "#92400E" : C.red, marginBottom: 4 }}>
                {r.status === "보류" ? "⏸️ 보류 사유" : "❌ 거절 사유"}
              </div>
              <div style={{ fontSize: 13, color: C.text }}>{r.reason}</div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
