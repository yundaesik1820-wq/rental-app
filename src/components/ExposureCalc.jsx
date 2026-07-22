import { useState, useMemo } from "react";

/**
 * 📷 노출 계산기 (이론)
 *
 * 탭 1 — 180° 셔터 룰: FPS → 권장 셔터 스피드
 * 탭 2 — 등가 노출 환산: 한 값 변경 시 다른 값 자동 환산
 */

const FONT_MONO   = "'Noto Sans KR', sans-serif";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

const C = {
  surface: "#1a1a1a",
  surfaceDark: "#0d0d0d",
  border: "#2a2a2a",
  text: "#fafaf9",
  muted: "#a8a29e",
  mutedDim: "#71706b",
  gold: "#fbbf24",
  red: "#dc2626",
};

// 표준 stop 값들 (1 stop 간격)
const APERTURES = [
  "f/1.0", "f/1.4", "f/2.0", "f/2.8", "f/4.0",
  "f/5.6", "f/8.0", "f/11", "f/16", "f/22",
];

const SHUTTERS = [
  '1"', "1/2", "1/4", "1/8", "1/15", "1/30",
  "1/60", "1/125", "1/250", "1/500",
  "1/1000", "1/2000", "1/4000", "1/8000",
];

const ISOS = ["100", "200", "400", "800", "1600", "3200", "6400", "12800"];

const FPS_OPTIONS = [
  { fps: 23.976, label: "23.98" },
  { fps: 24,     label: "24" },
  { fps: 25,     label: "25" },
  { fps: 29.97,  label: "29.97" },
  { fps: 30,     label: "30" },
  { fps: 48,     label: "48" },
  { fps: 50,     label: "50" },
  { fps: 60,     label: "60" },
  { fps: 120,    label: "120" },
];

// 표준 셔터 초 단위 (가까운 값 찾기용)
const STD_SHUTTER_SEC = [
  1, 1/2, 1/4, 1/8, 1/15, 1/30,
  1/60, 1/125, 1/250, 1/500,
  1/1000, 1/2000, 1/4000, 1/8000,
];

function fpsToShutterSec(fps) {
  return 1 / (2 * fps);
}

function findNearestStd(targetSec) {
  let idx = 0;
  let minDiff = Math.abs(STD_SHUTTER_SEC[0] - targetSec);
  STD_SHUTTER_SEC.forEach((s, i) => {
    const diff = Math.abs(s - targetSec);
    if (diff < minDiff) { minDiff = diff; idx = i; }
  });
  return idx;
}

function exactLabel(seconds) {
  const denom = Math.round(1 / seconds);
  return `1/${denom}`;
}

