import { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import SignaturePad from "../../components/SignaturePad";
import { useCollection, updateItem } from "../../hooks/useFirestore";
import { PauseCircle } from "lucide-react";

const STATUS_TABS_SUPER = ["전체", "승인대기", "승인됨", "대여중", "보류", "거절됨", "반납완료"];
const STATUS_TABS_SUB   = ["승인됨", "대여중", "반납완료", "연체"];
const STATUS_ICON = { 승인대기: "⏳", 승인됨: "✅", 대여중: "🚀", 보류: null, 거절됨: "❌", 반납완료: "📦" };

// ── QR 체크리스트 컴포넌트 (카메라 + 리더기 겸용) ─────────
function QRChecklist({ checklist, onUpdate, onPrev, onConfirm, submitting, mode = "rental" }) {
  // mode = "rental" | "return" (대여/반납 구분 prop)
  const inputRef     = useRef(null);
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);
  const streamRef    = useRef(null);
  const cooldownRef  = useRef(false);    // 스캔 쿨다운
  const checklistRef = useRef(checklist); // 항상 최신 checklist 참조

  // checklist prop 변경 시 ref 동기화
  useEffect(() => { checklistRef.current = checklist; }, [checklist]);

  const [scanMode, setScanMode]  = useState("camera"); // "camera" | "reader"
  const [qrInput, setQrInput]   = useState("");
  const [lastMsg, setLastMsg]   = useState(null);
  const [camErr, setCamErr]     = useState(null);
  const [scanning, setScanning] = useState(false);

  const allDone   = checklist.every(c => c.checked);
  const doneCount = checklist.filter(c => c.checked).length;

  const showMsg = (text, ok) => {
    setLastMsg({ text, ok });
    setTimeout(() => setLastMsg(null), ok ? 2000 : 3000);
  };

  // handleScan: checklistRef로 항상 최신값 참조 → stale closure 방지
  const handleScan = useCallback((raw) => {
    if (cooldownRef.current) return; // 쿨다운 중이면 무시
    const val = raw.trim();
    if (!val) return;

    const cl  = checklistRef.current;
    const idx = cl.findIndex(c =>
      !c.checked && (
        c.itemNo === val ||
        c.unitId === val ||
        (c.itemNo && val.includes(c.itemNo)) ||
        (c.itemNo && c.itemNo.includes(val))
      )
    );

    // 쿨다운 시작 (성공/실패 무관하게 1.5초 차단)
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 1500);

    if (idx === -1) {
      // 이미 전부 체크됐으면 메시지 안 띄움
      if (cl.every(c => c.checked)) return;
      showMsg(`"${val}" — 목록에 없는 장비예요`, false);
      return;
    }

    const newCL = cl.map((c, i) => i === idx ? { ...c, checked: true } : c);
    onUpdate(newCL);
    showMsg(`✅ ${cl[idx].label} ${cl[idx].itemNo} 확인!`, true);
  }, [onUpdate]); // onUpdate만 의존 → checklist 변경에 영향받지 않음

  // 카메라 시작
  const startCamera = useCallback(async () => {
    setCamErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
      }
    } catch (e) {
      setCamErr("카메라 권한이 필요합니다. 브라우저 설정에서 허용해주세요.");
    }
  }, []);

  // 카메라 중지
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setScanning(false);
  }, []);

  // QR 프레임 분석 - handleScan만 의존하므로 재생성 최소화
  const tick = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
    if (code?.data) {
      handleScan(code.data);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [handleScan]);

  useEffect(() => {
    if (scanMode === "camera") {
      startCamera();
    } else {
      stopCamera();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => stopCamera();
  }, [mode]);

  useEffect(() => {
    if (scanning) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [scanning, tick]);

  return (
    <>
      <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>
        {mode === "return" ? "반납 QR 체크" : "장비 QR 체크"}
      </div>

      {/* 진행바 */}
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:12, color:C.muted }}>진행 현황</span>
        <span style={{ fontSize:12, fontWeight:700, color: allDone ? C.green : C.blue }}>{doneCount} / {checklist.length}</span>
      </div>
      <div style={{ background:C.border, borderRadius:6, height:8, overflow:"hidden", marginBottom:14 }}>
        <div style={{ width:`${(doneCount/checklist.length)*100}%`, background: allDone ? C.green : C.blue, height:"100%", borderRadius:6, transition:"width 0.3s" }} />
      </div>

      {/* 모드 탭 */}
      <div style={{ display:"flex", background:C.bg, borderRadius:10, padding:3, marginBottom:14, border:`1px solid ${C.border}` }}>
        {[["camera","📷 카메라"],["reader","🔫 리더기"]].map(([m, label]) => (
          <button key={m} onClick={() => setScanMode(m)} style={{
            flex:1, padding:"7px 0", borderRadius:8, border:"none", fontSize:13, fontWeight:700, cursor:"pointer",
            background: mode===m ? C.navy : "transparent", color: mode===m ? "#fff" : C.muted,
          }}>{label}</button>
        ))}
      </div>

      {/* 스캔 결과 메시지 */}
      {lastMsg && (
        <div style={{ background: lastMsg.ok ? C.greenLight : C.redLight, color: lastMsg.ok ? C.green : C.red, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, marginBottom:10 }}>
          {lastMsg.text}
        </div>
      )}

      {/* 카메라 모드 */}
      {scanMode === "camera" && (
        <div style={{ marginBottom:14 }}>
          {camErr ? (
            <div style={{ background:C.redLight, borderRadius:10, padding:"14px", fontSize:13, color:C.red, marginBottom:10 }}>
              {camErr}
              <button onClick={startCamera} style={{ display:"block", marginTop:8, background:C.red, color:"#fff", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>
                다시 시도
              </button>
            </div>
          ) : (
            <div style={{ position:"relative", borderRadius:12, overflow:"hidden", background:"#000", aspectRatio:"4/3" }}>
              <video ref={videoRef} style={{ width:"100%", height:"100%", objectFit:"cover" }} playsInline muted />
              {/* 스캔 가이드 */}
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                <div style={{ width:200, height:200, border:"3px solid rgba(255,255,255,0.8)", borderRadius:16, boxShadow:"0 0 0 9999px rgba(0,0,0,0.3)" }} />
              </div>
              <div style={{ position:"absolute", bottom:12, left:0, right:0, textAlign:"center", color:"rgba(255,255,255,0.8)", fontSize:12 }}>
                QR 코드를 가이드 안에 맞춰주세요
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display:"none" }} />
        </div>
      )}

      {/* 리더기 모드 */}
      {scanMode === "reader" && (
        <div style={{ position:"relative", marginBottom:14 }}>
          <input
            ref={inputRef}
            value={qrInput}
            onChange={e => setQrInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && qrInput.trim()) { handleScan(qrInput); setQrInput(""); }
            }}
            placeholder="QR 리더기로 스캔 또는 직접 입력 후 Enter"
            style={{ display:"block", width:"100%", background:C.bg, border:`2px solid ${C.blue}`, borderRadius:10, color:C.text, padding:"11px 16px", fontSize:14, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }}
          />
          {qrInput && (
            <button onClick={() => { handleScan(qrInput); setQrInput(""); }}
              style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:C.blue, color:"#fff", border:"none", borderRadius:8, padding:"5px 12px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              확인
            </button>
          )}
        </div>
      )}

      {/* 체크리스트 */}
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
        {checklist.map((item, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, background: item.checked ? C.greenLight : C.bg, borderRadius:10, padding:"10px 14px", border:`1.5px solid ${item.checked ? C.green : C.border}` }}>
            <div style={{ width:24, height:24, borderRadius:6, flexShrink:0, background: item.checked ? C.green : "#fff", border:`2px solid ${item.checked ? C.green : C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14, fontWeight:700 }}>
              {item.checked ? "✓" : ""}
            </div>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:14, fontWeight:600, color: item.checked ? C.green : C.text }}>{item.label}</span>
              {item.itemNo && <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>{item.itemNo}</span>}
            </div>
            {!item.checked && (
              <button onClick={() => onUpdate(checklist.map((c,j) => j===i ? {...c,checked:true} : c))}
                style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 8px", fontSize:11, color:C.muted, cursor:"pointer" }}>
                수동
              </button>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <div style={{ background:C.greenLight, borderRadius:10, padding:"10px 14px", fontSize:13, color:C.green, fontWeight:700, marginBottom:14, textAlign:"center" }}>
          {mode === "return" ? "✅ 모든 장비 반납 확인 완료!" : "✅ 모든 장비 확인 완료!"}
        </div>
      )}

      <div style={{ display:"flex", gap:10 }}>
        <Btn onClick={onPrev} color={C.muted} outline full>{mode === "return" ? "취소" : "← 이전"}</Btn>
        <Btn onClick={onConfirm} color={mode === "return" ? C.teal : C.green} full disabled={submitting || !allDone}>
          {submitting ? "처리중..." : mode === "return" ? "📦 반납 완료" : "🚀 대여 시작"}
        </Btn>
      </div>
    </>
  );
}

export default function Rental({ subAdmin = false }) {
  const { data: requests }   = useCollection("rentalRequests", "createdAt");
  const { data: equipments } = useCollection("equipments", "createdAt");

  const STATUS_TABS = subAdmin ? STATUS_TABS_SUB : STATUS_TABS_SUPER;
  const [tab, setTab]             = useState(subAdmin ? "대여중" : "승인대기");
  const [actionTarget, setActionTarget] = useState(null);
  const [signTarget, setSignTarget]     = useState(null); // 서명 대상 request // { request, type: "보류"|"거절" }
  const [reason, setReason]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignModal, setAssignModal] = useState(null);   // 배치 선택 모달 { request, assignments }
  const [returnModal, setReturnModal] = useState(null);   // 반납 QR 체크 모달 { request, checklist }
  const [swapModal, setSwapModal]     = useState(null);   // 교체 모달 { request, unitIdx }
  const [swapReason, setSwapReason]   = useState("");      // 교체 사유

  // 신청서 출력
  const printRequest = (r) => {
    const storageRows = r.storageForm?.days?.map(d => `
      <tr>
        <td style="background:#fff9db;font-weight:bold;text-align:center">${d.day}<br/><small>${d.date}</small></td>
        <td>${d.keeper || ""}</td>
        <td>${d.equipment || ""}</td>
        <td>${d.location || ""}</td>
        <td>${d.storageTime || ""}</td>
        <td>${d.outTime || ""}</td>
      </tr>`).join("") || "";

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>장비대여 신청서</title>
<style>
  body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; font-size: 13px; padding: 30px; color: #111; }
  h2 { text-align: center; font-size: 20px; margin-bottom: 4px; }
  .sub { text-align: center; color: #666; margin-bottom: 24px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { border: 1px solid #bbb; padding: 7px 10px; }
  th { background: #2C3E6B; color: #fff; text-align: center; font-size: 12px; }
  .section-title { background: #f0f4ff; font-weight: bold; color: #2C3E6B; font-size: 13px; padding: 6px 10px; border-left: 4px solid #2C3E6B; margin: 18px 0 8px; }
  .label { color: #555; font-size: 12px; width: 110px; }
  .sign-area { display: flex; justify-content: flex-end; gap: 40px; margin-top: 30px; font-size: 13px; }
  .sign-box { text-align: center; }
  .sign-line { width: 80px; border-bottom: 1px solid #111; margin: 30px auto 4px; }
  @media print { body { padding: 15px; } button { display: none; } }
</style>
</head>
<body>
<h2>장비 대여 신청서</h2>
<p class="sub">한국방송예술진흥원 미디어센터 장비대여실</p>

<div class="section-title">신청자 정보</div>
<table>
  <tr>
    <td class="label">이름</td><td>${r.studentName || ""}</td>
    <td class="label">학번</td><td>${r.studentId || ""}</td>
  </tr>
  <tr>
    <td class="label">계열</td><td>${r.dept || ""}</td>
    <td class="label">연락처</td><td>${r.phone || ""}</td>
  </tr>
  <tr>
    <td class="label">라이센스</td><td>${r.license || "없음"}</td>
    <td class="label">신청일</td><td>${r.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || ""}</td>
  </tr>
</table>

<div class="section-title">대여 장비</div>
<table>
  <tr><th>장비명</th><th>카테고리</th><th>수량</th><th>비고 (제품번호)</th></tr>
  ${(r.items||[]).map(i => {
    const modelName = i.equipName || i.modelName || "";
    const assigned  = (r.assignedUnits || []).filter(u => u.modelName === modelName);
    const itemNos   = assigned.length > 0 ? assigned.map(u => u.itemNo).filter(Boolean).join(", ") : (i.setItems || "");
    return `<tr><td>${modelName}</td><td>${i.category||""}</td><td style="text-align:center">${i.quantity||1}${i.isSet?" (세트)":""}</td><td>${itemNos}</td></tr>`;
  }).join("")}
</table>

<div class="section-title">대여 정보</div>
<table>
  <tr>
    <td class="label">대여 시작</td><td>${r.startDate || ""} ${r.startTime || ""}</td>
    <td class="label">반납</td><td>${r.endDate || ""} ${r.endTime || ""}</td>
  </tr>
  <tr>
    <td class="label">사용 장소</td><td>${r.locationType ? r.locationType + " - " : ""}${r.location || ""}</td>
    <td class="label">사용 목적</td><td>${r.purpose || ""}</td>
  </tr>
  ${r.courseName ? `<tr><td class="label">수업명</td><td>${r.courseName}</td><td class="label">담당교수</td><td>${r.professorName||""}</td></tr>` : ""}
  ${r.eventName ? `<tr><td class="label">행사명</td><td>${r.eventName}</td><td class="label">담당교수</td><td>${r.eventProfessor||""}</td></tr>` : ""}
  ${r.club ? `<tr><td class="label">동아리</td><td colspan="3">${r.club}</td></tr>` : ""}
  <tr><td class="label">세부내용</td><td colspan="3">${r.purposeDetail || ""}</td></tr>
</table>

<div class="section-title">참여인원 및 비상연락처</div>
<table>
  <tr>
    <td class="label">참여인원<br/>(본인 제외)</td>
    <td style="white-space:pre-line">${r.participants || ""}</td>
    <td class="label">비상연락처</td>
    <td>${r.emergencyContact || ""}</td>
  </tr>
</table>

${r.storageForm ? `
<div class="section-title">장비보관계획서 (주말)</div>
<table>
  <tr>
    <td class="label">대여자</td><td>${r.studentName} / ${r.dept} / ${r.studentId} / ${r.phone}</td>
  </tr>
  <tr>
    <td class="label">보관자 1</td>
    <td>${r.storageForm.keeper1?.name||""} / ${r.storageForm.keeper1?.dept||""} / ${r.storageForm.keeper1?.studentId||""} / ${r.storageForm.keeper1?.phone||""}</td>
  </tr>
  <tr>
    <td class="label">보관자 2</td>
    <td>${r.storageForm.keeper2?.name||""} / ${r.storageForm.keeper2?.dept||""} / ${r.storageForm.keeper2?.studentId||""} / ${r.storageForm.keeper2?.phone||""}</td>
  </tr>
</table>
<table>
  <tr><th>요일</th><th>보관자</th><th>보관 장비</th><th>보관 장소</th><th>보관 일시</th><th>불출 일시</th></tr>
  ${storageRows}
</table>
<p style="text-align:center;font-size:11px;color:#555">모든 안내사항을 확인하였으며 보관 중 발생된 문제에 대한 책임은 대여자 및 보관자에게 있음을 확인합니다.</p>
` : ""}

${r.attachments?.length > 0 ? `
<div class="section-title">첨부 파일</div>
<table>
  ${r.attachments.map((a,i)=>`<tr><td>${i+1}. ${a.name}</td><td><a href="${a.url}">${a.url}</a></td></tr>`).join("")}
</table>` : ""}

<div class="sign-area">
  <div class="sign-box">
    ${r.studentSignature ? `<img src="${r.studentSignature}" style="width:120px;height:60px;object-fit:contain;display:block;margin:0 auto 4px"/>` : `<div class="sign-line"></div>`}
    신청자 서명
  </div>
  <div class="sign-box">
    ${r.adminSignature ? `<img src="${r.adminSignature}" style="width:120px;height:60px;object-fit:contain;display:block;margin:0 auto 4px"/>` : `<div class="sign-line"></div>`}
    담당자 확인
  </div>
</div>

<div style="text-align:center;margin-top:30px">
  <button onclick="window.print()" style="padding:10px 30px;background:#2C3E6B;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit">🖨️ 인쇄 / PDF 저장</button>
</div>
</body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  const filtered = tab === "전체" ? requests : requests.filter(r => r.status === tab);
  const sorted   = [...filtered].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  // 장비 status 업데이트 (대여가능 ↔ 대여중)
  const updateAvailable = async (items, delta) => {
    if (!items) return;
    const modelQty = {};
    items.forEach(item => {
      const key = item.modelName || item.equipName || "";
      if (key) modelQty[key] = (modelQty[key] || 0) + (item.quantity || 1);
    });
    for (const [modelName, qty] of Object.entries(modelQty)) {
      const units = equipments.filter(e => (e.modelName || e.name) === modelName);
      let remaining = Math.abs(qty);
      if (delta < 0) {
        // 대여 나감: 대여가능 → 대여중
        for (const unit of units) {
          if (remaining <= 0) break;
          if ((unit.status || "대여가능") === "대여가능") {
            await updateItem("equipments", unit.id, { status: "대여중", available: 0 });
            remaining--;
          }
        }
      } else {
        // 반납: 대여중 → 대여가능
        for (const unit of units) {
          if (remaining <= 0) break;
          if (unit.status === "대여중") {
            await updateItem("equipments", unit.id, { status: "대여가능", available: 1 });
            remaining--;
          }
        }
      }
    }
  };

  // 예약 확정 (equipment.status 변경 없음 - 아직 물리 대여 전)
  const approve = async (r, adminSignature) => {
    await updateItem("rentalRequests", r.id, { status: "승인됨", reason: "", adminSignature: adminSignature || "" });
  };

  // 배치 선택 모달 열기 (자동배치 기본값 + 체크리스트)
  const openAssignModal = (r) => {
    const assignments = [];
    const modelQty = {};
    (r.items || []).forEach(item => {
      const key = item.modelName || item.equipName || "";
      if (key) modelQty[key] = (modelQty[key] || 0) + (item.quantity || 1);
    });
    for (const [modelName, qty] of Object.entries(modelQty)) {
      const availUnits = equipments
        .filter(e => (e.modelName || e.name) === modelName && (e.status || "대여가능") === "대여가능")
        .sort((a, b) => (a.itemNo || "").localeCompare(b.itemNo || ""));
      for (let i = 0; i < qty; i++) {
        assignments.push({ modelName, selectedUnit: availUnits[i] || null, availUnits });
      }
    }
    // 체크리스트 = 배치 확정된 유닛의 itemNo 기반 (QR 스캔 매칭용)
    const checklist = assignments
      .filter(a => a.selectedUnit)
      .map(a => ({
        label:   a.selectedUnit.itemName || a.modelName,
        itemNo:  a.selectedUnit.itemNo || "",
        unitId:  a.selectedUnit.id,
        modelName: a.modelName,
        checked: false,
      }));
    setAssignModal({ request: r, assignments, checklist, checkStep: false, qrInput: "" });
  };

  // 배치 확정 → 대여 시작
  const confirmAssign = async () => {
    const { request, assignments } = assignModal;
    setSubmitting(true);
    try {
      const assignedUnits = [];
      for (const a of assignments) {
        if (!a.selectedUnit) continue;
        await updateItem("equipments", a.selectedUnit.id, { status: "대여중" });
        assignedUnits.push({
          modelName: a.modelName,
          itemNo:    a.selectedUnit.itemNo || "",
          unitId:    a.selectedUnit.id,
          itemName:  a.selectedUnit.itemName || "",
        });
      }
      await updateItem("rentalRequests", request.id, { status: "대여중", assignedUnits });
      setAssignModal(null);
    } catch(e) { alert("오류: " + e.message); }
    finally { setSubmitting(false); }
  };

  // 장비 교체 확정
  const confirmSwap = async (newUnit) => {
    const { request, unitIdx } = swapModal;
    setSubmitting(true);
    try {
      const oldUnit = request.assignedUnits[unitIdx];
      if (oldUnit?.unitId) await updateItem("equipments", oldUnit.unitId, { status: "대여가능" });
      await updateItem("equipments", newUnit.id, { status: "대여중" });
      const newAssigned = request.assignedUnits.map((u, i) => i === unitIdx ? {
        modelName:  u.modelName,
        itemNo:     newUnit.itemNo || "",
        unitId:     newUnit.id,
        itemName:   newUnit.itemName || "",
        swapReason: swapReason.trim() || "",
        swapFrom:   u.itemNo || "",
      } : u);
      await updateItem("rentalRequests", request.id, { assignedUnits: newAssigned });
      setSwapModal(null);
      setSwapReason("");
    } catch(e) { alert("오류: " + e.message); }
    finally { setSubmitting(false); }
  };

  // 실제 장비 수령 시 대여 시작 처리 + itemNo 자동 배치
  const startRental = async (r) => {
    const assignedUnits = []; // 배치된 개별 장비 기록

    const modelQty = {};
    (r.items || []).forEach(item => {
      const key = item.modelName || item.equipName || "";
      if (key) modelQty[key] = (modelQty[key] || 0) + (item.quantity || 1);
    });

    for (const [modelName, qty] of Object.entries(modelQty)) {
      // 대여가능 상태인 유닛만, itemNo 순으로 정렬
      const availUnits = equipments
        .filter(e => (e.modelName || e.name) === modelName && (e.status || "대여가능") === "대여가능")
        .sort((a, b) => (a.itemNo || "").localeCompare(b.itemNo || ""));

      let remaining = qty;
      for (const unit of availUnits) {
        if (remaining <= 0) break;
        await updateItem("equipments", unit.id, { status: "대여중" });
        assignedUnits.push({
          modelName,
          itemNo:   unit.itemNo || "",
          unitId:   unit.id,
          itemName: unit.itemName || "",
        });
        remaining--;
      }
    }

    // 배치 결과를 rentalRequest에 저장
    await updateItem("rentalRequests", r.id, {
      status: "대여중",
      assignedUnits,
    });
  };

  const confirmAction = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    const prevStatus = actionTarget.request.status;
    await updateItem("rentalRequests", actionTarget.request.id, {
      status: actionTarget.type,
      reason: reason,
    });
    // 대여중이었으면 재고 복구 (승인됨은 equipment.status 미변경이므로 복구 불필요)
    if (prevStatus === "대여중") {
      await updateAvailable(actionTarget.request.items, +1);
    }
    setActionTarget(null);
    setReason("");
    setSubmitting(false);
  };

  // 반납 QR 체크 모달 열기
  const openReturnModal = (r) => {
    const checklist = (r.assignedUnits || []).map(u => ({
      label:     u.itemName || u.modelName,
      itemNo:    u.itemNo || "",
      unitId:    u.unitId,
      modelName: u.modelName,
      checked:   false,
    }));
    // assignedUnits 없으면 items 기반으로 생성
    if (checklist.length === 0) {
      (r.items || []).forEach(item => {
        const name = item.modelName || item.equipName || "";
        for (let i = 0; i < (item.quantity || 1); i++) {
          checklist.push({ label: name, itemNo: "", unitId: "", modelName: name, checked: false });
        }
      });
    }
    setReturnModal({ request: r, checklist });
  };

  const returnDone = async (r) => {
    await updateItem("rentalRequests", r.id, { status: "반납완료" });
    // assignedUnits 기준 복구 (없으면 기존 방식)
    if (r.assignedUnits?.length > 0) {
      for (const unit of r.assignedUnits) {
        await updateItem("equipments", unit.unitId, { status: "대여가능" });
      }
    } else {
      await updateAvailable(r.items, +1);
    }
  };

  const counts = STATUS_TABS.reduce((acc, s) => {
    acc[s] = s === "전체" ? requests.length : requests.filter(r => r.status === s).length;
    return acc;
  }, {});

  return (
    <div>
      <PageTitle>📋 대여 신청 관리</PageTitle>

      {/* 승인대기 알림 */}
      {counts["승인대기"] > 0 && (
        <div style={{ background: C.yellowLight, borderRadius: 14, padding: "14px 18px", marginBottom: 20, border: `1px solid ${C.yellow}40`, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 24 }}>⏳</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>승인 대기 {counts["승인대기"]}건</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>대여 신청이 들어왔습니다. 확인 후 처리해주세요.</div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => setTab(s)} style={{
            background: tab === s ? C.navy : C.surface,
            color: tab === s ? "#fff" : C.muted,
            border: `1px solid ${tab === s ? C.navy : C.border}`,
            borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {s} {counts[s] > 0 && <span style={{ opacity: 0.7 }}>({counts[s]})</span>}
          </button>
        ))}
      </div>

      {/* 신청 목록 */}
      {sorted.length === 0 && <Empty icon="📋" text="대여 신청이 없습니다" />}

      {sorted.map(r => (
        <Card key={r.id} style={{
          border: `2px solid ${
            r.status === "승인대기" ? C.yellow + "50" :
            r.status === "보류"    ? C.orange + "50" :
            r.status === "거절됨"  ? C.red    + "40" :
            r.status === "승인됨"  ? C.teal   + "40" :
            r.status === "대여중"  ? C.blue   + "50" : C.border
          }`
        }}>
          {/* 신청자 정보 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{r.studentName}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{r.studentId ? r.studentId.slice(0,2)+"학번" : ""}</span>
                <span style={{ fontSize: 12, color: C.muted }}>·</span>
                <span style={{ fontSize: 12, color: C.muted }}>{r.dept}</span>
                {r.license && r.license !== "없음" && (
                  <span style={{ background: C.blueLight, color: C.blue, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>라이선스 {r.license}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 4, flexWrap: "wrap" }}>
                {r.phone && <span style={{ fontSize: 12, color: C.muted }}>📞 {r.phone}</span>}
                {r.emergencyContact && <span style={{ fontSize: 12, color: C.red }}>🚨 비상: {r.emergencyContact}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                📅 {r.startDate} {r.startTime} ~ {r.endDate} {r.endTime}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4, flexWrap: "wrap" }}>
                {r.purpose && <span style={{ background: C.purpleLight, color: C.purple, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{r.purpose}</span>}
                {r.purposeDetail && <span style={{ fontSize: 12, color: C.text }}>{r.purposeDetail}</span>}
              </div>
              {r.participants && (
                <div style={{ background: C.bg, borderRadius: 8, padding: "6px 10px", marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>참여인원</div>
                  <div style={{ fontSize: 12, color: C.text, whiteSpace: "pre-line" }}>{r.participants}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 10 }}>
              <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>{r.status === "보류" ? <PauseCircle size={20} color={C.orange} /> : STATUS_ICON[r.status]}</span>
              <Badge label={r.status} />
            </div>
          </div>

          {/* 장비 목록 */}
          <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>신청 장비</div>
            {r.items?.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < r.items.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{item.img}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.equipName}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{item.category}</div>
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{item.quantity}개</span>
              </div>
            ))}
          </div>

          {/* 보류/거절 사유 */}
          {r.reason && (
            <div style={{
              background: r.status === "보류" ? C.yellowLight : C.redLight,
              borderRadius: 10, padding: "10px 14px", marginBottom: 14,
              borderLeft: `4px solid ${r.status === "보류" ? C.yellow : C.red}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: r.status === "보류" ? "#92400E" : C.red, marginBottom: 4 }}>
                {r.status === "보류" ? "보류 사유" : "❌ 거절 사유"}
              </div>
              <div style={{ fontSize: 13, color: C.text }}>{r.reason}</div>
            </div>
          )}

          {/* 출력 버튼 */}
          <div style={{ marginBottom:8 }}>
            <Btn onClick={() => printRequest(r)} color={C.muted} outline full small>🖨️ 신청서 출력</Btn>
          </div>

          {/* 액션 버튼 */}
          {!subAdmin && r.status === "승인대기" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setSignTarget(r)} color={C.green} full>✅ 승인</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "보류" }); setReason(""); }} color={C.yellow} text={C.text} full><PauseCircle size={14} style={{ marginRight: 4 }} />보류</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "거절됨" }); setReason(""); }} color={C.red} full>❌ 거절</Btn>
            </div>
          )}
          {!subAdmin && r.status === "보류" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setSignTarget(r)} color={C.green} full>✅ 승인으로 변경</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "거절됨" }); setReason(""); }} color={C.red} full>❌ 거절</Btn>
            </div>
          )}
          {r.status === "승인됨" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => openAssignModal(r)} color={C.blue} full>🚀 대여 시작</Btn>
              {!subAdmin && <Btn onClick={() => { setActionTarget({ request: r, type: "거절됨" }); setReason(""); }} color={C.red} outline full>❌ 취소</Btn>}
            </div>
          )}
          {r.status === "대여중" && (
            <div>
              {r.assignedUnits?.length > 0 && (
                <div style={{ background:C.blueLight, borderRadius:10, padding:"10px 14px", marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.blue, marginBottom:6 }}>배치된 장비</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {r.assignedUnits.map((u, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#fff", border:`1px solid ${C.blue}30`, borderRadius:8, padding:"6px 12px" }}>
                        <div>
                          <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>
                            {u.itemName || u.modelName}
                            {u.itemNo && <span style={{ color:C.blue, marginLeft:4 }}>{u.itemNo}</span>}
                          </span>
                          {u.swapReason && (
                            <div style={{ fontSize:11, color:C.orange, marginTop:2 }}>
                              교체됨 ({u.swapFrom} → {u.itemNo}): {u.swapReason}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setSwapModal({ request: r, unitIdx: i })}
                          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 10px", fontSize:11, color:C.muted, cursor:"pointer" }}>
                          교체
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Btn onClick={() => openReturnModal(r)} color={C.teal} full>📦 반납 처리</Btn>
            </div>
          )}
          {r.status === "반납완료" && r.assignedUnits?.length > 0 && (
            <div style={{ background:"#F8FAFC", borderRadius:10, padding:"10px 14px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:6 }}>사용 장비 기록</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {r.assignedUnits.map((u, i) => (
                  <div key={i} style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:600, color:C.text }}>
                    <div>
                      {u.itemName || u.modelName}
                      {u.itemNo && <span style={{ color:C.blue, marginLeft:4 }}>{u.itemNo}</span>}
                    </div>
                    {u.swapReason && (
                      <div style={{ fontSize:11, color:C.orange, fontWeight:400, marginTop:2 }}>
                        교체: {u.swapFrom} → {u.itemNo} / {u.swapReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}

      {/* 관리자 서명 모달 */}
      {signTarget && (
        <Modal onClose={() => setSignTarget(null)} width={520}>
          <SignaturePad
            title="✍️ 관리자 서명"
            onSave={async (sig) => {
              try {
                await approve(signTarget, sig);
              } catch(e) {
                console.error("승인 오류:", e);
              } finally {
                setSignTarget(null);
              }
            }}
            onCancel={() => setSignTarget(null)}
          />
        </Modal>
      )}

      {/* 보류/거절 사유 입력 모달 */}
      {actionTarget && (
        <Modal onClose={() => { setActionTarget(null); setReason(""); }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: actionTarget.type === "보류" ? "#92400E" : C.red, marginBottom: 6 }}>
            {actionTarget.type === "보류" ? "보류 처리" : "❌ 거절 처리"}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
            {actionTarget.request.studentName} · {actionTarget.request.purpose}
          </div>

          {/* 장비 요약 */}
          <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
            {actionTarget.request.items?.map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, padding: "3px 0" }}>
                {item.img} {item.equipName} × {item.quantity}개
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              {actionTarget.type === "보류" ? "보류 사유 *" : "거절 사유 *"}
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 6 }}>(학생에게 표시됩니다)</span>
            </div>
            <textarea
              placeholder={actionTarget.type === "보류" ? "예: 해당 기간 이미 예약된 장비가 있습니다." : "예: 신청 수량이 재고를 초과합니다."}
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 100, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn onClick={() => { setActionTarget(null); setReason(""); }} color={C.muted} outline full>취소</Btn>
            <Btn
              onClick={confirmAction}
              color={actionTarget.type === "보류" ? C.yellow : C.red}
              text={actionTarget.type === "보류" ? C.text : "#fff"}
              full
              disabled={submitting || !reason.trim()}
            >
              {submitting ? "처리 중..." : actionTarget.type === "보류" ? "보류 처리" : "거절 처리"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* ── 반납 QR 체크 모달 ── */}
      {returnModal && (
        <Modal onClose={() => setReturnModal(null)} width={520}>
          <QRChecklist
            checklist={returnModal.checklist}
            mode="return"
            onUpdate={newCL => setReturnModal(p => ({ ...p, checklist: newCL }))}
            onPrev={() => setReturnModal(null)}
            onConfirm={async () => {
              await returnDone(returnModal.request);
              setReturnModal(null);
            }}
            submitting={submitting}
          />
        </Modal>
      )}

      {/* ── 배치 선택 모달 ── */}
      {assignModal && (
        <Modal onClose={() => setAssignModal(null)} width={520}>
          {!assignModal.checkStep ? (
            <>
              <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>배치 장비 선택</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>대여할 장비를 확인하고 필요시 변경하세요</div>
              {assignModal.assignments.map((a, i) => (
                <div key={i} style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:12, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>{a.modelName} ({i+1}번째)</div>
                  {a.availUnits.length === 0 ? (
                    <div style={{ fontSize:13, color:C.red }}>대여 가능한 유닛이 없습니다</div>
                  ) : (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {a.availUnits.map(unit => (
                        <button key={unit.id} onClick={() => {
                          const newA = assignModal.assignments.map((x, j) =>
                            j === i ? { ...x, selectedUnit: unit } : x
                          );
                          setAssignModal(p => ({ ...p, assignments: newA }));
                        }} style={{
                          padding:"8px 16px", borderRadius:10, border:`2px solid ${a.selectedUnit?.id === unit.id ? C.blue : C.border}`,
                          background: a.selectedUnit?.id === unit.id ? C.blueLight : "#fff",
                          color: a.selectedUnit?.id === unit.id ? C.blue : C.text,
                          fontSize:13, fontWeight:600, cursor:"pointer",
                        }}>
                          {unit.itemNo || unit.id.slice(-4)}
                        </button>
                      ))}
                    </div>
                  )}
                  {a.selectedUnit && (
                    <div style={{ marginTop:8, fontSize:12, color:C.muted }}>
                      선택됨: <span style={{ color:C.blue, fontWeight:600 }}>{a.selectedUnit.itemNo}</span>
                      {a.selectedUnit.itemName && ` · ${a.selectedUnit.itemName}`}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <Btn onClick={() => setAssignModal(null)} color={C.muted} outline full>취소</Btn>
                <Btn
                  onClick={() => setAssignModal(p => ({ ...p, checkStep: true }))}
                  color={C.blue} full
                  disabled={assignModal.assignments.some(a => !a.selectedUnit)}>
                  다음 → 장비 체크
                </Btn>
              </div>
            </>
          ) : (
            <QRChecklist
              checklist={assignModal.checklist}
              onUpdate={newCL => setAssignModal(p => ({ ...p, checklist: newCL }))}
              onPrev={() => setAssignModal(p => ({ ...p, checkStep: false }))}
              onConfirm={confirmAssign}
              submitting={submitting}
            />
          )}
        </Modal>
      )}

      {/* ── 장비 교체 모달 ── */}
      {swapModal && swapModal.request.assignedUnits[swapModal.unitIdx] && (() => {
        const unit  = swapModal.request.assignedUnits[swapModal.unitIdx];
        const avail = equipments
          .filter(e => (e.modelName || e.name) === unit.modelName && (e.status || "대여가능") === "대여가능")
          .sort((a, b) => (a.itemNo || "").localeCompare(b.itemNo || ""));
        return null; // 아래 SwapModal로 처리
      })()}
      {swapModal && swapModal.request.assignedUnits[swapModal.unitIdx] && (
        <Modal onClose={() => { setSwapModal(null); setSwapReason(""); }} width={460}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>장비 교체</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
            현재:{" "}
            <span style={{ color:C.red, fontWeight:600 }}>
              {swapModal.request.assignedUnits[swapModal.unitIdx].itemName || swapModal.request.assignedUnits[swapModal.unitIdx].modelName}{" "}
              {swapModal.request.assignedUnits[swapModal.unitIdx].itemNo}
            </span>{" "}→ 교체할 유닛 선택
          </div>
          {equipments.filter(e =>
            (e.modelName || e.name) === swapModal.request.assignedUnits[swapModal.unitIdx].modelName &&
            (e.status || "대여가능") === "대여가능"
          ).length === 0 ? (
            <div style={{ background:C.redLight, borderRadius:10, padding:"12px 16px", fontSize:13, color:C.red, marginBottom:16 }}>
              교체 가능한 유닛이 없습니다
            </div>
          ) : (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {equipments
                .filter(e =>
                  (e.modelName || e.name) === swapModal.request.assignedUnits[swapModal.unitIdx].modelName &&
                  (e.status || "대여가능") === "대여가능"
                )
                .sort((a, b) => (a.itemNo || "").localeCompare(b.itemNo || ""))
                .map(u => (
                  <button
                    key={u.id}
                    onClick={(e) => { e.stopPropagation(); confirmSwap(u); }}
                    disabled={submitting}
                    style={{ padding:"10px 20px", borderRadius:10, border:`1.5px solid ${C.blue}`, background:C.blueLight, color:C.blue, fontSize:14, fontWeight:700, cursor:"pointer", opacity: submitting ? 0.5 : 1 }}>
                    {u.itemNo || u.id.slice(-4)}
                  </button>
                ))
              }
            </div>
          )}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>교체 사유 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
            <textarea
              placeholder={"예: 고장으로 인한 교체, 학생 요청으로 교체 등"}
              value={swapReason}
              onChange={e => setSwapReason(e.target.value)}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }}
            />
          </div>
          <Btn onClick={() => { setSwapModal(null); setSwapReason(""); }} color={C.muted} outline full>취소</Btn>
        </Modal>
      )}

    </div>
  );
}
