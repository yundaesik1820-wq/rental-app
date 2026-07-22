import { useState, useMemo } from "react";

/**
 * 🔭 렌즈 화각 (FOV / Angle of View) 도구
 *
 * 탭 1 — 화각: 센서 + 초점거리 → 수평/수직/대각 화각 + 거리별 촬영 범위
 * 탭 2 — 역계산: 거리 + 원하는 가로 폭 → 필요 초점거리
 *
 * 공식:
 *   AOV = 2·atan(sensor_dim / (2·f))
 *   촬영 폭(거리 d) = d · sensor_w / f
 *   역계산:  f = d · sensor_w / 원하는_폭
 *   crop factor = 43.27 / sensor_diagonal
 */

const FONT_MONO   = "'Noto Sans KR', sans-serif";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

const C = {
  surface: "#1a1a1a",
  border: "#2a2a2a",
  text: "#fafaf9",
  muted: "#a8a29e",
  mutedDim: "#71706b",
  gold: "#fbbf24",
  red: "#dc2626",
};

const SENSORS = [
  { key: "ff",   label: "풀프레임",  short: "FF",    w: 36,    h: 24 },
  { key: "s35",  label: "Super35",  short: "S35",   w: 24.89, h: 18.66 },
  { key: "apsc", label: "APS-C",    short: "APS-C", w: 23.5,  h: 15.6 },
  { key: "m43",  label: "M4/3",     short: "M43",   w: 17.3,  h: 13 },
  { key: "s16",  label: "Super16",  short: "S16",   w: 12.52, h: 7.41 },
];

const STD_LENSES = [14, 16, 18, 24, 28, 35, 50, 70, 85, 100, 135, 200];
const FF_DIAGONAL = Math.hypot(36, 24); // 43.27mm

function aov(dim, f) {
  return 2 * Math.atan(dim / (2 * f)) * 180 / Math.PI;
}

