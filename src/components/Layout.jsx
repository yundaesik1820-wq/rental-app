import { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { C } from "../theme";
import {
  Home, Wrench, ClipboardList, Users, Calendar, BarChart2,
  Megaphone, Camera, MessageCircle, Settings, Search,
  BookOpen, CalendarCheck, UserCircle, Bell, LogOut,
  ChevronLeft, ChevronRight, GraduationCap
} from "lucide-react";

const ADMIN_NAV = [
  { id: "home",     icon: Home,          label: "대시보드" },
  { id: "equip",    icon: Wrench,        label: "장비 관리" },
  { id: "rental",   icon: ClipboardList, label: "대여/반납" },
  { id: "students", icon: Users,         label: "학생 관리" },
  { id: "calendar", icon: Calendar,      label: "캘린더"    },
  { id: "stats",    icon: BarChart2,     label: "통계"      },
  { id: "notices",  icon: Megaphone,     label: "공지사항"  },
  { id: "qrscan",   icon: Camera,        label: "QR 스캔"  },
  { id: "inquiry",  icon: MessageCircle, label: "문의 관리" },
  { id: "settings", icon: Settings,      label: "설정"      },
];

const STU_NAV = [
  { id: "home",     icon: Home,          label: "홈"       },
  { id: "equip",    icon: Search,        label: "장비 목록" },
  { id: "history",  icon: BookOpen,      label: "대여 이력" },
  { id: "reserve",  icon: CalendarCheck, label: "예약 신청" },
  { id: "calendar", icon: Calendar,      label: "캘린더"   },
  { id: "notices",  icon: Megaphone,     label: "공지사항" },
  { id: "inquiry",  icon: MessageCircle, label: "문의"     },
  { id: "profile",  icon: UserCircle,    label: "내 정보"  },
];

export default function Layout({ tab, setTab, children, notifCount, onNotif }) {
  const { profile, logout } = useAuth();
  const [sideOpen, setSideOpen] = useState(true);

  const adminRole = profile?.adminRole || "super";
  const isSuper   = profile?.role === "admin" && adminRole === "super";
  const roleLabel = profile?.role === "admin"
    ? (adminRole === "teacher" ? "교사" : adminRole === "assistant" ? "조교" : "관리자")
    : null;

  // 일반 직원(교사/조교)은 대여/반납 숨김
  const nav = profile?.role === "admin"
    ? (isSuper ? ADMIN_NAV : ADMIN_NAV.filter(n => n.id !== "rental"))
    : STU_NAV;

  // 모바일 하단 2줄 그리드
  const half = Math.ceil(nav.length / 2);
  const row1 = nav.slice(0, half);
  const row2 = nav.slice(half);

  const currentNav = nav.find(n => n.id === tab);

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
          <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <GraduationCap size={20} color="#fff" />
          </div>
          {sideOpen && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>한국방송예술진흥원</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>장비대여실</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {nav.map(n => {
            const active = tab === n.id;
            const Icon = n.icon;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", padding: "10px 12px", borderRadius: 10,
                background: active ? "rgba(255,255,255,0.15)" : "transparent",
                border: "none", cursor: "pointer", marginBottom: 2,
                transition: "background 0.15s",
              }}>
                <Icon size={20} color={active ? "#fff" : "rgba(255,255,255,0.55)"} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {sideOpen && (
                  <span style={{ fontSize: 14, fontWeight: active ? 700 : 400, color: active ? "#fff" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
                    {n.label}
                  </span>
                )}
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
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{profile.role === "admin" ? roleLabel : profile.studentId}</div>
              </div>
            </div>
          )}
          <button onClick={() => setSideOpen(v => !v)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: sideOpen ? "flex-start" : "center", gap: 8 }}>
            {sideOpen ? <><ChevronLeft size={16} /> 접기</> : <ChevronRight size={16} />}
          </button>
          <button onClick={logout} style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", justifyContent: sideOpen ? "flex-start" : "center", gap: 8 }}>
            <LogOut size={15} />
            {sideOpen && "로그아웃"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 800, color: C.navy }}>
            {currentNav && <currentNav.icon size={20} color={C.navy} strokeWidth={2.5} />}
            {currentNav?.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onNotif} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", color: C.muted }}>
              <Bell size={22} />
              {notifCount > 0 && (
                <span style={{ position: "absolute", top: 0, right: 0, background: C.red, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifCount}</span>
              )}
            </button>
            {profile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: C.blue }}>
                  {profile.name?.[0] || "U"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{profile.name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{profile.role === "admin" ? roleLabel : `${profile.dept} · ${profile.studentId ? profile.studentId.slice(0,2)+"학번" : ""}`}</div>
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

      {/* ── 모바일 2줄 하단 네비 ── */}
      <style>{`
        @media (max-width: 768px) {
          aside { display: none !important; }
          .mobile-nav { display: block !important; }
          .mobile-logout-btn { display: flex !important; }
          main { padding: 16px !important; padding-bottom: 120px !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
          .mobile-logout-btn { display: none !important; }
        }
      `}</style>

      {/* 모바일 로그아웃 버튼 */}
      <button className="mobile-logout-btn" onClick={logout}
        style={{ display: "none", position: "fixed", top: 12, right: 12, zIndex: 200, background: C.red, color: "#fff", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <LogOut size={14} /> 로그아웃
      </button>

      {/* 모바일 하단 2줄 네비 */}
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
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  style={{
                    background: active ? C.blueLight : "transparent",
                    border: "none", cursor: "pointer",
                    padding: "8px 2px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 3,
                    transition: "background 0.15s",
                  }}
                >
                  <Icon size={20} color={active ? C.blue : C.muted} strokeWidth={active ? 2.5 : 1.8} />
                  <span style={{
                    fontSize: 9, fontWeight: active ? 800 : 500,
                    color: active ? C.blue : C.muted,
                    whiteSpace: "nowrap", letterSpacing: "-0.3px",
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
