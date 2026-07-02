import { useState, useEffect, useRef, useMemo } from "react";

/**
 * 📏 AR 거리 측정기 (4점 호모그래피 방식)
 *
 * 정확도 핵심:
 * - 직사각형 기준 객체의 4 모서리 → 호모그래피 행렬 H 계산
 * - 측정점을 H로 변환 → 실제 평면(mm) 좌표 → 원근 왜곡 보정된 거리
 * - 점 드래그로 정밀 조정 가능
 *
 * 한계: 측정 대상이 기준 객체와 같은 평면에 있어야 함 (물리적 제약)
 */

const FONT_MONO   = "'Courier New', ui-monospace, monospace";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

// 직사각형 기준 객체 (가로 w, 세로 h, mm)
const REFERENCE_RECTS = [
  { key: "creditcard",  label: "신용카드",  w: 85.6, h: 54.0 },
  { key: "businesscard",label: "명함",      w: 90,   h: 50 },
  { key: "a4",          label: "A4 (세로)", w: 210,  h: 297 },
  { key: "a5",          label: "A5 (세로)", w: 148,  h: 210 },
];

function formatDistance(mm) {
  if (mm == null || !isFinite(mm)) return "—";
  if (mm < 10)   return `${mm.toFixed(1)} mm`;
  if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
  return `${(mm / 1000).toFixed(2)} m`;
}

// ── 8x8 선형 시스템 (가우스 소거) ──
function solve8x8(A, b) {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    if (Math.abs(M[maxRow][col]) < 1e-12) return null; // singular
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let r = 0; r < n; r++) {
      if (r !== col) {
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// ── 4점 대응 호모그래피 행렬 ──
function computeHomography(src, dst) {
  if (src.length !== 4 || dst.length !== 4) return null;
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const x = src[i].x, y = src[i].y;
    const X = dst[i].x, Y = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -x*X, -y*X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x*Y, -y*Y]); b.push(Y);
  }
  const h = solve8x8(A, b);
  if (!h) return null;
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
}

function applyHomography(H, pt) {
  const x = pt.x, y = pt.y;
  const denom = H[2][0]*x + H[2][1]*y + H[2][2];
  return {
    x: (H[0][0]*x + H[0][1]*y + H[0][2]) / denom,
    y: (H[1][0]*x + H[1][1]*y + H[1][2]) / denom,
  };
}

