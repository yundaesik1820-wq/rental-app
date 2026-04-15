import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle, Select } from "../../components/UI";
import { useCollection, addItem, updateItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";

export default function Reserve() {
  const { profile } = useAuth();
  const { data: reservations } = useCollection("reservations", "startDate");
  const { data: equipments }   = useCollection("equipments", "createdAt");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ equipName: "", startDate: "", endDate: "", purpose: "" });

  const mine = reservations.filter(r => r.studentId === profile?.studentId);

  const handleAdd = async () => {
    if (!form.equipName || !form.startDate || !form.endDate) return;
    await addItem("reservations", {
      studentName: profile.name, studentId: profile.studentId,
      dept: profile.dept || "", ...form, status: "승인대기",
    });
    setForm({ equipName: "", startDate: "", endDate: "", purpose: "" });
    setShowAdd(false);
  };

  const cancel = async id => updateItem("reservations", id, { status: "취소됨" });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <PageTitle>📅 예약 신청</PageTitle>
        <Btn onClick={() => setShowAdd(true)} color={C.yellow} text={C.text}>+ 예약 신청</Btn>
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>예약 신청</div>
          <Select label="장비 선택" value={form.equipName} onChange={e => setForm(p => ({ ...p, equipName: e.target.value }))}>
            <option value="">장비를 선택하세요</option>
            {equipments.map(e => <option key={e.id} value={e.modelName || e.name}>{e.img || ""} {e.modelName || e.name} ({e.majorCategory || e.category})</option>)}
          </Select>
          <Inp label="사용 목적" placeholder="예: 졸업작품 촬영" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} />
          <div style={{ display: "flex", gap: 12 }}>
            <Inp label="대여일" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} style={{ flex: 1 }} />
            <Inp label="반납일" type="date" value={form.endDate}   onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}   style={{ flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAdd} color={C.yellow} text={C.text} full>신청</Btn>
          </div>
        </Modal>
      )}

      {mine.length === 0 && <Empty icon="📅" text="예약 내역이 없습니다" />}

      {mine.map(r => (
        <Card key={r.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.equipName}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{r.startDate} ~ {r.endDate}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>목적: {r.purpose}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <Badge label={r.status} />
              {r.status === "승인대기" && (
                <Btn onClick={() => cancel(r.id)} small color={C.red} outline>취소</Btn>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
