import { useState, useEffect, useRef } from "react";

/**
 * 🎥 LIVE 노출 도우미
 *
 * 기능:
 * - 카메라 라이브 영상 + 픽셀별 노출 시각화
 * - 폴스컬러 (사용자 정의 기준):
 *   0-10%:    보라/핑크 (암부 디테일 손실)
 *   10-18%:   파랑 (어두운 영역)
 *   18-38%:   회색조 (그림자 디테일)
 *   38-50%:   초록 (18% 표준 회색)
 *   50-60%:   회색조 (중간 영역)
 *   60-70%:   핑크 (밝은 피부톤)
 *   70-90%:   노랑/주황 (강한 하이라이트)
 *   90-100%:  빨강 (클리핑)
 * - 제브라 (95% 클리핑 경고)
 * - 히스토그램 오버레이
 * - 전후 카메라 전환
 */

const FONT_MONO   = "'Courier New', ui-monospace, monospace";
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', sans-serif";

// 사용자 정의 폴스컬러 매핑
function falseColorMap(ire, luma) {
  if (ire < 10)  return { r: 180, g: 60,  b: 220 };  // 보라/핑크: 0-10%
  if (ire < 18)  return { r: 40,  g: 100, b: 240 };  // 파랑: 10-18%
  if (ire < 38)  return { r: luma, g: luma, b: luma }; // 회색조: 18-38%
  if (ire <= 50) return { r: 40,  g: 220, b: 80 };   // 초록: 38-50%
  if (ire < 60)  return { r: luma, g: luma, b: luma }; // 회색조: 50-60%
  if (ire <= 70) return { r: 255, g: 140, b: 200 };  // 핑크: 60-70%
  if (ire < 90)  return { r: 255, g: 180, b: 0 };    // 노랑/주황: 70-90%
  return { r: 255, g: 0, b: 0 };                      // 빨강: 90-100%
}

// 폴스컬러 범례 (UI 표시용)
const FC_LEGEND = [
  { range: "90-100%", color: "rgb(255,0,0)",     label: "CLIP",   desc: "과다 노출" },
  { range: "70-90%",  color: "rgb(255,180,0)",   label: "70-90",  desc: "하이라이트" },
  { range: "60-70%",  color: "rgb(255,140,200)", label: "SKIN",   desc: "밝은 피부톤" },
  { range: "38-50%",  color: "rgb(40,220,80)",   label: "18% GREY", desc: "표준 회색" },
  { range: "10-18%",  color: "rgb(40,100,240)",  label: "10-18",  desc: "어두운 영역" },
  { range: "0-10%",   color: "rgb(180,60,220)",  label: "CRUSH",  desc: "암부 손실" },
];

