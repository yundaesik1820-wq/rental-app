import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle, StatBox } from "../../components/UI";
import { useCollection, addItem, updateItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";

export default function History() {
  const { profile } = useAuth();
  const { data: rentals }    = useCollection("rentals", "rentDate");
  const { data: extensions } = useCollection("extensions", "createdAt");

  const [extTarget, setExtTarget] = useState(null);
  const [extDate, setExtDate]     = useState("");

  const mine = rentals.filter(r => r.studentId === profile?.studentId)
    .sort((a, b) => b.rentDate?.localeCompare(a.rentDate));

  const total   = mine.length;
  const active  = mine.filter(r => r.status === "대여중" || r.status === "연체").length;
  const done    = mine.filter(r => r.status === "반납완료").length;

  const hasExt = id => extensions.some(e => e.rentalId === id && e.status === "신청중");

  const submitExt = async () => {
    if (!extDate || extDate <= extTarget.dueDate) return;
    await addItem("extensions", {
      rentalId: extTarget.id, studentId: profile.studentId, studentName: profile.name,
      equipName: extTarget.equipName, originalDue: extTarget.dueDate,
      requestedDue: extDate, status: "신청중",
    });
    setExtTarget(null); setExtDate("");
  };

  return (
    <div>
      <PageTitle>📖 내 대여 이력</PageTitle>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox icon="📊" label="전체 대여"  value={total}  color={C.blue}  bg={C.blueLight}  />
        <StatBox icon="🔄" label="대여 중"    value={active} color={C.teal}  bg={C.tealLight}  />
        <StatBox icon="✅" label="반납 완료"  value={done}   color={C.green} bg={C.greenLight} />
      </div>

      {mine.length === 0 && <Empty icon="📭" text="대여 이력이 없습니다" />}

      {mine.map(r => (
        <Card key={r.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.equipName}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>목적: {r.purpose}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>대여: {r.rentDate} → 반납예정: {r.dueDate}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <Badge label={r.status} />
              {r.status === "대여중" && !hasExt(r.id) && (
                <Btn onClick={() => setExtTarget(r)} small color={C.purple}>연장 신청</Btn>
              )}
              {hasExt(r.id) && (
                <span style={{ fontSize: 11, color: C.purple, fontWeight: 700 }}>연장 검토중</span>
              )}
            </div>
          </div>
        </Card>
      ))}

      {extTarget && (
        <Modal onClose={() => { setExtTarget(null); setExtDate(""); }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 6 }}>🔄 반납 연장 신청</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{extTarget.equipName}</div>
          <div style={{ background: C.redLight, borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.muted }}>현재 반납예정일</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.red, marginTop: 4 }}>{extTarget.dueDate}</div>
          </div>
          <Inp label="연장 반납일" type="date" value={extDate} onChange={e => setExtDate(e.target.value)} />
          {extDate && extDate <= extTarget.dueDate && (
            <div style={{ color: C.red, fontSize: 12, marginTop: -6, marginBottom: 10 }}>현재 반납일 이후 날짜를 선택하세요</div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={() => { setExtTarget(null); setExtDate(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={submitExt} full disabled={!extDate || extDate <= extTarget.dueDate}>신청</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
