import { useState, useMemo } from "react";

/**
 * 📐 피사계 심도 (DOF) 계산기
 *
 * 입력: 센서 크기, 초점거리, 조리개, 피사체 거리
 * 출력: DOF (피사계 심도), 근초점·원초점·과초점, 시각화 막대
 *
 * 공식:
 *   Hyperfocal:  H = f²/(N·c) + f
 *   Near focus:  DN = H·s / (H + (s - f))
 *   Far focus:   DF = H·s / (H - (s - f))  (s < H일 때, 아니면 ∞)
 *   DOF:         DF - DN
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

// 센서별 혼동원(Circle of Confusion) 크기 (mm)
const SENSORS = [
  { key: "ff",    label: "Full Frame", short: "FF",    coc: 0.030 },
  { key: "apsc",  label: "APS-C",      short: "APS-C", coc: 0.019 },
  { key: "m43",   label: "Micro 4/3",  short: "M43",   coc: 0.015 },
  { key: "1inch", label: "1 inch",     short: "1\"",   coc: 0.011 },
  { key: "phone", label: "스마트폰",    short: "📱",    coc: 0.005 },
];

const FOCAL_LENGTHS = [8, 14, 18, 24, 35, 50, 85, 105, 135, 200];

const APERTURE_VALS = [1.0, 1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 11, 16, 22];
const APERTURE_LABELS = [
  "f/1.0", "f/1.4", "f/2.0", "f/2.8", "f/4.0",
  "f/5.6", "f/8.0", "f/11", "f/16", "f/22",
];

const DISTANCES = [0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0, 8.0, 15.0, 30.0];

function calcDOF(focalMm, fStop, distanceM, cocMm) {
  const f = focalMm;
  const N = fStop;
  const s = distanceM * 1000; // m → mm
  const c = cocMm;

  const H = (f * f) / (N * c) + f;
  const DN = (H * s) / (H + (s - f));
  let DF;
  if (s >= H) {
    DF = Infinity;
  } else {
    DF = (H * s) / (H - (s - f));
  }

  return {
    H_m:    H / 1000,
    DN_m:   DN / 1000,
    DF_m:   DF === Infinity ? Infinity : DF / 1000,
    DOF_m:  DF === Infinity ? Infinity : (DF - DN) / 1000,
    front_m: (s - DN) / 1000,
    back_m:  DF === Infinity ? Infinity : (DF - s) / 1000,
  };
}

function formatDist(m) {
  if (m === Infinity || !isFinite(m)) return "∞";
  if (m < 0.01) return "0 cm";
  if (m < 1)    return `${Math.round(m * 100)} cm`;
  if (m < 10)   return `${m.toFixed(2)} m`;
  if (m < 100)  return `${m.toFixed(1)} m`;
  return `${Math.round(m)} m`;
}

export default function DofCalc({ onBack }) {
  const [sensorIdx, setSensorIdx] = useState(0); // FF
  const [focalIdx, setFocalIdx]   = useState(5); // 50mm
  const [apIdx, setApIdx]         = useState(3); // f/2.8
  const [distIdx, setDistIdx]     = useState(6); // 3m

  const focal    = FOCAL_LENGTHS[focalIdx];
  const aperture = APERTURE_VALS[apIdx];
  const distance = DISTANCES[distIdx];
  const coc      = SENSORS[sensorIdx].coc;
  const sensor   = SENSORS[sensorIdx];

  const result = useMemo(
    () => calcDOF(focal, aperture, distance, coc),
    [focal, aperture, distance, coc]
  );

  return (
    <div style={{ marginTop: 8, fontFamily: FONT_GOTHIC, color: C.text }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, padding: "0 2px",
      }}>
        <button onClick={onBack}
          style={{
            background: "none", border: "none",
            color: C.gold, fontSize: 26, fontWeight: 600, lineHeight: 1,
            padding: "2px 10px 2px 0", cursor: "pointer",
            touchAction: "manipulation",
          }}>
          ‹
        </button>
        <span style={{
          color: C.gold, fontSize: 10, fontWeight: 700,
          letterSpacing: "0.2em", fontFamily: FONT_MONO,
        }}>
          📐 DOF
        </span>
        <div style={{ width: 60 }} />
      </div>

      {/* 입력 그룹 */}
      <Section label="센서 크기 (SENSOR)">
        <ChipRow
          values={SENSORS.map(s => s.short)}
          selected={sensorIdx}
          onSelect={setSensorIdx}
        />
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.mutedDim, marginTop: 4, letterSpacing: "0.05em" }}>
          {sensor.label} · CoC = {sensor.coc.toFixed(3)}mm
        </div>
      </Section>

      <Section label="초점거리 (FOCAL LENGTH)">
        <ChipRow
          values={FOCAL_LENGTHS.map(v => `${v}mm`)}
          selected={focalIdx}
          onSelect={setFocalIdx}
        />
      </Section>

      <Section label="조리개 (APERTURE)">
        <ChipRow
          values={APERTURE_LABELS}
          selected={apIdx}
          onSelect={setApIdx}
        />
      </Section>

      <Section label="피사체 거리 (DISTANCE)">
        <ChipRow
          values={DISTANCES.map(d => d < 1 ? `${Math.round(d * 100)}cm` : `${d}m`)}
          selected={distIdx}
          onSelect={setDistIdx}
        />
      </Section>

      {/* DOF 결과 박스 */}
      <div style={{
        marginTop: 16, background: "#000",
        border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "22px 12px",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
          letterSpacing: "0.3em", fontWeight: 700, marginBottom: 8,
        }}>DEPTH OF FIELD</div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 44, fontWeight: 900, color: C.gold,
          letterSpacing: "0.04em", lineHeight: 1,
          textShadow: "0 0 22px rgba(251,191,36,0.5)",
        }}>
          {formatDist(result.DOF_m)}
        </div>
        {result.DOF_m !== Infinity && (
          <div style={{
            fontFamily: FONT_MONO, fontSize: 10, color: C.muted,
            marginTop: 10, letterSpacing: "0.08em",
          }}>
            앞 {formatDist(result.front_m)} <span style={{ color: C.mutedDim }}>·</span> 뒤 {formatDist(result.back_m)}
          </div>
        )}
      </div>

      {/* 시각화 막대 */}
      <DofVisual result={result} distance={distance} />

      {/* 상세 결과 */}
      <div style={{
        marginTop: 12, background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6, padding: "10px 14px",
      }}>
        <DetailRow label="근초점 (NEAR)" value={formatDist(result.DN_m)} />
        <DetailRow label="원초점 (FAR)"  value={formatDist(result.DF_m)} />
        <DetailRow label="과초점 (HYPER)" value={formatDist(result.H_m)} last />
      </div>

      {/* 가이드 */}
      <div style={{
        marginTop: 14, padding: "10px 12px",
        background: "#16130d",
        border: `1px dashed ${C.gold}`,
        borderRadius: 6,
        fontSize: 11, color: "#d6d3d1", lineHeight: 1.7,
      }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, color: C.gold,
          letterSpacing: "0.25em", fontWeight: 700, marginBottom: 5,
        }}>💡 GUIDE</div>
        조리개 <strong style={{ color: C.text }}>열수록</strong> (f값↓) → 심도 <strong style={{ color: C.text }}>얕아짐</strong> (배경 흐림)<br/>
        초점거리 <strong style={{ color: C.text }}>길수록</strong> → 심도 <strong style={{ color: C.text }}>얕아짐</strong><br/>
        피사체 <strong style={{ color: C.text }}>가까울수록</strong> → 심도 <strong style={{ color: C.text }}>얕아짐</strong><br/>
        센서 <strong style={{ color: C.text }}>클수록</strong> → 심도 <strong style={{ color: C.text }}>얕아짐</strong>
      </div>

      {/* 공통 안내 */}
      <div style={{
        marginTop: 10, padding: "8px 12px",
        background: C.surface, borderRadius: 6,
        border: `1px solid ${C.border}`,
        fontSize: 10, color: C.muted, lineHeight: 1.6,
        fontFamily: FONT_MONO, letterSpacing: "0.05em",
      }}>
        과초점 거리에 초점을 맞추면 그 거리의 절반부터 무한대까지<br/>
        모두 선명하게 찍힙니다 (풍경 촬영용).
      </div>
    </div>
  );
}