export default function ExposureLive({ onBack }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);

  const [mode, setMode] = useState("falsecolor"); // off | falsecolor | zebra
  const [zebraThreshold, setZebraThreshold] = useState(95);
  const [showHistogram, setShowHistogram] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [facingMode, setFacingMode] = useState("environment"); // user | environment
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [histogram, setHistogram] = useState(new Array(48).fill(0));

  // 모드 등을 ref로 (frame 루프에서 최신 값 참조)
  const modeRef       = useRef(mode);
  const zebraRef      = useRef(zebraThreshold);
  const histEnableRef = useRef(showHistogram);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { zebraRef.current = zebraThreshold; }, [zebraThreshold]);
  useEffect(() => { histEnableRef.current = showHistogram; }, [showHistogram]);

  // 📷 카메라 시작 / 전환 시 재시작
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          const md = navigator.mediaDevices;
          const diag =
            `proto=${location.protocol} · host=${location.host || "-"} · ` +
            `secure=${window.isSecureContext} · ` +
            `mediaDevices=${typeof md} · ` +
            `getUserMedia=${md ? typeof md.getUserMedia : "-"} · ` +
            `legacyGUM=${typeof navigator.getUserMedia}`;
          throw new Error("이 브라우저는 카메라를 지원하지 않습니다\n\n[진단] " + diag);
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
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
        console.error("카메라 에러:", e);
        let msg = e.message || "카메라 접근 실패";
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          msg = "카메라 권한이 거부됐어요. 브라우저 설정에서 카메라 권한을 허용해주세요.";
        } else if (e.name === "NotFoundError") {
          msg = "사용 가능한 카메라가 없습니다.";
        } else if (e.name === "NotReadableError") {
          msg = "다른 앱이 카메라를 사용 중일 수 있어요.";
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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [facingMode]);

  // 🎨 매 프레임 처리 루프 (UI 반응성을 위해 30fps로 제한)
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let lastProcessTs = 0;
    let lastHistUpdate = 0;
    const FRAME_INTERVAL = 33; // ~30fps (1000/30)

    function processFrame(ts) {
      if (video.videoWidth === 0 || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // 처리 빈도 제한 (UI thread 여유)
      if (ts - lastProcessTs < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastProcessTs = ts;

      // 다운스케일 (모바일 성능)
      const aspect = video.videoWidth / video.videoHeight;
      const W = 400;
      const H = Math.round(W / aspect);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      // 비디오 프레임 그리기
      ctx.drawImage(video, 0, 0, W, H);

      const m = modeRef.current;
      const needsProcessing = m === "falsecolor" || m === "zebra" || histEnableRef.current;

      if (needsProcessing) {
        const imageData = ctx.getImageData(0, 0, W, H);
        const data = imageData.data;
        const hist = histEnableRef.current ? new Array(48).fill(0) : null;
        const zebraT = zebraRef.current;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Rec.709 luma
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const ire = (luma / 255) * 100;

          if (hist) {
            const bucket = Math.min(47, Math.floor((luma / 255) * 48));
            hist[bucket]++;
          }

          if (m === "falsecolor") {
            const fc = falseColorMap(ire, Math.round(luma));
            data[i]     = fc.r;
            data[i + 1] = fc.g;
            data[i + 2] = fc.b;
          } else if (m === "zebra") {
            if (ire > zebraT) {
              const idx = i / 4;
              const x = idx % W;
              const y = (idx - x) / W;
              if ((x + y) % 14 < 7) {
                data[i]     = 255;
                data[i + 1] = 230;
                data[i + 2] = 0;
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // 히스토그램 업데이트 (200ms마다만, setState 비용 절약)
        if (hist && ts - lastHistUpdate > 200) {
          setHistogram(hist);
          lastHistUpdate = ts;
        }
      }

      rafRef.current = requestAnimationFrame(processFrame);
    }

    rafRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // viewport zoom 잠금 (슬레이터처럼)
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
        requestAnimationFrame(() => {
          document.body.style.transform = "";
        });
      });
    };
  }, []);

  // 히스토그램 정규화
  const maxHist = Math.max(1, ...histogram);
  const histPath = histogram.map((v, i) => {
    const x = (i / histogram.length) * 100;
    const y = 100 - (v / maxHist) * 100;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ") + " L 100 100 L 0 100 Z";

  // 모드 카드
  const ModeBtn = ({ value, icon, label }) => (
    <button onClick={() => setMode(value)}
      style={{
        flex: 1, padding: "12px 4px",
        minHeight: 46,
        background: mode === value ? "#fbbf24" : "#1a1a1a",
        border: `1px solid ${mode === value ? "#fbbf24" : "#2a2a2a"}`,
        color: mode === value ? "#0a0a0a" : "#a8a29e",
        fontSize: 11, fontWeight: mode === value ? 800 : 700,
        borderRadius: 6, cursor: "pointer",
        fontFamily: FONT_MONO, letterSpacing: "0.08em",
        whiteSpace: "nowrap", overflow: "hidden",
        WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
        touchAction: "manipulation",
        userSelect: "none",
      }}>
      {icon} {label}
    </button>
  );

  const OptionBtn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{
        flex: 1, padding: "10px 4px",
        minHeight: 38,
        background: "#1a1a1a",
        border: `1px solid ${active ? "#fbbf24" : "#2a2a2a"}`,
        color: active ? "#fbbf24" : "#a8a29e",
        fontSize: 10, fontWeight: 700,
        borderRadius: 6, cursor: "pointer",
        fontFamily: FONT_MONO, letterSpacing: "0.08em",
        whiteSpace: "nowrap",
        WebkitTapHighlightColor: "rgba(251,191,36,0.3)",
        touchAction: "manipulation",
        userSelect: "none",
      }}>
      {children}
    </button>
  );

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
          }}>
          <span style={{ color: "#fbbf24" }}>←</span> 도구
        </button>
        <span style={{
          color: "#fbbf24", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.2em", fontFamily: FONT_MONO,
        }}>
          🎥 LIVE EXPOSURE
        </span>
        <button onClick={() => setFacingMode(f => f === "environment" ? "user" : "environment")}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fafaf9", fontSize: 14,
            padding: "4px 9px", borderRadius: 8, cursor: "pointer",
          }}
          title="카메라 전환">
          🔄
        </button>
      </div>

      {/* 비디오 + 캔버스 영역 */}
      <div style={{
        flex: 1, position: "relative",
        background: "#000",
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* hidden video (stream 소스) */}
        <video ref={videoRef}
          playsInline muted autoPlay
          style={{ display: "none" }} />

        {/* 출력 canvas */}
        <canvas ref={canvasRef}
          style={{
            maxWidth: "100%", maxHeight: "100%",
            objectFit: "contain",
            display: error ? "none" : "block",
            background: "#0a0a0a",
          }} />

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
            <div style={{
              fontFamily: FONT_MONO, fontSize: 10, color: "#dc2626",
              letterSpacing: "0.3em", fontWeight: 700,
            }}>
              CAMERA ERROR
            </div>
            <div style={{ fontSize: 13, color: "#fafaf9", lineHeight: 1.6, maxWidth: 320, whiteSpace: "pre-line", wordBreak: "break-word" }}>
              {error}
            </div>
            <button onClick={() => setFacingMode(f => f)}
              style={{
                background: "#dc2626", color: "#fff", border: "none",
                padding: "8px 18px", borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                marginTop: 6, fontFamily: FONT_GOTHIC,
              }}>
              다시 시도
            </button>
          </div>
        )}

        {/* 폴스컬러 범례 (좌상단) */}
        {!error && !loading && mode === "falsecolor" && showLegend && (
          <div style={{
            position: "absolute", left: 8, top: 8,
            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
            borderRadius: 6, padding: "8px 10px",
            fontFamily: FONT_MONO, fontSize: 9,
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{ color: "#71706b", letterSpacing: "0.2em", fontWeight: 700, marginBottom: 5 }}>
              FALSE COLOR
            </div>
            {FC_LEGEND.map(item => (
              <div key={item.range} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <div style={{ width: 14, height: 8, background: item.color, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ color: "#fafaf9", fontSize: 9 }}>{item.range}</span>
              </div>
            ))}
            <button onClick={() => setShowLegend(false)}
              style={{
                position: "absolute", top: 4, right: 4,
                background: "transparent", border: "none",
                color: "#71706b", fontSize: 11, cursor: "pointer",
                padding: "2px 4px", lineHeight: 1,
              }}>✕</button>
          </div>
        )}

        {/* 히스토그램 (우상단) */}
        {!error && !loading && showHistogram && (
          <div style={{
            position: "absolute", right: 8, top: 8,
            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
            borderRadius: 6, padding: "6px 8px",
            width: 120,
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{
              color: "#71706b", fontFamily: FONT_MONO,
              fontSize: 8, letterSpacing: "0.2em", fontWeight: 700, marginBottom: 3,
            }}>
              HISTOGRAM
            </div>
            <svg width="100%" height="40" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d={histPath} fill="rgba(251,191,36,0.5)" stroke="#fbbf24" strokeWidth="0.5" />
            </svg>
          </div>
        )}

        {/* 제브라 임계값 표시 (하단) */}
        {!error && !loading && mode === "zebra" && (
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
            borderRadius: 6, padding: "6px 12px",
            display: "flex", alignItems: "center", gap: 10,
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#71706b", letterSpacing: "0.2em" }}>
              ZEBRA
            </span>
            <button onClick={() => setZebraThreshold(70)}
              style={{
                background: zebraThreshold === 70 ? "#fbbf24" : "transparent",
                border: `1px solid ${zebraThreshold === 70 ? "#fbbf24" : "#2a2a2a"}`,
                color: zebraThreshold === 70 ? "#0a0a0a" : "#a8a29e",
                fontSize: 10, fontWeight: 700, padding: "3px 8px",
                borderRadius: 4, cursor: "pointer", fontFamily: FONT_MONO,
              }}>70%</button>
            <button onClick={() => setZebraThreshold(95)}
              style={{
                background: zebraThreshold === 95 ? "#fbbf24" : "transparent",
                border: `1px solid ${zebraThreshold === 95 ? "#fbbf24" : "#2a2a2a"}`,
                color: zebraThreshold === 95 ? "#0a0a0a" : "#a8a29e",
                fontSize: 10, fontWeight: 700, padding: "3px 8px",
                borderRadius: 4, cursor: "pointer", fontFamily: FONT_MONO,
              }}>95%</button>
          </div>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div style={{
        flexShrink: 0,
        background: "#0a0a0a",
        padding: "10px 14px 12px",
        borderTop: "1px solid #1a1a1a",
      }}>
        {/* 모드 선택 */}
        <div style={{
          fontFamily: FONT_MONO, fontSize: 8, color: "#71706b",
          letterSpacing: "0.25em", fontWeight: 700, marginBottom: 5,
        }}>
          DISPLAY MODE
        </div>
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          <ModeBtn value="off"        icon=""   label="OFF" />
          <ModeBtn value="falsecolor" icon="🌈" label="FALSE" />
          <ModeBtn value="zebra"      icon="🦓" label="ZEBRA" />
        </div>

        {/* 옵션 */}
        <div style={{ display: "flex", gap: 5 }}>
          <OptionBtn active={showHistogram} onClick={() => setShowHistogram(v => !v)}>
            📊 HISTOGRAM
          </OptionBtn>
          {mode === "falsecolor" && (
            <OptionBtn active={showLegend} onClick={() => setShowLegend(v => !v)}>
              📋 범례
            </OptionBtn>
          )}
        </div>

        {/* 가이드 */}
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: "#16130d",
          border: "1px dashed #fbbf24",
          borderRadius: 5,
          fontSize: 10, color: "#d6d3d1", lineHeight: 1.5,
        }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 8, color: "#fbbf24",
            letterSpacing: "0.25em", fontWeight: 700, marginBottom: 3,
          }}>💡 GUIDE</div>
          {mode === "falsecolor" && (
            <>피부톤은 <span style={{ color: "#ff8cc8" }}>핑크(60-70%)</span>, 18% 회색은 <span style={{ color: "#28dc50" }}>초록(38-50%)</span><br/>
            <span style={{ color: "#b43cdc" }}>보라</span> = 너무 어둠 · <span style={{ color: "#ff0000" }}>빨강</span> = 클리핑 (정보 손실)</>
          )}
          {mode === "zebra" && (
            <>줄무늬가 있는 영역은 <strong style={{ color: "#fafaf9" }}>{zebraThreshold}% 이상</strong> 노출.<br/>
            <strong style={{ color: "#fbbf24" }}>70%</strong>: 밝은 피부톤 노출 확인 · <strong style={{ color: "#fbbf24" }}>95%</strong>: 클리핑 경고</>
          )}
          {mode === "off" && (
            <>왼쪽 모드 버튼을 눌러 폴스컬러 또는 제브라를 켜보세요.<br/>
            브라우저 카메라는 자동 노출이라 정확한 IRE 값은 아니지만 분포 학습용으로 충분합니다.</>
          )}
        </div>
      </div>
    </div>
  );
}