export default function ExposureCalc({ onBack }) {
  const [tab, setTab] = useState("shutter180");

  // ── 탭 1: 180° 셔터 ──
  const [fpsIdx, setFpsIdx] = useState(1); // 24fps
  const fps = FPS_OPTIONS[fpsIdx].fps;
  const targetSec = fpsToShutterSec(fps);
  const stdIdx = findNearestStd(targetSec);
  const std = SHUTTERS[stdIdx];
  const exact = exactLabel(targetSec);

  // ── 탭 2: 등가 환산 ──
  const [shutter, setShutter]   = useState(6); // 1/60
  const [aperture, setAperture] = useState(3); // f/2.8
  const [iso, setIso]           = useState(2); // 400
  const [changeKey, setChangeKey] = useState("shutter");
  const [newStop, setNewStop] = useState({ shutter: 8, aperture: 1, iso: 4 });
  const updateNewStop = (key, val) => setNewStop(p => ({ ...p, [key]: val }));

  // 환산 결과 (EV = aperture + shutter - iso 모델)
  const result = useMemo(() => {
    let d = 0;
    let resShutter, resAperture, resIso;
    if (changeKey === "shutter") {
      d = newStop.shutter - shutter;
      resAperture = aperture - d;
      resIso = iso + d;
    } else if (changeKey === "aperture") {
      d = newStop.aperture - aperture;
      resShutter = shutter - d;
      resIso = iso + d;
    } else {
      d = -(newStop.iso - iso);
      resShutter = shutter + d;
      resAperture = aperture + d;
    }
    const inRange = (arr, idx) => idx >= 0 && idx < arr.length;
    return {
      stopDiff: d,
      shutter: resShutter !== undefined ? (inRange(SHUTTERS, resShutter) ? SHUTTERS[resShutter] : "범위 초과") : null,
      aperture: resAperture !== undefined ? (inRange(APERTURES, resAperture) ? APERTURES[resAperture] : "범위 초과") : null,
      iso: resIso !== undefined ? (inRange(ISOS, resIso) ? ISOS[resIso] : "범위 초과") : null,
    };
  }, [changeKey, shutter, aperture, iso, newStop]);

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
          📷 EXPOSURE
        </span>
        <div style={{ width: 60 }} />
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", marginBottom: 16 }}>
        <TabBtn active={tab === "shutter180"} onClick={() => setTab("shutter180")} position="left">180° SHUTTER</TabBtn>
        <TabBtn active={tab === "equiv"}     onClick={() => setTab("equiv")}     position="right">등가 환산</TabBtn>
      </div>

      {tab === "shutter180" && (
        <Shutter180Section
          fpsIdx={fpsIdx} setFpsIdx={setFpsIdx}
          fps={fps} std={std} exact={exact}
        />
      )}

      {tab === "equiv" && (
        <EquivSection
          shutter={shutter} setShutter={setShutter}
          aperture={aperture} setAperture={setAperture}
          iso={iso} setIso={setIso}
          changeKey={changeKey} setChangeKey={setChangeKey}
          newStop={newStop} updateNewStop={updateNewStop}
          result={result}
        />
      )}

      {/* 공통 안내 */}
      <div style={{
        marginTop: 16, padding: "8px 12px",
        background: C.surface, borderRadius: 6,
        border: `1px solid ${C.border}`,
        fontSize: 10, color: C.muted, lineHeight: 1.6,
        fontFamily: FONT_MONO, letterSpacing: "0.05em",
      }}>
        <div style={{ color: C.gold, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 3 }}>HOW TO USE</div>
        {tab === "shutter180" && "촬영 FPS를 선택하면 180도 셔터 룰 기반 권장 셔터가 표시됩니다."}
        {tab === "equiv" && "기준 노출을 입력하고 한 값을 바꿔보세요. 같은 노출을 유지하려면 다른 값을 어떻게 조정해야 하는지 표시됩니다."}
      </div>
    </div>
  );
}

/** 탭 버튼 */
function TabBtn({ active, onClick, children, position }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1, padding: "10px",
        background: active ? C.gold : C.surface,
        color: active ? "#0a0a0a" : C.muted,
        border: `1px solid ${active ? C.gold : C.border}`,
        borderRadius: position === "left" ? "6px 0 0 6px" : "0 6px 6px 0",
        borderLeft: position === "right" ? "none" : undefined,
        fontSize: 12, fontWeight: active ? 800 : 700,
        fontFamily: FONT_MONO, letterSpacing: "0.1em",
        cursor: "pointer", minHeight: 42,
        WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
        touchAction: "manipulation",
      }}>
      {children}
    </button>
  );
}

