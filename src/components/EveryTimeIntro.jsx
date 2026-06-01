import { useEffect, useState } from "react";

/**
 * 에브리타임 진입 인트로 - 넷플릭스 스타일 시네마 인트로
 * 약 2.5초 후 자동으로 onComplete 콜백 호출
 *
 * 단계:
 *  0~0.3s: 검은 배경 페이드인
 *  0.3~1.0s: 빨간 라인 좌→우 sweep (영화관 커튼 느낌)
 *  1.0~2.2s: 로고 + 부제 페이드인 + 살짝 줌인
 *  2.2~2.5s: 전체 페이드아웃
 */
export default function EveryTimeIntro({ onComplete }) {
  const [phase, setPhase] = useState(0); // 0:fadein, 1:line, 2:logo, 3:fadeout
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);   // 빨간 라인 시작
    const t2 = setTimeout(() => setPhase(2), 1000);  // 로고 표시
    const t3 = setTimeout(() => setExiting(true), 2200); // 페이드아웃 시작
    const t4 = setTimeout(() => onComplete && onComplete(), 2500); // 완료
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
      {/* 필름 그레인 효과 (CSS) */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 100%)",
        opacity:0.5,
      }} />

      {/* 영화 필름 perforations (위아래 점선) */}
      <div style={{
        position:"absolute", top:20, left:0, right:0, height:14,
        backgroundImage:"repeating-linear-gradient(90deg, #1a1a1a 0px, #1a1a1a 18px, #0a0a0a 18px, #0a0a0a 26px)",
        opacity:0.6,
      }} />
      <div style={{
        position:"absolute", bottom:20, left:0, right:0, height:14,
        backgroundImage:"repeating-linear-gradient(90deg, #1a1a1a 0px, #1a1a1a 18px, #0a0a0a 18px, #0a0a0a 26px)",
        opacity:0.6,
      }} />

      {/* 빨간 라인 sweep (좌→우) */}
      <div style={{
        position:"absolute", top:"50%", left:0, height:2,
        background:"linear-gradient(90deg, transparent, #dc2626 30%, #ef4444 50%, #dc2626 70%, transparent)",
        width: phase >= 1 ? "100%" : "0%",
        opacity: phase >= 1 && phase < 3 ? 1 : 0,
        transition:"width 0.7s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.4s",
        boxShadow:"0 0 20px #dc2626, 0 0 40px #dc2626",
        transform:"translateY(-50%)",
      }} />

      {/* 중앙 로고/텍스트 */}
      <div style={{
        position:"relative", zIndex:2,
        textAlign:"center",
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "scale(1)" : "scale(0.85)",
        transition:"opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{
          fontSize:14, color:"#dc2626", fontWeight:700, letterSpacing:"0.4em",
          marginBottom:18, textTransform:"uppercase",
        }}>
          A KBAS PRESENTATION
        </div>
        <div style={{
          fontSize:48, fontWeight:900, color:"#fafaf9",
          letterSpacing:"0.05em", lineHeight:1, marginBottom:10,
          textShadow:"0 4px 20px rgba(220, 38, 38, 0.5)",
          fontFamily:"'Bebas Neue', 'Impact', sans-serif",
        }}>
          에브리타임
        </div>
        <div style={{
          fontSize:13, color:"#a8a29e", fontWeight:400, letterSpacing:"0.25em",
          textTransform:"uppercase",
        }}>
          음지력 충전소 — 익명 커뮤니티
        </div>
        <div style={{
          marginTop:24, width:60, height:2, background:"#dc2626",
          margin:"24px auto 0", opacity:0.7,
        }} />
      </div>

      {/* 좌측 빨간 박스 (영화 카운트다운 느낌) */}
      <div style={{
        position:"absolute", top:50, left:30,
        fontSize:11, color:"#dc2626", fontWeight:700, letterSpacing:"0.2em",
        opacity: phase >= 1 ? 0.7 : 0,
        transition:"opacity 0.4s",
      }}>
        ● REC
      </div>
      <div style={{
        position:"absolute", top:50, right:30,
        fontSize:11, color:"#fafaf9", fontWeight:400, letterSpacing:"0.2em",
        opacity: phase >= 1 ? 0.5 : 0,
        transition:"opacity 0.4s",
      }}>
        {new Date().toLocaleDateString("ko-KR")}
      </div>
    </div>
  );
}
