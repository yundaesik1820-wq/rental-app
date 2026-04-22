import { C, NOTICE_CAT } from "../../theme";
import { Card, Badge, SectionTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";

export default function StudentHome() {
  const { profile } = useAuth();
  const { data: allRequests } = useCollection("rentalRequests", "createdAt");
  const { data: notices }     = useCollection("notices", "createdAt");

  const myId = profile?.studentId || profile?.email || "";

  // 현재 대여중 / 연체
  const myRentals = allRequests.filter(r =>
    (r.studentId === myId || r.studentId === profile?.uid) &&
    (r.status === "대여중" || r.status === "연체")
  );

  // 예약 현황 (승인대기 + 승인됨)
  const myRes = allRequests.filter(r =>
    (r.studentId === myId || r.studentId === profile?.uid) &&
    (r.status === "승인대기" || r.status === "승인됨")
  );

  const pinned = notices.filter(n => n.pinned).slice(0, 3);
  const recentNotices = pinned.length > 0
    ? pinned
    : [...notices].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).slice(0, 3);

  // 장비명 표시 헬퍼
  const getEquipLabel = (r) => {
    if (!r.items || r.items.length === 0) return r.equipName || "-";
    const names = r.items.map(i => i.modelName || i.equipName || "").filter(Boolean);
    return names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : names[0] || "-";
  };

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ background: `linear-gradient(135deg,#2D4A9B,${C.teal})`, borderRadius: 20, padding: "28px 28px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
          {profile?.role === "professor" ? "교수" : `${profile?.dept} · ${profile?.studentId ? profile.studentId.slice(0,2)+"학번" : ""}`}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>
          {profile?.role === "professor"
            ? `${profile?.name} 교수님 안녕하세요 👋`
            : `안녕하세요, ${profile?.name}님 👋`}
        </div>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{getEquipLabel(r)}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>반납예정: {r.endDate}</div>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{getEquipLabel(r)}</div>
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
          {recentNotices.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>공지사항이 없습니다</div>}
          {recentNotices.map(n => {
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
