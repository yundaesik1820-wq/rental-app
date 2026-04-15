import { useState } from "react";
import { C } from "../../theme";
import { Card, Badge, Btn, Inp, Modal, Empty, PageTitle, Select } from "../../components/UI";
import { useCollection, addItem, updateItem } from "../../hooks/useFirestore";

export default function Rental() {
  const { data: rentals }    = useCollection("rentals", "rentDate");
  const { data: students }   = useCollection("users", "name");
  const { data: equipments } = useCollection("equipments", "name");
  const { data: extensions } = useCollection("extensions", "createdAt");

  const [activeTab, setActiveTab] = useState("대여목록");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ studentId: "", equipId: "", dueDate: "", purpose: "" });
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");

  const handleRent = async () => {
    const student = students.find(s => s.studentId === form.studentId && s.role === "student");
    const equip   = equipments.find(e => e.id === form.equipId);
    const active  = rentals.filter(r => r.studentId === form.studentId && (r.status === "대여중" || r.status === "연체")).length;
    if (!student)                        { setErr("학번을 확인하세요"); return; }
    if (!equip || (equip.available||0) === 0) { setErr("선택한 장비의 재고가 없습니다"); return; }
    if (!form.dueDate)                   { setErr("반납예정일을 선택하세요"); return; }
    setErr("");
    await addItem("rentals", { studentId: student.studentId, studentName: student.name, equipId: equip.id, equipName: equip.name, rentDate: new Date().toISOString().slice(0, 10), dueDate: form.dueDate, status: "대여중", dept: student.dept || "", purpose: form.purpose });
    await updateItem("equipments", equip.id, { available: (equip.available || 1) - 1, status: (equip.available || 1) - 1 === 0 ? "대여중" : equip.status });
    setForm({ studentId: "", equipId: "", dueDate: "", purpose: "" });
    setShowAdd(false);
  };

  const handleReturn = async (r) => {
    await updateItem("rentals", r.id, { status: "반납완료" });
    const equip = equipments.find(e => e.id === r.equipId);
    if (equip) await updateItem("equipments", r.id === equip.id ? equip.id : equip.id, { available: (equip.available || 0) + 1, status: "대여가능" });
  };

  const approveExt = async (ex) => {
    await updateItem("extensions", ex.id, { status: "승인됨" });
    await updateItem("rentals", ex.rentalId, { dueDate: ex.requestedDue });
  };

  const tabs = ["대여목록", `연장신청${extensions.filter(e => e.status === "신청중").length > 0 ? ` (${extensions.filter(e => e.status === "신청중").length})` : ""}`];
  const statuses = ["전체", "대여중", "연체", "반납완료"];
  const filtered = statusFilter === "전체" ? rentals : rentals.filter(r => r.status === statusFilter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>📋 대여/반납 관리</PageTitle>
        <Btn onClick={() => setShowAdd(true)} color={C.teal}>+ 대여 등록</Btn>
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>대여 처리</div>
          {err && <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}
          <Inp label="학번" placeholder="예: 20210001" value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))} />
          <Select label="장비 선택" value={form.equipId} onChange={e => setForm(p => ({ ...p, equipId: e.target.value }))}>
            <option value="">선택하세요</option>
            {equipments.filter(e => (e.available || 0) > 0).map(e => <option key={e.id} value={e.id}>{e.img} {e.name} ({e.available}대 가능)</option>)}
          </Select>
          <Inp label="사용 목적" placeholder="예: 졸업작품 촬영" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} />
          <Inp label="반납예정일" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleRent} color={C.teal} full>대여 처리</Btn>
          </div>
        </Modal>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabs.map(t => {
          const key = t.replace(/ \(\d+\)/, "");
          return (
            <button key={key} onClick={() => setActiveTab(key)} style={{ background: activeTab === key ? C.navy : C.surface, color: activeTab === key ? "#fff" : C.muted, border: `1px solid ${activeTab === key ? C.navy : C.border}`, borderRadius: 20, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t}</button>
          );
        })}
      </div>

      {activeTab === "대여목록" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {statuses.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ background: statusFilter === s ? C.blue : C.surface, color: statusFilter === s ? "#fff" : C.muted, border: `1px solid ${statusFilter === s ? C.blue : C.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
          {filtered.map(r => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.equipName}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>👤 {r.studentName} · {r.studentId} · {r.dept}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>목적: {r.purpose}</div>
                  <div style={{ fontSize: 12, color: r.status === "연체" ? C.red : C.muted, marginTop: 2, fontWeight: r.status === "연체" ? 700 : 400 }}>
                    대여일: {r.rentDate} → 반납예정: {r.dueDate}{r.status === "연체" ? " ⚠️ 연체" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <Badge label={r.status} />
                  {(r.status === "대여중" || r.status === "연체") && <Btn onClick={() => handleReturn(r)} small color={C.green}>반납처리</Btn>}
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <Empty icon="📋" text="대여 내역이 없습니다" />}
        </>
      )}

      {activeTab === "연장신청" && (
        <>
          {extensions.filter(e => e.status === "신청중").map(ex => (
            <Card key={ex.id} style={{ border: `2px solid ${C.purple}30` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{ex.equipName}</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>👤 {ex.studentName}</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, background: C.redLight, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>현재 반납예정일</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.red, marginTop: 4 }}>{ex.originalDue}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", color: C.muted, fontSize: 20 }}>→</div>
                <div style={{ flex: 1, background: C.greenLight, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>연장 신청일</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginTop: 4 }}>{ex.requestedDue}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={() => approveExt(ex)} color={C.green} full>승인</Btn>
                <Btn onClick={() => updateItem("extensions", ex.id, { status: "거절됨" })} color={C.red} full>거절</Btn>
              </div>
            </Card>
          ))}
          {extensions.filter(e => e.status !== "신청중").map(ex => (
            <Card key={ex.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ex.equipName}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{ex.studentName} · {ex.originalDue} → {ex.requestedDue}</div>
                </div>
                <Badge label={ex.status} />
              </div>
            </Card>
          ))}
          {extensions.length === 0 && <Empty icon="🔄" text="연장 신청이 없습니다" />}
        </>
      )}
    </div>
  );
}
