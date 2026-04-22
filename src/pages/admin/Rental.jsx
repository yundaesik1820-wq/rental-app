import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import SignaturePad from "../../components/SignaturePad";
import { useCollection, updateItem } from "../../hooks/useFirestore";

const STATUS_TABS = ["전체", "승인대기", "승인됨", "보류", "거절됨", "반납완료"];
const STATUS_ICON = { 승인대기: "⏳", 승인됨: "✅", 보류: "⏸️", 거절됨: "❌", 반납완료: "📦" };

export default function Rental() {
  const { data: requests }   = useCollection("rentalRequests", "createdAt");
  const { data: equipments } = useCollection("equipments", "createdAt");

  const [tab, setTab]             = useState("승인대기");
  const [actionTarget, setActionTarget] = useState(null);
  const [signTarget, setSignTarget]     = useState(null); // 서명 대상 request // { request, type: "보류"|"거절" }
  const [reason, setReason]       = useState("");
  const [submitting, setSubmitting] = useState(false);

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
  <tr><th>장비명</th><th>카테고리</th><th>수량</th><th>비고</th></tr>
  ${(r.items||[]).map(i=>`<tr><td>${i.equipName||i.modelName||""}</td><td>${i.category||""}</td><td style="text-align:center">${i.quantity||1}${i.isSet?" (세트)":""}</td><td>${i.setItems||""}</td></tr>`).join("")}
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

  const approve = async (r, adminSignature) => {
    await updateItem("rentalRequests", r.id, { status: "승인됨", reason: "", adminSignature: adminSignature || "" });
    await updateAvailable(r.items, -1);
  };

  const confirmAction = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    const prevStatus = actionTarget.request.status;
    await updateItem("rentalRequests", actionTarget.request.id, {
      status: actionTarget.type,
      reason: reason,
    });
    // 승인됨 상태였으면 재고 복구 (승인대기는 status 변경 없었으므로 복구 불필요)
    if (prevStatus === "승인됨") {
      await updateAvailable(actionTarget.request.items, +1);
    }
    setActionTarget(null);
    setReason("");
    setSubmitting(false);
  };

  const returnDone = async (r) => {
    await updateItem("rentalRequests", r.id, { status: "반납완료" });
    await updateAvailable(r.items, +1); // 재고 복구
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
            r.status === "승인됨"  ? C.teal   + "40" : C.border
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
              <span style={{ fontSize: 18 }}>{STATUS_ICON[r.status]}</span>
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
                {r.status === "보류" ? "⏸️ 보류 사유" : "❌ 거절 사유"}
              </div>
              <div style={{ fontSize: 13, color: C.text }}>{r.reason}</div>
            </div>
          )}

          {/* 출력 버튼 */}
          <div style={{ marginBottom:8 }}>
            <Btn onClick={() => printRequest(r)} color={C.muted} outline full small>🖨️ 신청서 출력</Btn>
          </div>

          {/* 액션 버튼 */}
          {r.status === "승인대기" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setSignTarget(r)} color={C.green} full>✅ 승인</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "보류" }); setReason(""); }} color={C.yellow} text={C.text} full>⏸️ 보류</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "거절됨" }); setReason(""); }} color={C.red} full>❌ 거절</Btn>
            </div>
          )}
          {r.status === "보류" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setSignTarget(r)} color={C.green} full>✅ 승인으로 변경</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "거절됨" }); setReason(""); }} color={C.red} full>❌ 거절</Btn>
            </div>
          )}
          {r.status === "승인됨" && (
            <Btn onClick={() => returnDone(r)} color={C.muted} outline full>📦 반납 완료 처리</Btn>
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
            {actionTarget.type === "보류" ? "⏸️ 보류 처리" : "❌ 거절 처리"}
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
    </div>
  );
}
