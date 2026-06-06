import { useState, useMemo } from "react";

/**
 * 🌡️ 색온도 (Color Temperature) 도구
 *
 * - 켈빈(K) → 흑체복사 색상 시각화 + 광원 프리셋
 * - 미레드(mired) 표시
 * - WB 보정 가이드
 * - 젤(CTO/CTB) 계산: 현재 광원 → 목표 색온도 변환에 필요한 색보정 젤
 *
 * mired = 1,000,000 / K
 * mired shift = (1e6/목표K) - (1e6/현재K)
 *   양수 → CTO 계열(색온도 낮춤),  음수 → CTB 계열(색온도 높임)
 */

const FONT_MONO   = "'Courier New', ui-monospace, monospace";
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

const PRESETS = [
  { n: "촛불",       k: 1900 },
  { n: "백열등",     k: 2700 },
  { n: "텅스텐",     k: 3200 },
  { n: "형광등",     k: 4000 },
  { n: "주광",       k: 5600 },
  { n: "흐림",       k: 6500 },
  { n: "그늘",       k: 7500 },
  { n: "맑은하늘",   k: 10000 },
];

// 표준 색보정 젤 (대표 미레드 값, Rosco/Lee 기준)
const CTO_GELS = [
  { name: "1/8 CTO", mired: 20 },
  { name: "1/4 CTO", mired: 42 },
  { name: "1/2 CTO", mired: 81 },
  { name: "Full CTO", mired: 167 },
];
const CTB_GELS = [
  { name: "1/8 CTB", mired: -12 },
  { name: "1/4 CTB", mired: -30 },
  { name: "1/2 CTB", mired: -68 },
  { name: "Full CTB", mired: -131 },
];

// 켈빈 → RGB (Tanner Helland 근사)
function kToRGB(k) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const t = k / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708 * Math.log(t) - 161.1196;
    b = t <= 19 ? 0 : 138.5177 * Math.log(t - 10) - 305.0448;
  } else {
    r = 329.6987 * Math.pow(t - 60, -0.1332);
    g = 288.1222 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  return [clamp(r), clamp(g), clamp(b)];
}

