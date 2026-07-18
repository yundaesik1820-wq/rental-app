import { useState, useEffect } from "react";
import { C } from "../../theme";
import { Card, Badge, Empty, StatBox, Btn } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { FileText, CalendarDays, MapPin, Camera, ChevronDown } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "../../firebase";

const STATUS_ICON = { 승인대기: "⏳", 승인됨: "✅", 보류: "⏸", 거절됨: "❌", 반납완료: "📦", 대여중: "🚀" };

// ── 예약내역 새 디자인 (홈 톤 블루 계열) ──
const CARD_BG = "#141824", CARD2 = "#10131d", BD = "#232a3a";
const PAL = {
  blue:   { line:"linear-gradient(#3b82f6,#2563eb)", bg:"rgba(59,130,246,.16)", fg:"#7fa9ff", big:"#5b9bff", dot:"#3b82f6" },
  teal:   { line:"linear-gradient(#2DD4BF,#0ea5a5)", bg:"rgba(45,212,191,.16)", fg:"#5eead4", big:"#2DD4BF", dot:"#2DD4BF" },
  purple: { line:"linear-gradient(#a78bfa,#7c3aed)", bg:"rgba(167,139,250,.16)", fg:"#c4b5fd", big:"#c4b5fd", dot:"#a78bfa" },
  red:    { line:"linear-gradient(#ef4444,#b91c1c)", bg:"rgba(239,68,68,.16)", fg:"#fca5a5", big:"#fca5a5", dot:"#ef4444" },
  amber:  { line:"linear-gradient(#f59e0b,#d97706)", bg:"rgba(245,158,11,.16)", fg:"#fcd34d", big:"#fcd34d", dot:"#f59e0b" },
  gray:   { line:"linear-gradient(#64748b,#475569)", bg:"rgba(148,163,184,.16)", fg:"#cbd5e1", big:"#cbd5e1", dot:"#64748b" },
};
const STATUS_CFG = {
  대여중:   { pal:"blue",   badge:"대여중",   box:"반납 예정일", use:"end",   photoBtn:true },
  승인됨:   { pal:"teal",   badge:"승인완료", box:"대여 예정일", use:"start" },
  승인대기: { pal:"amber",  badge:"승인대기", box:"대여 예정일", use:"start" },
  반납완료: { pal:"purple", badge:"반납완료", box:"반납일",     use:"end" },
  연체:     { pal:"red",    badge:"연체중",   box:"연체 기간",   use:"overdue" },
  거절됨:   { pal:"red",    badge:"거절됨",   box:"대여 예정일", use:"start" },
  보류:     { pal:"amber",  badge:"보류",     box:"대여 예정일", use:"start" },
};
const WD = ["일","월","화","수","목","금","토"];
const parseYMD = (s) => { if (!s) return null; const p = String(s).split(/[-.\/]/).map(Number); if (p.length < 3 || !p[0]) return null; const d = new Date(p[0], p[1]-1, p[2]); return isNaN(d) ? null : d; };
const fmtMD   = (s) => { const d = parseYMD(s); return d ? `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} (${WD[d.getDay()]})` : (s || "-"); };
const fmtFull = (s) => { const d = parseYMD(s); return d ? `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} (${WD[d.getDay()]})` : (s || "-"); };
const overdueDays = (s) => { const d = parseYMD(s); if (!d) return 0; const now = new Date(); now.setHours(0,0,0,0); return Math.max(0, Math.round((now - d) / 86400000)); };

