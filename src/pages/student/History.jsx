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

  return (
    <div>
      <PageTitle>대여 이력</PageTitle>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox icon="📊" label="전체 신청"  value={total}    color={C.blue}   bg={C.blueLight}  />
        <StatBox icon="⏳" label="승인 대기"  value={pending}  color={C.yellow} bg={C.yellowLight} />
        <StatBox icon="✅" label="승인/대여중" value={active}   color={C.teal}   bg={C.tealLight}  />
        <StatBox icon="📦" label="반납 완료"  value={returned} color={C.green}  bg={C.greenLight} />
      </div>

      {mine.length === 0 && <Empty icon="📭" text="대여 신청 이력이 없습니다" />}

      {mine.map(r => (
        <Card key={r.id} style={{
          border: `2px solid ${
            r.status === "보류"   ? C.yellow + "60" :
            r.status === "거절됨" ? C.red    + "40" :
            r.status === "승인됨" ? C.teal   + "40" :
            r.status === "대여중" ? C.blue   + "40" : C.border
          }`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                {r.startDate} ~ {r.endDate}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>
                목적: {r.purpose}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge label={r.status} />
              <button onClick={() => printRequest(r)}
                style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontSize:12, color:C.muted, cursor:"pointer" }}>
                <FileText size={13} /> 신청서
              </button>
            </div>
          </div>

          {/* 장비 목록 */}
          <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
            {r.items?.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < r.items.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{item.modelName || item.equipName}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{item.quantity}개</span>
              </div>
            ))}
          </div>

          {/* 배치된 장비 (대여중/반납완료) */}
          {r.assignedUnits?.length > 0 && (
            <div style={{ background: r.status === "반납완료" ? "#F8FAFC" : C.blueLight, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: r.status === "반납완료" ? C.muted : C.blue, marginBottom: 5 }}>
                {r.status === "반납완료" ? "사용한 장비" : "배치된 장비"}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {r.assignedUnits.map((u, i) => (
                  <span key={i} style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:"2px 8px", fontSize:12, color:C.text }}>
                    {u.itemName || u.modelName}
                    {u.itemNo && <span style={{ color:C.blue, marginLeft:4, fontWeight:600 }}>{u.itemNo}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 보류/거절 사유 */}
          {r.reason && (
            <div style={{
              background: r.status === "보류" ? C.yellowLight : C.redLight,
              borderRadius: 10, padding: "10px 14px",
              borderLeft: `4px solid ${r.status === "보류" ? C.yellow : C.red}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: r.status === "보류" ? "#92400E" : C.red, marginBottom: 4 }}>
                {r.status === "보류" ? "보류 사유" : "거절 사유"}
              </div>
              <div style={{ fontSize: 13, color: C.text }}>{r.reason}</div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