/** ─── 탭 1: 180° 셔터 ─── */
function Shutter180Section({ fpsIdx, setFpsIdx, fps, std, exact }) {
  return (
    <div>
      {/* FPS 칩 */}
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
        letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8,
      }}>FRAME RATE</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
        {FPS_OPTIONS.map((opt, i) => (
          <button key={opt.label} onClick={() => setFpsIdx(i)}
            style={{
              padding: "9px 13px",
              background: fpsIdx === i ? C.gold : C.surface,
              color: fpsIdx === i ? "#0a0a0a" : C.muted,
              border: `1px solid ${fpsIdx === i ? C.gold : C.border}`,
              borderRadius: 6,
              fontSize: 12, fontWeight: fpsIdx === i ? 800 : 700,
              fontFamily: FONT_MONO,
              cursor: "pointer", minHeight: 40,
              WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
              touchAction: "manipulation",
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* 결과 박스 */}
      <div style={{
        background: "#000",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "22px 12px",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
          letterSpacing: "0.3em", fontWeight: 700, marginBottom: 8,
        }}>권장 셔터 스피드</div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 48, fontWeight: 900, color: C.gold,
          letterSpacing: "0.04em", lineHeight: 1,
          textShadow: "0 0 22px rgba(251,191,36,0.5)",
        }}>
          {std}
        </div>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 10, color: C.muted,
          marginTop: 10, letterSpacing: "0.15em",
        }}>
          정확한 값: {exact} · 셔터 각도 180°
        </div>
      </div>

      {/* 설명 */}
      <div style={{
        background: "#16130d",
        border: `1px dashed ${C.gold}`,
        borderRadius: 6,
        padding: "10px 12px",
        marginTop: 12,
      }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, color: C.gold,
          letterSpacing: "0.25em", fontWeight: 700, marginBottom: 5,
        }}>💡 180° SHUTTER RULE</div>
        <div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.6 }}>
          영화 같은 자연스러운 모션 블러를 위한 표준.<br/>
          <strong style={{ color: C.text }}>셔터 시간 = 1 / (2 × FPS)</strong><br/>
          <span style={{ color: C.mutedDim, fontSize: 10.5 }}>
            셔터가 너무 빠르면 끊기는 느낌 · 너무 느리면 흐릿함
          </span>
        </div>
      </div>
    </div>
  );
}