export default function ColorTemp({ onBack }) {
  const [kelvin, setKelvin] = useState(5600);
  const [targetK, setTargetK] = useState(3200);

  const [r, g, b] = useMemo(() => kToRGB(kelvin), [kelvin]);
  const mired = Math.round(1000000 / kelvin);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;

  const wbHint = useMemo(() => {
    if (kelvin < 3500) return "따뜻한 주황빛. 카메라 WB를 이 값에 맞추면 중립이 됩니다. 데이라이트(5600K)에서 켜면 주황색으로 찍혀요.";
    if (kelvin < 5000) return "중간 색감. 형광등·혼합광 환경에서 자주 나타납니다.";
    if (kelvin < 6800) return "자연광/주광 영역. 야외 낮 촬영의 표준 색온도입니다.";
    return "차가운 파란빛. 흐린 날·그늘. WB를 높게 맞추면 따뜻하게 보정됩니다.";
  }, [kelvin]);

  // 젤 계산
  const gel = useMemo(() => {
    const shift = (1000000 / targetK) - (1000000 / kelvin);
    if (Math.abs(shift) < 6) {
      return { shift, family: "none", text: "거의 동일 — 젤 불필요" };
    }
    const list = shift > 0 ? CTO_GELS : CTB_GELS;
    const family = shift > 0 ? "CTO" : "CTB";
    // 가장 가까운 단일 젤
    let best = list[0];
    let bestDiff = Math.abs(list[0].mired - shift);
    list.forEach(gl => {
      const d = Math.abs(gl.mired - shift);
      if (d < bestDiff) { bestDiff = d; best = gl; }
    });
    return { shift, family, best, list };
  }, [kelvin, targetK]);

  return (
    <div style={{ marginTop: 8, fontFamily: FONT_GOTHIC, color: C.text }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 2px" }}>
        <button onClick={onBack}
          style={{
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
            color: C.text, fontSize: 12, fontWeight: 600,
            padding: "7px 14px", borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_GOTHIC,
            touchAction: "manipulation",
          }}>
          <span style={{ color: C.gold }}>←</span> 도구
        </button>
        <span style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>
          🌡️ COLOR TEMP
        </span>
        <div style={{ width: 60 }} />
      </div>

      {/* 색상 스와치 */}
      <div style={{
        height: 72, borderRadius: 8, marginBottom: 14,
        background: `rgb(${r},${g},${b})`,
        border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: luma > 140 ? "#1a1a1a" : "#fafaf9", fontFamily: FONT_MONO }}>
          {kelvin}K 광원 색감
        </span>
      </div>

      {/* 켈빈 슬라이더 */}
      <input type="range" min={1000} max={12000} step={50} value={kelvin}
        onChange={e => setKelvin(Number(e.target.value))}
        style={{ width: "100%", accentColor: C.gold, height: 30, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <span style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_MONO, color: C.gold }}>{kelvin} K</span>
        <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT_MONO }}>{mired} mired</span>
      </div>

      {/* 프리셋 */}
      <Section label="광원 프리셋 (PRESETS)">
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {PRESETS.map(p => {
            const active = kelvin === p.k;
            return (
              <button key={p.k} onClick={() => setKelvin(p.k)}
                style={{
                  padding: "8px 11px",
                  background: active ? C.gold : C.surface,
                  color: active ? "#0a0a0a" : C.muted,
                  border: `1px solid ${active ? C.gold : C.border}`,
                  borderRadius: 6, fontSize: 11, fontWeight: active ? 800 : 700,
                  fontFamily: FONT_MONO, cursor: "pointer",
                  whiteSpace: "nowrap", flexShrink: 0, minHeight: 36,
                  touchAction: "manipulation",
                }}>
                {p.n} {p.k}K
              </button>
            );
          })}
        </div>
      </Section>

      {/* WB 힌트 */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
        padding: "10px 12px", marginBottom: 18, fontSize: 12, lineHeight: 1.55, color: "#d6d3d1",
      }}>
        {wbHint}
      </div>

      {/* ── 젤 계산 ── */}
      <div style={{ height: 1, background: C.border, margin: "0 0 16px" }} />
      <Section label="색보정 젤 계산 (GEL)">
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
          현재 광원 <strong style={{ color: C.gold }}>{kelvin}K</strong> 를 아래 목표로 바꾸려면:
        </div>
        <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
          {[{ label: "텅스텐 3200K", k: 3200 }, { label: "데이라이트 5600K", k: 5600 }].map(t => {
            const active = targetK === t.k;
            return (
              <button key={t.k} onClick={() => setTargetK(t.k)}
                style={{
                  flex: 1, padding: "9px 6px", minHeight: 40,
                  background: active ? C.red : C.surface,
                  color: active ? "#fff" : C.muted,
                  border: `1px solid ${active ? C.red : C.border}`,
                  borderRadius: 6, fontSize: 11, fontWeight: active ? 800 : 700,
                  fontFamily: FONT_MONO, cursor: "pointer", touchAction: "manipulation",
                }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 젤 결과 */}
      {gel.family === "none" ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "14px", textAlign: "center", fontSize: 13, color: C.muted }}>
          {gel.text}
        </div>
      ) : (
        <div style={{ background: "#000", border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`, borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO, letterSpacing: "0.1em" }}>추천 젤</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: C.red, fontFamily: FONT_MONO }}>{gel.best.name}</span>
          </div>
          <div style={{ fontSize: 11, color: C.mutedDim, fontFamily: FONT_MONO, marginBottom: 10 }}>
            필요 미레드 시프트: {gel.shift > 0 ? "+" : ""}{Math.round(gel.shift)} · {gel.family} 계열
          </div>
          <div style={{ fontSize: 11.5, color: "#d6d3d1", lineHeight: 1.5 }}>
            {gel.family === "CTO"
              ? "CTO(주황) 젤을 광원·조명 앞에 붙여 색온도를 낮춥니다. (예: 창문 데이라이트를 실내 텅스텐에 맞출 때)"
              : "CTB(파랑) 젤을 광원 앞에 붙여 색온도를 높입니다. (예: 텅스텐 조명을 데이라이트에 맞출 때)"}
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
