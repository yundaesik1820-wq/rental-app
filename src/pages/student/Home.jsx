import { C, NOTICE_CAT } from "../../theme";
import { Card, Badge, SectionTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";

export default function StudentHome() {
  const { profile } = useAuth();
  const { data: rentals }      = useCollection("rentals", "rentDate");
  const { data: reservations } = useCollection("reservations", "startDate");
  const { data: notices }      = useCollection("notices", "createdAt");

  const myRentals = rentals.filter(r => r.studentId === profile?.studentId && (r.status === "대여중" || r.status === "연체"));
  const myRes     = reservations.filter(r => r.studentId === profile?.studentId);
  const pinned    = notices.filter(n => n.pinned).slice(0, 3);

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ background: `linear-gradient(135deg,#2D4A9B,${C.teal})`, borderRadius: 20, padding: "28px 28px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>{profile?.dept} · {profile?.year}학년</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>안녕하세요, {profile?.name}님 👋</div>
        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          {[["현재 대여중", myRentals.length, "#93C5FD"], ["예약 현황", myRes.length, "#6EE7B7"]].map(([l, v, col]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: col }}>{v}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Current rentals */}
        <div>
          <SectionTitle>📋 현재 대여 중</SectionTitle>
          {myRentals.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>대여 중인 장비가 없습니다</div>}
          {myRentals.map(r => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.equipName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>반납예정: {r.dueDate}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>목적: {r.purpose}</div>
                </div>
                <Badge label={r.status} />
              </div>
            </Card>
          ))}

          <SectionTitle>📅 예약 현황</SectionTitle>
          {myRes.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>예약 내역이 없습니다</div>}
          {myRes.slice(0, 3).map(r => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.equipName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{r.startDate} ~ {r.endDate}</div>
                </div>
                <Badge label={r.status} />
              </div>
            </Card>
          ))}
        </div>

        {/* Pinned notices */}
        <div>
          <SectionTitle>📌 공지사항</SectionTitle>
          {pinned.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>공지사항이 없습니다</div>}
          {pinned.map(n => {
            const cat = NOTICE_CAT[n.category] || { bg: C.bg, col: C.muted };
            return (
              <Card key={n.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n.category}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{n.date}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
