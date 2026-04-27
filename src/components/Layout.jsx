import { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { C } from "../theme";
import {
  Home, Wrench, ClipboardList, Users, Calendar, BarChart2,
  Megaphone, Camera, MessageCircle, Settings, Search,
  BookOpen, CalendarCheck, UserCircle, Bell, LogOut,
  ChevronLeft, ChevronRight, GraduationCap, MessageSquare
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
  { id: "license",  icon: GraduationCap, label: "라이센스"  },
  { id: "community", icon: MessageSquare, label: "에브리타임"   },
  { id: "settings", icon: Settings,      label: "설정"      },
];

const STU_NAV = [
  { id: "home",     icon: Home,          label: "홈"       },
  { id: "equip",    icon: Search,        label: "장비 목록" },
  { id: "history",  icon: BookOpen,      label: "대여 이력" },
  { id: "reserve",  icon: CalendarCheck, label: "예약 신청" },
  { id: "calendar", icon: Calendar,      label: "캘린더"   },
  { id: "notices",  icon: Megaphone,     label: "공지사항" },
  { id: "license",  icon: GraduationCap, label: "라이센스" },
  { id: "community", icon: MessageSquare, label: "에브리타임"  },
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
  // 일반관리자: 대여/반납 탭 보이되 제한된 뷰 (대여중~반납완료만)
  // 교사·교수는 에브리타임 숨김 (조교는 보임)
  const hideEverytime = 
    (profile?.role === "admin" && adminRole === "teacher") ||
    (profile?.role === "professor");
  const nav = profile?.role === "admin"
    ? (hideEverytime ? ADMIN_NAV.filter(n => n.id !== "community") : ADMIN_NAV)
    : (hideEverytime ? STU_NAV.filter(n => n.id !== "community") : STU_NAV);

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
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: "env(safe-area-inset-right, 0px)" }}>
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
          header { padding-right: 48px !important; }
          main { padding: 12px !important; padding-bottom: 130px !important; }

          /* 헤더 */
          header { padding: 0 12px !important; height: 52px !important; }
          header > div:last-child > div > div:last-child { display: none !important; }

          /* 카드 패딩 축소 */
          [class*="card"], [data-card] { padding: 12px !important; }

          /* 2열 그리드 → 1열 */
          [style*="grid-template-columns: 1fr 1fr"],
          [style*="gridTemplateColumns: \"1fr 1fr\""],
          [style*="gridTemplateColumns:'1fr 1fr'"] {
            grid-template-columns: 1fr !important;
          }

          /* 3열 이상 그리드 → 1열 또는 2열 */
          [style*="repeat(3"],
          [style*="repeat(4"],
          [style*="repeat(auto-fill"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          /* 폰트 크기 조정 */
          [style*="fontSize: 28"],
          [style*="fontSize: 32"],
          [style*="fontSize: 36"],
          [style*="fontSize: 40"],
          [style*="fontSize: 42"],
          [style*="fontSize: 48"] {
            font-size: 22px !important;
          }
          [style*="fontSize: 22"],
          [style*="fontSize: 24"] {
            font-size: 18px !important;
          }
          [style*="fontSize: 18"],
          [style*="fontSize: 20"] {
            font-size: 15px !important;
          }

          /* 버튼 최소 높이 */
          button { min-height: 36px; }

          /* 홈 배너 */
          [style*="linear-gradient"] { border-radius: 14px !important; padding: 18px 16px !important; }

          /* 입력창 */
          input, textarea, select { font-size: 16px !important; }

          /* 모달 */
          [style*="maxWidth: 560"],
          [style*="maxWidth: 600"],
          [style*="maxWidth: 640"],
          [style*="maxWidth: 700"],
          [style*="maxWidth: 800"] {
            max-width: calc(100vw - 24px) !important;
            margin: 0 12px !important;
          }

          /* 가로 스크롤 방지 */
          * { max-width: 100%; box-sizing: border-box; }
          body { overflow-x: hidden; }

          /* 탭 버튼 */
          [style*="padding: \"8px 28px\""],
          [style*="padding: \"8px 24px\""],
          [style*="padding: \"9px 0\""] {
            padding: 7px 10px !important;
            font-size: 12px !important;
          }

          /* flex 행 → 줄바꿈 */
          [style*="display: \"flex\""][style*="gap: 12"],
          [style*="display: \"flex\""][style*="gap: 16"],
          [style*="display: \"flex\""][style*="gap: 24"] {
            flex-wrap: wrap;
          }

          /* PageTitle */
          [style*="fontSize: 22"][style*="fontWeight: 900"] {
            font-size: 17px !important;
          }

          /* 카테고리 배지 작게 */
          [style*="borderRadius: 20"][style*="padding: \"8px 16px\""] {
            padding: 5px 10px !important;
            font-size: 12px !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
          .mobile-logout-btn { display: none !important; }
        }
      `}</style>

      {/* 모바일 로그아웃 버튼 - 헤더 우측에 고정 */}
      <button className="mobile-logout-btn" onClick={logout}
        style={{ display: "none", position: "fixed", top: 0, right: 0, zIndex: 200, background: "transparent", color: C.muted, border: "none", padding: "16px 14px", fontSize: 13, cursor: "pointer", alignItems: "center", gap: 4, height: 52 }}>
        <LogOut size={18} />
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
