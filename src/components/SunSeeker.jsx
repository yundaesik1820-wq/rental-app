import { useState, useEffect, useRef, useMemo } from "react";

/**
 * 🌅 태양 위치 / 골든아워 (SunSeeker)
 *
 * - 위치: geolocation 자동 + 수동(위경도/도시 프리셋)
 * - 날짜 선택 (촬영 예정일 미리 확인)
 * - 시간 슬라이더 → 태양 방위각/고도, 골든·블루아워 판별
 * - 나침반 시각화 + 디바이스 나침반 연동(실제 방향)
 * - 태양 경로 호(arc) 시각화
 * - 그림자 길이/방향
 *
 * 태양 계산: SunCalc 알고리즘(MIT) 내장 — 외부 의존성 없음
 */

const FONT_MONO   = "'Courier New', ui-monospace, monospace";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

const C = {
  surface: "#1a1a1a", border: "#2a2a2a",
  text: "#fafaf9", muted: "#a8a29e", mutedDim: "#71706b",
  gold: "#fbbf24", goldDim: "#BA7517", red: "#dc2626",
  blue: "#3b5bdb", sun: "#E8A23D", sunHigh: "#F2C94C", night: "#6b7280",
};

const CITIES = [
  { n: "서울", lat: 37.5665, lng: 126.9780 },
  { n: "부산", lat: 35.1796, lng: 129.0756 },
  { n: "인천", lat: 37.4563, lng: 126.7052 },
  { n: "대구", lat: 35.8714, lng: 128.6014 },
  { n: "광주", lat: 35.1595, lng: 126.8526 },
  { n: "제주", lat: 33.4996, lng: 126.5312 },
];

// ── SunCalc 핵심 (MIT, mourner/suncalc) ──
const PI = Math.PI, rad = PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
const eob = rad * 23.4397;
function toDays(d) { return d.valueOf() / dayMs - 0.5 + J1970 - J2000; }
function fromJ(j) { return new Date((j + 0.5 - J1970) * dayMs); }
function raF(l, b) { return Math.atan2(Math.sin(l) * Math.cos(eob) - Math.tan(b) * Math.sin(eob), Math.cos(l)); }
function decF(l, b) { return Math.asin(Math.sin(b) * Math.cos(eob) + Math.cos(b) * Math.sin(eob) * Math.sin(l)); }
function azF(H, phi, d) { return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)); }
function altF(H, phi, d) { return Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H)); }
function sidereal(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
function sma(d) { return rad * (357.5291 + 0.98560028 * d); }
function ecl(M) { const Cc = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)); return M + Cc + rad * 102.9372 + PI; }
function sunCoords(d) { const M = sma(d), L = ecl(M); return { dec: decF(L, 0), ra: raF(L, 0) }; }
function getPos(date, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(date), c = sunCoords(d), H = sidereal(d, lw) - c.ra;
  return { azimuth: azF(H, phi, c.dec), altitude: altF(H, phi, c.dec) };
}
const J0 = 0.0009;
function aTransit(Ht, lw, n) { return J0 + (Ht + lw) / (2 * PI) + n; }
function tJ(ds, M, L) { return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L); }
function hAngle(h, phi, d) { return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d))); }
function getTimes(date, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(date), n = Math.round(d - J0 - lw / (2 * PI)), ds = aTransit(0, lw, n);
  const M = sma(ds), L = ecl(M), dc = decF(L, 0), Jnoon = tJ(ds, M, L);
  function setJ(h) { const w = hAngle(h * rad, phi, dc), a = aTransit(w, lw, n); return tJ(a, M, L); }
  function pair(h) { const js = setJ(h); return [fromJ(Jnoon - (js - Jnoon)), fromJ(js)]; }
  const sr = pair(-0.833), dw = pair(-6), gh = pair(6);
  return { sunrise: sr[0], sunset: sr[1], dawn: dw[0], dusk: dw[1], ghEnd: gh[0], gh: gh[1], noon: fromJ(Jnoon) };
}

