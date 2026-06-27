import { useState } from "react";
import { C } from "../../theme";
import { Empty } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";

// 버튼 스타일 (목업과 동일: 높이 고정)
const btnStyle = (bg, color) => ({
  flex: 1, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 12.5, fontWeight: 700, lineHeight: 1, borderRadius: 9, border: "none",
  cursor: "pointer", background: bg, color, boxSizing: "border-box",
});
const sheetBtnStyle = (bg, color) => ({
  width: "100%", fontSize: 14, fontWeight: 700, padding: 11, borderRadius: 11, border: "none",
  cursor: "pointer", marginBottom: 8, background: bg, color,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
});

export default function ExternalRentalView() {
  const { data: shops, loading } = useCollection("externalRentals", "createdAt");
  const [navShop, setNavShop] = useState(null); // 길찾기 시트 대상 업체

  const callPhone = (phone) => { if (phone) window.location.href = `tel:${phone}`; };
  const openWeb = (url) => {
    if (!url) return;
    const full = url.startsWith("http") ? url : `https://${url}`;
    window.open(full, "_blank");
  };
  const goMap = (app) => {
    if (!navShop) return;
    const q = encodeURIComponent(`${navShop.name} ${navShop.address || ""}`.trim());
    const url = app === "kakao"
      ? `https://map.kakao.com/?q=${q}`
      : `https://map.naver.com/p/search/${q}`;
    window.open(url, "_blank");
    setNavShop(null);
  };

  if (loading) return <Empty icon="⏳" text="불러오는 중..." />;
  if (shops.length === 0) return <Empty icon="🏬" text="등록된 외부 렌탈샵이 없어요" />;

  return (
    <div>
      {shops.map((s) => (
        <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
          {s.photo ? (
            <img src={s.photo} alt={s.name} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 90, background: `linear-gradient(135deg,${C.surface},${C.border})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: C.muted }}>🏢</div>
          )}
          <div style={{ padding: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.name}</div>
              {s.region && (
                <span style={{ fontSize: 10, fontWeight: 700, color: C.teal, background: C.tealLight, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{s.region}</span>
              )}
            </div>
            {s.desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 1.45 }}>{s.desc}</div>}
            {s.address && <div style={{ fontSize: 12.5, color: C.text, marginTop: 6 }}>📍 {s.address}</div>}
            {s.phone && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>📞 {s.phone}</div>}
            {s.hours && <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>🕒 {s.hours}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
              {s.phone && <button onClick={() => callPhone(s.phone)} style={btnStyle(C.navy, "#fff")}>전화</button>}
              {s.website && <button onClick={() => openWeb(s.website)} style={btnStyle(C.teal, "#fff")}>홈페이지</button>}
              <button onClick={() => setNavShop(s)} style={btnStyle(C.border, C.text)}>길찾기</button>
            </div>
          </div>
        </div>
      ))}

      {/* 길찾기 앱 선택 시트 */}
      {navShop && (
        <div onClick={() => setNavShop(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.surface, borderRadius: "20px 20px 0 0", padding: "18px 16px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 14 }}>길찾기 앱 선택</div>
            <button onClick={() => goMap("kakao")} style={sheetBtnStyle("#FEE500", "#191600")}>🗺️ 카카오맵</button>
            <button onClick={() => goMap("naver")} style={sheetBtnStyle("#03C75A", "#fff")}>🗺️ 네이버지도</button>
            <button onClick={() => setNavShop(null)} style={sheetBtnStyle(C.border, C.muted)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