export default function History({ focusId, onConsumed }) {
  const { profile } = useAuth();
  const { data: requests } = useCollection("rentalRequests", "createdAt");

  const mine = requests.filter(r =>
    r.studentId === profile?.studentId || r.studentId === profile?.uid
  ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const total    = mine.length;
  const active   = mine.filter(r => r.status === "승인됨" || r.status === "대여중").length;
  const pending  = mine.filter(r => r.status === "승인대기").length;
  const returned = mine.filter(r => r.status === "반납완료").length;

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
    <td class="label">라이선스</td><td>${r.license || "없음"}</td>
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
</body>
</html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  const [tabFilter, setTabFilter] = useState("전체");
  const [expandedId, setExpandedId]     = useState(null);
  const [photoLightbox, setPhotoLightbox] = useState(null);
  const [showPrint, setShowPrint]   = useState(null);
  const [returnPhotoUploading, setReturnPhotoUploading] = useState(false);
  const [returnPhotoProgress,  setReturnPhotoProgress]  = useState(0);

  // 반납 사진 업로드 — 학생은 Firestore 규칙상 returnPhotos 키만 수정 가능. 최대 3장.
  const uploadReturnPhoto = (requestId) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const input = e.target;
    setReturnPhotoUploading(true);
    setReturnPhotoProgress(0);
    try {
      const storageRef = ref(storage, `return_photos/${requestId}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise((resolve, reject) => {
        task.on("state_changed",
          snap => setReturnPhotoProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
          reject, resolve);
      });
      const url = await getDownloadURL(task.snapshot.ref);
      const docSnap = await getDoc(doc(db, "rentalRequests", requestId));
      const current = docSnap.exists() ? (docSnap.data().returnPhotos || []) : [];
      if (current.length >= 3) { alert("사진은 최대 3장까지 업로드할 수 있어요"); return; }
      await updateDoc(doc(db, "rentalRequests", requestId), { returnPhotos: [...current, url] });
      input.value = "";
    } catch (err) {
      alert("업로드 실패: " + err.message);
    } finally {
      setReturnPhotoUploading(false);
      setReturnPhotoProgress(0);
    }
  };
  const deleteReturnPhoto = async (requestId, photos, idx) => {
    await updateDoc(doc(db, "rentalRequests", requestId), { returnPhotos: photos.filter((_, i) => i !== idx) });
  };

  // 🔔 알림 딥링크 — 해당 대여 건으로 필터 전환 + 스크롤 + 하이라이트
  const [flashId, setFlashId] = useState(null);
  useEffect(() => {
    if (!focusId || !mine.length) return;
    const r = mine.find(x => x.id === focusId);
    if (r) { setTabFilter(r.status); setExpandedId(focusId); setFlashId(focusId); }
    onConsumed?.();
  }, [focusId, mine]);
  useEffect(() => {
    if (!flashId) return;
    const t1 = setTimeout(() => {
      document.getElementById(`history-card-${flashId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    const t2 = setTimeout(() => setFlashId(null), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [flashId]);

  const overdue  = mine.filter(r => r.status === "연체").length;
  const renting  = mine.filter(r => r.status === "대여중").length;
  const approved = mine.filter(r => r.status === "승인됨").length;

  // 활성 배경이 흰색 계열 토큰(navy/blue, 흑백 테마에선 #FFFFFF)일 땐 글자를 어둡게 — 흰배경+흰글자 방지
  const activeText = (bg) => (bg === C.navy || bg === C.blue) ? C.bg : "#fff";
  const STATUS_TABS = [
    { id:"전체",    label:"전체 신청", count:total,    color:C.navy,   bg:C.blueLight },
    { id:"승인대기", label:"승인대기",  count:pending,  color:C.yellow, bg:C.yellowLight },
    { id:"승인됨",   label:"승인완료",  count:active,   color:C.teal,   bg:C.tealLight },
    { id:"대여중",   label:"대여중",   count:renting,  color:C.blue,   bg:C.blueLight },
    { id:"반납완료", label:"반납완료",  count:returned, color:C.green,  bg:C.greenLight },
    { id:"연체",    label:"연체중",   count:overdue,  color:C.red,    bg:C.redLight },
  ];

  const filtered = tabFilter === "전체" ? mine : mine.filter(r => r.status === tabFilter);

  const getEquipLabel = (r) => {
    if (!r.items || r.items.length === 0) return r.equipName || "-";
    const names = r.items.map(i => i.modelName || i.equipName || "").filter(Boolean);
    return names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : names[0] || "-";
  };

  // 신청서 뷰 모드
  if (showPrint) {
    return (
      <div>
        <button onClick={() => setShowPrint(null)}
          style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:`1.5px solid ${C.navy}`, borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, color:C.navy, cursor:"pointer", marginBottom:20 }}>
          ← 대여 이력으로 돌아가기
        </button>
        <div style={{ background:C.surface, borderRadius:16, padding:20, border:`1px solid ${C.border}` }}>
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontSize:18, fontWeight:900, color:C.navy }}>장비 대여 신청서</div>
            <div style={{ fontSize:12, color:C.muted }}>한국방송예술진흥원 미디어센터 장비대여실</div>
          </div>
          {[
            ["신청자", showPrint.studentName],
            ["학번", showPrint.studentId],
            ["계열", showPrint.dept],
            ["연락처", showPrint.phone],
            ["대여일", `${showPrint.startDate} ~ ${showPrint.endDate}`],
            ["반납시간", showPrint.endTime],
            ["목적", showPrint.purpose],
            ["장소", showPrint.location],
          ].map(([label, val]) => val ? (
            <div key={label} style={{ display:"flex", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
              <span style={{ color:C.muted, minWidth:70 }}>{label}</span>
              <span style={{ color:C.text, fontWeight:500 }}>{val}</span>
            </div>
          ) : null)}
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>장비 목록</div>
            {showPrint.items?.map((item, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", background:C.bg, borderRadius:8, marginBottom:4, fontSize:13 }}>
                <span>{item.modelName || item.equipName}</span>
                <span style={{ fontWeight:700, color:C.navy }}>{item.quantity}개</span>
              </div>
            ))}
          </div>
          {showPrint.studentSignature && (
            <div style={{ marginTop:16, textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>신청자 서명</div>
              <img src={showPrint.studentSignature} alt="서명" style={{ height:70, objectFit:"contain", background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, padding:6 }} />
            </div>
          )}
          <div style={{ marginTop:20, display:"flex", gap:10 }}>
            <Btn onClick={() => printRequest(showPrint)} color={C.navy} full>🖨️ 인쇄 / PDF</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 상태 필터 칩 (가로 스크롤) */}
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:14 }}>
        {[
          { id:"전체",    label:"전체",     n:total,    pal:"blue" },
          { id:"대여중",   label:"대여중",   n:renting,  pal:"blue" },
          { id:"승인됨",   label:"승인완료", n:approved, pal:"teal" },
          { id:"반납완료", label:"반납완료", n:returned, pal:"purple" },
          { id:"연체",    label:"연체중",   n:overdue,  pal:"red" },
          { id:"승인대기", label:"승인대기", n:pending,  pal:"amber" },
        ].filter(c => c.id === "전체" || c.n > 0).map(c => {
          const on = tabFilter === c.id, p = PAL[c.pal];
          return (
            <button key={c.id} onClick={() => setTabFilter(c.id)}
              style={{ flex:"none", display:"flex", alignItems:"center", gap:6, padding:"9px 15px", borderRadius:20,
                border:`1px solid ${on ? p.dot : BD}`, background: on ? p.bg : CARD2,
                fontSize:13, fontWeight:700, color: on ? "#e8eefc" : C.muted, whiteSpace:"nowrap", cursor:"pointer", fontFamily:"inherit" }}>
              {c.label} <span style={{ fontWeight:900, color: p.fg }}>{c.n}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <img src="/mascot/sad.png" alt="" style={{ width:120, height:120, objectFit:"contain", marginBottom:12 }} />
          <div style={{ fontSize:14, color:C.muted, fontWeight:600 }}>해당 이력이 없습니다</div>
        </div>
      )}

      {filtered.map(r => {
        const isExpand = expandedId === r.id;
        const cfg = STATUS_CFG[r.status] || { pal:"gray", badge:r.status, box:"대여 예정일", use:"start" };
        const p = PAL[cfg.pal];
        const isEnd = cfg.use === "end";
        const boxDate = fmtMD(isEnd ? r.endDate : r.startDate);
        const boxTime = isEnd ? r.endTime : r.startTime;

        return (
          <div key={r.id} id={`history-card-${r.id}`} className="card-press" onClick={() => setExpandedId(isExpand ? null : r.id)}
            style={{ position:"relative", background:CARD_BG, border:`1px solid ${flashId===r.id ? C.teal : BD}`, borderRadius:16,
              padding:"16px 18px 10px", marginBottom:12, overflow:"hidden", cursor:"pointer",
              ...(flashId===r.id ? { boxShadow:`0 0 0 3px ${C.teal}55` } : {}) }}>
            {/* 좌측 상태 컬러바 */}
            <span style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background:p.line }} />

            <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
              {/* 좌측 정보 */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
                  <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:8, background:p.bg, color:p.fg }}>{cfg.badge}</span>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:p.dot }} />
                </div>
                <div style={{ fontSize:17, fontWeight:900, letterSpacing:"-0.02em", color:C.text, marginBottom:9, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {getEquipLabel(r)}
                </div>
                <div style={{ fontSize:12.5, color: cfg.pal==="red" ? "#fca5a5" : "#aab3c5", display:"flex", gap:7, marginBottom:5, lineHeight:1.5 }}>
                  <CalendarDays size={14} style={{ flexShrink:0, marginTop:2 }} />
                  <span>{fmtFull(r.startDate)} {r.startTime}<br/>~ {fmtMD(r.endDate)} {r.endTime}</span>
                </div>
                <div style={{ fontSize:12.5, color:"#aab3c5", display:"flex", gap:7 }}>
                  <MapPin size={14} style={{ flexShrink:0, marginTop:1 }} />
                  <span>{r.location || r.locationType || "장비대여실"}</span>
                </div>
              </div>

              {/* 우측 날짜 박스 + (대여중) 반납사진 버튼 */}
              <div style={{ width:112, flexShrink:0, textAlign:"center" }}>
                <div style={{ background:CARD2, border:`1px solid ${BD}`, borderRadius:12, padding:"11px 8px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{cfg.box}</div>
                  {cfg.use === "overdue" ? (
                    <div style={{ fontSize:22, fontWeight:900, color:p.big }}>{overdueDays(r.endDate)}일</div>
                  ) : (
                    <>
                      <div style={{ fontSize:17, fontWeight:900, color:p.big, lineHeight:1.15 }}>{boxDate}</div>
                      {boxTime && <div style={{ fontSize:15, fontWeight:900, color:p.big }}>{boxTime}</div>}
                    </>
                  )}
                </div>
                {cfg.photoBtn && (
                  <button onClick={(e) => { e.stopPropagation(); setExpandedId(r.id); }}
                    style={{ marginTop:9, width:"100%", padding:"9px 0", borderRadius:10, fontSize:12, fontWeight:800, fontFamily:"inherit", cursor:"pointer",
                      border:`1px solid ${p.dot}`, background:"transparent", color:p.fg, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                    <Camera size={13} /> 반납사진
                  </button>
                )}
              </div>
            </div>

            {/* 하단 중앙 펼침 화살표 */}
            <div style={{ display:"flex", justifyContent:"center", marginTop:isExpand ? 6 : 2 }}>
              <ChevronDown size={20} color="#4a5678"
                style={{ transform:`rotate(${isExpand ? 180 : 0}deg)`, transition:"transform 0.3s cubic-bezier(0.34,1.5,0.5,1)" }} />
            </div>

            {/* 펼침 상세 */}
            {isExpand && (
              <div onClick={(e) => e.stopPropagation()} style={{ animation:"historyExpand 0.25s ease", marginTop:8, paddingTop:14, borderTop:`1px solid ${BD}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:12, color:C.muted }}>목적: {r.purpose || "-"}</div>
                  <button onClick={() => setShowPrint(r)}
                    style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:`1px solid ${BD}`, borderRadius:8, padding:"5px 10px", fontSize:11.5, color:"#aab3c5", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                    <FileText size={12} /> 신청서
                  </button>
                </div>

                {/* 장비 목록 */}
                <div style={{ background:CARD2, borderRadius:8, padding:"8px 12px", marginBottom:8 }}>
                  {r.items?.map((item, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom: i<r.items.length-1?`1px solid ${BD}`:"none", fontSize:12 }}>
                      <span style={{ color:C.text }}>{item.modelName || item.equipName}</span>
                      <span style={{ fontWeight:700, color:"#7fa9ff" }}>{item.quantity}개</span>
                    </div>
                  ))}
                </div>

                {/* 배치 장비 */}
                {r.assignedUnits?.length > 0 && (
                  <div style={{ background:CARD2, borderRadius:8, padding:"8px 12px", marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color: r.status==="반납완료"?C.muted:"#7fa9ff", marginBottom:5 }}>
                      {r.status==="반납완료" ? "사용한 장비" : "배치된 장비"}
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {r.assignedUnits.map((u,i) => (
                        <span key={i} style={{ background:CARD_BG, border:`1px solid ${BD}`, borderRadius:5, padding:"2px 7px", fontSize:11, color:C.text }}>
                          {u.itemName||u.modelName}
                          {u.itemNo && <span style={{ color:"#7fa9ff", marginLeft:3, fontWeight:600 }}>{u.itemNo}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 반납 사진 — 대여중이면 업로드/삭제 가능, 그 외엔 보기 전용 */}
                {(r.returnPhotos?.length > 0 || r.status === "대여중") && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6 }}>
                      {r.status === "대여중" ? (
                        <>
                          📸 촬영현장에서 장비를 사용했던 모습을 찍고 올려주세요!
                          <span style={{ display:"block", color:"#ef4444", marginTop:3 }}>(3장을 업로드해주셔야하며 미업로드시 반납처리가 불가합니다.)</span>
                        </>
                      ) : "📸 장비 사용 사진"}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {(r.returnPhotos || []).map((url, idx) => (
                        <div key={idx} style={{ position:"relative" }}>
                          <img src={url} alt="" onClick={() => setPhotoLightbox({ photos:r.returnPhotos, idx })}
                            style={{ width:64, height:64, objectFit:"cover", borderRadius:8, border:`1px solid ${BD}`, cursor:"pointer" }} />
                          {r.status === "대여중" && (
                            <button onClick={() => deleteReturnPhoto(r.id, r.returnPhotos, idx)}
                              style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:C.red, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, padding:0 }}>×</button>
                          )}
                        </div>
                      ))}
                      {r.status === "대여중" && (r.returnPhotos?.length || 0) < 3 && (
                        <label style={{ width:64, height:64, borderRadius:8, border:`1.5px dashed ${BD}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor: returnPhotoUploading ? "wait" : "pointer", color:C.muted, gap:2, background:CARD2 }}>
                          {returnPhotoUploading
                            ? <span style={{ fontSize:12, fontWeight:700, color:C.teal }}>{returnPhotoProgress}%</span>
                            : <><span style={{ fontSize:20, lineHeight:1 }}>+</span><span style={{ fontSize:9 }}>사진</span></>}
                          <input type="file" accept="image/*" onChange={uploadReturnPhoto(r.id)} disabled={returnPhotoUploading} style={{ display:"none" }} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* 보류/거절 사유 */}
                {r.reason && (
                  <div style={{ background:"rgba(239,68,68,.1)", borderRadius:8, padding:"8px 12px", borderLeft:`3px solid ${r.status==="보류"?"#f59e0b":"#ef4444"}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color: r.status==="보류"?"#fcd34d":"#fca5a5", marginBottom:3 }}>
                      {r.status==="보류" ? "보류 사유" : "거절 사유"}
                    </div>
                    <div style={{ fontSize:12, color:C.text }}>{r.reason}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 장비 사용 사진 라이트박스 */}
      {photoLightbox && (
        <div onClick={() => setPhotoLightbox(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src={photoLightbox.photos[photoLightbox.idx]} alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth:"90vw", maxHeight:"80vh", objectFit:"contain", borderRadius:12 }} />
          <button onClick={() => setPhotoLightbox(null)}
            style={{ position:"absolute", top:"calc(20px + env(safe-area-inset-top, 0px))", right:20, background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"50%", width:40, height:40, fontSize:20, cursor:"pointer" }}>✕</button>
          {photoLightbox.photos.length > 1 && (
            <div>
              <button onClick={e => { e.stopPropagation(); setPhotoLightbox(p => ({...p, idx:(p.idx-1+p.photos.length)%p.photos.length})); }}
                style={{ position:"absolute", left:20, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"50%", width:44, height:44, fontSize:24, cursor:"pointer" }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setPhotoLightbox(p => ({...p, idx:(p.idx+1)%p.photos.length})); }}
                style={{ position:"absolute", right:20, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"50%", width:44, height:44, fontSize:24, cursor:"pointer" }}>›</button>
            </div>
          )}
          <div style={{ position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)", color:"rgba(255,255,255,0.7)", fontSize:13 }}>
            {photoLightbox.idx+1} / {photoLightbox.photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