const deg = r => r * 180 / PI;
const compassOf = azRad => ((deg(azRad) + 180) % 360 + 360) % 360;
const DIRS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
const dirName = b => DIRS[Math.round(b / 45) % 8];
function hm(d) { if (!d || isNaN(d)) return "—"; return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function SunSeeker({ onBack }) {
  const [lat, setLat] = useState(37.5665);
  const [lng, setLng] = useState(126.9780);
  const [locName, setLocName] = useState("서울");
  const [dateStr, setDateStr] = useState(todayStr());
  const [minutes, setMinutes] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const [locating, setLocating] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [heading, setHeading] = useState(null);
  const [compassOn, setCompassOn] = useState(false);
  const headingRef = useRef(null);

  const base = useMemo(() => { const d = new Date(dateStr + "T00:00:00"); return isNaN(d) ? new Date() : d; }, [dateStr]);
  const times = useMemo(() => getTimes(base, lat, lng), [base, lat, lng]);
  const dt = useMemo(() => new Date(base.getTime() + minutes * 60000), [base, minutes]);
  const pos = useMemo(() => getPos(dt, lat, lng), [dt, lat, lng]);
  const bearing = compassOf(pos.azimuth);
  const altDeg = deg(pos.altitude);

  // 디바이스 나침반
  useEffect(() => {
    if (!compassOn) return;
    const handler = (e) => {
      let h = null;
      if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;       // iOS
      else if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360;     // Android
      if (h != null) { headingRef.current = h; setHeading(h); }
    };
    window.addEventListener("deviceorientationabsolute", handler, true);
    window.addEventListener("deviceorientation", handler, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handler, true);
      window.removeEventListener("deviceorientation", handler, true);
    };
  }, [compassOn]);

  const toggleCompass = () => {
    if (compassOn) { setCompassOn(false); setHeading(null); return; }
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === "granted") setCompassOn(true);
        else alert("나침반 권한이 거부되었습니다.");
      }).catch(() => alert("나침반을 사용할 수 없습니다."));
    } else {
      setCompassOn(true);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { alert("위치 기능을 지원하지 않습니다."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => { setLat(+p.coords.latitude.toFixed(4)); setLng(+p.coords.longitude.toFixed(4)); setLocName("현재 위치"); setLocating(false); },
      () => { alert("위치를 가져오지 못했습니다. 권한을 확인해주세요."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 상태 판별
  let state, stateColor;
  if (altDeg < -6) { state = "🌙 밤"; stateColor = C.blue; }
  else if (altDeg < 0) { state = "🌆 블루아워"; stateColor = C.blue; }
  else if (altDeg < 8) { state = "🌅 골든아워"; stateColor = C.gold; }
  else { state = "☀️ 주간"; stateColor = C.gold; }

  // 나침반 좌표
  const headingApplied = compassOn && heading != null ? heading : 0;
  const dotR = altDeg < 0 ? 90 : 82 * (1 - Math.max(0, altDeg) / 90 * 0.66);
  const ang = (bearing - 90) * rad;
  const cx = 100 + dotR * Math.cos(ang), cy = 100 + dotR * Math.sin(ang);

  return (
    <div style={{ marginTop: 8, fontFamily: FONT_GOTHIC, color: C.text }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
        <button onClick={onBack}
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: C.text, fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_GOTHIC, touchAction: "manipulation" }}>
          <span style={{ color: C.gold }}>←</span> 도구
        </button>
        <span style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>🌅 SUN SEEKER</span>
        <div style={{ width: 60 }} />
      </div>

      {/* 위치 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={useMyLocation} disabled={locating}
          style={{ flex: 1, padding: "9px 6px", minHeight: 38, background: C.surface, color: C.text, border: `1px solid ${C.gold}`, borderRadius: 6, fontSize: 11.5, fontWeight: 700, fontFamily: FONT_GOTHIC, cursor: "pointer", touchAction: "manipulation" }}>
          {locating ? "📍 찾는 중..." : "📍 현재 위치"}
        </button>
        <button onClick={() => setShowManual(s => !s)}
          style={{ flex: 1, padding: "9px 6px", minHeight: 38, background: showManual ? C.gold : C.surface, color: showManual ? "#0a0a0a" : C.muted, border: `1px solid ${showManual ? C.gold : C.border}`, borderRadius: 6, fontSize: 11.5, fontWeight: 700, fontFamily: FONT_GOTHIC, cursor: "pointer", touchAction: "manipulation" }}>
          ✏️ 수동 입력
        </button>
      </div>

      {showManual && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {CITIES.map(ci => (
              <button key={ci.n} onClick={() => { setLat(ci.lat); setLng(ci.lng); setLocName(ci.n); }}
                style={{ padding: "6px 11px", minHeight: 32, background: locName === ci.n ? C.gold : "transparent", color: locName === ci.n ? "#0a0a0a" : C.muted, border: `1px solid ${locName === ci.n ? C.gold : C.border}`, borderRadius: 5, fontSize: 11, fontWeight: 700, fontFamily: FONT_MONO, cursor: "pointer", touchAction: "manipulation" }}>
                {ci.n}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: FONT_MONO, marginBottom: 3 }}>위도 LAT</div>
              <input type="number" inputMode="decimal" value={lat} onChange={e => { setLat(Number(e.target.value)); setLocName("사용자 지정"); }}
                style={inputSm} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: FONT_MONO, marginBottom: 3 }}>경도 LNG</div>
              <input type="number" inputMode="decimal" value={lng} onChange={e => { setLng(Number(e.target.value)); setLocName("사용자 지정"); }}
                style={inputSm} />
            </div>
          </div>
        </div>
      )}

      {/* 위치/날짜 표시 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 12 }}>
        <span style={{ color: C.muted }}>📍 {locName} <span style={{ color: C.mutedDim, fontFamily: FONT_MONO, fontSize: 10 }}>{lat.toFixed(2)}, {lng.toFixed(2)}</span></span>
        <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, padding: "5px 8px", borderRadius: 6, fontFamily: FONT_MONO, colorScheme: "dark", outline: "none" }} />
      </div>

      {/* 나침반 + 태양 위치 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
        <svg viewBox="0 0 200 200" style={{ width: 140, height: 140, flexShrink: 0 }}>
          <g transform={`rotate(${-headingApplied} 100 100)`}>
            <circle cx="100" cy="100" r="82" fill="none" stroke={C.border} strokeWidth="1" />
            <circle cx="100" cy="100" r="55" fill="none" stroke={C.border} strokeWidth="0.5" strokeDasharray="2 3" />
            <circle cx="100" cy="100" r="28" fill="none" stroke={C.border} strokeWidth="0.5" strokeDasharray="2 3" />
            <line x1="100" y1="18" x2="100" y2="182" stroke={C.border} strokeWidth="0.5" />
            <line x1="18" y1="100" x2="182" y2="100" stroke={C.border} strokeWidth="0.5" />
            <text x="100" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill={compassOn ? C.gold : C.muted} fontFamily={FONT_MONO}>N</text>
            <text x="190" y="104" textAnchor="middle" fontSize="10" fill={C.mutedDim} fontFamily={FONT_MONO}>E</text>
            <text x="100" y="196" textAnchor="middle" fontSize="10" fill={C.mutedDim} fontFamily={FONT_MONO}>S</text>
            <text x="10" y="104" textAnchor="middle" fontSize="10" fill={C.mutedDim} fontFamily={FONT_MONO}>W</text>
            <line x1="100" y1="100" x2={cx} y2={cy} stroke={altDeg < 0 ? C.night : C.goldDim} strokeWidth="2" />
            <circle cx={cx} cy={cy} r="9" fill={altDeg < 0 ? C.night : (altDeg < 8 ? C.sun : C.sunHigh)} />
          </g>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.mutedDim, fontFamily: FONT_MONO }}>방위각</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, fontFamily: FONT_MONO }}>{Math.round(bearing)}° {dirName(bearing)}</div>
          <div style={{ fontSize: 10, color: C.mutedDim, fontFamily: FONT_MONO }}>고도</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT_MONO }}>{altDeg.toFixed(1)}°</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: stateColor }}>{state}</div>
        </div>
      </div>

      {/* 나침반 연동 버튼 */}
      <button onClick={toggleCompass}
        style={{ width: "100%", padding: "9px", minHeight: 40, background: compassOn ? C.gold : C.surface, color: compassOn ? "#0a0a0a" : C.muted, border: `1px solid ${compassOn ? C.gold : C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: FONT_GOTHIC, cursor: "pointer", marginBottom: 12, touchAction: "manipulation" }}>
        🧭 {compassOn ? "나침반 연동 켜짐 (폰을 돌려보세요)" : "디바이스 나침반 연동"}
      </button>

      {/* 시간 슬라이더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <input type="range" min={0} max={1439} step={5} value={minutes} onChange={e => setMinutes(Number(e.target.value))}
          style={{ flex: 1, accentColor: C.gold, height: 30, cursor: "pointer" }} />
        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT_MONO, color: C.gold, minWidth: 54, textAlign: "right" }}>
          {String(Math.floor(minutes / 60)).padStart(2, "0")}:{String(minutes % 60).padStart(2, "0")}
        </span>
      </div>
      <button onClick={() => { const n = new Date(); setMinutes(n.getHours() * 60 + n.getMinutes()); }}
        style={{ background: "transparent", border: "none", color: C.mutedDim, fontSize: 11, cursor: "pointer", marginBottom: 12, fontFamily: FONT_MONO, touchAction: "manipulation" }}>
        ↻ 현재 시각으로
      </button>

      {/* 태양 경로 호 */}
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 6 }}>오늘의 태양 경로</div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 8px 4px", marginBottom: 14 }}>
        <SunPath base={base} lat={lat} lng={lng} minutes={minutes} times={times} />
      </div>

      {/* 주요 시각 */}
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8 }}>주요 시각</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 7, marginBottom: 12 }}>
        <EvCard n="여명 (블루)" t={times.dawn} c={C.blue} />
        <EvCard n="일출" t={times.sunrise} c={C.sun} />
        <EvCard n="골든아워 ↑" t={times.ghEnd} c={C.gold} />
        <EvCard n="정오 (남중)" t={times.noon} c={C.muted} />
        <EvCard n="골든아워 ↓" t={times.gh} c={C.gold} />
        <EvCard n="일몰" t={times.sunset} c={C.sun} />
        <EvCard n="땅거미 (블루)" t={times.dusk} c={C.blue} />
      </div>

      {/* 그림자 */}
      <ShadowInfo altDeg={altDeg} bearing={bearing} />
      <div style={{ height: 8 }} />
    </div>
  );
}

function SunPath({ base, lat, lng, minutes, times }) {
  const W = 304, H = 130, pad = 14;
  const horizonY = H - 34;
  // 정오 고도로 스케일
  const noonAlt = deg(getPos(times.noon, lat, lng).altitude);
  const maxAlt = Math.max(noonAlt + 8, 15);
  const xOf = m => pad + (m / 1440) * (W - 2 * pad);
  const yOf = a => horizonY - (a / maxAlt) * (horizonY - 10);

  // 경로 샘플 (20분 간격)
  const pts = [];
  for (let m = 0; m <= 1440; m += 20) {
    const a = deg(getPos(new Date(base.getTime() + m * 60000), lat, lng).altitude);
    pts.push([xOf(m), yOf(a)]);
  }
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  const mPos = getPos(new Date(base.getTime() + minutes * 60000), lat, lng);
  const curX = xOf(minutes), curY = yOf(deg(mPos.altitude));
  const curAlt = deg(mPos.altitude);

  const bandX = (d1, d2) => {
    const m1 = d1.getHours() * 60 + d1.getMinutes();
    const m2 = d2.getHours() * 60 + d2.getMinutes();
    return [xOf(m1), xOf(m2)];
  };
  const [grM1, grM2] = bandX(times.sunrise, times.ghEnd); // 아침 골든
  const [grE1, grE2] = bandX(times.gh, times.sunset);     // 저녁 골든

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* 골든아워 띠 */}
      <rect x={grM1} y={6} width={Math.max(0, grM2 - grM1)} height={horizonY - 6} fill={C.gold} opacity="0.12" />
      <rect x={grE1} y={6} width={Math.max(0, grE2 - grE1)} height={horizonY - 6} fill={C.gold} opacity="0.12" />
      {/* 지평선 */}
      <line x1={pad} y1={horizonY} x2={W - pad} y2={horizonY} stroke={C.mutedDim} strokeWidth="1" />
      <text x={W - pad} y={horizonY + 12} textAnchor="end" fontSize="8" fill={C.mutedDim} fontFamily={FONT_MONO}>지평선</text>
      {/* 지평선 아래 영역 */}
      <rect x={pad} y={horizonY} width={W - 2 * pad} height={H - horizonY} fill="#000" opacity="0.25" />
      {/* 경로 */}
      <path d={path} fill="none" stroke={C.goldDim} strokeWidth="1.5" />
      {/* 일출/일몰 마커 */}
      {[times.sunrise, times.sunset].map((t, i) => {
        const m = t.getHours() * 60 + t.getMinutes();
        return <line key={i} x1={xOf(m)} y1={horizonY - 4} x2={xOf(m)} y2={horizonY + 4} stroke={C.sun} strokeWidth="1.5" />;
      })}
      {/* 시간 눈금 */}
      {[6, 12, 18].map(h => (
        <text key={h} x={xOf(h * 60)} y={H - 2} textAnchor="middle" fontSize="8" fill={C.mutedDim} fontFamily={FONT_MONO}>{h}시</text>
      ))}
      {/* 현재 */}
      <line x1={curX} y1={6} x2={curX} y2={horizonY} stroke={C.muted} strokeWidth="0.5" strokeDasharray="2 2" />
      <circle cx={curX} cy={curY} r="6" fill={curAlt < 0 ? C.night : (curAlt < 8 ? C.sun : C.sunHigh)} stroke="#000" strokeWidth="1" />
    </svg>
  );
}

function EvCard({ n, t, c }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, color: C.muted }}>{n}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: FONT_MONO }}>{hm(t)}</div>
    </div>
  );
}

function ShadowInfo({ altDeg, bearing }) {
  let text;
  if (altDeg <= 0.5) text = "🌑 태양이 지평선 아래 — 그림자 없음";
  else {
    const mult = 1 / Math.tan(altDeg * rad);
    const shadowDir = dirName((bearing + 180) % 360);
    text = `🌗 그림자 길이 ≈ 키의 ${mult.toFixed(1)}배 · ${shadowDir}쪽으로`;
  }
  return (
    <div style={{ background: "#16130d", border: `1px dashed ${C.gold}`, borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#d6d3d1", lineHeight: 1.5 }}>
      {text}
    </div>
  );
}

const inputSm = { width: "100%", boxSizing: "border-box", background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fafaf9", fontSize: 13, fontFamily: FONT_MONO, padding: "8px 10px", borderRadius: 6, outline: "none" };
