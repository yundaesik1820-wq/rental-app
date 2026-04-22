import { useState } from "react";
import { C } from "../../theme";
import { Card, PageTitle } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";

const MONTH_NAMES = ["","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_NAMES   = ["일","월","화","수","목","금","토"];

const STATUS_COLOR = {
  "승인대기": C.yellow,
  "승인됨":   C.blue,
  "대여중":   C.teal,
  "반납완료": C.muted,
  "보류":     C.orange,
  "거절됨":   C.red,
};

export default function CalendarPage({ isAdmin = true, userId = null }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sel,   setSel]   = useState(null);

  const { data: requests } = useCollection("rentalRequests", "createdAt");

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();

  const toStr = d => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // 해당 날짜에 걸쳐있는 신청 목록
  const getEvents = d => {
    const ds = toStr(d);
    return requests.filter(r => {
      if (userId && r.studentId !== userId) return false;
      if (["거절됨","반납완료"].includes(r.status)) return false;
      return r.startDate <= ds && r.endDate >= ds;
    });
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); setSel(null); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); setSel(null); };

  const selEvents = sel ? getEvents(sel) : [];

  return (
    <div>
      <PageTitle>📅 예약 캘린더</PageTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:20, alignItems:"start" }}>

        {/* 캘린더 */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <button onClick={prevMonth} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <div style={{ fontSize:20, fontWeight:800, color:C.navy }}>{year}년 {MONTH_NAMES[month]}</div>
            <button onClick={nextMonth} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:8 }}>
            {DAY_NAMES.map((d,i) => (
              <div key={d} style={{ textAlign:"center", fontSize:12, fontWeight:700, padding:"4px 0", color:i===0?C.red:i===6?C.blue:C.muted }}>{d}</div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
            {Array(firstDay).fill(null).map((_,i) => <div key={`p${i}`} />)}
            {Array(daysInMonth).fill(null).map((_,i) => {
              const d       = i + 1;
              const events  = getEvents(d);
              const isToday = d === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
              const isSel   = sel === d;
              const dow     = new Date(year, month-1, d).getDay();
              return (
                <div key={d} onClick={() => setSel(isSel ? null : d)} style={{
                  borderRadius:10, padding:"6px 4px", textAlign:"center", cursor:"pointer",
                  background: isSel ? C.navy : isToday ? C.blueLight : "transparent",
                  border:`2px solid ${isSel ? C.navy : isToday ? C.blue : "transparent"}`,
                  transition:"all 0.15s", minHeight:52,
                }}>
                  <div style={{ fontSize:14, fontWeight:isSel||isToday?800:400, color:isSel?"#fff":isToday?C.blue:dow===0?C.red:dow===6?C.blue:C.text }}>{d}</div>
                  <div style={{ display:"flex", justifyContent:"center", gap:2, marginTop:4, flexWrap:"wrap" }}>
                    {events.slice(0,3).map((_,j) => (
                      <div key={j} style={{ width:6, height:6, borderRadius:"50%", background:isSel?"rgba(255,255,255,0.7)":C.teal }} />
                    ))}
                    {events.length > 3 && <div style={{ fontSize:9, color:isSel?"#fff":C.muted }}>+{events.length-3}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div style={{ display:"flex", gap:20, marginTop:16, justifyContent:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:10, height:10, borderRadius:"50%", background:C.teal }} /><span style={{ fontSize:12, color:C.muted }}>대여 일정</span></div>
          </div>
        </Card>

        {/* 선택 날짜 상세 */}
        <div>
          {sel ? (
            <Card style={{ border:`2px solid ${C.blue}25` }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:16 }}>
                {month}월 {sel}일 일정
              </div>
              {selEvents.length === 0 && (
                <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"20px 0" }}>이 날 일정이 없습니다</div>
              )}
              {selEvents.map(r => (
                <div key={r.id} style={{ background:C.bg, borderRadius:12, padding:"12px 14px", marginBottom:10, borderLeft:`4px solid ${STATUS_COLOR[r.status]||C.muted}` }}>
                  {/* 상태 배지 */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:STATUS_COLOR[r.status]||C.muted, background:`${STATUS_COLOR[r.status]}15`, borderRadius:6, padding:"2px 8px" }}>{r.status}</span>
                  </div>
                  {/* 신청자 */}
                  <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:2 }}>{r.studentName}</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>{r.dept} · {r.studentId}</div>
                  {/* 장비 목록 */}
                  <div style={{ fontSize:12, color:C.text, marginBottom:4 }}>
                    {r.items?.map(i => `${i.equipName||i.modelName} ×${i.quantity}`).join(", ")}
                  </div>
                  {/* 기간 */}
                  <div style={{ fontSize:11, color:C.muted }}>
                    📅 {r.startDate} {r.startTime} ~ {r.endDate} {r.endTime}
                  </div>
                  {/* 장소/목적 */}
                  {r.purpose && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>🎯 {r.purpose}</div>}
                  {r.location && <div style={{ fontSize:11, color:C.muted }}>📍 {r.locationType ? r.locationType+" - " : ""}{r.location}</div>}
                </div>
              ))}
            </Card>
          ) : (
            <Card style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
              <div style={{ fontSize:14 }}>날짜를 클릭하면<br/>일정을 확인할 수 있어요</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
