import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Empty, PageTitle, StatBox, Btn } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { FileText } from "lucide-react";

const STATUS_ICON = { 승인대기: "⏳", 승인됨: "✅", 보류: "⏸", 거절됨: "❌", 반납완료: "📦", 대여중: "🚀" };

export default function History() {
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

  const overdue  = mine.filter(r => r.status === "연체").length;
  const renting  = mine.filter(r => r.status === "대여중").length;

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
        <div style={{ background:"#fff", borderRadius:16, padding:20, border:`1px solid ${C.border}` }}>
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
            <div style={{ marginTop:16, textAlign:"right" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>신청자 서명</div>
              <img src={showPrint.studentSignature} alt="서명" style={{ height:60, objectFit:"contain", border:`1px solid ${C.border}`, borderRadius:8, padding:4 }} />
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
{/* 페이지 안내 배너 */}
      <div style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img src="/mascot/history.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
          <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
            <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
            <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 대여 이력 페이지야!</div>
            <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>내가 신청한 대여 내역을 확인할 수 있어.
승인 여부와 반납 현황도 여기서 볼 수 있어 📋</div>
          </div>
        </div>
      </div>

      <PageTitle>대여 이력</PageTitle>

      {/* 1행: 전체 신청 */}
      <div onClick={() => setTabFilter("전체")}
        style={{ background: tabFilter==="전체" ? C.navy : C.surface, borderRadius:12, padding:"12px 16px", marginBottom:8, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", border:`1.5px solid ${tabFilter==="전체" ? C.navy : C.border}` }}>
        <span style={{ fontSize:14, fontWeight:700, color: tabFilter==="전체" ? "#fff" : C.text }}>전체 신청</span>
        <span style={{ fontSize:20, fontWeight:900, color: tabFilter==="전체" ? "#fff" : C.navy }}>{total}</span>
      </div>

      {/* 2행: 상태별 탭 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:5, marginBottom:20 }}>
        {STATUS_TABS.slice(1).map(t => (
          <button key={t.id} onClick={() => setTabFilter(t.id)}
            style={{ background: tabFilter===t.id ? t.color : C.surface, border:`1.5px solid ${tabFilter===t.id ? t.color : C.border}`, borderRadius:10, padding:"6px 4px", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
            <div style={{ fontSize:16, fontWeight:900, color: tabFilter===t.id ? "#fff" : t.color }}>{t.count}</div>
            <div style={{ fontSize:9, fontWeight:600, color: tabFilter===t.id ? "rgba(255,255,255,0.85)" : C.muted, marginTop:1, whiteSpace:"nowrap" }}>{t.label}</div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <img src="/mascot/sad.png" alt="" style={{ width:120, height:120, objectFit:"contain", marginBottom:12 }} />
          <div style={{ fontSize:14, color:C.muted, fontWeight:600 }}>해당 이력이 없습니다</div>
        </div>
      )}

      {filtered.map(r => {
        const isExpand = expandedId === r.id;
        const statusColor = {
          승인대기: C.yellow, 승인됨: C.teal, 대여중: C.blue,
          반납완료: C.green, 거절됨: C.red, 보류: C.orange, 연체: C.red,
        }[r.status] || C.muted;

        return (
          <Card key={r.id} style={{ marginBottom:8, border:`1.5px solid ${statusColor}30`, padding:"12px 14px" }}>
            {/* 카드 헤더 - 항상 보임 */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>
                  {getEquipLabel(r)}
                </div>
                <div style={{ fontSize:11, color:C.muted }}>{r.startDate} ~ {r.endDate}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                <Badge label={r.status} />
                <div style={{ display:"flex", gap:5 }}>
                  <button onClick={() => setShowPrint(r)}
                    style={{ display:"flex", alignItems:"center", gap:3, background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 8px", fontSize:11, color:C.muted, cursor:"pointer" }}>
                    <FileText size={11} /> 신청서
                  </button>
                  <button onClick={() => setExpandedId(isExpand ? null : r.id)}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 8px", fontSize:11, color:C.navy, fontWeight:600, cursor:"pointer" }}>
                    {isExpand ? "접기 ▲" : "자세히 ▼"}
                  </button>
                </div>
              </div>
            </div>

            {/* 자세히 보기 - 클릭 시 펼침 */}
            {isExpand && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>목적: {r.purpose}</div>

                {/* 장비 목록 */}
                <div style={{ background:C.bg, borderRadius:8, padding:"8px 12px", marginBottom:8 }}>
                  {r.items?.map((item, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom: i<r.items.length-1?`1px solid ${C.border}`:"none", fontSize:12 }}>
                      <span style={{ color:C.text }}>{item.modelName || item.equipName}</span>
                      <span style={{ fontWeight:700, color:C.navy }}>{item.quantity}개</span>
                    </div>
                  ))}
                </div>

                {/* 배치 장비 */}
                {r.assignedUnits?.length > 0 && (
                  <div style={{ background: r.status==="반납완료"?"#F8FAFC":C.blueLight, borderRadius:8, padding:"8px 12px", marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color: r.status==="반납완료"?C.muted:C.blue, marginBottom:5 }}>
                      {r.status==="반납완료" ? "사용한 장비" : "배치된 장비"}
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {r.assignedUnits.map((u,i) => (
                        <span key={i} style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:5, padding:"2px 7px", fontSize:11, color:C.text }}>
                          {u.itemName||u.modelName}
                          {u.itemNo && <span style={{ color:C.blue, marginLeft:3, fontWeight:600 }}>{u.itemNo}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 반납 사진 */}
                {r.returnPhotos?.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6 }}>📸 장비 사용 사진</div>
                    <div style={{ display:"flex", gap:6 }}>
                      {r.returnPhotos.map((url, idx) => (
                        <img key={idx} src={url} alt="" onClick={() => setPhotoLightbox({ photos:r.returnPhotos, idx })}
                          style={{ width:64, height:64, objectFit:"cover", borderRadius:8, border:`1px solid ${C.border}`, cursor:"pointer" }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 보류/거절 사유 */}
                {r.reason && (
                  <div style={{ background: r.status==="보류"?C.yellowLight:C.redLight, borderRadius:8, padding:"8px 12px", borderLeft:`3px solid ${r.status==="보류"?C.yellow:C.red}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color: r.status==="보류"?"#92400E":C.red, marginBottom:3 }}>
                      {r.status==="보류" ? "보류 사유" : "거절 사유"}
                    </div>
                    <div style={{ fontSize:12, color:C.text }}>{r.reason}</div>
                  </div>
                )}
              </div>
            )}
          </Card>
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
            style={{ position:"absolute", top:20, right:20, background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"50%", width:40, height:40, fontSize:20, cursor:"pointer" }}>✕</button>
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
