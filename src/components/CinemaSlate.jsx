import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * 🎬 전자식 시네마 슬레이터 v3 (가로 모드)
 *
 * 주요 변경:
 * - 좌측: DATE 박스 추가 (타임코드와 같은 사이즈), 정보 박스는 컴팩트 + 큰 글자
 * - 우측: SCENE/CUT/TAKE 큰 입력 박스 (텍스트 입력, 알파벳 가능)
 * - CLAP 버튼 작게 / 사운드 훨씬 크게
 * - 글꼴: 한국어 고딕(Pretendard/Noto Sans), 라벨만 모노
 */
const FONT_GOTHIC = "Pretendard, 'Noto Sans KR', -apple-system, 'Segoe UI', sans-serif";
const FONT_MONO   = "'Courier New', ui-monospace, monospace";

export default function CinemaSlate({ onBack }) {
  // ─── localStorage 키 ──────────────────────
  const LS = {
    prod:     "slate_prod",
    dir:      "slate_dir",
    camera:   "slate_camera",
    scene:    "slate_scene",
    cut:      "slate_cut",
    take:     "slate_take",
    intext:   "slate_intext",
    daynight: "slate_daynight",
  };
  const getLS = (key, def) => {
    if (typeof window === "undefined") return def;
    const v = localStorage.getItem(key);
    return v === null ? def : v;
  };

  // ─── 상태 (SCENE/CUT/TAKE는 문자열로 — 알파벳 가능) ───
  const [prod,     setProd]     = useState(getLS(LS.prod, ""));
  const [dir,      setDir]      = useState(getLS(LS.dir, ""));
  const [camera,   setCamera]   = useState(getLS(LS.camera, ""));
  const [scene,    setScene]    = useState(getLS(LS.scene, "1"));
  const [cut,      setCut]      = useState(getLS(LS.cut, "1"));
  const [take,     setTake]     = useState(getLS(LS.take, "1"));
  const [intExt,   setIntExt]   = useState(getLS(LS.intext, "INT"));
  const [dayNight, setDayNight] = useState(getLS(LS.daynight, "DAY"));
  const [inverted, setInverted] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [clapping, setClapping]   = useState(0);
  // 📱 세로 고정 해제 안내 (한 번만)
  const [showOrientHint, setShowOrientHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("slate_orient_hint_seen") !== "1";
  });
  const dismissHint = () => {
    setShowOrientHint(false);
    localStorage.setItem("slate_orient_hint_seen", "1");
  };

  // ─── 가로/세로 감지 (컨테이너 실측 — ResizeObserver로 기기·회전잠금·PWA·주소창 무관하게 정확) ─
  const rootRef = useRef(null);
  const [box, setBox] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 800,
    h: typeof window !== "undefined" ? window.innerHeight : 600,
  });
  const portrait = box.h > box.w;
  useEffect(() => {
    const el = rootRef.current;
    // 폴백: ResizeObserver 미지원 시 window 기준 + 회전 후 지연 재측정
    if (!el || typeof ResizeObserver === "undefined") {
      const measure = () => setBox({ w: window.innerWidth, h: window.innerHeight });
      const onOrient = () => { measure(); setTimeout(measure, 250); setTimeout(measure, 600); };
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("orientationchange", onOrient);
      return () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("orientationchange", onOrient);
      };
    }
    // 컨테이너의 실제 렌더 크기를 직접 관측 (innerWidth/Height의 stale 문제 없음)
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const r = e.contentRect;
        setBox({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 📐 슬레이터 진입 시 viewport zoom 잠금, 나갈 때 복원 + 강제 reflow
  // (회전 transform + 큰 글자로 인한 iOS Safari zoom 잔존 방지)
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    const original = viewport.getAttribute("content") || "width=device-width, initial-scale=1.0";
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    );
    return () => {
      // 원래 viewport로 복원
      viewport.setAttribute("content", original);
      // 강제 reflow로 zoom 상태 즉시 정상화
      requestAnimationFrame(() => {
        document.body.style.transform = "translateZ(0)";
        requestAnimationFrame(() => {
          document.body.style.transform = "";
        });
      });
    };
  }, []);

  // ─── 실시간 타임코드 (24fps) + 날짜 ────────
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), Math.round(1000/24));
    return () => clearInterval(id);
  }, []);
  const tc = (() => {
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ms = now.getMilliseconds();
    const ff = String(Math.floor(ms / (1000/24))).padStart(2, "0");
    return `${h}:${m}:${s}:${ff}`;
  })();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")}`;
  const dayName = ["일","월","화","수","목","금","토"][now.getDay()];

  // ─── localStorage 자동 저장 ───────────────
  useEffect(() => { localStorage.setItem(LS.prod, prod); }, [prod]);
  useEffect(() => { localStorage.setItem(LS.dir, dir); }, [dir]);
  useEffect(() => { localStorage.setItem(LS.camera, camera); }, [camera]);
  useEffect(() => { localStorage.setItem(LS.scene, scene); }, [scene]);
  useEffect(() => { localStorage.setItem(LS.cut, cut); }, [cut]);
  useEffect(() => { localStorage.setItem(LS.take, take); }, [take]);
  useEffect(() => { localStorage.setItem(LS.intext, intExt); }, [intExt]);
  useEffect(() => { localStorage.setItem(LS.daynight, dayNight); }, [dayNight]);

  // ─── CLAP! 사운드 ──────────────────────────
  // 🎵 MP3 우선 재생, 실패 시 합성 사운드 fallback
  const playClapSound = () => {
    try {
      const audio = new Audio("/sounds/clap.mp3");
      audio.volume = 1.0;
      audio.play().catch(err => {
        console.warn("clap.mp3 재생 실패, 합성 사운드로 대체:", err);
        playSynthClap();
      });
    } catch (e) {
      playSynthClap();
    }
  };

  // 합성 사운드 (fallback용)
  const playSynthClap = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume();

      const t0 = ctx.currentTime;
      const dur = 0.22;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < buf.length; i++) {
        const t = i / buf.length;
        const env = t < 0.015 ? t * 67 : Math.exp(-(t - 0.015) * 20);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hpf = ctx.createBiquadFilter();
      hpf.type = "highpass"; hpf.frequency.value = 1000;
      const bpf = ctx.createBiquadFilter();
      bpf.type = "peaking"; bpf.frequency.value = 3500; bpf.gain.value = 8; bpf.Q.value = 1.2;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6; comp.ratio.value = 14;
      comp.attack.value = 0.001; comp.release.value = 0.08;
      const masterGain = ctx.createGain();
      masterGain.gain.value = 2.6;
      src.connect(hpf).connect(bpf).connect(comp).connect(masterGain).connect(ctx.destination);
      src.start();

      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(150, t0);
      sub.frequency.exponentialRampToValueAtTime(35, t0 + 0.08);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(1.6, t0);
      subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      sub.connect(subGain).connect(ctx.destination);
      sub.start(t0); sub.stop(t0 + 0.15);

      setTimeout(() => { try { ctx.close(); } catch(e) {} }, 600);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  const handleClap = () => {
    // 즉시: 빛 번쩍임 + 진동 + 슬레이트 애니메이션 시작
    setShowFlash(true);
    if (navigator.vibrate) navigator.vibrate([180, 30, 80]);
    setClapping(c => c + 1);
    setTimeout(() => setShowFlash(false), 220);

    // 슬레이트가 닫히는 순간에 소리 재생 (애니메이션 SNAP 시점)
    setTimeout(() => {
      playClapSound();
    }, 480);
  };

  const handleReset = () => {
    if (!window.confirm("씬·컷·테이크를 1로 초기화할까요? (정보는 유지)")) return;
    setScene("1");
    setCut("1");
    setTake("1");
  };

  // ─── 컬러 팔레트 (반전 대응) ───────────────
  const C = inverted ? {
    bg:"#fafaf9", surface:"#ede6cf", text:"#0a0a0a", muted:"#5a5346",
    border:"#bbb5a3", red:"#b91c1c", redGlow:"rgba(185,28,28,0.35)",
    chalk:"#0a0a0a", chalkLabel:"#71706b",
    blackBg:"#fafaf9",
  } : {
    bg:"#0a0a0a", surface:"#0d0d0d", text:"#fafaf9", muted:"#a8a29e",
    border:"#2a2a2a", red:"#dc2626", redGlow:"rgba(220,38,38,0.7)",
    chalk:"#ede6cf", chalkLabel:"#8a8275",
    blackBg:"#000",
  };

  // ─── 슬레이트 콘텐츠 ──────────────────────
  const SlateContent = (
    <div style={{
      width:"100%", height:"100%",
      background: C.bg, color: C.text,
      display:"flex", flexDirection:"column",
      padding:"6px 10px 8px",
      boxSizing:"border-box",
      transition:"background 0.3s, color 0.3s",
      position:"relative",
      overflow:"hidden",
      fontFamily: FONT_GOTHIC,
    }}>
      <style>{`
        @keyframes flashWhite {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes clapperSnap {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(-6deg); }
          35%  { transform: rotate(-28deg); }
          55%  { transform: rotate(-30deg); }
          72%  { transform: rotate(2.8deg); }
          84%  { transform: rotate(-1.2deg); }
          93%  { transform: rotate(0.4deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>

      {showFlash && (
        <div style={{
          position:"absolute", inset:0, zIndex:1000,
          background:"#fff", pointerEvents:"none",
          animation:"flashWhite 0.22s ease-out",
        }} />
      )}

      {/* ─── 상단 도구바 ─── */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom:8, flexShrink:0,
      }}>
        <button onClick={onBack}
          style={{
            background:"rgba(251,191,36,0.1)",
            border:"1px solid rgba(251,191,36,0.3)",
            color: C.text, fontSize:11, fontWeight:600,
            padding:"6px 12px", borderRadius:8, cursor:"pointer",
            display:"flex", alignItems:"center", gap:5,
            fontFamily: FONT_GOTHIC,
          }}>
          <span style={{ color:"#fbbf24" }}>←</span> 도구
        </button>
        <span style={{ color:"#fbbf24", fontSize:10, fontWeight:700, letterSpacing:"0.2em", fontFamily:FONT_MONO }}>
          🎬 SLATE
        </span>
        <div style={{ display:"flex", gap:5 }}>
          <button onClick={() => setInverted(v => !v)}
            style={{
              background: C.surface, border:`1px solid ${C.border}`,
              color: C.muted, fontSize:12,
              padding:"5px 9px", borderRadius:7, cursor:"pointer",
            }}
            title={inverted ? "어둡게" : "밝게"}>🌓</button>
          <button onClick={handleReset}
            style={{
              background: C.surface, border:`1px solid ${C.border}`,
              color: C.muted, fontSize:12,
              padding:"5px 9px", borderRadius:7, cursor:"pointer",
            }}
            title="리셋">↻</button>
        </div>
      </div>

      {/* ─── 슬레이트 본체 ─── */}
      <div style={{
        flex:1,
        background: inverted ? "#ede6cf" : "linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)",
        border:`2px solid ${C.border}`,
        borderRadius:6, padding:"6px 10px 8px",
        display:"flex", flexDirection:"column",
        boxShadow: inverted ? "0 6px 24px rgba(0,0,0,0.15)" : "0 6px 24px rgba(0,0,0,0.6)",
        position:"relative",
        minHeight:0,
      }}>
        {/* 클래퍼 */}
        <div style={{ position:"relative", marginBottom:6, flexShrink:0 }}>
          <div key={clapping} style={{
            height:22,
            backgroundImage:"repeating-linear-gradient(118deg, #f5f1e8 0 24px, #1a1a1a 24px 48px)",
            border:`2px solid ${C.border}`,
            borderRadius:3,
            transformOrigin:"bottom left",
            animation: clapping > 0 ? "clapperSnap 0.7s cubic-bezier(0.45, 0, 0.15, 1)" : "none",
            boxShadow:"0 3px 12px rgba(0,0,0,0.5)",
            position:"relative",
          }}>
            <div style={{
              position:"absolute", bottom:-3, left:6,
              width:8, height:8, borderRadius:"50%",
              background:"#2a2a2a", border:"2px solid #4a4a4a",
            }} />
          </div>
        </div>

        {/* 본체 그리드: 좌측(날짜+타임코드+정보+메모) + 우측(SCENE/CUT/TAKE + 토글 + CLAP) */}
        <div style={{
          flex:1,
          display:"grid",
          gridTemplateColumns:"1.3fr 1fr",
          gap:8,
          minHeight:0,
        }}>
          {/* ── 좌측 ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:5, minHeight:0 }}>
            {/* 날짜 박스 */}
            <div style={{
              background: C.blackBg,
              border:`1px solid ${C.border}`,
              borderRadius:5, padding:"7px 8px", textAlign:"center",
              flexShrink:0,
            }}>
              <div style={{ fontFamily:FONT_MONO, fontSize:8, color:C.chalkLabel, letterSpacing:"0.3em", marginBottom:1, fontWeight:700 }}>
                DATE
              </div>
              <div style={{
                fontFamily:FONT_MONO,
                fontSize:22, fontWeight:900, color: inverted ? "#0a0a0a" : "#fbbf24",
                letterSpacing:"0.04em", lineHeight:1,
                textShadow: inverted ? "none" : "0 0 14px rgba(251,191,36,0.5)",
              }}>
                {dateStr}
                <span style={{ fontSize:13, marginLeft:6, opacity:0.7 }}>({dayName})</span>
              </div>
            </div>

            {/* 타임코드 */}
            <div style={{
              background: C.blackBg,
              border:`1px solid ${C.border}`,
              borderRadius:5, padding:"7px 8px", textAlign:"center",
              flexShrink:0,
            }}>
              <div style={{ fontFamily:FONT_MONO, fontSize:8, color:C.chalkLabel, letterSpacing:"0.3em", marginBottom:1, fontWeight:700 }}>
                TIMECODE · 24 FPS
              </div>
              <div style={{
                fontFamily:FONT_MONO,
                fontSize:26, fontWeight:900, color:C.red,
                letterSpacing:"0.04em", lineHeight:1,
                textShadow: `0 0 18px ${C.redGlow}, 0 0 6px ${C.redGlow}`,
              }}>
                {tc}
              </div>
            </div>

            {/* PROD / DIR / CAM (컴팩트 + 큰 글자 + 고딕) */}
            <div style={{
              background: inverted ? "#fafaf9" : "rgba(0,0,0,0.4)",
              border:`1px solid ${C.border}`,
              borderRadius:5, padding:"6px 10px",
              display:"flex", flexDirection:"column", gap:3,
              flexShrink:0,
            }}>
              <InfoRow label="PROD" value={prod} onChange={setProd} C={C} inverted={inverted} />
              <InfoRow label="DIR"  value={dir}  onChange={setDir}  C={C} inverted={inverted} />
              <InfoRow label="CAM"  value={camera} onChange={setCamera} C={C} inverted={inverted} />
            </div>

            {/* 🖊️ 손글씨 메모 박스 */}
            <HandwritingCanvas C={C} inverted={inverted} portrait={portrait} />
          </div>

          {/* ── 우측: SCENE/CUT/TAKE (크고 강조) + 토글 + CLAP ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:5, minHeight:0 }}>
            {/* SCENE / CUT / TAKE (가장 큼, 텍스트 입력) */}
            <div style={{
              flex:1,
              display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6,
              minHeight:0,
            }}>
              <BigInput label="SCENE" value={scene} onChange={setScene} C={C} />
              <BigInput label="CUT"   value={cut}   onChange={setCut}   C={C} />
              <BigInput label="TAKE"  value={take}  onChange={setTake}  C={C} />
            </div>

            {/* INT/EXT, DAY/NIGHT */}
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <div style={{ flex:1, display:"flex", gap:3 }}>
                <ToggleBtn active={intExt==="INT"} onClick={() => setIntExt("INT")} color={C.red} C={C}>INT</ToggleBtn>
                <ToggleBtn active={intExt==="EXT"} onClick={() => setIntExt("EXT")} color={C.red} C={C}>EXT</ToggleBtn>
              </div>
              <div style={{ flex:1, display:"flex", gap:3 }}>
                <ToggleBtn active={dayNight==="DAY"} onClick={() => setDayNight("DAY")} color={C.red} C={C}>DAY</ToggleBtn>
                <ToggleBtn active={dayNight==="NIGHT"} onClick={() => setDayNight("NIGHT")} color={C.red} C={C}>NIGHT</ToggleBtn>
              </div>
            </div>

            {/* CLAP! 버튼 (작게) */}
            <button onClick={handleClap}
              style={{
                flexShrink:0, height:42,
                background:"linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
                color:"#fff", border:"none",
                borderRadius:8,
                fontFamily:FONT_MONO,
                fontSize:18, fontWeight:900, letterSpacing:"0.35em",
                boxShadow:"0 4px 14px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
                cursor:"pointer",
                transition:"transform 0.1s",
              }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              🎬 CLAP!
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── 풀스크린 + 자동 가로 ─────────────────
  // ⚠️ createPortal(body): 커뮤니티 z-200 fixed 컨테이너 안에 중첩되면 전역 스택이 200 레벨로 갇혀
  //    하단바(z 250)가 슬레이트 위에 뜸 → body 직속으로 탈출 (z 9000이 실제로 최상위가 되게)
  // ⚠️ maxWidth:"none": Layout 모바일 전역 규칙 `* { max-width:100% }`이 회전 래퍼(폭=화면높이)를
  //    화면폭으로 캡핑해 회전 화면이 정사각형으로 뭉개짐 → 인라인으로 무력화 (인라인 > 전역 CSS)
  return createPortal(
    <div ref={rootRef} style={{
      position:"fixed", inset:0, zIndex:9000,
      background:"#000",
      overflow:"hidden",
      maxWidth:"none",
    }}>
      {portrait ? (
        <div style={{
          position:"absolute", top:0, left:`${box.w}px`,
          width:`${box.h}px`, height:`${box.w}px`, maxWidth:"none",
          transformOrigin:"top left",
          transform:"rotate(90deg)",
        }}>
          {SlateContent}
        </div>
      ) : (
        <div style={{ position:"absolute", inset:0 }}>
          {SlateContent}
        </div>
      )}

      {/* 📱 세로 고정 해제 안내 모달 (회전과 무관하게 항상 정방향) */}
      {showOrientHint && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          background:"rgba(0,0,0,0.92)",
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:24,
        }}>
          <div style={{
            background:"#1a1a1a",
            border:"1px solid #2a2a2a",
            borderRadius:14, padding:"30px 24px 24px",
            maxWidth:340, width:"100%", textAlign:"center",
            boxShadow:"0 10px 40px rgba(0,0,0,0.6)",
          }}>
            <div style={{ fontSize:48, marginBottom:14, lineHeight:1 }}>📱 ↻</div>
            <div style={{ fontFamily:FONT_MONO, fontSize:10, color:"#fbbf24", letterSpacing:"0.3em", marginBottom:8, fontWeight:700 }}>
              LANDSCAPE MODE
            </div>
            <div style={{ fontFamily:FONT_GOTHIC, fontSize:17, fontWeight:800, color:"#fafaf9", marginBottom:10 }}>
              가로 모드로 보세요
            </div>
            <div style={{ fontFamily:FONT_GOTHIC, fontSize:13, color:"#a8a29e", lineHeight:1.7, marginBottom:20 }}>
              슬레이터는 가로 화면 전용입니다.<br/>
              화면이 잘리거나 회전이 안 된다면<br/>
              핸드폰의 <strong style={{ color:"#fbbf24" }}>세로 고정을 해제</strong>해주세요.
            </div>
            <button onClick={dismissHint}
              style={{
                background:"#dc2626", color:"#fff",
                border:"none", borderRadius:10,
                padding:"11px 28px",
                fontSize:14, fontWeight:700,
                cursor:"pointer",
                fontFamily:FONT_GOTHIC,
                boxShadow:"0 4px 12px rgba(220,38,38,0.4)",
              }}>
              확인했어요
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

/** PROD/DIR/CAM 입력 한 줄 (컴팩트, 큰 글자, 고딕체) */
function InfoRow({ label, value, onChange, C, inverted }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{
        fontFamily:FONT_MONO, fontSize:9,
        color: C.chalkLabel, letterSpacing:"0.2em", fontWeight:700,
        minWidth:38, flexShrink:0,
      }}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        style={{
          flex:1, minWidth:0,
          background:"transparent", border:"none",
          color: C.chalk,
          fontFamily: FONT_GOTHIC,
          fontSize:18, fontWeight:800, outline:"none",
          padding:"2px 0",
          textShadow: inverted ? "none" : "0 0 2px rgba(255,255,255,0.2)",
        }}
      />
    </div>
  );
}

/** SCENE/CUT/TAKE 큰 입력 박스 (텍스트 입력 가능) */
function BigInput({ label, value, onChange, C }) {
  return (
    <div style={{
      background: C.surface, border:`1px solid ${C.border}`,
      borderRadius:6, padding:"10px 4px",
      textAlign:"center",
      display:"flex", flexDirection:"column",
      justifyContent:"center", alignItems:"stretch",
      minWidth:0,
    }}>
      <div style={{
        fontFamily:FONT_MONO, fontSize:10,
        color:C.chalkLabel, letterSpacing:"0.25em", fontWeight:700,
        marginBottom:8,
      }}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        maxLength={5}
        style={{
          width:"100%", boxSizing:"border-box",
          background:"transparent", border:"none",
          color: C.chalk,
          fontFamily: FONT_GOTHIC,
          fontSize:44, fontWeight:900,
          textAlign:"center",
          outline:"none", padding:"0 2px",
          textShadow: C.chalk === "#ede6cf" ? "0 0 4px rgba(255,255,255,0.3), 0 0 1px rgba(255,255,255,0.5)" : "none",
          lineHeight:1.1,
        }}
      />
    </div>
  );
}

/** INT/EXT, DAY/NIGHT 토글 */
function ToggleBtn({ active, onClick, children, color, C }) {
  return (
    <button onClick={onClick}
      style={{
        flex:1, background: active ? color : "transparent",
        color: active ? "#fff" : C.muted,
        border:`1px solid ${active ? color : C.border}`,
        padding:"6px 4px", fontSize:10, fontWeight:700, letterSpacing:"0.15em",
        borderRadius:5, cursor:"pointer", fontFamily:FONT_MONO,
      }}>
      {children}
    </button>
  );
}

/** 🖊️ 손글씨 캔버스 - 터치/마우스/펜으로 자유롭게 쓰기 */
function HandwritingCanvas({ C, inverted, portrait }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const LS_KEY = "slate_memo_v2";

  // 캔버스 설정 + 저장된 메모 복원
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      // 기존 메모 백업
      let oldData = null;
      if (canvas.width > 0) {
        try { oldData = canvas.toDataURL(); } catch(e) {}
      }
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      // 우선 저장된 데이터 또는 백업 데이터 복원
      const saved = oldData || localStorage.getItem(LS_KEY);
      if (saved) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = saved;
      }
    };

    setupCanvas();
    const obs = new ResizeObserver(() => setupCanvas());
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const ne = e.nativeEvent || e;
    // Pointer 이벤트의 offsetX/Y는 브라우저가 회전(transform)·스케일·위치를 모두
    // 역계산해 요소 로컬 좌표로 제공하므로, 부모가 rotate(90deg)여도 정확하다.
    // ctx가 dpr만큼 scale 돼 있어 CSS px(offset) 좌표를 그대로 쓰면 된다.
    let x = ne.offsetX, y = ne.offsetY;
    if (x == null || y == null) {
      // 폴백 (구형): rect 기준 단순 매핑
      const rect = canvas.getBoundingClientRect();
      const cx = ne.clientX ?? 0, cy = ne.clientY ?? 0;
      x = cx - rect.left; y = cy - rect.top;
    }
    return { x, y };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.strokeStyle = inverted ? "#0a0a0a" : "#ede6cf";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = inverted ? 0 : 3;
    ctx.shadowColor = inverted ? "transparent" : "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      try {
        localStorage.setItem(LS_KEY, canvasRef.current.toDataURL());
      } catch(e) { /* quota exceeded 등 무시 */ }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem(LS_KEY);
  };

  return (
    <div style={{
      position:"relative",
      background: inverted ? "#fafaf9" : "rgba(0,0,0,0.4)",
      border:`1px solid ${C.border}`,
      borderRadius:5,
      flex:1, minHeight:60,
      overflow:"hidden",
    }}>
      {/* 라벨 */}
      <div style={{
        position:"absolute", top:4, left:8,
        fontFamily:FONT_MONO, fontSize:8,
        color: C.chalkLabel, letterSpacing:"0.2em", fontWeight:700,
        pointerEvents:"none", zIndex:1,
      }}>
        MEMO
      </div>
      {/* 지우기 버튼 */}
      <button onClick={clearCanvas}
        style={{
          position:"absolute", top:2, right:4,
          background:"transparent", border:"none",
          color: C.muted, fontSize:12, cursor:"pointer",
          padding:"2px 6px", lineHeight:1,
          zIndex:2,
        }}
        title="지우기">
        ✕
      </button>
      {/* 캔버스 */}
      <canvas ref={canvasRef}
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); startDraw(e); }}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        onPointerCancel={endDraw}
        style={{
          width:"100%", height:"100%",
          display:"block",
          touchAction:"none",
          cursor:"crosshair",
        }} />
    </div>
  );
}
