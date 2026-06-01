import { useEffect, useState } from "react";

/**
 * 에브리타임 진입 인트로 - 영화 슬레이트(클래퍼보드) 연출
 *
 * 단계:
 *  0~0.4s: 슬레이트 등장 (상단 바 열린 상태)
 *  0.4~1.1s: 슬레이트 SNAP 닫힘 (clap! + bounce)
 *  1.1~1.3s: 화면 플래시 (촬영 시작 느낌)
 *  1.3~2.5s: 로고 + 부제 페이드인
 *  2.5~2.8s: 페이드아웃
 *  2.8s: onComplete
 */
export default function EveryTimeIntro({ onComplete }) {
  const [phase, setPhase] = useState(0);
  // 0: 슬레이트 열림, 1: 닫히는 중, 2: 플래시·로고, 3: 페이드아웃
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);   // clap 시작
    const t2 = setTimeout(() => setPhase(2), 1150);  // 슬레이트 사라지고 로고
    const t3 = setTimeout(() => setExiting(true), 2700); // 페이드아웃
    const t4 = setTimeout(() => onComplete && onComplete(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:99999,
      background:"#000",
      display:"flex", alignItems:"center", justifyContent:"center",
      opacity: exiting ? 0 : 1,
      transition:"opacity 0.3s ease-out",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes slateClap {
          0%   { transform: rotate(-32deg); }
          55%  { transform: rotate(0deg); }
          65%  { transform: rotate(4deg); }
          78%  { transform: rotate(-1.5deg); }
          90%  { transform: rotate(0.5deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes screenFlash {
          0%   { opacity: 0; }
          15%  { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0); }
          20%      { transform: translate(-3px, 2px); }
          40%      { transform: translate(2px, -2px); }
          60%      { transform: translate(-2px, 1px); }
          80%      { transform: translate(2px, -1px); }
        }
      `}</style>

      {/* 비네트 효과 */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)",
        opacity:0.5,
      }} />

      {/* 필름 perforations (위·아래) */}
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
        position:"absolute", top:48, left:24,
        fontSize:10, color:"#dc2626", fontWeight:700, letterSpacing:"0.2em",
        opacity:0.8,
      }}>
        ● REC
      </div>
      {/* 우상단 날짜 */}
      <div style={{
        position:"absolute", top:48, right:24,
        fontSize:10, color:"#fafaf9", fontWeight:400, letterSpacing:"0.2em",
        opacity:0.5,
      }}>
        {new Date().toLocaleDateString("ko-KR")}
      </div>

      {/* 🎬 슬레이트(클래퍼보드) - phase 0,1 표시 */}
      {phase < 2 && (
        <div style={{
          position:"relative",
          width: 300, height: 200,
          animation: phase === 1 ? "screenShake 0.15s ease-out 0.55s" : "none",
        }}>
          {/* 하단 정보판 (칠판 영역) */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            height: 140,
            background:"#0d0d0d",
            border:"3px solid #2a2a2a",
            borderRadius:4,
            padding:"16px 18px",
            color:"#fafaf9",
            fontFamily:"'Courier New', monospace",
            fontSize: 11,
            letterSpacing: "0.05em",
            lineHeight: 1.9,
            boxShadow:"0 8px 30px rgba(0,0,0,0.6)",
          }}>
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <span style={{color:"#a8a29e"}}>PROD.</span>
              <span style={{fontWeight:700}}>ZZOTKYO</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <span style={{color:"#a8a29e"}}>SCENE</span>
              <span style={{fontWeight:700}}>EVERYTIME</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <span style={{color:"#a8a29e"}}>TAKE</span>
              <span style={{fontWeight:700}}>01</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <span style={{color:"#a8a29e"}}>DATE</span>
              <span style={{fontWeight:700}}>{new Date().toLocaleDateString("ko-KR")}</span>
            </div>
          </div>

          {/* 상단 슬레이트 바 (클래퍼) - 회전 애니메이션 */}
          <div style={{
            position:"absolute",
            top: 0, left: 0, right: 0,
            height: 48,
            backgroundImage:"repeating-linear-gradient(115deg, #fafaf9 0 22px, #1a1a1a 22px 44px)",
            border:"3px solid #2a2a2a",
            borderRadius: 4,
            transformOrigin: "bottom left",
            animation: phase >= 1 ? "slateClap 0.75s cubic-bezier(0.4, 0.6, 0.25, 1) forwards" : "none",
            transform: phase >= 1 ? undefined : "rotate(-32deg)",
            boxShadow:"0 4px 15px rgba(0,0,0,0.5)",
          }} />
        </div>
      )}

      {/* 화면 플래시 (clap 임팩트 순간) */}
      {phase === 1 && (
        <div style={{
          position:"absolute", inset:0,
          background:"#fff",
          opacity: 0,
          animation: "screenFlash 0.4s ease-out 0.5s",
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
        transition:"opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: phase >= 2 ? "auto" : "none",
      }}>
        <div style={{
          fontSize:13, color:"#dc2626", fontWeight:700, letterSpacing:"0.4em",
          marginBottom:20, textTransform:"uppercase",
        }}>
          ZZOTKYO PRESENTATION
        </div>
        <div style={{
          fontSize:52, fontWeight:900, color:"#fafaf9",
          letterSpacing:"0.05em", lineHeight:1, marginBottom:16,
          textShadow:"0 4px 20px rgba(220, 38, 38, 0.5)",
        }}>
          에브리타임
        </div>
        <div style={{
          fontSize:12, color:"#a8a29e", fontWeight:500, letterSpacing:"0.25em",
        }}>
          BEHIND THE SCENES · FILM DEPARTMENT
        </div>
        <div style={{
          marginTop:22, width:60, height:2, background:"#dc2626",
          opacity:0.7,
        }} />
      </div>
    </div>
  );
}
