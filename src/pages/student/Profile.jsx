import { C } from "../../theme";
import { Card, Avatar, PageTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";

export default function Profile() {
  const { profile, logout } = useAuth();
  const { data: rentals } = useCollection("rentals", "rentDate");

  const mine   = rentals.filter(r => r.studentId === profile?.studentId);
  const active = mine.filter(r => r.status === "대여중" || r.status === "연체").length;

  if (!profile) return null;

  return (
    <div style={{ maxWidth: 500 }}>
      <PageTitle>👤 내 정보</PageTitle>

      <Card style={{ textAlign: "center", padding: "32px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Avatar name={profile.name || "?"} size={72} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>{profile.name}</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{profile.dept}</div>
        <div style={{ display: "inline-block", background: C.blueLight, color: C.blue, borderRadius: 8, padding: "4px 16px", fontSize: 13, fontWeight: 700, marginTop: 10, fontFamily: "monospace" }}>
          {profile.studentId}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 14 }}>계정 정보</div>
        {[
          ["학년", `${profile.year}학년`],
          ["연락처", profile.phone || "-"],
          ["이메일", profile.email || "-"],
          ["누적 대여", `${profile.rentals || 0}회`],
          ["현재 대여중", `${active}개`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 14, color: C.muted }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{v}</span>
          </div>
        ))}
      </Card>

      <button onClick={logout} style={{ width: "100%", background: C.redLight, color: C.red, border: `1.5px solid ${C.red}30`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        로그아웃
      </button>
    </div>
  );
}
