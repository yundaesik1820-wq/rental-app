import { useState } from "react";
import Stats from "./Stats.jsx";
import { C } from "../../theme";
import { Card, PageTitle, Badge, Modal, Btn } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import { isKoreanHoliday, getKoreanHolidayName } from "../../utils/koreanHolidays";
import { CalendarDays, MapPin, Wrench, User, ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = ["","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_NAMES   = ["일","월","화","수","목","금","토"];

const STATUS_META = {
  "승인대기": { color: C.yellow,  bg: "#FFFBEB", label: "승인대기" },
  "승인됨":   { color: C.blue,    bg: C.blueLight, label: "승인됨"   },
  "대여중":   { color: C.teal,    bg: C.tealLight, label: "대여중"   },
  "반납완료": { color: C.muted,   bg: "#F8FAFC",   label: "반납완료" },
  "거절됨":   { color: C.red,     bg: C.redLight,  label: "거절됨"   },
};

// 학생 캘린더 리디자인용 상태 색(홈 톤 블루 계열)
const ST_PAL = {
  "승인대기": { bg:"rgba(245,158,11,.16)", fg:"#fcd34d" },
  "승인됨":   { bg:"rgba(45,212,191,.16)", fg:"#5eead4" },
  "대여중":   { bg:"rgba(59,130,246,.16)", fg:"#7fa9ff" },
  "반납완료": { bg:"rgba(45,212,191,.16)", fg:"#5eead4" },
  "거절됨":   { bg:"rgba(239,68,68,.16)",  fg:"#fca5a5" },
};

const ALL_STATUSES = ["승인대기","승인됨","대여중","반납완료","거절됨"];

export default function CalendarPage({ isAdmin = true, userId = null, userEmail = null, userName = null }) {
  const today = new Date();
  const [calView, setCalView] = useState("calendar"); // "calendar" | "stats"
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

  const isMineReq = (r) =>
    (userId && r.studentId === userId)
    || (userEmail && r.phone === userEmail)
    || (userName && r.studentName === userName);

  const getEvents = (d) => {
    const ds = toStr(d);
    return requests.filter(r => {
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

  // 학생 범례용 — 이번 달 내 예약/반납완료 건수
  const myMonthReqs     = monthRequests.filter(isMineReq);
  const myMonthTotal    = myMonthReqs.length;
  const myMonthReturned = myMonthReqs.filter(r => r.status === "반납완료").length;

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
      {/* 뷰 전환 탭 (관리자만 — 캘린더/통계 전환. 학생은 캘린더 단일이라 숨김) */}
      {isAdmin && (
        <div style={{ display:"flex", gap:4, marginBottom:12 }}>
          {[["calendar","📅 캘린더"],["stats","📊 통계"]].map(([v,l]) => (
            <button key={v} onClick={() => setCalView(v)}
              style={{ padding:"5px 14px", borderRadius:10, border:"none", fontSize:12, fontWeight:700, cursor:"pointer", background:calView===v?C.navy:C.surface, color:calView===v?C.bg:C.muted }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* 통계 뷰 - 관리자만 */}
      {isAdmin && calView === "stats" && <Stats />}

      {/* 캘린더 뷰 */}
      {calView === "calendar" && <div>
      {isAdmin && <PageTitle>📅 예약 캘린더</PageTitle>}

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
                color: on ? C.bg : C.muted,
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
        <Card style={ isAdmin ? { padding: "20px 16px" } : { padding: 16, background:"#141824", border:"1px solid #232a3a", borderRadius:18 } }>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: isAdmin ? 20 : 14 }}>
            <button onClick={prevMonth} style={{ background: isAdmin?C.bg:"#10131d", border:`1px solid ${isAdmin?C.border:"#2a4a6a"}`, borderRadius:10, width:38, height:36, cursor:"pointer", color: isAdmin?C.text:"#cfe0ff", display:"flex", alignItems:"center", justifyContent:"center" }}>{isAdmin ? "‹" : <ChevronLeft size={18} />}</button>
            <div style={{ fontSize: isAdmin?20:19, fontWeight: isAdmin?800:900, color: isAdmin?C.navy:"#fff" }}>{year}년 {MONTH_NAMES[month]}</div>
            <button onClick={nextMonth} style={{ background: isAdmin?C.bg:"#10131d", border:`1px solid ${isAdmin?C.border:"#2a4a6a"}`, borderRadius:10, width:38, height:36, cursor:"pointer", color: isAdmin?C.text:"#cfe0ff", display:"flex", alignItems:"center", justifyContent:"center" }}>{isAdmin ? "›" : <ChevronRight size={18} />}</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap: isAdmin?3:6, marginBottom:6 }}>
            {DAY_NAMES.map((d,i) => (
              <div key={d} style={{ textAlign:"center", fontSize:12.5, fontWeight:700, padding:"4px 0", color:i===0?"#f87171":i===6?"#60a5fa":(isAdmin?C.muted:"#93a0bd") }}>{d}</div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap: isAdmin?3:6 }}>
            {Array(firstDay).fill(null).map((_,i) => <div key={`p${i}`} />)}
            {Array(daysInMonth).fill(null).map((_,i) => {
              const d       = i + 1;
              const events  = getEvents(d);
              const isToday = d === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
              const isSel   = sel === d;
              const dow     = new Date(year, month-1, d).getDay();
              const holidayName = getKoreanHolidayName(year, month, d);
              const isHoliday   = !!holidayName;

              // ── 학생 리디자인 셀 (정사각·다크, 오늘=민트, 선택=흰테두리) ──
              if (!isAdmin) {
                const mineCount = events.filter(isMineReq).length;
                const numColor = isToday ? "#04201d" : isSel ? "#fff" : (dow===0||isHoliday) ? "#f87171" : dow===6 ? "#60a5fa" : "#c7cfdd";
                return (
                  <div key={d} onClick={() => setSel(isSel ? null : d)} style={{
                    aspectRatio:"1/1", borderRadius:12, cursor:"pointer", position:"relative",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background: isToday ? "linear-gradient(135deg,#22d3ee,#2DD4BF)" : "#0d1017",
                    border: isSel ? "2px solid #fff" : isToday ? "1px solid transparent" : "1px solid #1b2130",
                    transition:"all 0.15s",
                  }}>
                    <span style={{ fontSize:15, fontWeight: (isToday||isSel)?800:600, color:numColor }}>{d}</span>
                    {events.length > 0 && (
                      <span style={{ position:"absolute", bottom:7, left:"50%", transform:"translateX(-50%)", width:5, height:5, borderRadius:"50%",
                        background: isToday ? "#04201d" : mineCount>0 ? "#2DD4BF" : "#3b4560" }} />
                    )}
                  </div>
                );
              }

              return (
                <div key={d} onClick={() => setSel(isSel ? null : d)} style={{
                  borderRadius:10, padding:"5px 4px", cursor:"pointer",
                  background: isSel ? C.teal : isToday ? C.blueLight : C.surface,
                  border:`2px solid ${isSel ? C.teal : isToday ? C.blue : C.border}`,
                  transition:"all 0.15s",
                  minHeight: isAdmin ? 56 : 44,
                }}>
                  <div style={{ fontSize:13, fontWeight:isSel||isToday?800:400, color:isSel?"#fff":isToday?C.blue:(dow===0||isHoliday)?C.red:dow===6?C.blue:C.text, marginBottom:3 }}>{d}</div>
                  {isHoliday && (
                    <div style={{ fontSize:8, fontWeight:700, color:isSel?"rgba(255,255,255,0.85)":C.red, marginBottom:2, lineHeight:1.1, wordBreak:"keep-all", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {holidayName}
                    </div>
                  )}

                  {/* 관리자: 이벤트 도트 + 건수 */}
                  {isAdmin && events.length > 0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:2, width:"100%" }}>
                      {events.slice(0,3).map((r,j) => {
                        const sm = STATUS_META[r.status] || {};
                        const col = isSel?"rgba(255,255,255,0.8)":sm.color||C.muted;
                        const isMultiDay = r.startDate !== r.endDate;
                        const isStart = toStr(d) === r.startDate;
                        const isEnd   = toStr(d) === r.endDate;
                        if (isMultiDay) {
                          return (
                            <div key={j} style={{
                              height:5, background:col,
                              borderRadius: isStart?"3px 0 0 3px": isEnd?"0 3px 3px 0":"0",
                              marginLeft: isStart?2:0, marginRight: isEnd?2:0,
                              width:"100%", flexShrink:0
                            }} />
                          );
                        }
                        return <div key={j} style={{ width:6, height:6, borderRadius:"50%", background:col, flexShrink:0, alignSelf:"center" }} />;
                      })}
                      {events.length > 3 && <div style={{ fontSize:8, color:isSel?"rgba(255,255,255,0.7)":C.muted, fontWeight:700, textAlign:"center" }}>+{events.length-3}</div>}
                    </div>
                  )}

                  {/* 학생: 당일=도트, 주말대여(연속)=바 */}
                  {!isAdmin && (
                    <div style={{ display:"flex", flexDirection:"column", gap:2, width:"100%" }}>
                      {events.slice(0,3).map((r,j) => {
                        const mine = isMineReq(r);
                        const isMultiDay = r.startDate !== r.endDate;
                        const isStart = toStr(d) === r.startDate;
                        const isEnd   = toStr(d) === r.endDate;
                        const baseColor = mine ? C.teal : C.border;
                        const selColor  = mine ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)";
                        const col = isSel ? selColor : baseColor;
                        if (isMultiDay) {
                          return (
                            <div key={j} style={{
                              height:5, borderRadius: isStart?"3px 0 0 3px": isEnd?"0 3px 3px 0":"0",
                              background:col, marginLeft: isStart?2:0, marginRight: isEnd?2:0,
                              width:"100%", flexShrink:0
                            }} />
                          );
                        }
                        return <div key={j} style={{ width:6, height:6, borderRadius:"50%", background:col, alignSelf:"center" }} />;
                      })}
                      {events.length > 3 && <div style={{ fontSize:8, color:isSel?"#fff":C.muted, textAlign:"center" }}>+{events.length-3}</div>}
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
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:16, justifyContent:"center", flexWrap:"wrap", fontSize:12, color:C.muted }}>
              <span style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ width:9, height:9, borderRadius:"50%", background:"#2DD4BF" }} /><span style={{ color:C.text }}>대여 일정</span></span>
              <span style={{ color:"#2a3448" }}>|</span>
              <span>이번 달 예약 <b style={{ color:"#5eead4" }}>{myMonthTotal}건</b> · 반납완료 <b style={{ color:"#7fa9ff" }}>{myMonthReturned}건</b></span>
            </div>
          )}
        </Card>

        {/* 선택 날짜 상세 패널 - 캘린더 아래 */}
        {sel && (
          <div>
            <Card style={ isAdmin ? { border:`2px solid ${C.blue}25` } : { background:"#141824", border:"1px solid #232a3a", borderRadius:18 } }>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <div style={{ fontSize: isAdmin?16:20, fontWeight: isAdmin?800:900, color: isAdmin?C.navy:"#fff" }}>{month}월 {sel}일</div>
                  <span style={{ fontSize:12, color:C.muted, background: isAdmin?C.bg:"#10131d", border: isAdmin?"none":"1px solid #232a3a", borderRadius:16, padding:"3px 11px" }}>총 {selEvents.length}건</span>
                </div>
                <button onClick={() => setSel(null)} style={{ background: isAdmin?C.bg:"#10131d", border:`1px solid ${isAdmin?C.border:"#232a3a"}`, borderRadius:10, padding:"6px 16px", color:C.muted, fontSize:13, cursor:"pointer", textAlign:"center" }}>닫기</button>
              </div>

              {selEvents.length === 0 && (
                <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"24px 0" }}>이 날 일정이 없습니다</div>
              )}
              {selEvents.map(r => {
                const sm = STATUS_META[r.status] || {};

                // ── 학생 리디자인 예약 카드 (아바타·배지·아이콘) ──
                if (!isAdmin) {
                  const p = ST_PAL[r.status] || { bg:"rgba(148,163,184,.16)", fg:"#cbd5e1" };
                  return (
                    <div key={r.id} onClick={() => setDetail(r)} style={{
                      background:"#10131d", border:"1px solid #2a4a6a", borderRadius:14, padding:14, marginBottom:10, cursor:"pointer",
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:11 }}>
                        <div style={{ width:44, height:44, borderRadius:12, background:"rgba(59,130,246,.16)", display:"grid", placeItems:"center", flexShrink:0 }}>
                          <User size={22} color="#7fa9ff" />
                        </div>
                        <div style={{ fontSize:16, fontWeight:900, color:C.text, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.studentName}</div>
                        <span style={{ fontSize:12, fontWeight:800, padding:"5px 13px", borderRadius:16, background:p.bg, color:p.fg, flexShrink:0 }}>{r.status}</span>
                      </div>
                      <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:9, display:"flex", alignItems:"center", gap:7 }}>
                        <Wrench size={15} color="#7fa9ff" style={{ flexShrink:0 }} /> {getItemLabel(r)}
                      </div>
                      <div style={{ fontSize:12.5, color:"#aab3c5", display:"flex", gap:7, marginBottom:5, alignItems:"center" }}>
                        <CalendarDays size={14} style={{ flexShrink:0 }} /> <span>{r.startDate} {r.startTime} ~ {r.endDate} {r.endTime}</span>
                      </div>
                      {r.location && (
                        <div style={{ fontSize:12.5, color:"#aab3c5", display:"flex", gap:7, alignItems:"center" }}>
                          <MapPin size={14} style={{ flexShrink:0 }} /> <span>{r.locationType ? r.locationType+" · " : ""}{r.location}</span>
                        </div>
                      )}
                    </div>
                  );
                }

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

      </div>}

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
