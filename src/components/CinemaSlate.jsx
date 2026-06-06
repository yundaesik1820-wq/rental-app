import { useState, useEffect, useRef } from "react";

/**
 * 🎬 전자식 시네마 슬레이터 (Electronic Cinema Slate)
 *
 * 기능:
 * - 실시간 타임코드 (24fps, HH:MM:SS:FF)
 * - 씬 / 테이크 / 롤 카운터 (+/-)
 * - INT/EXT, DAY/NIGHT 토글
 * - PROD/DIR/CAMERA/SOUND 입력
 * - CLAP! 버튼 (사운드 + 진동 + 화면 플래시)
 * - 컬러 반전 모드
 * - 사운드 ON/OFF
 * - 리셋 기능
 * - 모든 설정 localStorage에 자동 저장
 */
export default function CinemaSlate({ onBack }) {
  // ─── localStorage 키 ──────────────────────
  const LS = {
    prod:     "slate_prod",
    dir:      "slate_dir",
    camera:   "slate_camera",
    sound:    "slate_sound",
    scene:    "slate_scene",
    take:     "slate_take",
    roll:     "slate_roll",
    intext:   "slate_intext",
    daynight: "slate_daynight",
    soundOn:  "slate_soundOn",
  };
  const getLS = (key, def) => {
    if (typeof window === "undefined") return def;
    const v = localStorage.getItem(key);
    return v === null ? def : v;
  };

  // ─── 상태 ─────────────────────────────────
  const [prod,     setProd]     = useState(getLS(LS.prod, ""));
  const [dir,      setDir]      = useState(getLS(LS.dir, ""));
  const [camera,   setCamera]   = useState(getLS(LS.camera, ""));
  const [sound,    setSound]    = useState(getLS(LS.sound, ""));
  const [scene,    setScene]    = useState(parseInt(getLS(LS.scene, "1"), 10));
  const [take,     setTake]     = useState(parseInt(getLS(LS.take, "1"), 10));
  const [roll,     setRoll]     = useState(parseInt(getLS(LS.roll, "1"), 10));
  const [intExt,   setIntExt]   = useState(getLS(LS.intext, "INT"));
  const [dayNight, setDayNight] = useState(getLS(LS.daynight, "DAY"));
  const [soundOn,  setSoundOn]  = useState(getLS(LS.soundOn, "true") === "true");
  const [inverted, setInverted] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [clapping, setClapping]   = useState(false);
  const [showInfo, setShowInfo]   = useState(false); // 정보 입력 패널

  // ─── 실시간 타임코드 (24fps) ────────────────
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
    return { h, m, s, ff, str: `${h}:${m}:${s}:${ff}` };
  })();

  // ─── localStorage 자동 저장 ───────────────
  useEffect(() => { localStorage.setItem(LS.prod, prod); }, [prod]);
  useEffect(() => { localStorage.setItem(LS.dir, dir); }, [dir]);
  useEffect(() => { localStorage.setItem(LS.camera, camera); }, [camera]);
  useEffect(() => { localStorage.setItem(LS.sound, sound); }, [sound]);
  useEffect(() => { localStorage.setItem(LS.scene, String(scene)); }, [scene]);
  useEffect(() => { localStorage.setItem(LS.take, String(take)); }, [take]);
  useEffect(() => { localStorage.setItem(LS.roll, String(roll)); }, [roll]);
  useEffect(() => { localStorage.setItem(LS.intext, intExt); }, [intExt]);
  useEffect(() => { localStorage.setItem(LS.daynight, dayNight); }, [dayNight]);
  useEffect(() => { localStorage.setItem(LS.soundOn, String(soundOn)); }, [soundOn]);

  // ─── CLAP! 사운드 (Web Audio로 합성) ──────
  const playClapSound = () => {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      // 짧은 노이즈 + 빠른 감쇠 = 클랩 비슷한 효과
      const dur = 0.09;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < buf.length; i++) {
        // 백색 노이즈에 envelope 적용
        const env = Math.exp(-i / (buf.length * 0.12));
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.7;
      // 약간의 하이패스 효과로 더 날카로운 소리
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 800;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      setTimeout(() => { try { ctx.close(); } catch(e) {} }, 500);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  const handleClap = () => {
    playClapSound();
    if (navigator.vibrate) navigator.vibrate([80, 30, 60]);
    setShowFlash(true);
    setClapping(true);
    setTimeout(() => setShowFlash(false), 220);
    setTimeout(() => setClapping(false), 600);
  };

  const handleReset = () => {
    if (!window.confirm("씬·테이크·롤을 1로 초기화할까요? (PROD/DIR 등 정보는 유지)")) return;
    setScene(1);
    setTake(1);
    setRoll(1);
  };

  // ─── 컬러 팔레트 (반전 대응) ───────────────
  const C = inverted ? {
    bg:"#fafaf9", surface:"#ede6cf", text:"#0a0a0a", muted:"#5a5346",
    border:"#bbb5a3", red:"#b91c1c", redGlow:"rgba(185,28,28,0.4)",
    chalk:"#0a0a0a", chalkLabel:"#71706b",
  } : {
    bg:"#0a0a0a", surface:"#0d0d0d", text:"#fafaf9", muted:"#a8a29e",
    border:"#2a2a2a", red:"#dc2626", redGlow:"rgba(220,38,38,0.6)",
    chalk:"#ede6cf", chalkLabel:"#8a8275",
  };

  return (
    <div style={{
      background: C.bg,
      color: C.text,
      borderRadius: 12,
      padding: 12,
      transition: "background 0.3s, color 0.3s",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes flashWhite {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes clapShake {
          0%, 100% { transform: rotate(0deg); }
          25%      { transform: rotate(-1deg); }
          75%      { transform: rotate(1deg); }
        }
      `}</style>

      {/* 플래시 효과 */}
      {showFlash && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          background:"#fff", pointerEvents:"none",
          animation:"flashWhite 0.22s ease-out",
        }} />
      )}

      {/* ── 상단 도구바 (← 도구로 / 토글들) ── */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom:14, gap:8,
      }}>
        <button onClick={onBack}
          style={{
            background:"rgba(251,191,36,0.1)",
            border:"1px solid rgba(251,191,36,0.3)",
            color: C.text, fontSize:11, fontWeight:600,
            padding:"6px 12px", borderRadius:8, cursor:"pointer",
            display:"flex", alignItems:"center", gap:5,
          }}>
          <span style={{ color:"#fbbf24" }}>←</span> 도구
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ color:"#fbbf24", fontSize:10, fontWeight:700, letterSpacing:"0.2em", fontFamily:"'Courier New', monospace" }}>
            🎬 SLATE
          </span>
        </div>
        <button onClick={() => setShowInfo(s => !s)}
          style={{
            background: showInfo ? C.red : C.surface,
            border:`1px solid ${showInfo ? C.red : C.border}`,
            color: showInfo ? "#fff" : C.muted,
            fontSize:10, fontWeight:600,
            padding:"6px 10px", borderRadius:8, cursor:"pointer",
            fontFamily:"'Courier New', monospace", letterSpacing:"0.1em",
          }}>
          INFO
        </button>
      </div>

      {/* ── 정보 입력 패널 (토글) ── */}
      {showInfo && (
        <div style={{
          background: C.surface,
          border:`1px solid ${C.border}`,
          borderRadius:6, padding:"10px 12px", marginBottom:12,
        }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <SlateInput label="PROD." value={prod} onChange={setProd} C={C} />
            <SlateInput label="DIR." value={dir} onChange={setDir} C={C} />
            <SlateInput label="CAMERA" value={camera} onChange={setCamera} C={C} />
            <SlateInput label="SOUND" value={sound} onChange={setSound} C={C} />
          </div>
        </div>
      )}

      {/* ── 클래퍼 (사선 줄무늬, 장식용) ── */}
      <div style={{
        height:34,
        backgroundImage:"repeating-linear-gradient(118deg, #f5f1e8 0 28px, #1a1a1a 28px 56px)",
        border:`2px solid ${C.border}`,
        borderRadius:4, marginBottom:2,
        animation: clapping ? "clapShake 0.18s ease-out" : "none",
      }} />

      {/* ── 슬레이트 본체 ── */}
      <div style={{
        background: inverted ? "#ede6cf" : "linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)",
        border:`2px solid ${C.border}`,
        borderRadius:4, padding:"14px 14px 16px",
      }}>
        {/* 헤더 라인: PROD / DIR */}
        {!showInfo && (
          <div style={{ display:"flex", gap:14, marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${C.border}` }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Courier New', monospace", fontSize:8, color:C.chalkLabel, letterSpacing:"0.15em", marginBottom:1 }}>PROD</div>
              <div style={{ fontFamily:"'Courier New', monospace", fontSize:13, fontWeight:700, color:C.chalk, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textShadow: inverted ? "none" : "0 0 2px rgba(255,255,255,0.25)" }}>
                {prod || <span style={{ color:C.chalkLabel, fontStyle:"italic" }}>—</span>}
              </div>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Courier New', monospace", fontSize:8, color:C.chalkLabel, letterSpacing:"0.15em", marginBottom:1 }}>DIR</div>
              <div style={{ fontFamily:"'Courier New', monospace", fontSize:13, fontWeight:700, color:C.chalk, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textShadow: inverted ? "none" : "0 0 2px rgba(255,255,255,0.25)" }}>
                {dir || <span style={{ color:C.chalkLabel, fontStyle:"italic" }}>—</span>}
              </div>
            </div>
          </div>
        )}

        {/* 메인 타임코드 (큰 글씨) */}
        <div style={{
          background: inverted ? "#fafaf9" : "#000",
          border:`1px solid ${C.border}`,
          borderRadius:6, padding:"14px 8px", marginBottom:14, textAlign:"center",
        }}>
          <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:C.chalkLabel, letterSpacing:"0.3em", marginBottom:4, fontWeight:700 }}>
            TIMECODE · 24 FPS
          </div>
          <div style={{
            fontFamily:"'Courier New', monospace",
            fontSize:36, fontWeight:900, color:C.red,
            letterSpacing:"0.05em", lineHeight:1,
            textShadow: `0 0 18px ${C.redGlow}, 0 0 6px ${C.redGlow}`,
          }}>
            {tc.str}
          </div>
        </div>

        {/* SCENE / TAKE / ROLL 카운터 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
          <Counter label="SCENE" value={scene} setValue={setScene} C={C} />
          <Counter label="TAKE" value={take} setValue={setTake} C={C} />
          <Counter label="ROLL" value={roll} setValue={setRoll} C={C} padDigits={3} />
        </div>

        {/* INT/EXT, DAY/NIGHT 토글 */}
        <div style={{ display:"flex", gap:5, fontFamily:"'Courier New', monospace" }}>
          <ToggleBtn active={intExt==="INT"}   onClick={() => setIntExt("INT")}   color={C.red} C={C}>INT</ToggleBtn>
          <ToggleBtn active={intExt==="EXT"}   onClick={() => setIntExt("EXT")}   color={C.red} C={C}>EXT</ToggleBtn>
          <span style={{ width:8 }} />
          <ToggleBtn active={dayNight==="DAY"}   onClick={() => setDayNight("DAY")}   color={C.red} C={C}>DAY</ToggleBtn>
          <ToggleBtn active={dayNight==="NIGHT"} onClick={() => setDayNight("NIGHT")} color={C.red} C={C}>NIGHT</ToggleBtn>
        </div>
      </div>

      {/* ── 큰 CLAP! 버튼 ── */}
      <button onClick={handleClap}
        style={{
          width:"100%", marginTop:14,
          background:"linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
          color:"#fff", border:"none",
          padding:"18px", borderRadius:10,
          fontFamily:"'Courier New', monospace",
          fontSize:22, fontWeight:900, letterSpacing:"0.4em",
          boxShadow:"0 4px 18px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.1)",
          cursor:"pointer",
          transition:"transform 0.1s",
        }}
        onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
        onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        🎬 CLAP!
      </button>

      {/* ── 하단 설정 ── */}
      <div style={{ display:"flex", gap:6, marginTop:10 }}>
        <SettingBtn onClick={() => setInverted(v => !v)} active={inverted} C={C}>
          🌓 {inverted ? "어둡게" : "밝게"}
        </SettingBtn>
        <SettingBtn onClick={() => setSoundOn(v => !v)} active={soundOn} C={C}>
          {soundOn ? "🔊 사운드 ON" : "🔇 사운드 OFF"}
        </SettingBtn>
        <SettingBtn onClick={handleReset} C={C}>
          ↻ 리셋
        </SettingBtn>
      </div>

      {/* 도움말 */}
      <div style={{
        marginTop:14, padding:"8px 12px",
        background: C.surface, borderRadius:6,
        border:`1px solid ${C.border}`,
        fontSize:10, color:C.muted, lineHeight:1.6,
        fontFamily:"'Courier New', monospace", letterSpacing:"0.05em",
      }}>
        <div style={{ color:C.red, fontWeight:700, letterSpacing:"0.2em", marginBottom:3 }}>HOW TO USE</div>
        촬영 전: SCENE/TAKE 입력 · 카메라 ROLL 후 화면을 비추고 CLAP!<br/>
        모든 설정은 자동 저장 됩니다 · INFO 버튼으로 정보 입력
      </div>
    </div>
  );
}

