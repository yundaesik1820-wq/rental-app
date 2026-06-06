import { useState, useEffect, useRef, useMemo } from "react";

/**
 * 📏 AR 거리 측정기 (Reference Object Calibration)
 *
 * 동작 흐름:
 * 1. 카메라로 알려진 객체 (신용카드 등) 비춤
 * 2. 양 끝점 두 번 탭 → 픽셀/mm 비율 계산
 * 3. 측정 모드 전환 → 측정 대상 양 끝점 탭
 * 4. 실제 거리 (mm/cm/m) 표시
 *
 * 정확도 조건:
 * - 기준 객체와 측정 대상이 같은 평면에 있어야 함
 * - 카메라는 위에서 수직으로 비추는 것이 가장 정확
 */

const FONT_MONO   = "'Courier New', ui-monospace, monospace";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

const REFERENCE_OBJECTS = [
  { key: "creditcard_w", label: "신용카드 가로", mm: 85.6 },
  { key: "creditcard_h", label: "신용카드 세로", mm: 54.0 },
  { key: "coin500",      label: "500원 동전",    mm: 26.5 },
  { key: "coin100",      label: "100원 동전",    mm: 24.0 },
  { key: "a4_w",         label: "A4 가로",       mm: 210 },
  { key: "a4_h",         label: "A4 세로",       mm: 297 },
];

function formatDistance(mm) {
  if (mm == null || !isFinite(mm)) return "—";
  if (mm < 10) return `${mm.toFixed(1)} mm`;
  if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
  return `${(mm / 1000).toFixed(2)} m`;
}

