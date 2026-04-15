import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, updateItem } from "../../hooks/useFirestore";

const STATUS_TABS = ["전체", "승인대기", "승인됨", "보류", "거절됨", "반납완료"];
const STATUS_ICON = { 승인대기: "⏳", 승인됨: "✅", 보류: "⏸️", 거절됨: "❌", 반납완료: "📦" };

export default function Rental() {
  const { data: requests }   = useCollection("rentalRequests", "createdAt");
  const { data: equipments } = useCollection("equipments", "name");

  const [tab, setTab]             = useState("승인대기");
  const [actionTarget, setActionTarget] = useState(null); // { request, type: "보류"|"거절" }
  const [reason, setReason]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = tab === "전체" ? requests : requests.filter(r => r.status === tab);
  const sorted   = [...filtered].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const approve = async (r) => {
    await updateItem("rentalRequests", r.id, { status: "승인됨", reason: "" });
  };

  const confirmAction = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    await updateItem("rentalRequests", actionTarget.request.id, {
      status: actionTarget.type,
      reason: reason,
    });
    setActionTarget(null);
    setReason("");
    setSubmitting(false);
  };

  const returnDone = async (r) => {
    await updateItem("rentalRequests", r.id, { status: "반납완료" });
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
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{r.studentName}</span>
                <span style={{ fontSize: 12, color: C.muted }}>·</span>
                <span style={{ fontSize: 12, color: C.muted }}>{r.studentId ? r.studentId.slice(0,2)+"학번" : ""}</span>
                <span style={{ fontSize: 12, color: C.muted }}>·</span>
                <span style={{ fontSize: 12, color: C.muted }}>{r.dept}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>📅 {r.startDate} ~ {r.endDate}</div>
              <div style={{ fontSize: 12, color: C.muted }}>목적: {r.purpose}</div>
              {r.license && r.license !== "없음" && (
                <div style={{ display: "inline-block", background: C.blueLight, color: C.blue, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                  라이센스 {r.license}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

          {/* 액션 버튼 */}
          {r.status === "승인대기" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => approve(r)} color={C.green} full>✅ 승인</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "보류" }); setReason(""); }} color={C.yellow} text={C.text} full>⏸️ 보류</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "거절됨" }); setReason(""); }} color={C.red} full>❌ 거절</Btn>
            </div>
          )}
          {r.status === "보류" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => approve(r)} color={C.green} full>✅ 승인으로 변경</Btn>
              <Btn onClick={() => { setActionTarget({ request: r, type: "거절됨" }); setReason(""); }} color={C.red} full>❌ 거절</Btn>
            </div>
          )}
          {r.status === "승인됨" && (
            <Btn onClick={() => returnDone(r)} color={C.muted} outline full>📦 반납 완료 처리</Btn>
          )}
        </Card>
      ))}

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
