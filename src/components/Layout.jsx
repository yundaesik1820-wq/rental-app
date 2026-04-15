import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { C } from "../theme";

const ADMIN_NAV = [
  { id: "home",      icon: "🏠", label: "대시보드" },
  { id: "equip",     icon: "🔧", label: "장비 관리" },
  { id: "rental",    icon: "📋", label: "대여/반납"  },
  { id: "students",  icon: "👥", label: "학생 관리" },
  { id: "calendar",  icon: "📅", label: "캘린더"    },
  { id: "stats",     icon: "📊", label: "통계"      },
  { id: "notices",   icon: "📢", label: "공지사항"  },
  { id: "settings",  icon: "⚙️", label: "설정"      },
];

const STU_NAV = [
  { id: "home",     icon: "🏠", label: "홈"       },
  { id: "equip",    icon: "🔍", label: "장비 목록" },
  { id: "history",  icon: "📖", label: "대여 이력" },
  { id: "reserve",  icon: "📅", label: "예약 신청" },
  { id: "calendar", icon: "🗓️", label: "캘린더"   },
  { id: "notices",  icon: "📢", label: "공지사항" },
  { id: "profile",  icon: "👤", label: "내 정보"  },
];

export default function Layout({ tab, setTab, children, notifCount, onNotif }) {
  const { profile, logout } = useAuth();
  const [sideOpen, setSideOpen] = useState(true);
  const nav = profile?.role === "admin" ? ADMIN_NAV : STU_NAV;

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
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>장비대여실</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>미디어센터</div>
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
                  <div style={{ fontSize: 10, color: C.muted }}>{profile.role === "admin" ? "관리자" : `${profile.dept} ${profile.year}학년`}</div>
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

      {/* ── Bottom Nav (mobile only) ── */}
      <style>{`
        @media (max-width: 768px) {
          aside { display: none !important; }
          .mobile-nav { display: flex !important; }
          main { padding: 16px !important; padding-bottom: 80px !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>
      <div className="mobile-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: C.surface, borderTop: `1px solid ${C.border}`,
        padding: "8px 0 16px", zIndex: 100, display: "none",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
      }}>
        {nav.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: tab === n.id ? C.blueLight : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{n.icon}</div>
            <span style={{ fontSize: 9, fontWeight: tab === n.id ? 800 : 500, color: tab === n.id ? C.blue : C.muted }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