/** 섹션 (라벨 + 칩 그룹) */
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
        letterSpacing: "0.25em", fontWeight: 700, marginBottom: 6,
      }}>{label}</div>
      {children}
    </div>
  );
}

/** 칩 가로 스크롤 */
function ChipRow({ values, selected, onSelect }) {
  return (
    <div style={{
      display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2,
      WebkitOverflowScrolling: "touch",
    }}>
      {values.map((v, i) => {
        const active = selected === i;
        return (
          <button key={`${v}-${i}`} onClick={() => onSelect(i)}
            style={{
              padding: "8px 12px",
              background: active ? C.gold : C.surface,
              color: active ? "#0a0a0a" : C.muted,
              border: `1px solid ${active ? C.gold : C.border}`,
              borderRadius: 6,
              fontSize: 12, fontWeight: active ? 800 : 700,
              fontFamily: FONT_MONO,
              cursor: "pointer",
              whiteSpace: "nowrap", flexShrink: 0,
              minHeight: 38,
              WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
              touchAction: "manipulation",
            }}>
            {v}
          </button>
        );
      })}
    </div>
  );
}

/** 상세 결과 한 줄 */
function DetailRow({ label, value, last }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0",
      borderBottom: last ? "none" : `1px dashed ${C.border}`,
    }}>
      <span style={{
        fontSize: 11, color: C.muted,
        fontFamily: FONT_MONO, letterSpacing: "0.1em",
      }}>{label}</span>
      <span style={{
        fontFamily: FONT_MONO, color: C.text,
        fontSize: 16, fontWeight: 800,
      }}>{value}</span>
    </div>
  );
}

