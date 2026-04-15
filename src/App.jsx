import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { Spinner } from "./components/UI";

// Admin pages
import Dashboard  from "./pages/admin/Dashboard";
import Equipment  from "./pages/admin/Equipment";
import Rental     from "./pages/admin/Rental";
import Students   from "./pages/admin/Students";
import CalendarPage from "./pages/admin/Calendar";
import Stats      from "./pages/admin/Stats";
import Notices    from "./pages/admin/Notices";
import Settings   from "./pages/admin/Settings";
import QRScan       from "./pages/admin/QRScan";
import AdminInquiry from "./pages/admin/Inquiry";

// Student pages
import StudentHome    from "./pages/student/Home";
import EquipList      from "./pages/student/EquipList";
import History        from "./pages/student/History";
import Reserve        from "./pages/student/Reserve";
import Profile         from "./pages/student/Profile";
import StudentInquiry from "./pages/student/Inquiry";

// Shared
import { useCollection } from "./hooks/useFirestore";

function NotifPanel({ onClose, isAdmin, rentals, reservations, extensions }) {
  const { C } = { C: { red: "#F05252", redLight: "#FEF2F2", yellow: "#F59E0B", yellowLight: "#FFFBEB", blue: "#3B6CF8", blueLight: "#EEF2FF", navy: "#1A2B6B", text: "#1E293B", muted: "#94A3B8", border: "#E2E8F0", surface: "#FFFFFF" } };
  const alerts = [
    ...(isAdmin ? rentals.filter(r => r.status === "연체").map(r => ({ type: "danger", icon: "⚠️", title: `연체: ${r.equipName}`, desc: `${r.studentName} · ${r.dueDate}` })) : []),
    ...(isAdmin ? reservations.filter(r => r.status === "승인대기").map(r => ({ type: "warning", icon: "📅", title: `예약 승인대기: ${r.equipName}`, desc: `${r.studentName}` })) : []),
    ...(isAdmin ? extensions.filter(e => e.status === "신청중").map(e => ({ type: "warning", icon: "🔄", title: `연장 신청: ${e.equipName}`, desc: `${e.studentName}` })) : []),
  ];
  const bg  = t => ({ danger: "#FEF2F2", warning: "#FFFBEB", info: "#EEF2FF" }[t]);
  const col = t => ({ danger: "#F05252", warning: "#F59E0B", info: "#3B6CF8" }[t]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 500 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 360, background: "#fff", boxShadow: "-10px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A2B6B" }}>🔔 알림</div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94A3B8" }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {alerts.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}><div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>새 알림 없음</div>}
          {alerts.map((a, i) => (
            <div key={i} style={{ background: bg(a.type), borderRadius: 12, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${col(a.type)}` }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [tab,       setTab]       = useState("home");
  const [showNotif, setShowNotif] = useState(false);

  const { data: rentals }      = useCollection("rentals", "rentDate");
  const { data: reservations } = useCollection("reservations", "startDate");
  const { data: extensions }   = useCollection("extensions", "createdAt");

  if (loading) return <Spinner />;
  if (!user || !profile) return <Login />;

  const isAdmin = profile.role === "admin";
  const notifCount = isAdmin
    ? rentals.filter(r => r.status === "연체").length
    + reservations.filter(r => r.status === "승인대기").length
    + extensions.filter(e => e.status === "신청중").length
    : 0;

  const renderPage = () => {
    if (isAdmin) {
      switch (tab) {
        case "home":     return <Dashboard />;
        case "equip":    return <Equipment />;
        case "rental":   return <Rental />;
        case "students": return <Students />;
        case "calendar": return <CalendarPage isAdmin={true} />;
        case "stats":    return <Stats />;
        case "notices":  return <Notices isAdmin={true} />;
        case "settings": return <Settings />;
        case "qrscan":   return <QRScan />;
        case "inquiry":  return <AdminInquiry />;
        default:         return <Dashboard />;
      }
    } else {
      switch (tab) {
        case "home":     return <StudentHome />;
        case "equip":    return <EquipList />;
        case "history":  return <History />;
        case "reserve":  return <Reserve />;
        case "calendar": return <CalendarPage isAdmin={false} userId={profile.studentId} />;
        case "notices":  return <Notices isAdmin={false} />;
        case "profile":  return <Profile />;
        case "inquiry":  return <StudentInquiry />;
        default:         return <StudentHome />;
      }
    }
  };

  return (
    <>
      <Layout tab={tab} setTab={setTab} notifCount={notifCount} onNotif={() => setShowNotif(true)}>
        {renderPage()}
      </Layout>
      {showNotif && (
        <NotifPanel
          onClose={() => setShowNotif(false)}
          isAdmin={isAdmin}
          rentals={rentals}
          reservations={reservations}
          extensions={extensions}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
