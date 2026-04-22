import { useRef, useEffect, useState } from "react";
import { C } from "../theme";

export default function SignaturePad({ onSave, onCancel, title = "서명" }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty]     = useState(true);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    setEmpty(false);
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const pos    = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = (e) => {
    e.preventDefault();
    setDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };

  const save = () => {
    if (empty) { alert("서명을 입력해주세요"); return; }
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div style={{ background:"#fff", borderRadius:16, padding:24, maxWidth:480, margin:"0 auto" }}>
      <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>아래 칸에 서명해주세요</div>

      <div style={{ border:`2px solid ${C.border}`, borderRadius:12, overflow:"hidden", background:"#fafafa", marginBottom:12, touchAction:"none" }}>
        <canvas
          ref={canvasRef}
          width={440}
          height={180}
          style={{ display:"block", width:"100%", height:180, cursor:"crosshair" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ fontSize:12, color:C.muted }}>✍️ 마우스 또는 터치로 서명하세요</div>
        <button onClick={clear} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 12px", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
          다시 쓰기
        </button>
      </div>

      <div style={{ display:"flex", gap:10 }}>
        {onCancel && <button onClick={onCancel} style={{ flex:1, background:"none", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"11px 0", fontSize:14, fontWeight:600, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>취소</button>}
        <button onClick={save} style={{ flex:2, background:C.navy, border:"none", borderRadius:10, padding:"11px 0", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit" }}>
          서명 완료
        </button>
      </div>
    </div>
  );
}
