import { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { C } from "../theme";

const ADMIN_NAV = [
  { id: "home",      icon: "🏠", label: "대시보드" },
  { id: "equip",     icon: "🔧", label: "장비 관리" },
  { id: "rental",    icon: "📋", label: "대여/반납"  },
  { id: "students",  icon: "👥", label: "학생 관리" },
  { id: "calendar",  icon: "📅", label: "캘린더"    },
  { id: "stats",     icon: "📊", label: "통계"      },
  { id: "notices",   icon: "📢", label: "공지사항"  },
  { id: "qrscan",    icon: "📷", label: "QR스캔"   },
  { id: "inquiry",   icon: "💬", label: "문의관리"  },
  { id: "settings",  icon: "⚙️", label: "설정"      },
];

const STU_NAV = [
  { id: "home",     icon: "🏠", label: "홈"       },
  { id: "equip",    icon: "🔍", label: "장비 목록" },
  { id: "history",  icon: "📖", label: "대여 이력" },
  { id: "reserve",  icon: "📅", label: "예약 신청" },
  { id: "calendar", icon: "🗓️", label: "캘린더"   },
  { id: "notices",  icon: "📢", label: "공지사항" },
  { id: "inquiry",  icon: "💬", label: "문의"     },
  { id: "profile",  icon: "👤", label: "내 정보"  },
];

// 모바일에서 보여줄 탭
const ADMIN_MOBILE_NAV = [
  { id: "home",      icon: "🏠", label: "대시보드" },
  { id: "equip",     icon: "🔧", label: "장비"     },
  { id: "rental",    icon: "📋", label: "대여"     },
  { id: "students",  icon: "👥", label: "학생"     },
  { id: "calendar",  icon: "📅", label: "캘린더"   },
  { id: "stats",     icon: "📊", label: "통계"     },
  { id: "notices",   icon: "📢", label: "공지"     },
  { id: "qrscan",    icon: "📷", label: "QR"       },
  { id: "inquiry",   icon: "💬", label: "문의"     },
  { id: "settings",  icon: "⚙️", label: "설정"     },
];

export default function Layout({ tab, setTab, children, notifCount, onNotif }) {
  const { profile, logout } = useAuth();
  const [sideOpen, setSideOpen] = useState(true);
  const nav = profile?.role === "admin" ? ADMIN_NAV : STU_NAV;
  const mobileNav = profile?.role === "admin" ? ADMIN_MOBILE_NAV : STU_NAV;

  // 2줄 그리드: 절반씩 나눔
  const half = Math.ceil(mobileNav.length / 2);
  const row1 = mobileNav.slice(0, half);
  const row2 = mobileNav.slice(half);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ── Sidebar (desktop) ── */}
      <aside style={{
        width: sideOpen ? 240 : 68, flexShrink: 0,
        background: C.navy, display: "flex", flexDirection: "column",
        transition: "width 0.25s", overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎓</div>
          {sideOpen && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>한국방송예술진흥원</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>장비대여실</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {nav.map(n => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", padding: "10px 12px", borderRadius: 10,
                background: active ? "rgba(255,255,255,0.15)" : "transparent",
                border: "none", cursor: "pointer", marginBottom: 2,
                transition: "background 0.15s",
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{n.icon}</span>
                {sideOpen && <span style={{ fontSize: 14, fontWeight: active ? 700 : 500, color: active ? "#fff" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>{n.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User + Collapse */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {sideOpen && profile && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {profile.name?.[0] || "U"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{profile.role === "admin" ? "관리자" : profile.studentId}</div>
              </div>
            </div>
          )}
          <button onClick={() => setSideOpen(v => !v)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14 }}>
            {sideOpen ? "◀ 접기" : "▶"}
          </button>
          <button onClick={logout} style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, marginTop: 4 }}>
            {sideOpen ? "로그아웃" : "↩"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>
            {nav.find(n => n.id === tab)?.icon} {nav.find(n => n.id === tab)?.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onNotif} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", fontSize: 22 }}>
              🔔
              {notifCount > 0 && (
                <span style={{ position: "absolute", top: -2, right: -4, background: C.red, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifCount}</span>
              )}
            </button>
            {profile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: C.blue }}>
                  {profile.name?.[0] || "U"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{profile.name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{profile.role === "admin" ? "관리자" : `${profile.dept} · ${profile.studentId ? profile.studentId.slice(0,2)+"학번" : ""}`}</div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          {children}
        </main>
      </div>

      {/* ── Bottom Nav (mobile 2줄 그리드) ── */}
      <style>{`
        @media (max-width: 768px) {
          aside { display: none !important; }
          .mobile-nav { display: block !important; }
          .mobile-topbar-logout { display: flex !important; }
          main { padding: 16px !important; padding-bottom: 110px !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
          .mobile-topbar-logout { display: none !important; }
        }
      `}</style>

      {/* 모바일 탑바 로그아웃 버튼 */}
      <button className="mobile-topbar-logout" onClick={logout}
        style={{ display:"none", position:"fixed", top:12, right:12, zIndex:200, background:C.red, color:"#fff", border:"none", borderRadius:10, padding:"7px 14px", fontSize:13, fontWeight:700, cursor:"pointer", alignItems:"center", gap:6, boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
        🚪 로그아웃
      </button>

      {/* 모바일 하단 2줄 네비게이션 */}
      <div className="mobile-nav" style={{
        display: "none",
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
      }}>
        {[row1, row2].map((row, rowIdx) => (
          <div key={rowIdx} style={{
            display: "grid",
            gridTemplateColumns: `repeat(${row.length}, 1fr)`,
            borderTop: rowIdx === 1 ? `1px solid ${C.border}` : "none",
          }}>
            {row.map(n => {
              const active = tab === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  style={{
                    background: active ? C.blueLight : "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "7px 2px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: active ? 800 : 500,
                    color: active ? C.blue : C.muted,
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.3px",
                  }}>{n.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
