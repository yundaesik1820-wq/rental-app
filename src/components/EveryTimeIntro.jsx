import { useEffect, useState } from "react";

/**
 * 에브리타임 진입 인트로 - 영화 슬레이트(클래퍼보드) 연출
 *
 * 단계 (총 4.7초):
 *  0~0.8s:   슬레이트 등장 (상단 클래퍼 38도 열린 상태로 hover)
 *  0.8~2.0s: 클래퍼 SNAP 닫힘 (1.2초, anticipation + snap + bounce)
 *  1.4s:     화면 플래시 (clap 임팩트)
 *  2.1~3.0s: 슬레이트 페이드아웃 + 로고 페이드인
 *  3.0~4.2s: 로고 유지
 *  4.2~4.7s: 전체 페이드아웃
 *  4.7s:     onComplete
 */
export default function EveryTimeIntro({ onComplete }) {
  const [phase, setPhase] = useState(0);
  // 0: 슬레이트 열림 hover, 1: 닫히는 중, 2: 로고
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2100);
    const t3 = setTimeout(() => setExiting(true), 4200);
    const t4 = setTimeout(() => onComplete && onComplete(), 4700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}`;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:99999,
      background:"#000",
      display:"flex", alignItems:"center", justifyContent:"center",
      opacity: exiting ? 0 : 1,
      transition:"opacity 0.5s ease-out",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes slateClap {
          0%   { transform: rotate(-38deg); }
          12%  { transform: rotate(-42deg); }      /* 살짝 들었다가 (anticipation) */
          75%  { transform: rotate(2deg); }        /* 강한 충돌 + 오버슈트 */
          85%  { transform: rotate(-1deg); }       /* 작은 바운스 */
          93%  { transform: rotate(0.5deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes slateBreathe {
          0%, 100% { transform: rotate(-38deg) translateY(0); }
          50%      { transform: rotate(-38deg) translateY(-2px); }
        }
        @keyframes screenFlash {
          0%   { opacity: 0; }
          20%  { opacity: 0.85; }
          100% { opacity: 0; }
        }
        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0); }
          20%      { transform: translate(-4px, 3px); }
          40%      { transform: translate(3px, -3px); }
          60%      { transform: translate(-3px, 2px); }
          80%      { transform: translate(2px, -1px); }
        }
        .chalk-text {
          color: #ede6cf;
          text-shadow: 0 0 2px rgba(255,255,255,0.25);
          font-family: 'Courier New', monospace;
          letter-spacing: 0.05em;
        }
        .chalk-label {
          color: #8a8275;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.15em;
          font-size: 10px;
        }
      `}</style>

      {/* 비네트 */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)",
        opacity:0.6,
      }} />

      {/* 필름 perforations */}
      <div style={{
        position:"absolute", top:18, left:0, right:0, height:14,
        backgroundImage:"repeating-linear-gradient(90deg, #1a1a1a 0px, #1a1a1a 18px, #0a0a0a 18px, #0a0a0a 26px)",
        opacity:0.6,
      }} />
      <div style={{
        position:"absolute", bottom:18, left:0, right:0, height:14,
        backgroundImage:"repeating-linear-gradient(90deg, #1a1a1a 0px, #1a1a1a 18px, #0a0a0a 18px, #0a0a0a 26px)",
        opacity:0.6,
      }} />

      {/* 좌상단 ● REC */}
      <div style={{
        position:"absolute", top:50, left:24,
        fontSize:11, color:"#dc2626", fontWeight:700, letterSpacing:"0.2em",
        opacity:0.8, fontFamily:"'Courier New', monospace",
      }}>
        ● REC
      </div>
      <div style={{
        position:"absolute", top:50, right:24,
        fontSize:11, color:"#fafaf9", fontWeight:400, letterSpacing:"0.2em",
        opacity:0.5, fontFamily:"'Courier New', monospace",
      }}>
        {dateStr}
      </div>

      {/* 🎬 슬레이트(클래퍼보드) */}
      {phase < 2 && (
        <div style={{
          position:"relative",
          width: 540, height: 370,
          animation: phase === 1 ? "screenShake 0.18s ease-out 0.85s" : "none",
          opacity: phase >= 2 ? 0 : 1,
          transition:"opacity 0.4s ease-out",
        }}>
          {/* ── 하단 본체 (칠판) ── */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            height: 270,
            background:"linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)",
            border:"4px solid #2a2a2a",
            borderRadius:6,
            padding:"22px 28px",
            boxShadow:"0 12px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
            boxSizing:"border-box",
          }}>
            {/* PROD / DIR 라인 */}
            <div style={{ display:"flex", gap:16, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <div className="chalk-label">PROD.</div>
                <div className="chalk-text" style={{ fontSize:18, fontWeight:700, marginTop:2 }}>ZZOTKYO</div>
              </div>
              <div style={{ flex:1 }}>
                <div className="chalk-label">DIRECTOR</div>
                <div className="chalk-text" style={{ fontSize:18, fontWeight:700, marginTop:2 }}>ZZOTKYO</div>
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ height:1, background:"#3a3a3a", marginBottom:14 }} />

            {/* SCENE / TAKE / ROLL / DATE */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1.5fr", gap:14, marginBottom:14 }}>
              <div>
                <div className="chalk-label">SCENE</div>
                <div className="chalk-text" style={{ fontSize:20, fontWeight:800, marginTop:2 }}>EVERYTIME</div>
              </div>
              <div>
                <div className="chalk-label">TAKE</div>
                <div className="chalk-text" style={{ fontSize:20, fontWeight:800, marginTop:2 }}>01</div>
              </div>
              <div>
                <div className="chalk-label">ROLL</div>
                <div className="chalk-text" style={{ fontSize:20, fontWeight:800, marginTop:2 }}>001</div>
              </div>
              <div>
                <div className="chalk-label">DATE</div>
                <div className="chalk-text" style={{ fontSize:14, fontWeight:700, marginTop:6 }}>{dateStr}</div>
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ height:1, background:"#3a3a3a", marginBottom:14 }} />

            {/* INT/EXT, DAY/NIGHT, CAMERA */}
            <div style={{ display:"flex", alignItems:"center", gap:24, fontFamily:"'Courier New', monospace" }}>
              {/* INT/EXT 박스 */}
              <div style={{ display:"flex", gap:10 }}>
                <CheckBox checked={false} label="INT" />
                <CheckBox checked={true}  label="EXT" />
              </div>
              {/* DAY/NIGHT 박스 */}
              <div style={{ display:"flex", gap:10 }}>
                <CheckBox checked={true}  label="NIGHT" />
                <CheckBox checked={false} label="DAY" />
              </div>
              {/* CAMERA */}
              <div style={{ marginLeft:"auto" }}>
                <span className="chalk-label" style={{ marginRight:6 }}>CAMERA</span>
                <span className="chalk-text" style={{ fontSize:14, fontWeight:700 }}>A</span>
              </div>
            </div>
          </div>

          {/* ── 상단 클래퍼 (회전 애니메이션) ── */}
          <div style={{
            position:"absolute",
            top: 0, left: 0, right: 0,
            height: 92,
            backgroundImage:"repeating-linear-gradient(118deg, #f5f1e8 0 32px, #1a1a1a 32px 64px)",
            border:"4px solid #2a2a2a",
            borderRadius: 6,
            transformOrigin: "bottom left",
            animation: phase >= 1
              ? "slateClap 1.2s cubic-bezier(0.45, 0, 0.15, 1) forwards"
              : "slateBreathe 2.5s ease-in-out infinite",
            boxShadow:"0 6px 20px rgba(0,0,0,0.6)",
          }}>
            {/* 좌측 힌지 디테일 (작은 동그라미) */}
            <div style={{
              position:"absolute", bottom:-6, left:8,
              width:12, height:12, borderRadius:"50%",
              background:"#2a2a2a", border:"2px solid #4a4a4a",
              boxShadow:"inset 0 1px 2px rgba(0,0,0,0.5)",
            }} />
          </div>
        </div>
      )}

      {/* 화면 플래시 (clap 임팩트 순간) */}
      {phase === 1 && (
        <div style={{
          position:"absolute", inset:0,
          background:"#fff",
          opacity: 0,
          animation: "screenFlash 0.5s ease-out 0.75s",
          pointerEvents:"none",
          mixBlendMode: "screen",
        }} />
      )}

      {/* 🎬 메인 로고 + 부제 */}
      <div style={{
        position:"absolute", inset:0,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        textAlign:"center", padding:20,
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "scale(1)" : "scale(0.92)",
        transition:"opacity 0.8s ease-out 0.2s, transform 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
        pointerEvents: phase >= 2 ? "auto" : "none",
      }}>
        <div style={{
          fontSize:13, color:"#dc2626", fontWeight:700, letterSpacing:"0.45em",
          marginBottom:22, textTransform:"uppercase",
        }}>
          ZZOTKYO PRESENTATION
        </div>
        <div style={{
          fontSize:56, fontWeight:900, color:"#fafaf9",
          letterSpacing:"0.05em", lineHeight:1, marginBottom:18,
          textShadow:"0 4px 24px rgba(220, 38, 38, 0.5)",
        }}>
          에브리타임
        </div>
        <div style={{
          fontSize:12, color:"#a8a29e", fontWeight:500, letterSpacing:"0.3em",
        }}>
          BEHIND THE SCENES · FILM DEPARTMENT
        </div>
        <div style={{
          marginTop:24, width:60, height:2, background:"#dc2626",
          opacity:0.7,
        }} />
      </div>
    </div>
  );
}

/** 슬레이트 체크박스 */
function CheckBox({ checked, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
      <div style={{
        width:14, height:14,
        border:"1.5px solid #6a6356",
        borderRadius:2,
        display:"flex", alignItems:"center", justifyContent:"center",
        background: checked ? "transparent" : "transparent",
      }}>
        {checked && (
          <div style={{
            width:8, height:8,
            background:"#ede6cf",
            boxShadow:"0 0 3px rgba(255,255,255,0.3)",
          }} />
        )}
      </div>
      <span style={{
        fontSize:10, color: checked ? "#ede6cf" : "#6a6356",
        fontWeight: checked ? 700 : 500,
        letterSpacing:"0.15em",
        textShadow: checked ? "0 0 2px rgba(255,255,255,0.25)" : "none",
        fontFamily:"'Courier New', monospace",
      }}>{label}</span>
    </div>
  );
}