/** DOF 시각화 막대 */
function DofVisual({ result, distance }) {
  // 무한대 케이스
  if (result.DOF_m === Infinity || !isFinite(result.DOF_m)) {
    return (
      <div style={{
        marginTop: 12, padding: "14px",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6, textAlign: "center",
      }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
          letterSpacing: "0.2em", marginBottom: 6,
        }}>DOF VISUAL</div>
        <div style={{ fontSize: 36, color: C.gold, fontFamily: FONT_MONO, lineHeight: 1, marginBottom: 6 }}>∞</div>
        <div style={{ fontSize: 11, color: C.muted }}>
          과초점 이상 → 무한대까지 모두 초점
        </div>
      </div>
    );
  }

  const front = result.front_m;
  const back = result.back_m;
  const total = front + back;
  const subjectPos = total > 0 ? (front / total) * 100 : 50;

  return (
    <div style={{
      marginTop: 12, padding: "12px 14px",
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
    }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
        letterSpacing: "0.2em", marginBottom: 8,
      }}>DOF VISUAL</div>

      {/* 막대 */}
      <div style={{
        position: "relative", height: 32,
        background: "rgba(251,191,36,0.15)",
        borderRadius: 5, border: `1px solid ${C.gold}`,
      }}>
        {/* 앞쪽 영역 */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${subjectPos}%`,
          background: "rgba(251,191,36,0.2)",
        }} />
        {/* 뒤쪽 영역 */}
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: `${100 - subjectPos}%`,
          background: "rgba(251,191,36,0.35)",
        }} />
        {/* 피사체 마커 */}
        <div style={{
          position: "absolute", left: `${subjectPos}%`,
          top: -4, bottom: -4,
          width: 3, background: C.red,
          transform: "translateX(-1.5px)",
          boxShadow: "0 0 10px rgba(220,38,38,0.6)",
        }} />
        <div style={{
          position: "absolute", left: `${subjectPos}%`,
          top: "50%", transform: "translate(-50%, -50%)",
          background: C.red, color: "#fff",
          width: 22, height: 22, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 900,
          border: "2px solid #fff",
        }}>●</div>
      </div>

      {/* 라벨 */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginTop: 8, fontFamily: FONT_MONO, fontSize: 10,
      }}>
        <span style={{ color: C.mutedDim }}>
          ◀ {formatDist(result.DN_m)}
        </span>
        <span style={{ color: C.red, fontWeight: 700 }}>
          {formatDist(distance)}
        </span>
        <span style={{ color: C.mutedDim }}>
          {formatDist(result.DF_m)} ▶
        </span>
      </div>
    </div>
  );
}