/** ─── 탭 2: 등가 환산 ─── */
function EquivSection({ shutter, setShutter, aperture, setAperture, iso, setIso,
                       changeKey, setChangeKey, newStop, updateNewStop, result }) {
  return (
    <div>
      {/* 기준 노출 */}
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
        letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8,
      }}>기준 노출 (BASE)</div>
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6, padding: 12, marginBottom: 14,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <ValueRow label="SHUTTER"  values={SHUTTERS}  selected={shutter}  onSelect={setShutter} />
        <ValueRow label="APERTURE" values={APERTURES} selected={aperture} onSelect={setAperture} />
        <ValueRow label="ISO"      values={ISOS}      selected={iso}      onSelect={setIso} />
      </div>

      {/* 변경 항목 */}
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
        letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8,
      }}>어떤 값을 바꿔보시겠어요?</div>
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        <ChangeBtn val="shutter"  current={changeKey} set={setChangeKey}>SHUTTER</ChangeBtn>
        <ChangeBtn val="aperture" current={changeKey} set={setChangeKey}>APERTURE</ChangeBtn>
        <ChangeBtn val="iso"      current={changeKey} set={setChangeKey}>ISO</ChangeBtn>
      </div>

      {/* 새 값 */}
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, color: C.mutedDim,
        letterSpacing: "0.25em", fontWeight: 700, marginBottom: 8,
      }}>새 {changeKey.toUpperCase()} 값</div>
      <div style={{
        background: C.surface,
        border: `1px solid ${C.gold}`,
        borderRadius: 6, padding: 12, marginBottom: 14,
      }}>
        {changeKey === "shutter" && (
          <ValueRow label="" values={SHUTTERS} selected={newStop.shutter} onSelect={v => updateNewStop("shutter", v)} highlight />
        )}
        {changeKey === "aperture" && (
          <ValueRow label="" values={APERTURES} selected={newStop.aperture} onSelect={v => updateNewStop("aperture", v)} highlight />
        )}
        {changeKey === "iso" && (
          <ValueRow label="" values={ISOS} selected={newStop.iso} onSelect={v => updateNewStop("iso", v)} highlight />
        )}
      </div>

      {/* 결과 */}
      <div style={{
        background: "#000",
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.red}`,
        borderRadius: 6, padding: 14,
      }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, color: C.red,
          letterSpacing: "0.25em", fontWeight: 700, marginBottom: 10,
        }}>같은 노출이 되려면</div>

        {/* stop diff */}
        <div style={{
          fontSize: 11, marginBottom: 12, fontFamily: FONT_MONO,
          letterSpacing: "0.05em", fontWeight: 700,
          color: result.stopDiff > 0 ? "#ef4444" : result.stopDiff < 0 ? "#22d3ee" : C.muted,
        }}>
          {result.stopDiff > 0 ? `▼ +${result.stopDiff} STOPS 어두워짐 → 다른 값을 밝게` :
           result.stopDiff < 0 ? `▲ ${-result.stopDiff} STOPS 밝아짐 → 다른 값을 어둡게` :
           "변화 없음"}
        </div>

        {result.shutter !== null && (
          <ResultRow label="SHUTTER" before={SHUTTERS[shutter]} after={result.shutter} />
        )}
        {result.aperture !== null && (
          <ResultRow label="APERTURE" before={APERTURES[aperture]} after={result.aperture} />
        )}
        {result.iso !== null && (
          <ResultRow label="ISO" before={ISOS[iso]} after={result.iso} />
        )}

        <div style={{
          marginTop: 10, padding: "8px 0 0",
          borderTop: `1px dashed ${C.border}`,
          fontSize: 10, color: C.mutedDim,
          fontFamily: FONT_MONO, letterSpacing: "0.05em",
        }}>
          둘 중 하나 적용 또는 분배해서 조정
        </div>
      </div>
    </div>
  );
}

/** 값 선택 행 (가로 스크롤 칩) */
function ValueRow({ label, values, selected, onSelect, highlight = false }) {
  return (
    <div>
      {label && (
        <div style={{
          fontFamily: FONT_MONO, fontSize: 8, color: C.mutedDim,
          letterSpacing: "0.2em", fontWeight: 700, marginBottom: 5,
        }}>{label}</div>
      )}
      <div style={{
        display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2,
        WebkitOverflowScrolling: "touch",
      }}>
        {values.map((v, i) => {
          const active = selected === i;
          return (
            <button key={v} onClick={() => onSelect(i)}
              style={{
                padding: "7px 11px",
                background: active ? (highlight ? C.gold : C.text) : "transparent",
                color: active ? "#0a0a0a" : C.muted,
                border: `1px solid ${active ? (highlight ? C.gold : C.text) : C.border}`,
                borderRadius: 5,
                fontSize: 11, fontWeight: active ? 800 : 600,
                fontFamily: FONT_MONO,
                cursor: "pointer",
                whiteSpace: "nowrap", flexShrink: 0,
                minHeight: 34,
                WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
                touchAction: "manipulation",
              }}>
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 변경 항목 선택 버튼 */
function ChangeBtn({ val, current, set, children }) {
  const active = current === val;
  return (
    <button onClick={() => set(val)}
      style={{
        flex: 1, padding: "10px",
        background: active ? C.gold : C.surface,
        color: active ? "#0a0a0a" : C.muted,
        border: `1px solid ${active ? C.gold : C.border}`,
        borderRadius: 6,
        fontSize: 11, fontWeight: active ? 800 : 700,
        fontFamily: FONT_MONO, letterSpacing: "0.1em",
        cursor: "pointer", minHeight: 42,
        WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
        touchAction: "manipulation",
      }}>
      {children}
    </button>
  );
}

/** 환산 결과 한 줄 */
function ResultRow({ label, before, after }) {
  const isOOR = after === "범위 초과";
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 0", borderBottom: `1px dashed ${C.border}`,
    }}>
      <span style={{
        fontSize: 11, color: C.muted, fontFamily: FONT_MONO, letterSpacing: "0.1em",
      }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, color: C.text, fontSize: 13 }}>
        <span style={{ color: C.mutedDim }}>{before}</span>
        <span style={{ color: C.gold, margin: "0 6px" }}>→</span>
        <strong style={{ color: isOOR ? "#ef4444" : C.gold, fontSize: 16 }}>{after}</strong>
      </span>
    </div>
  );
}