/** 입력 필드 */
function SlateInput({ label, value, onChange, C }) {
  return (
    <div>
      <div style={{ fontFamily:"'Courier New', monospace", fontSize:8, color:C.chalkLabel, letterSpacing:"0.2em", marginBottom:3, fontWeight:700 }}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        style={{
          width:"100%", boxSizing:"border-box",
          background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:4, padding:"5px 8px",
          color: C.chalk, fontFamily:"'Courier New', monospace",
          fontSize:13, fontWeight:700, outline:"none",
        }}
      />
    </div>
  );
}

/** 숫자 카운터 (+/-) */
function Counter({ label, value, setValue, C, padDigits = 2 }) {
  return (
    <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 4px", textAlign:"center" }}>
      <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:C.chalkLabel, letterSpacing:"0.15em", fontWeight:700 }}>
        {label}
      </div>
      <div style={{
        fontFamily:"'Courier New', monospace",
        fontSize:24, fontWeight:900, color:C.chalk,
        lineHeight:1.1, padding:"4px 0",
        textShadow: C.chalk === "#ede6cf" ? "0 0 2px rgba(255,255,255,0.25)" : "none",
      }}>
        {String(value).padStart(padDigits, "0")}
      </div>
      <div style={{ display:"flex", gap:3, justifyContent:"center" }}>
        <button onClick={() => setValue(v => Math.max(1, v - 1))}
          style={{ background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:14, fontWeight:700, padding:"2px 9px", borderRadius:3, cursor:"pointer", lineHeight:1 }}>
          −
        </button>
        <button onClick={() => setValue(v => v + 1)}
          style={{ background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:14, fontWeight:700, padding:"2px 9px", borderRadius:3, cursor:"pointer", lineHeight:1 }}>
          +
        </button>
      </div>
    </div>
  );
}

/** 토글 버튼 (INT/EXT, DAY/NIGHT) */
function ToggleBtn({ active, onClick, children, color, C }) {
  return (
    <button onClick={onClick}
      style={{
        flex:1, background: active ? color : "transparent",
        color: active ? "#fff" : C.muted,
        border:`1px solid ${active ? color : C.border}`,
        padding:"7px 4px", fontSize:10, fontWeight:700, letterSpacing:"0.15em",
        borderRadius:5, cursor:"pointer", fontFamily:"'Courier New', monospace",
      }}>
      {children}
    </button>
  );
}

/** 하단 설정 버튼 */
function SettingBtn({ onClick, active, children, C }) {
  return (
    <button onClick={onClick}
      style={{
        flex:1, background: C.surface,
        border:`1px solid ${active ? "#fbbf24" : C.border}`,
        color: active ? "#fbbf24" : C.muted,
        fontSize:10, padding:"7px 4px", borderRadius:6, cursor:"pointer",
        fontFamily:"'Courier New', monospace", letterSpacing:"0.1em",
      }}>
      {children}
    </button>
  );
}
