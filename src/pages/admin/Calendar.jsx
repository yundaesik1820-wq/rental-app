import { useState } from "react";
import { C } from "../../theme";
import { Card, PageTitle, Badge, Modal, Btn } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";

const MONTH_NAMES = ["","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_NAMES   = ["일","월","화","수","목","금","토"];

const STATUS_META = {
  "승인대기": { color: C.yellow,  bg: "#FFFBEB", label: "승인대기" },
  "승인됨":   { color: C.blue,    bg: C.blueLight, label: "승인됨"   },
  "대여중":   { color: C.teal,    bg: C.tealLight, label: "대여중"   },
  "반납완료": { color: C.muted,   bg: "#F8FAFC",   label: "반납완료" },
  "거절됨":   { color: C.red,     bg: C.redLight,  label: "거절됨"   },
};

const ALL_STATUSES = ["승인대기","승인됨","대여중","반납완료","거절됨"];

export default function CalendarPage({ isAdmin = true, userId = null, userEmail = null, userName = null }) {
  const today = new Date();
  const [year,   setYear]   = useState(today.getFullYear());
  const [month,  setMonth]  = useState(today.getMonth() + 1);
  const [sel,    setSel]    = useState(null);
  const [detail, setDetail] = useState(null);

  // 관리자: 상태 필터 (기본: 거절됨 제외 전체)
  const [statusFilter, setStatusFilter] = useState(["승인대기","승인됨","대여중","반납완료"]);

  const { data: requests } = useCollection("rentalRequests", "createdAt");

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();

  const toStr = d => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const getEvents = (d) => {
    const ds = toStr(d);
    return requests.filter(r => {
      if (!isAdmin) {
        const isMine = (userId && r.studentId === userId)
          || (userEmail && r.phone === userEmail)
          || (userName && r.studentName === userName);
        if (!isMine) return false;
      }
      if (!statusFilter.includes(r.status)) return false;
      return r.startDate <= ds && r.endDate >= ds;
    });
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y=>y-1); } else setMonth(m=>m-1); setSel(null); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y=>y+1); } else setMonth(m=>m+1); setSel(null); };

  const selEvents = sel ? getEvents(sel) : [];

  // 이번 달 통계 (관리자)
  const monthStr = `${year}-${String(month).padStart(2,"0")}`;
  const monthRequests = requests.filter(r =>
    r.startDate?.startsWith(monthStr) || r.endDate?.startsWith(monthStr)
  );
  const stats = {
    total:    monthRequests.length,
    pending:  monthRequests.filter(r => r.status === "승인대기").length,
    approved: monthRequests.filter(r => r.status === "승인됨").length,
    active:   monthRequests.filter(r => r.status === "대여중").length,
  };

  const getItemLabel = (r) => {
    if (!r.items?.length) return r.equipName || "-";
    const names = r.items.map(i => i.modelName || i.equipName || "").filter(Boolean);
    return names.length > 1 ? `${names[0]} 외 ${names.length-1}` : names[0] || "-";
  };

  const toggleStatus = (s) => {
    setStatusFilter(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  return (
    <div>
      {/* 페이지 안내 배너 (학생용) */}
      {!isAdmin && (
        <div style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/mascot/tripod.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
            <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
              <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
              <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 캘린더 페이지야!</div>
              <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>대여 일정을 한눈에 확인할 수 있어.\n내 예약 현황도 여기서 볼 수 있어 📅</div>
            </div>
          </div>
        </div>
      )}
      <PageTitle>📅 예약 캘린더</PageTitle>

      {/* 관리자 월간 통계 */}
      {isAdmin && (
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          {[
            ["전체", stats.total, C.blue, C.blueLight],
            ["대기", stats.pending, C.yellow, C.yellowLight],
            ["승인", stats.approved, C.teal, C.tealLight],
            ["대여중", stats.active, C.navy, C.blueLight],
          ].map(([label, val, col, bg]) => (
            <div key={label} style={{ background:bg, borderRadius:10, padding:"6px 10px", border:`1px solid ${col}30`, flex:1, textAlign:"center" }}>
              <div style={{ fontSize:16, fontWeight:900, color:col }}>{val}</div>
              <div style={{ fontSize:10, color:C.muted }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 상태 필터 (관리자) */}
      {isAdmin && (
        <div style={{ display:"flex", gap:4, marginBottom:12, flexWrap:"nowrap", overflowX:"auto", alignItems:"center" }}>
          <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>표시:</span>
          {ALL_STATUSES.map(s => {
            const m = STATUS_META[s] || {};
            const on = statusFilter.includes(s);
            return (
              <button key={s} onClick={() => toggleStatus(s)} style={{
                background: on ? m.color : C.surface,
                color: on ? "#fff" : C.muted,
                border: `1px solid ${on ? m.color : C.border}`,
                borderRadius:12, padding:"3px 9px", fontSize:10,
                fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
              }}>
                {s}
              </button>
            );
          })}
          <button onClick={() => setStatusFilter(ALL_STATUSES.filter(s=>s!=="거절됨"))}
            style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"3px 9px", fontSize:10, color:C.muted, cursor:"pointer", flexShrink:0 }}>
            초기화
          </button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* 캘린더 */}
        <Card style={{ padding: "20px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <button onClick={prevMonth} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <div style={{ fontSize:20, fontWeight:800, color:C.navy }}>{year}년 {MONTH_NAMES[month]}</div>
            <button onClick={nextMonth} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, width:38, height:38, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
            {DAY_NAMES.map((d,i) => (
              <div key={d} style={{ textAlign:"center", fontSize:12, fontWeight:700, padding:"4px 0", color:i===0?C.red:i===6?C.blue:C.muted }}>{d}</div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
            {Array(firstDay).fill(null).map((_,i) => <div key={`p${i}`} />)}
            {Array(daysInMonth).fill(null).map((_,i) => {
              const d       = i + 1;
              const events  = getEvents(d);
              const isToday = d === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
              const isSel   = sel === d;
              const dow     = new Date(year, month-1, d).getDay();

              return (
                <div key={d} onClick={() => setSel(isSel ? null : d)} style={{
                  borderRadius:10, padding:"5px 4px", cursor:"pointer",
                  background: isSel ? C.navy : isToday ? C.blueLight : C.surface,
                  border:`2px solid ${isSel ? C.navy : isToday ? C.blue : C.border}`,
                  transition:"all 0.15s",
                  minHeight: isAdmin ? 56 : 44,
                }}>
                  <div style={{ fontSize:13, fontWeight:isSel||isToday?800:400, color:isSel?"#fff":isToday?C.blue:dow===0?C.red:dow===6?C.blue:C.text, marginBottom:3 }}>{d}</div>

                  {/* 관리자: 이벤트 도트 + 건수 */}
                  {isAdmin && events.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:2, justifyContent:"center" }}>
                      {events.slice(0,3).map((r,j) => {
                        const sm = STATUS_META[r.status] || {};
                        return <div key={j} style={{ width:6, height:6, borderRadius:"50%", background:isSel?"rgba(255,255,255,0.8)":sm.color||C.muted, flexShrink:0 }} />;
                      })}
                      {events.length > 3 && <div style={{ fontSize:8, color:isSel?"rgba(255,255,255,0.7)":C.muted, fontWeight:700 }}>+{events.length-3}</div>}
                    </div>
                  )}

                  {/* 학생: 도트 */}
                  {!isAdmin && (
                    <div style={{ display:"flex", justifyContent:"center", gap:2, flexWrap:"wrap" }}>
                      {events.slice(0,3).map((_,j) => (
                        <div key={j} style={{ width:6, height:6, borderRadius:"50%", background:isSel?"rgba(255,255,255,0.7)":C.teal }} />
                      ))}
                      {events.length > 3 && <div style={{ fontSize:9, color:isSel?"#fff":C.muted }}>+{events.length-3}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          {isAdmin ? (
            <div style={{ display:"flex", gap:12, marginTop:16, flexWrap:"wrap" }}>
              {["승인대기","승인됨","대여중"].map(s => {
                const m = STATUS_META[s];
                return (
                  <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:m.color }} />
                    <span style={{ fontSize:11, color:C.muted }}>{s}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display:"flex", gap:20, marginTop:16, justifyContent:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:10, height:10, borderRadius:"50%", background:C.teal }} /><span style={{ fontSize:12, color:C.muted }}>대여 일정</span></div>
            </div>
          )}
        </Card>

        {/* 선택 날짜 상세 패널 - 캘린더 아래 */}
        {sel && (
          <div>
            <Card style={{ border:`2px solid ${C.blue}25` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.navy }}>{month}월 {sel}일</div>
                  <span style={{ fontSize:12, color:C.muted, background:C.bg, borderRadius:12, padding:"2px 10px" }}>총 {selEvents.length}건</span>
                </div>
                <button onClick={() => setSel(null)} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px", color:C.muted, fontSize:12, cursor:"pointer" }}>닫기</button>
              </div>

              {selEvents.length === 0 && (
                <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"24px 0" }}>이 날 일정이 없습니다</div>
              )}
              {selEvents.map(r => {
                const sm = STATUS_META[r.status] || {};
                return (
                  <div key={r.id} onClick={() => setDetail(r)} style={{
                    background:C.bg, borderRadius:12, padding:"12px 14px", marginBottom:10,
                    borderLeft:`4px solid ${sm.color||C.muted}`, cursor:"pointer",
                    border:`1px solid ${C.border}`, borderLeftWidth:4,
                    transition:"box-shadow 0.15s",
                  }}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.08)"}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{r.studentName}</div>
                      <span style={{ background:sm.bg, color:sm.color, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, flexShrink:0 }}>{r.status}</span>
                    </div>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
                      {isAdmin && <>{r.dept || ""} · {r.studentId || r.role === "professor" ? "교수" : ""}</>}
                    </div>
                    <div style={{ fontSize:12, color:C.text, fontWeight:600, marginBottom:4 }}>
                      🔧 {getItemLabel(r)}
                    </div>
                    <div style={{ fontSize:11, color:C.muted }}>
                      📅 {r.startDate} {r.startTime} ~ {r.endDate} {r.endTime}
                    </div>
                    {r.purpose && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>🎯 {r.purpose}</div>}
                    {r.location && <div style={{ fontSize:11, color:C.muted }}>📍 {r.locationType ? r.locationType+" - " : ""}{r.location}</div>}
                  </div>
                );
              })}
            </Card>
          </div>
        )}
      </div>

      {/* 신청 상세 모달 */}
      {detail && (() => {
        const sm = STATUS_META[detail.status] || {};
        return (
          <Modal onClose={() => setDetail(null)} width={500}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:17, fontWeight:800, color:C.navy }}>📋 신청 상세</div>
              <span style={{ background:sm.bg, color:sm.color, borderRadius:20, padding:"4px 14px", fontSize:13, fontWeight:700 }}>{detail.status}</span>
            </div>

            {/* 신청자 */}
            <div style={{ background:C.bg, borderRadius:12, padding:"12px 16px", marginBottom:14, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>👤 신청자</div>
              <div style={{ fontSize:15, fontWeight:700, color:C.navy }}>{detail.studentName}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                {detail.dept} · {detail.studentId} · {detail.phone}
              </div>
            </div>

            {/* 장비 */}
            <div style={{ background:C.bg, borderRadius:12, padding:"12px 16px", marginBottom:14, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>🔧 신청 장비</div>
              {(detail.items || []).map((item, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom: i < detail.items.length-1 ? `1px solid ${C.border}` : "none" }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{item.modelName || item.equipName}</span>
                    {item.isSet && <span style={{ marginLeft:6, background:C.orangeLight, color:C.orange, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>세트</span>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:C.teal }}>{item.quantity}개</span>
                </div>
              ))}
              {(!detail.items || detail.items.length === 0) && <div style={{ fontSize:13, color:C.muted }}>{detail.equipName || "-"}</div>}
            </div>

            {/* 기간 */}
            <div style={{ background:C.bg, borderRadius:12, padding:"12px 16px", marginBottom:14, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>📅 대여 기간</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>대여 시작</div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{detail.startDate}</div>
                  <div style={{ fontSize:12, color:C.blue }}>{detail.startTime}</div>
                </div>
                <div style={{ fontSize:20, color:C.muted }}>→</div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>반납</div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{detail.endDate}</div>
                  <div style={{ fontSize:12, color:C.blue }}>{detail.endTime}</div>
                </div>
              </div>
            </div>

            {/* 기타 정보 */}
            <div style={{ background:C.bg, borderRadius:12, padding:"12px 16px", marginBottom:16, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>📝 상세 정보</div>
              {[
                ["사용 목적", detail.purpose],
                ["사용 장소", `${detail.locationType||""} ${detail.location||""}`.trim()],
                detail.purposeDetail && ["세부 내용", detail.purposeDetail],
                detail.courseName    && ["수업명", detail.courseName],
                detail.professorName && ["담당교수", detail.professorName],
                detail.club          && ["동아리", detail.club],
                detail.eventName     && ["행사명", detail.eventName],
                detail.participants  && ["참여인원", detail.participants],
              ].filter(Boolean).map(([k,v]) => v ? (
                <div key={k} style={{ display:"flex", gap:12, padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12, color:C.muted, minWidth:72, flexShrink:0 }}>{k}</span>
                  <span style={{ fontSize:13, color:C.text, whiteSpace:"pre-wrap" }}>{v}</span>
                </div>
              ) : null)}
            </div>

            {detail.reason && (
              <div style={{ background:C.redLight, borderRadius:10, padding:"12px 14px", marginBottom:14, border:`1px solid ${C.red}30` }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:4 }}>거절 사유</div>
                <div style={{ fontSize:13, color:C.red }}>{detail.reason}</div>
              </div>
            )}

            <Btn onClick={() => setDetail(null)} color={C.navy} full>닫기</Btn>
          </Modal>
        );
      })()}
    </div>
  );
}
