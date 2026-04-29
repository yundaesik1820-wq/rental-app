import { C, sc, sb } from "../theme";

export function Badge({ label }) {
  return (
    <span style={{ background: sb(label), color: sc(label), border: `1px solid ${sc(label)}25`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.card, borderRadius: 16, padding: "16px 20px", marginBottom: 12, border: `1px solid ${C.border}`, boxShadow: C.shadow, cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.2s", ...style }}>
      {children}
    </div>
  );
}

export function Inp({ label, placeholder, value, onChange, type = "text", style = {} }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 5 }}>{label}</div>}
      <input
        type={type} placeholder={placeholder} value={value} onChange={onChange}
        style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", transition: "border-color 0.2s", ...style }}
        onFocus={e => e.target.style.borderColor = C.blue}
        onBlur={e => e.target.style.borderColor = C.border}
      />
    </div>
  );
}

export function Btn({ children, onClick, color = C.blue, text = "#1E293B", small, full, outline, disabled, type = "button" }) {
  return (
    <button onClick={onClick} disabled={disabled} type={type} style={{
      background: outline ? "transparent" : disabled ? C.muted : color,
      color: outline ? color : text,
      border: `1.5px solid ${disabled ? C.muted : color}`,
      borderRadius: small ? 8 : 10,
      padding: small ? "5px 12px" : full ? "12px" : "9px 20px",
      fontSize: small ? 12 : 14, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit", width: full ? "100%" : undefined,
      transition: "opacity 0.15s",
      opacity: disabled ? 0.6 : 1,
    }}>{children}</button>
  );
}

export function Avatar({ name, size = 40 }) {
  const colors = [C.blue, C.teal, C.purple, C.red, C.orange];
  const col = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${col},${col}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 800, color: "#1E293B", flexShrink: 0 }}>
      {name[0]}
    </div>
  );
}

export function PageTitle({ children }) {
  return <div style={{ fontSize: 22, fontWeight: 900, color: C.navy, marginBottom: 20 }}>{children}</div>;
}

export function SectionTitle({ children }) {
  return <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, margin: "20px 0 12px" }}>{children}</div>;
}

export function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

export function Modal({ children, onClose, width = 420 }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: width, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

export function StatBox({ icon, label, value, color, bg }) {
  const Icon = icon;
  return (
    <div style={{ background: bg || C.blueLight, borderRadius: 16, padding: "20px", border: `1px solid ${color}20`, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 28, display: "flex", alignItems: "center" }}>
        {typeof icon === "string" ? icon : <Icon size={28} color={color} />}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: color || C.blue, marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function Select({ label, value, onChange, children, style = {} }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 5 }}>{label}</div>}
      <select value={value} onChange={onChange} style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", ...style }}>
        {children}
      </select>
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 48, height: 48, border: `4px solid ${C.border}`, borderTop: `4px solid ${C.blue}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 14, color: C.muted }}>로딩 중...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
