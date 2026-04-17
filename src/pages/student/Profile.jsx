import { C } from "../../theme";
import { Card, Avatar, PageTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";

export default function Profile() {
  const { profile, logout } = useAuth();
  const { data: rentals } = useCollection("rentals", "rentDate");

  const mine   = rentals.filter(r => r.studentId === profile?.studentId);
  const active = mine.filter(r => r.status === "대여중" || r.status === "연체").length;

  if (!profile) return null;

  // 학번 앞 2자리 추출
  const admYear = profile.studentId ? `${profile.studentId.slice(0, 2)}학번` : "-";

  const licenseColor = () => {
    if (!profile.license || profile.license === "없음") return { bg: C.bg, col: C.muted };
    if (profile.license === "1단계") return { bg: C.blueLight,   col: C.blue   };
    if (profile.license === "2단계") return { bg: C.tealLight,   col: C.teal   };
    if (profile.license === "3단계") return { bg: C.purpleLight, col: C.purple };
    return { bg: C.bg, col: C.muted };
  };
  const lc = licenseColor();

  return (
    <div style={{ maxWidth: 500 }}>
      <PageTitle>👤 내 정보</PageTitle>

      {/* 프로필 카드 */}
      <Card style={{ textAlign: "center", padding: "32px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Avatar name={profile.name || "?"} size={72} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>{profile.name}</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{profile.dept}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ background: C.blueLight, color: C.blue, borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
            {profile.studentId}
          </div>
          <div style={{ background: C.bg, color: C.muted, borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 600 }}>
            {admYear}
          </div>
        </div>
      </Card>

      {/* 라이센스 카드 */}
      <Card style={{ marginBottom: 16, border: `2px solid ${lc.col}30` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>🎖️ 장비 사용 라이센스</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: lc.bg, color: lc.col, borderRadius: 8, padding: "6px 16px", fontSize: 16, fontWeight: 800 }}>
                {profile.license || "없음"}
              </span>
              {(!profile.license || profile.license === "없음") && (
                <span style={{ fontSize: 12, color: C.muted }}>관리자 승인 후 등록됩니다</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 계정 정보 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 14 }}>계정 정보</div>
        {[
          ["학번",       profile.studentId || "-"],
          ["입학년도",   admYear],
          ["계열",       profile.dept || "-"],
          ["연락처",     profile.phone || "-"],
          ["이메일",     profile.email || "-"],
          ["누적 대여",  `${profile.rentals || 0}회`],
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