export default function ARDistance({ onBack }) {
  const videoRef   = useRef(null);
  const overlayRef = useRef(null);
  const streamRef  = useRef(null);

  const [mode, setMode] = useState("calib"); // calib | measure
  const [facingMode, setFacingMode] = useState("environment");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // 기준 객체
  const [refIdx, setRefIdx] = useState(0); // 신용카드 가로
  const [customMm, setCustomMm] = useState(100);
  const [useCustom, setUseCustom] = useState(false);
  const refMm = useCustom ? customMm : REFERENCE_OBJECTS[refIdx].mm;

  // 점들 (오버레이 픽셀 좌표)
  const [calibPoints, setCalibPoints] = useState([]);
  const [measurePoints, setMeasurePoints] = useState([]);

  // 픽셀 → mm 비율
  const pxPerMm = useMemo(() => {
    if (calibPoints.length !== 2 || refMm <= 0) return null;
    const dx = calibPoints[1].x - calibPoints[0].x;
    const dy = calibPoints[1].y - calibPoints[0].y;
    const px = Math.sqrt(dx*dx + dy*dy);
    return px / refMm;
  }, [calibPoints, refMm]);

  // 측정 결과 (mm)
  const measureMm = useMemo(() => {
    if (measurePoints.length !== 2 || !pxPerMm) return null;
    const dx = measurePoints[1].x - measurePoints[0].x;
    const dy = measurePoints[1].y - measurePoints[0].y;
    const px = Math.sqrt(dx*dx + dy*dy);
    return px / pxPerMm;
  }, [measurePoints, pxPerMm]);

  // 캘리브레이션 완료 시 자동으로 측정 모드 전환
  useEffect(() => {
    if (mode === "calib" && calibPoints.length === 2 && pxPerMm) {
      const t = setTimeout(() => setMode("measure"), 600);
      return () => clearTimeout(t);
    }
  }, [calibPoints, pxPerMm, mode]);

  // 📷 카메라 시작
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("이 브라우저는 카메라를 지원하지 않습니다");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setLoading(false);
      } catch (e) {
        let msg = e.message || "카메라 접근 실패";
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          msg = "카메라 권한을 허용해주세요";
        } else if (e.name === "NotFoundError") {
          msg = "카메라를 찾을 수 없습니다";
        }
        setError(msg);
        setLoading(false);
      }
    }
    start();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  // viewport zoom 잠금
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    const original = viewport.getAttribute("content") || "width=device-width, initial-scale=1.0";
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    );
    return () => {
      viewport.setAttribute("content", original);
      requestAnimationFrame(() => {
        document.body.style.transform = "translateZ(0)";
        requestAnimationFrame(() => { document.body.style.transform = ""; });
      });
    };
  }, []);

  // 영상 영역 탭 핸들러
  const handleTap = (e) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    let clientX, clientY;
    if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    const point = { x, y };

    if (mode === "calib") {
      if (calibPoints.length < 2) {
        setCalibPoints([...calibPoints, point]);
      } else {
        setCalibPoints([point]); // 다시 시작
      }
    } else {
      if (measurePoints.length < 2) {
        setMeasurePoints([...measurePoints, point]);
      } else {
        setMeasurePoints([point]);
      }
    }
  };

  const resetAll = () => {
    setCalibPoints([]);
    setMeasurePoints([]);
    setMode("calib");
  };

  const points = mode === "calib" ? calibPoints : measurePoints;
  const color = mode === "calib" ? "#fbbf24" : "#dc2626";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "#000",
      overflow: "hidden",
      fontFamily: FONT_GOTHIC,
      display: "flex", flexDirection: "column",
    }}>
      {/* 상단 도구바 */}
      <div style={{
        flexShrink: 0,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        padding: "10px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(251,191,36,0.2)",
      }}>
        <button onClick={onBack}
          style={{
            background: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.3)",
            color: "#fafaf9", fontSize: 11, fontWeight: 600,
            padding: "6px 12px", borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
            touchAction: "manipulation",
          }}>
          <span style={{ color: "#fbbf24" }}>←</span> 도구
        </button>
        <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>
          📏 AR DISTANCE
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={resetAll} title="처음부터"
            style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              color: "#fafaf9", fontSize: 14,
              padding: "4px 8px", borderRadius: 8, cursor: "pointer",
              touchAction: "manipulation",
            }}>↻</button>
          <button onClick={() => setFacingMode(f => f === "environment" ? "user" : "environment")} title="카메라 전환"
            style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              color: "#fafaf9", fontSize: 14,
              padding: "4px 8px", borderRadius: 8, cursor: "pointer",
              touchAction: "manipulation",
            }}>🔄</button>
        </div>
      </div>

      {/* 비디오 + 오버레이 (탭 영역) */}
      <div ref={overlayRef}
        onClick={handleTap}
        onTouchEnd={(e) => { e.preventDefault(); handleTap(e); }}
        style={{
          flex: 1, position: "relative",
          background: "#000",
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "crosshair",
          touchAction: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}>
        <video ref={videoRef} playsInline muted autoPlay
          style={{
            maxWidth: "100%", maxHeight: "100%",
            objectFit: "contain",
            display: error ? "none" : "block",
            pointerEvents: "none",
          }} />

        {/* 점 + 선 SVG 오버레이 */}
        {!error && !loading && (
          <svg style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            pointerEvents: "none",
          }}>
            {points.length === 2 && (
              <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y}
                stroke={color} strokeWidth="3" strokeDasharray="6 4"
                opacity="0.95" />
            )}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="16" fill={color} stroke="#fff" strokeWidth="2.5" opacity="0.95" />
                <text x={p.x} y={p.y + 4} fill="#fff" fontSize="13" fontWeight="800"
                  textAnchor="middle" fontFamily={FONT_MONO}>
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* 로딩 */}
        {loading && !error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12,
            background: "#0a0a0a",
          }}>
            <div style={{ fontSize: 48, opacity: 0.5 }}>📷</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#fbbf24", letterSpacing: "0.3em" }}>
              CAMERA STARTING...
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 14, padding: 24, textAlign: "center",
          }}>
            <div style={{ fontSize: 40, opacity: 0.6 }}>⚠️</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#dc2626", letterSpacing: "0.3em", fontWeight: 700 }}>
              CAMERA ERROR
            </div>
            <div style={{ fontSize: 13, color: "#fafaf9", lineHeight: 1.6, maxWidth: 320 }}>
              {error}
            </div>
          </div>
        )}

        {/* 안내 텍스트 (점 부족) */}
        {!error && !loading && points.length < 2 && (
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.75)", color: "#fafaf9",
            padding: "7px 14px", borderRadius: 8,
            fontSize: 11, fontFamily: FONT_MONO, letterSpacing: "0.1em",
            border: `1px solid ${color}66`,
            pointerEvents: "none",
          }}>
            {mode === "calib"
              ? `기준 객체 양 끝점 탭 (${points.length}/2)`
              : `측정 대상 양 끝점 탭 (${points.length}/2)`}
          </div>
        )}

        {/* 측정 결과 (상단) */}
        {mode === "measure" && measureMm !== null && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            background: "rgba(220,38,38,0.92)", color: "#fff",
            padding: "10px 20px", borderRadius: 10,
            fontFamily: FONT_MONO, fontSize: 24, fontWeight: 900,
            letterSpacing: "0.08em",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}>
            {formatDistance(measureMm)}
          </div>
        )}

        {/* 캘리브레이션 완료 표시 (상단) */}
        {mode === "calib" && pxPerMm && calibPoints.length === 2 && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            background: "rgba(251,191,36,0.92)", color: "#0a0a0a",
            padding: "8px 16px", borderRadius: 10,
            fontFamily: FONT_MONO, fontSize: 13, fontWeight: 900,
            letterSpacing: "0.1em",
            pointerEvents: "none",
          }}>
            ✓ 캘리브레이션 완료 ({refMm}mm)
          </div>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div style={{
        flexShrink: 0,
        background: "#0a0a0a",
        padding: "10px 14px 12px",
        borderTop: "1px solid #1a1a1a",
        maxHeight: "45vh", overflowY: "auto",
      }}>
        {/* 모드 토글 */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          <button onClick={() => setMode("calib")}
            style={{
              flex: 1, padding: "10px 4px", minHeight: 42,
              background: mode === "calib" ? "#fbbf24" : "#1a1a1a",
              border: `1px solid ${mode === "calib" ? "#fbbf24" : "#2a2a2a"}`,
              color: mode === "calib" ? "#0a0a0a" : "#a8a29e",
              fontSize: 11, fontWeight: mode === "calib" ? 800 : 700,
              borderRadius: 6, cursor: "pointer",
              fontFamily: FONT_MONO, letterSpacing: "0.08em",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
            }}>
            🎯 캘리브레이션
          </button>
          <button onClick={() => setMode("measure")} disabled={!pxPerMm}
            style={{
              flex: 1, padding: "10px 4px", minHeight: 42,
              background: mode === "measure" ? "#dc2626" : "#1a1a1a",
              border: `1px solid ${mode === "measure" ? "#dc2626" : "#2a2a2a"}`,
              color: mode === "measure" ? "#fff" : (!pxPerMm ? "#444" : "#a8a29e"),
              fontSize: 11, fontWeight: mode === "measure" ? 800 : 700,
              borderRadius: 6,
              cursor: !pxPerMm ? "not-allowed" : "pointer",
              opacity: !pxPerMm ? 0.5 : 1,
              fontFamily: FONT_MONO, letterSpacing: "0.08em",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "rgba(220,38,38,0.3)",
            }}>
            📏 측정 {!pxPerMm && "🔒"}
          </button>
        </div>

        {/* 캘리브레이션 모드: 기준 객체 */}
        {mode === "calib" && (
          <div>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 9, color: "#71706b",
              letterSpacing: "0.25em", fontWeight: 700, marginBottom: 6,
            }}>
              기준 객체 (REFERENCE)
            </div>
            <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4, marginBottom: 6, WebkitOverflowScrolling: "touch" }}>
              {REFERENCE_OBJECTS.map((ref, i) => {
                const active = !useCustom && refIdx === i;
                return (
                  <button key={ref.key} onClick={() => { setRefIdx(i); setUseCustom(false); setCalibPoints([]); }}
                    style={{
                      padding: "7px 10px",
                      background: active ? "#fbbf24" : "#1a1a1a",
                      color: active ? "#0a0a0a" : "#a8a29e",
                      border: `1px solid ${active ? "#fbbf24" : "#2a2a2a"}`,
                      borderRadius: 5,
                      fontSize: 10, fontWeight: active ? 800 : 700,
                      whiteSpace: "nowrap", flexShrink: 0,
                      fontFamily: FONT_MONO,
                      cursor: "pointer", minHeight: 32,
                      touchAction: "manipulation",
                      WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
                    }}>
                    {ref.label} ({ref.mm}mm)
                  </button>
                );
              })}
              <button onClick={() => { setUseCustom(true); setCalibPoints([]); }}
                style={{
                  padding: "7px 10px",
                  background: useCustom ? "#fbbf24" : "#1a1a1a",
                  color: useCustom ? "#0a0a0a" : "#a8a29e",
                  border: `1px solid ${useCustom ? "#fbbf24" : "#2a2a2a"}`,
                  borderRadius: 5,
                  fontSize: 10, fontWeight: useCustom ? 800 : 700,
                  whiteSpace: "nowrap", flexShrink: 0,
                  fontFamily: FONT_MONO,
                  cursor: "pointer", minHeight: 32,
                  touchAction: "manipulation",
                }}>
                직접 입력
              </button>
            </div>
            {useCustom && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input type="number" inputMode="decimal" value={customMm}
                  onChange={e => { setCustomMm(Number(e.target.value) || 0); setCalibPoints([]); }}
                  style={{
                    flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a",
                    color: "#fafaf9", padding: "8px 10px", borderRadius: 5,
                    fontFamily: FONT_MONO, fontSize: 14,
                    outline: "none",
                  }} />
                <span style={{ color: "#a8a29e", fontFamily: FONT_MONO, fontSize: 11 }}>mm</span>
              </div>
            )}
            <div style={{ fontSize: 10.5, color: "#a8a29e", fontFamily: FONT_MONO, letterSpacing: "0.05em" }}>
              현재 기준: <strong style={{ color: "#fbbf24" }}>{refMm}mm</strong>
              {pxPerMm && (
                <> · <span style={{ color: "#71706b" }}>비율: {pxPerMm.toFixed(2)} px/mm</span></>
              )}
            </div>
          </div>
        )}

        {/* 측정 모드: 결과 표시 */}
        {mode === "measure" && (
          <div>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 9, color: "#71706b",
              letterSpacing: "0.25em", fontWeight: 700, marginBottom: 6,
            }}>
              측정 결과 (MEASUREMENT)
            </div>
            {!pxPerMm && (
              <div style={{
                fontSize: 11, color: "#ef4444",
                padding: 8, background: "rgba(220,38,38,0.1)",
                border: "1px solid rgba(220,38,38,0.3)", borderRadius: 5,
              }}>
                ⚠ 먼저 캘리브레이션을 해주세요
              </div>
            )}
            {pxPerMm && measureMm !== null && (
              <div style={{
                background: "#000", padding: "12px 14px",
                borderRadius: 6, border: "1px solid #2a2a2a",
                borderLeft: "3px solid #dc2626",
                textAlign: "center",
              }}>
                <div style={{
                  fontFamily: FONT_MONO, fontSize: 32, fontWeight: 900,
                  color: "#dc2626", letterSpacing: "0.05em", lineHeight: 1,
                  textShadow: "0 0 18px rgba(220,38,38,0.5)",
                }}>
                  {formatDistance(measureMm)}
                </div>
                <div style={{ fontSize: 10, color: "#71706b", marginTop: 6, fontFamily: FONT_MONO, letterSpacing: "0.1em" }}>
                  기준: {refMm}mm · 비율 {pxPerMm.toFixed(2)} px/mm
                </div>
              </div>
            )}
            {pxPerMm && measureMm === null && (
              <div style={{ fontSize: 11, color: "#a8a29e", textAlign: "center", padding: 8, fontFamily: FONT_MONO }}>
                영상에서 두 점을 탭하세요
              </div>
            )}
          </div>
        )}

        {/* 가이드 */}
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: "#16130d",
          border: "1px dashed #fbbf24",
          borderRadius: 5,
          fontSize: 10, color: "#d6d3d1", lineHeight: 1.6,
        }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 8, color: "#fbbf24",
            letterSpacing: "0.25em", fontWeight: 700, marginBottom: 3,
          }}>
            💡 정확도 팁
          </div>
          기준 객체와 측정 대상을 <strong style={{ color: "#fafaf9" }}>같은 평면</strong>에 두고<br/>
          카메라를 <strong style={{ color: "#fafaf9" }}>위에서 수직</strong>으로 비춰주세요
        </div>
      </div>
    </div>
  );
}
