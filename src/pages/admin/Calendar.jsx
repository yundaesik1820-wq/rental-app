import { useState } from "react";
import { C } from "../../theme";
import { Card, PageTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";

const MONTH_NAMES = ["","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_NAMES   = ["일","월","화","수","목","금","토"];

export default function CalendarPage({ isAdmin = true, userId = null }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sel,   setSel]   = useState(null);

  const { data: rentals }      = useCollection("rentals", "rentDate");
  const { data: reservations } = useCollection("reservations", "startDate");

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();

  const toStr = d => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const getEvents = d => {
    const ds = toStr(d);
    const rents = rentals.filter(r =>
      (!userId || r.studentId === userId) &&
      r.rentDate <= ds && r.dueDate >= ds && r.status !== "반납완료"
    );
    const res = reservations.filter(r =>
      (!userId || r.studentId === userId) &&
      r.startDate <= ds && r.endDate >= ds && r.status === "승인됨"
    );
    return { rents, res };
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); setSel(null); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); setSel(null); };

  const selEvents = sel ? getEvents(sel) : null;

  return (
    <div>
      <PageTitle>📅 예약 캘린더</PageTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* Calendar */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={prevMonth} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.navy }}>{year}년 {MONTH_NAMES[month]}</div>
            <button onClick={nextMonth} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 8 }}>
            {DAY_NAMES.map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, padding: "4px 0", color: i===0 ? C.red : i===6 ? C.blue : C.muted }}>{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {Array(firstDay).fill(null).map((_, i) => <div key={`p${i}`} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const d = i + 1;
              const { rents, res } = getEvents(d);
              const isToday  = d === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
              const isSel    = sel === d;
              const dow      = new Date(year, month-1, d).getDay();
              const hasEvent = rents.length > 0 || res.length > 0;
              return (
                <div key={d} onClick={() => setSel(isSel ? null : d)} style={{
                  borderRadius: 10, padding: "8px 4px", textAlign: "center", cursor: "pointer",
                  background: isSel ? C.navy : isToday ? C.blueLight : "transparent",
                  border: `2px solid ${isSel ? C.navy : isToday ? C.blue : "transparent"}`,
                  transition: "all 0.15s",
                  minHeight: 52,
                }}>
                  <div style={{ fontSize: 14, fontWeight: isSel||isToday ? 800 : 400, color: isSel ? "#fff" : isToday ? C.blue : dow===0 ? C.red : dow===6 ? C.blue : C.text }}>{d}</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 4, flexWrap: "wrap" }}>
                    {rents.slice(0,3).map((_,j) => <div key={`r${j}`} style={{ width: 6, height: 6, borderRadius: "50%", background: isSel ? "rgba(255,255,255,0.7)" : C.blue }} />)}
                    {res.slice(0,3).map((_,j)   => <div key={`s${j}`} style={{ width: 6, height: 6, borderRadius: "50%", background: isSel ? "rgba(255,255,255,0.7)" : C.teal }} />)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 16, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: C.blue }} /><span style={{ fontSize: 12, color: C.muted }}>대여중</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: C.teal }} /><span style={{ fontSize: 12, color: C.muted }}>예약</span></div>
          </div>
        </Card>

        {/* Selected day detail */}
        <div>
          {sel && selEvents ? (
            <Card style={{ border: `2px solid ${C.blue}25` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 16 }}>
                {month}월 {sel}일 일정
              </div>
              {selEvents.rents.length === 0 && selEvents.res.length === 0 && (
                <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>이 날 일정이 없습니다</div>
              )}
              {selEvents.rents.map(r => (
                <div key={r.id} style={{ background: C.blueLight, borderRadius: 12, padding: "12px 14px", marginBottom: 10, borderLeft: `4px solid ${C.blue}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 4 }}>📋 대여중</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.equipName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{r.studentName} · {r.studentId}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>반납예정: {r.dueDate}</div>
                </div>
              ))}
              {selEvents.res.map(r => (
                <div key={r.id} style={{ background: C.tealLight, borderRadius: 12, padding: "12px 14px", marginBottom: 10, borderLeft: `4px solid ${C.teal}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, marginBottom: 4 }}>📅 예약</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.equipName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{r.studentName}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>~{r.endDate}</div>
                </div>
              ))}
            </Card>
          ) : (
            <Card style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
              <div style={{ fontSize: 14 }}>날짜를 클릭하면<br />일정을 확인할 수 있어요</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