export default function FovCalc({ onBack }) {
  const [tab, setTab] = useState("fov"); // fov | reverse
  const [sensorIdx, setSensorIdx] = useState(0);
  const sensor = SENSORS[sensorIdx];

  // 탭1
  const [focal, setFocal] = useState(50);
  const [dist, setDist] = useState(3);

  // 탭2
  const [rDist, setRDist] = useState(3);
  const [rWidth, setRWidth] = useState(1.5);

  const fov = useMemo(() => {
    const h = aov(sensor.w, focal);
    const v = aov(sensor.h, focal);
    const d = aov(Math.hypot(sensor.w, sensor.h), focal);
    const diag = Math.hypot(sensor.w, sensor.h);
    const crop = FF_DIAGONAL / diag;
    const equiv = focal * crop;
    const frameW = dist * sensor.w / focal;
    const frameH = dist * sensor.h / focal;
    return { h, v, d, crop, equiv, frameW, frameH };
  }, [sensor, focal, dist]);

  const reverse = useMemo(() => {
    if (rWidth <= 0) return null;
    const f = rDist * sensor.w / rWidth;
    // 가장 가까운 표준 렌즈
    let best = STD_LENSES[0];
    let bestDiff = Math.abs(STD_LENSES[0] - f);
    STD_LENSES.forEach(l => {
      const dd = Math.abs(l - f);
      if (dd < bestDiff) { bestDiff = dd; best = l; }
    });
    const h = aov(sensor.w, f);
    return { f, best, h };
  }, [sensor, rDist, rWidth]);

  return (
    <div style={{ marginTop: 8, fontFamily: FONT_GOTHIC, color: C.text }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
        <button onClick={onBack}
          style={{
            background: "none", border: "none",
            color: C.gold, fontSize: 26, fontWeight: 600, lineHeight: 1,
            padding: "2px 10px 2px 0", cursor: "pointer",
            touchAction: "manipulation",
          }}>
          ‹
        </button>
        <span style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>
          🔭 FOV
        </span>
        <div style={{ width: 60 }} />
      </div>

      {/* 센서 선택 (공통) */}
      <Section label="센서 크기 (SENSOR)">
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {SENSORS.map((s, i) => {
            const active = sensorIdx === i;
            return (
              <button key={s.key} onClick={() => setSensorIdx(i)}
                style={{
                  padding: "8px 12px",
                  background: active ? C.gold : C.surface,
                  color: active ? "#0a0a0a" : C.muted,
                  border: `1px solid ${active ? C.gold : C.border}`,
                  borderRadius: 6, fontSize: 12, fontWeight: active ? 800 : 700,
                  fontFamily: FONT_MONO, cursor: "pointer",
                  whiteSpace: "nowrap", flexShrink: 0, minHeight: 38,
                  touchAction: "manipulation",
                }}>
                {s.short}
              </button>
            );
          })}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.mutedDim, marginTop: 4 }}>
          {sensor.label} · {sensor.w}×{sensor.h}mm
        </div>
      </Section>

      {/* 탭 토글 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        <button onClick={() => setTab("fov")}
          style={{
            flex: 1, padding: "10px 4px", minHeight: 40,
            background: tab === "fov" ? C.gold : C.surface,
            color: tab === "fov" ? "#0a0a0a" : C.muted,
            border: `1px solid ${tab === "fov" ? C.gold : C.border}`,
            borderRadius: 6, fontSize: 11, fontWeight: tab === "fov" ? 800 : 700,
            fontFamily: FONT_MONO, letterSpacing: "0.05em", cursor: "pointer", touchAction: "manipulation",
          }}>
          화각 계산
        </button>
        <button onClick={() => setTab("reverse")}
          style={{
            flex: 1, padding: "10px 4px", minHeight: 40,
            background: tab === "reverse" ? C.gold : C.surface,
            color: tab === "reverse" ? "#0a0a0a" : C.muted,
            border: `1px solid ${tab === "reverse" ? C.gold : C.border}`,
            borderRadius: 6, fontSize: 11, fontWeight: tab === "reverse" ? 800 : 700,
            fontFamily: FONT_MONO, letterSpacing: "0.05em", cursor: "pointer", touchAction: "manipulation",
          }}>
          역계산 (몇 mm?)
        </button>
      </div>

      {/* ── 탭 1: 화각 계산 ── */}
      {tab === "fov" && (
        <div>
          {/* 초점거리 슬라이더 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO, minWidth: 60 }}>초점거리</span>
            <input type="range" min={8} max={200} step={1} value={focal}
              onChange={e => setFocal(Number(e.target.value))}
              style={{ flex: 1, accentColor: C.gold, height: 30, cursor: "pointer" }} />
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_MONO, color: C.gold, minWidth: 54, textAlign: "right" }}>{focal}mm</span>
          </div>

          {/* 부채꼴 시각화 */}
          <FovWedge hFov={fov.h} />

          {/* 화각 결과 3칸 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            <FovStat label="수평" value={`${fov.h.toFixed(1)}°`} />
            <FovStat label="수직" value={`${fov.v.toFixed(1)}°`} />
            <FovStat label="대각" value={`${fov.d.toFixed(1)}°`} />
          </div>

          {/* 35mm 환산 */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", marginBottom: 14, fontSize: 11.5, color: C.muted, fontFamily: FONT_MONO }}>
            35mm 환산: <strong style={{ color: C.text }}>{fov.equiv.toFixed(0)}mm</strong>
            <span style={{ color: C.mutedDim }}> (crop ×{fov.crop.toFixed(2)})</span>
          </div>

          {/* 거리별 촬영 범위 */}
          <Section label="피사체 거리 → 촬영 범위">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO, minWidth: 60 }}>거리</span>
              <input type="range" min={0.5} max={20} step={0.5} value={dist}
                onChange={e => setDist(Number(e.target.value))}
                style={{ flex: 1, accentColor: C.gold, height: 30, cursor: "pointer" }} />
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_MONO, color: C.gold, minWidth: 54, textAlign: "right" }}>{dist.toFixed(1)}m</span>
            </div>
            <div style={{ background: "#000", border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 6, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: FONT_MONO, color: C.gold, lineHeight: 1.2 }}>
                {fov.frameW.toFixed(2)}m × {fov.frameH.toFixed(2)}m
              </div>
              <div style={{ fontSize: 10.5, color: C.mutedDim, marginTop: 5, fontFamily: FONT_MONO }}>
                {dist.toFixed(1)}m 거리에서 프레임에 담기는 범위 (가로×세로)
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── 탭 2: 역계산 ── */}
      {tab === "reverse" && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
            원하는 <strong style={{ color: C.gold }}>촬영 범위</strong>를 담으려면 몇 mm 렌즈가 필요한지 계산합니다.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO, minWidth: 70 }}>피사체 거리</span>
            <input type="range" min={0.5} max={20} step={0.5} value={rDist}
              onChange={e => setRDist(Number(e.target.value))}
              style={{ flex: 1, accentColor: C.gold, height: 30, cursor: "pointer" }} />
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT_MONO, color: C.gold, minWidth: 50, textAlign: "right" }}>{rDist.toFixed(1)}m</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO, minWidth: 70 }}>담을 가로폭</span>
            <input type="range" min={0.2} max={10} step={0.1} value={rWidth}
              onChange={e => setRWidth(Number(e.target.value))}
              style={{ flex: 1, accentColor: C.gold, height: 30, cursor: "pointer" }} />
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT_MONO, color: C.gold, minWidth: 50, textAlign: "right" }}>{rWidth.toFixed(1)}m</span>
          </div>

          {reverse && (
            <div style={{ background: "#000", border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`, borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO, letterSpacing: "0.1em", marginBottom: 4 }}>필요 초점거리</div>
                <div style={{ fontSize: 34, fontWeight: 900, fontFamily: FONT_MONO, color: C.red, lineHeight: 1 }}>
                  {reverse.f.toFixed(0)}mm
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px dashed ${C.border}`, fontSize: 11.5, fontFamily: FONT_MONO }}>
                <span style={{ color: C.muted }}>가까운 표준 렌즈</span>
                <span style={{ color: C.gold, fontWeight: 800 }}>{reverse.best}mm</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, fontSize: 11.5, fontFamily: FONT_MONO }}>
                <span style={{ color: C.muted }}>그때 수평 화각</span>
                <span style={{ color: C.text }}>{reverse.h.toFixed(1)}°</span>
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, padding: "8px 10px", background: "#16130d", border: `1px dashed ${C.gold}`, borderRadius: 5, fontSize: 10.5, color: "#d6d3d1", lineHeight: 1.6 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: C.gold, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 3 }}>💡 예시</div>
            인물 풀샷(폭 ~1m)을 3m 거리에서 담으려면 위 결과의 렌즈를 쓰면 돼요.
          </div>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim, letterSpacing: "0.25em", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FovStat({ label, value }) {
  return (
    <div style={{ background: C.surface, borderRadius: 6, padding: "10px 4px", textAlign: "center", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT_MONO }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT_MONO, color: C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function FovWedge({ hFov }) {
  const ox = 40, oy = 70, len = 250;
  const half = (hFov / 2) * Math.PI / 180;
  const dy = Math.tan(half) * len;
  const x2 = ox + len;
  return (
    <svg viewBox="0 0 320 140" style={{ width: "100%", height: "auto", margin: "4px 0 10px" }}>
      <polygon points={`${ox},${oy} ${x2},${oy - dy} ${x2},${oy + dy}`} fill={C.gold} opacity="0.16" />
      <line x1={ox} y1={oy} x2={x2} y2={oy - dy} stroke={C.gold} strokeWidth="1.5" />
      <line x1={ox} y1={oy} x2={x2} y2={oy + dy} stroke={C.gold} strokeWidth="1.5" />
      <circle cx={ox} cy={oy} r="5" fill={C.gold} />
      <text x={ox} y={oy + 22} fill={C.muted} fontSize="10" textAnchor="middle" fontFamily={FONT_MONO}>카메라</text>
      <text x={155} y={oy - dy / 2 + 4} fill={C.gold} fontSize="14" fontWeight="800" fontFamily={FONT_MONO}>{hFov.toFixed(1)}°</text>
    </svg>
  );
}