export default function ARDistance({ onBack }) {
  const videoRef   = useRef(null);
  const overlayRef = useRef(null);
  const streamRef  = useRef(null);

  const [mode, setMode] = useState("calib"); // calib | measure
  const [facingMode, setFacingMode] = useState("environment");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // 기준 직사각형
  const [refIdx, setRefIdx] = useState(0);
  const [refW, setRefW] = useState(REFERENCE_RECTS[0].w);
  const [refH, setRefH] = useState(REFERENCE_RECTS[0].h);

  // 점들 (오버레이 픽셀 좌표)
  const [calibCorners, setCalibCorners] = useState([]); // 최대 4
  const [measurePoints, setMeasurePoints] = useState([]); // 최대 2
  const [dragging, setDragging] = useState(null); // 드래그 중인 점 인덱스

  // 호모그래피 (화면 → 실제 평면 mm)
  const homography = useMemo(() => {
    if (calibCorners.length !== 4) return null;
    const dst = [
      { x: 0,    y: 0 },     // ① 좌상
      { x: refW, y: 0 },     // ② 우상
      { x: refW, y: refH },  // ③ 우하
      { x: 0,    y: refH },  // ④ 좌하
    ];
    return computeHomography(calibCorners, dst);
  }, [calibCorners, refW, refH]);

  // 측정 결과 (mm) - 호모그래피로 변환 후 거리
  const measureMm = useMemo(() => {
    if (measurePoints.length !== 2 || !homography) return null;
    const a = applyHomography(homography, measurePoints[0]);
    const b = applyHomography(homography, measurePoints[1]);
    const dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx*dx + dy*dy);
  }, [measurePoints, homography]);

  // 캘리브레이션 완료 시 자동 측정 모드
  useEffect(() => {
    if (mode === "calib" && calibCorners.length === 4 && homography) {
      const t = setTimeout(() => setMode("measure"), 700);
      return () => clearTimeout(t);
    }
  }, [calibCorners, homography, mode]);

  // 📷 카메라
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("카메라를 지원하지 않습니다");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setLoading(false);
      } catch (e) {
        let msg = e.message || "카메라 접근 실패";
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") msg = "카메라 권한을 허용해주세요";
        else if (e.name === "NotFoundError") msg = "카메라를 찾을 수 없습니다";
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
    const vp = document.querySelector('meta[name="viewport"]');
    if (!vp) return;
    const original = vp.getAttribute("content") || "width=device-width, initial-scale=1.0";
    vp.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
    return () => {
      vp.setAttribute("content", original);
      requestAnimationFrame(() => {
        document.body.style.transform = "translateZ(0)";
        requestAnimationFrame(() => { document.body.style.transform = ""; });
      });
    };
  }, []);

  const getPos = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    if (error || loading) return;
    const pos = getPos(e);
    const points = mode === "calib" ? calibCorners : measurePoints;
    const maxPoints = mode === "calib" ? 4 : 2;

    // 기존 점 근처면 드래그
    let nearIdx = -1, minD = 32;
    points.forEach((p, i) => {
      const d = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (d < minD) { minD = d; nearIdx = i; }
    });

    if (nearIdx >= 0) {
      setDragging(nearIdx);
    } else if (points.length < maxPoints) {
      if (mode === "calib") setCalibCorners([...calibCorners, pos]);
      else setMeasurePoints([...measurePoints, pos]);
      setDragging(points.length);
    }
  };

  const handlePointerMove = (e) => {
    if (dragging === null) return;
    const pos = getPos(e);
    if (mode === "calib") {
      setCalibCorners(prev => prev.map((p, i) => i === dragging ? pos : p));
    } else {
      setMeasurePoints(prev => prev.map((p, i) => i === dragging ? pos : p));
    }
  };

  const handlePointerUp = () => setDragging(null);

  const resetAll = () => {
    setCalibCorners([]);
    setMeasurePoints([]);
    setMode("calib");
  };

  const clearCurrent = () => {
    if (mode === "calib") setCalibCorners([]);
    else setMeasurePoints([]);
  };

  const selectRef = (i) => {
    setRefIdx(i);
    setRefW(REFERENCE_RECTS[i].w);
    setRefH(REFERENCE_RECTS[i].h);
    setCalibCorners([]);
  };

  const points = mode === "calib" ? calibCorners : measurePoints;
  const color = mode === "calib" ? "#fbbf24" : "#dc2626";
  const CORNER_LABELS = ["좌상", "우상", "우하", "좌하"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "#000", overflow: "hidden",
      fontFamily: FONT_GOTHIC,
      display: "flex", flexDirection: "column",
    }}>
      {/* 상단 도구바 */}
      <div style={{
        flexShrink: 0,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        padding: "calc(10px + env(safe-area-inset-top, 0px)) 14px 10px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(251,191,36,0.2)",
      }}>
        <button onClick={onBack}
          style={{
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
            color: "#fafaf9", fontSize: 11, fontWeight: 600,
            padding: "6px 12px", borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            touchAction: "manipulation",
          }}>
          <span style={{ color: "#fbbf24" }}>←</span> 도구
        </button>
        <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", fontFamily: FONT_MONO }}>
          📏 AR DISTANCE
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={clearCurrent} title="현재 점 지우기"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fafaf9", fontSize: 13, padding: "4px 8px", borderRadius: 8, cursor: "pointer", touchAction: "manipulation" }}>
            ⌫
          </button>
          <button onClick={() => setFacingMode(f => f === "environment" ? "user" : "environment")} title="카메라 전환"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fafaf9", fontSize: 14, padding: "4px 8px", borderRadius: 8, cursor: "pointer", touchAction: "manipulation" }}>
            🔄
          </button>
        </div>
      </div>

      {/* 비디오 + 오버레이 */}
      <div ref={overlayRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          flex: 1, position: "relative", background: "#000", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "crosshair", touchAction: "none", userSelect: "none",
        }}>
        <video ref={videoRef} playsInline muted autoPlay
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: error ? "none" : "block", pointerEvents: "none" }} />

        {/* SVG 오버레이 */}
        {!error && !loading && (
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {/* 캘리브레이션 사각형 */}
            {mode === "calib" && calibCorners.length >= 2 && (
              <polygon
                points={calibCorners.map(p => `${p.x},${p.y}`).join(" ")}
                fill={calibCorners.length === 4 ? "rgba(251,191,36,0.15)" : "none"}
                stroke="#fbbf24" strokeWidth="2" strokeDasharray={calibCorners.length === 4 ? "none" : "5 4"}
              />
            )}
            {/* 측정 선 */}
            {mode === "measure" && measurePoints.length === 2 && (
              <line x1={measurePoints[0].x} y1={measurePoints[0].y} x2={measurePoints[1].x} y2={measurePoints[1].y}
                stroke="#dc2626" strokeWidth="3" strokeDasharray="6 4" />
            )}
            {/* 점 */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="9" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
                <circle cx={p.x} cy={p.y} r="16" fill={color} stroke="#fff" strokeWidth="2.5" opacity="0.95" />
                <text x={p.x} y={p.y + 4} fill="#fff" fontSize="13" fontWeight="800" textAnchor="middle" fontFamily={FONT_MONO}>
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* 로딩 */}
        {loading && !error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, background: "#0a0a0a" }}>
            <div style={{ fontSize: 48, opacity: 0.5 }}>📷</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#fbbf24", letterSpacing: "0.3em" }}>CAMERA STARTING...</div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 40, opacity: 0.6 }}>⚠️</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#dc2626", letterSpacing: "0.3em", fontWeight: 700 }}>CAMERA ERROR</div>
            <div style={{ fontSize: 13, color: "#fafaf9", lineHeight: 1.6, maxWidth: 320 }}>{error}</div>
          </div>
        )}

        {/* 안내 텍스트 */}
        {!error && !loading && (
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.78)", color: "#fafaf9",
            padding: "8px 14px", borderRadius: 8,
            fontSize: 11, fontFamily: FONT_MONO, letterSpacing: "0.05em",
            border: `1px solid ${color}66`, pointerEvents: "none",
            textAlign: "center", maxWidth: "90%",
          }}>
            {mode === "calib" ? (
              calibCorners.length < 4
                ? `기준 사각형 ${CORNER_LABELS[calibCorners.length]} 모서리 탭 (${calibCorners.length}/4)`
                : "✓ 점을 드래그해 정밀 조정 가능"
            ) : (
              measurePoints.length < 2
                ? `측정할 ${measurePoints.length === 0 ? "시작" : "끝"}점 탭 (${measurePoints.length}/2)`
                : "✓ 점을 드래그해 조정 가능"
            )}
          </div>
        )}

        {/* 측정 결과 배지 */}
        {mode === "measure" && measureMm !== null && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            background: "rgba(220,38,38,0.92)", color: "#fff",
            padding: "10px 20px", borderRadius: 10,
            fontFamily: FONT_MONO, fontSize: 26, fontWeight: 900, letterSpacing: "0.08em",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)", pointerEvents: "none",
          }}>
            {formatDistance(measureMm)}
          </div>
        )}

        {/* 캘리브레이션 완료 배지 */}
        {mode === "calib" && homography && calibCorners.length === 4 && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            background: "rgba(251,191,36,0.92)", color: "#0a0a0a",
            padding: "8px 16px", borderRadius: 10,
            fontFamily: FONT_MONO, fontSize: 12, fontWeight: 900, letterSpacing: "0.1em",
            pointerEvents: "none",
          }}>
            ✓ 캘리브레이션 완료 ({refW}×{refH}mm)
          </div>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div style={{
        flexShrink: 0, background: "#0a0a0a",
        padding: "10px 14px 12px", borderTop: "1px solid #1a1a1a",
        maxHeight: "46vh", overflowY: "auto",
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
              borderRadius: 6, cursor: "pointer", fontFamily: FONT_MONO, letterSpacing: "0.08em",
              touchAction: "manipulation",
            }}>
            🎯 캘리브레이션 ({calibCorners.length}/4)
          </button>
          <button onClick={() => setMode("measure")} disabled={!homography}
            style={{
              flex: 1, padding: "10px 4px", minHeight: 42,
              background: mode === "measure" ? "#dc2626" : "#1a1a1a",
              border: `1px solid ${mode === "measure" ? "#dc2626" : "#2a2a2a"}`,
              color: mode === "measure" ? "#fff" : (!homography ? "#444" : "#a8a29e"),
              fontSize: 11, fontWeight: mode === "measure" ? 800 : 700,
              borderRadius: 6, cursor: !homography ? "not-allowed" : "pointer",
              opacity: !homography ? 0.5 : 1, fontFamily: FONT_MONO, letterSpacing: "0.08em",
              touchAction: "manipulation",
            }}>
            📏 측정 {!homography && "🔒"}
          </button>
        </div>

        {/* 캘리브레이션 모드 */}
        {mode === "calib" && (
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#71706b", letterSpacing: "0.25em", fontWeight: 700, marginBottom: 6 }}>
              기준 직사각형 (REFERENCE)
            </div>
            <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4, marginBottom: 8, WebkitOverflowScrolling: "touch" }}>
              {REFERENCE_RECTS.map((ref, i) => {
                const active = refIdx === i;
                return (
                  <button key={ref.key} onClick={() => selectRef(i)}
                    style={{
                      padding: "7px 10px",
                      background: active ? "#fbbf24" : "#1a1a1a",
                      color: active ? "#0a0a0a" : "#a8a29e",
                      border: `1px solid ${active ? "#fbbf24" : "#2a2a2a"}`,
                      borderRadius: 5, fontSize: 10, fontWeight: active ? 800 : 700,
                      whiteSpace: "nowrap", flexShrink: 0, fontFamily: FONT_MONO,
                      cursor: "pointer", minHeight: 32, touchAction: "manipulation",
                    }}>
                    {ref.label}
                  </button>
                );
              })}
            </div>
            {/* W x H 입력 */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#71706b" }}>가로 W</span>
                <input type="number" inputMode="decimal" value={refW}
                  onChange={e => { setRefW(Number(e.target.value) || 0); }}
                  style={{ width: "100%", minWidth: 0, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fafaf9", padding: "6px 8px", borderRadius: 5, fontFamily: FONT_MONO, fontSize: 13, outline: "none" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#71706b" }}>세로 H</span>
                <input type="number" inputMode="decimal" value={refH}
                  onChange={e => { setRefH(Number(e.target.value) || 0); }}
                  style={{ width: "100%", minWidth: 0, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fafaf9", padding: "6px 8px", borderRadius: 5, fontFamily: FONT_MONO, fontSize: 13, outline: "none" }} />
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#a8a29e" }}>mm</span>
            </div>
            <div style={{ fontSize: 10.5, color: "#a8a29e", fontFamily: FONT_MONO, letterSpacing: "0.05em" }}>
              <strong style={{ color: "#fbbf24" }}>①좌상 → ②우상 → ③우하 → ④좌하</strong> 순서로 탭
            </div>
          </div>
        )}

        {/* 측정 모드 */}
        {mode === "measure" && (
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#71706b", letterSpacing: "0.25em", fontWeight: 700, marginBottom: 6 }}>
              측정 결과 (MEASUREMENT)
            </div>
            {!homography && (
              <div style={{ fontSize: 11, color: "#ef4444", padding: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 5 }}>
                ⚠ 먼저 캘리브레이션(4점)을 완료해주세요
              </div>
            )}
            {homography && measureMm !== null && (
              <div style={{ background: "#000", padding: "12px 14px", borderRadius: 6, border: "1px solid #2a2a2a", borderLeft: "3px solid #dc2626", textAlign: "center" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 32, fontWeight: 900, color: "#dc2626", letterSpacing: "0.05em", lineHeight: 1, textShadow: "0 0 18px rgba(220,38,38,0.5)" }}>
                  {formatDistance(measureMm)}
                </div>
                <div style={{ fontSize: 10, color: "#71706b", marginTop: 6, fontFamily: FONT_MONO, letterSpacing: "0.1em" }}>
                  기준 {refW}×{refH}mm · 원근 보정됨
                </div>
              </div>
            )}
            {homography && measureMm === null && (
              <div style={{ fontSize: 11, color: "#a8a29e", textAlign: "center", padding: 8, fontFamily: FONT_MONO }}>
                영상에서 두 점을 탭하세요
              </div>
            )}
          </div>
        )}

        {/* 가이드 */}
        <div style={{ marginTop: 8, padding: "8px 10px", background: "#16130d", border: "1px dashed #fbbf24", borderRadius: 5, fontSize: 10, color: "#d6d3d1", lineHeight: 1.6 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#fbbf24", letterSpacing: "0.25em", fontWeight: 700, marginBottom: 3 }}>💡 정확도 팁</div>
          신용카드 등 <strong style={{ color: "#fafaf9" }}>직사각형을 측정 대상 옆 같은 평면</strong>에 놓고<br/>
          네 모서리를 탭 → <strong style={{ color: "#fafaf9" }}>점을 드래그해 정확히 맞추세요</strong><br/>
          <span style={{ color: "#71706b" }}>원근 왜곡이 보정되어 비스듬해도 정확합니다</span>
        </div>
      </div>
    </div>
  );
}
