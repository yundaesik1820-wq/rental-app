import { useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../hooks/useAuth.jsx";
import { C } from "../theme";
import {
  Home, Wrench, ClipboardList, Users, Calendar, BarChart2,
  Megaphone, MessageCircle, Settings, Search,
  BookOpen, CalendarCheck, UserCircle, Bell, LogOut,
  ChevronLeft, ChevronRight, GraduationCap, MessageSquare, Share2, MoreHorizontal, Store, ShoppingCart
} from "lucide-react";

const ADMIN_NAV = [
  { id: "home",     icon: Home,          label: "대시보드" },
  { id: "equip",    icon: Wrench,        label: "장비 관리" },
  { id: "rental",   icon: ClipboardList, label: "대여/반납" },
  { id: "students", icon: Users,         label: "학생 관리" },
  { id: "calendar", icon: Calendar,      label: "캘린더/통계" },
  { id: "notices",  icon: Megaphone,     label: "공지사항"  },
  { id: "inquiry",  icon: MessageCircle, label: "문의 관리" },
  { id: "license",  icon: GraduationCap, label: "라이선스"  },
  { id: "community", icon: MessageSquare, label: "에브리타임"   },
  { id: "sns",      icon: Share2,        label: "SNS 관리"  },
  { id: "external", icon: Store,         label: "외부 렌탈샵" },
  { id: "settings", icon: Settings,      label: "설정"      },
];

const STU_NAV = [
  { id: "home",      icon: Home,          label: "홈"       },
  { id: "equip",     icon: Store,         label: "장비 예약" },
  { id: "reserve",   icon: CalendarCheck, label: "예약 신청" },
  { id: "license",   icon: GraduationCap, label: "라이선스" },
  { id: "notices",   icon: Megaphone,     label: "공지사항" },
  { id: "community", icon: MessageSquare, label: "에브리타임"  },
  { id: "calendar",  icon: ShoppingCart,  label: "예약내역" },
  { id: "mypage",    icon: UserCircle,    label: "내 정보" },
];

export default function Layout({ tab, setTab, children, notifCount, onNotif, onSameTab }) {
  const { profile, logout } = useAuth();


  const [sideOpen, setSideOpen] = useState(true);
  const [showSearch, setShowSearch] = useState(false); // 헤더 검색(커뮤니티와 동일 — 현재 준비중 껍데기)
  const mainRef = useRef(null); // 같은 탭 재탭 시 맨 위로 스크롤

  const adminRole = profile?.adminRole || "super";
  const isSuper   = profile?.role === "admin"; // 모든 관리자 슈퍼와 동일
  const roleLabel = profile?.role === "admin"
    ? (adminRole === "teacher" ? "교사" : adminRole === "assistant" ? "조교" : adminRole === "professor" ? "교수" : "관리자")
    : null;

  // 일반 직원(교사/조교)은 대여/반납 숨김
  // 일반관리자: 대여/반납 탭 보이되 제한된 뷰 (대여중~반납완료만)
  // 교사·교수는 에브리타임 숨김 (조교는 보임)
  // 에브리타임: 영상계열 학생만 접근, 교수도 숨김
  const hideEverytime = profile?.role === "professor" ||
    (profile?.role === "student" && (profile?.dept||"") !== "영상계열");
  const isTeacherOrProf = profile?.role === "admin" &&
    (profile?.adminRole === "teacher" || profile?.adminRole === "professor");

  const nav = profile?.role === "admin"
    ? (isTeacherOrProf
        ? ADMIN_NAV.filter(n => n.id !== "community")
        : ADMIN_NAV)
    : (hideEverytime ? STU_NAV.filter(n => n.id !== "community") : STU_NAV);

  // 모바일 하단 탭바: 학생은 핵심 5개 한 줄, 관리자는 기존 2줄 유지
  const NAV_ACCENT = C.navy; // 네온 라임 포인트
  const NAV_SHORT = { home: "홈", equip: "장비예약", reserve: "예약", calendar: "예약내역", community: "커뮤니티", mypage: "더보기" };
  // 예약 신청은 하단 탭에서 뺌 — 장비 목록에서 담고 장바구니 바로 진입 (tab "reserve" 자체는 유효)
  // calendar = 대여이력/예약내역 화면
  const MOBILE_STU_IDS = ["home", "calendar", "equip", "community", "mypage"];
  const isStudentNav = profile?.role !== "admin";
  const stuTabs = MOBILE_STU_IDS
    .map(id => {
      const it = nav.find(n => n.id === id);
      if (!it) return null;
      const o = { ...it, label: NAV_SHORT[id] || it.label };
      if (id === "mypage") o.icon = MoreHorizontal; // 카톡식 더보기
      return o;
    })
    .filter(Boolean);
  // 관리자 모바일 하단: 그룹 탭 6개
  const ADMIN_MOBILE_TABS = [
    { id: "home",      icon: Home,           label: "홈" },
    { id: "rental",    icon: ClipboardList,  label: "대여" },
    { id: "g_equip",   icon: Wrench,         label: "장비" },
    { id: "g_student", icon: Users,          label: "학생" },
    { id: "g_sns",     icon: Share2,         label: "SNS" },
    { id: "g_more",    icon: MoreHorizontal, label: "더보기" },
  ];
  // 그룹 탭 활성 판정 (그룹에 속한 기능 화면이면 해당 그룹 탭 활성)
  const GROUP_MEMBERS = {
    g_equip:   ["g_equip", "equip", "external"],
    g_student: ["g_student", "students", "license"],
    g_sns:     ["g_sns", "sns", "community"],
    g_more:    ["g_more", "calendar", "stats", "notices", "inquiry", "settings"],
  };
  const mobileRows = isStudentNav ? [stuTabs] : [ADMIN_MOBILE_TABS];

  const currentNav = nav.find(n => n.id === tab);

  return (
    <div className="kbas-root" style={{ display: "flex", height: "100%", background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>

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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        {/* Top bar — 커뮤니티 헤더와 동일 스타일 (띠 없음, 큰 볼드 제목, 검색+알림) */}
        <header style={{ background: C.bg, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentNav?.label}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, paddingRight: "env(safe-area-inset-right, 0px)" }}>
            <button onClick={() => setShowSearch(true)} className="tap-spring" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", color: C.text }}>
              <Search size={20} strokeWidth={2} />
            </button>
            <button onClick={onNotif} className="tap-spring" style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: C.text }}>
              <Bell size={20} strokeWidth={2} />
              {notifCount > 0 && (
                <span style={{ position: "absolute", top: -5, right: -6, background: C.red, color: "#fff", borderRadius: "50%", width: 17, height: 17, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifCount}</span>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <main ref={mainRef} style={{ flex: 1, padding: "24px", overflowY: "auto", minHeight: 0 }}>
          {children}
        </main>
      </div>

      {/* ── 모바일 2줄 하단 네비 ── */}
      <style>{`
        @media (max-width: 768px) {
          /* 노치/상태바 아래로 내림 — 최소 24px 바닥값은 네이티브 앱에서만 (웹/PWA는 상단 틈 없이 딱 붙게) */
          .kbas-root { padding-top: max(env(safe-area-inset-top, 0px), ${Capacitor.isNativePlatform() ? 24 : 0}px) !important; }
          aside { display: none !important; }
          .mobile-nav { display: block !important; }

          main { padding: 12px !important; padding-bottom: 70px !important; }

          /* 헤더 (커뮤니티와 동일 — 띠 없이 볼드 제목) */
          header { padding: 12px 16px !important; }

          /* 카드 패딩 축소 */
          [class*="card"], [data-card] { padding: 12px !important; }

          /* 2열 그리드 → 1열 */
          [style*="grid-template-columns: 1fr 1fr"],
          [style*="gridTemplateColumns: \"1fr 1fr\""],
          [style*="gridTemplateColumns:'1fr 1fr'"] {
            grid-template-columns: 1fr !important;
          }

          /* 3열 이상 그리드 → 2열 (하단 탭 제외) */
          :not(.bottom-nav-row)[style*="repeat(3"],
          :not(.bottom-nav-row)[style*="repeat(auto-fill"] {
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
          [style*="linear-gradient"]:not([data-cinema]) { border-radius: 14px !important; padding: 18px 16px !important; }

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
          /* 데스크톱/전체화면에서도 사이드바 대신 하단 네비 사용 */
          aside { display: none !important; }
          .mobile-nav { display: block !important; }
          main { padding-bottom: 70px !important; }
        }
      `}</style>



      {/* 모바일 하단 2줄 네비 */}
      <div className="mobile-nav" style={{
        display: "none",
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        zIndex: 100,
        paddingBottom: 8,
      }}>
        {mobileRows.map((row, rowIdx) => (
          <div key={rowIdx} className="bottom-nav-row" style={{
            display: "grid",
            gridTemplateColumns: `repeat(${row.length}, 1fr)`,
            borderTop: rowIdx === 1 ? `1px solid ${C.border}` : "none",
          }}>
            {row.map(n => {
              const active = GROUP_MEMBERS[n.id] ? GROUP_MEMBERS[n.id].includes(tab) : tab === n.id;
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    // 같은 탭을 다시 누르면 맨 위로 + 내부 state를 쓰는 화면은 첫 화면으로.
                    // (그룹탭은 하위 화면 → 허브 복귀가 먼저라 active가 아닌 tab === n.id 로 판정)
                    if (tab === n.id) {
                      onSameTab?.(n.id);
                      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    } else setTab(n.id);
                  }}
                  style={{
                    background: "transparent",
                    border: "none", cursor: "pointer",
                    padding: "9px 2px 5px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 4,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <Icon
                    size={23}
                    color={active ? NAV_ACCENT : C.muted}
                    strokeWidth={active ? 2.4 : 1.9}
                    style={{
                      transform: active ? "translateY(-2px)" : "translateY(0)",
                      transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
                    }}
                  />
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    color: active ? NAV_ACCENT : C.muted,
                    whiteSpace: "nowrap", letterSpacing: "-0.3px",
                    transition: "color 0.2s ease",
                  }}>{n.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 🔍 통합 검색 (준비중 껍데기 — 커뮤니티 헤더와 동일) */}
      {showSearch && (
        <div onClick={() => setShowSearch(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 320, textAlign: "center" }}>
            <Search size={40} color={C.muted} strokeWidth={2} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>통합 검색 준비 중</div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
              곧 검색 기능을 추가할 예정이에요.
            </div>
            <button onClick={() => setShowSearch(false)}
              style={{ width: "100%", padding: "11px", minHeight: 44, background: C.navy, color: C.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              확인
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
