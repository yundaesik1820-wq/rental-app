import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle, Badge } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";

const LEVELS = [1, 2, 3];

export default function LicenseAdmin() {
  const { profile } = useAuth();
  const { data: schedules }    = useCollection("licenseSchedules", "date");
  const { data: applications } = useCollection("licenseApplications", "createdAt");
  const { data: users }        = useCollection("users", "name");

  const [tab, setTab]           = useState("schedules"); // schedules | applications
  const [showAdd, setShowAdd]   = useState(false);
  const [selSchedule, setSelSchedule] = useState(null); // 출석 체크 모달
  const [form, setForm]         = useState({ title:"", date:"", time:"", level:1, maxCount:"", description:"" });
  const [saving, setSaving]     = useState(false);

  const licenseToNum = (lic) => {
    if (!lic || lic === "없음") return 0;
    const n = parseInt(lic);
    return isNaN(n) ? 0 : n;
  };

  const addSchedule = async () => {
    if (!form.title || !form.date || !form.time) return alert("제목, 날짜, 시간을 입력하세요");
    setSaving(true);
    await addItem("licenseSchedules", {
      title: form.title, date: form.date, time: form.time,
      level: Number(form.level), maxCount: Number(form.maxCount) || 0,
      description: form.description, status: "모집중",
      author: profile?.name || "관리자",
    });
    setForm({ title:"", date:"", time:"", level:1, maxCount:"", description:"" });
    setShowAdd(false);
    setSaving(false);
  };

  // 출석 체크 → 라이센스 업그레이드
  const checkAttendance = async (app) => {
    if (app.attended) return;
    setSaving(true);
    try {
      // 1. 신청 상태 출석 처리
      await updateItem("licenseApplications", app.id, { attended: true });
      // 2. users 컬렉션에서 학생 찾아 라이센스 업그레이드
      const user = users.find(u => u.studentId === app.studentId || u.uid === app.userId);
      if (user) {
        const newLevel = (licenseToNum(user.license) + 1);
        await updateItem("users", user.id, { license: `${newLevel}단계` });
      }
    } catch(e) {
      alert("오류: " + e.message);
    }
    setSaving(false);
  };

  // 일정별 신청자 목록
  const getApps = (scheduleId) =>
    applications.filter(a => a.scheduleId === scheduleId);

  const formatDate = (ts) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("ko-KR");
  };

  const levelColor = (lv) => {
    const map = { 1: { bg: C.blueLight, col: C.blue }, 2: { bg: C.purpleLight, col: C.purple }, 3: { bg: C.orangeLight, col: C.orange } };
    return map[lv] || { bg: C.bg, col: C.muted };
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>라이센스 관리</PageTitle>
        <Btn onClick={() => setShowAdd(true)}>+ 수업 일정 등록</Btn>
      </div>

      {/* 탭 */}
      <div style={{ display:"flex", background:C.surface, borderRadius:12, padding:4, marginBottom:20, border:`1px solid ${C.border}`, width:"fit-content" }}>
        {[["schedules","수업 일정"],["applications","신청 현황"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"8px 24px", borderRadius:9, border:"none", fontSize:14, fontWeight:700, cursor:"pointer", background:tab===id?C.navy:"transparent", color:tab===id?"#fff":C.muted }}>
            {label}
          </button>
        ))}
      </div>

      {/* 수업 일정 탭 */}
      {tab === "schedules" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
          {schedules.length === 0 && <Empty icon="📅" text="등록된 수업 일정이 없습니다" />}
          {schedules.map(s => {
            const apps  = getApps(s.id);
            const lc    = levelColor(s.level);
            const attended = apps.filter(a => a.attended).length;
            return (
              <Card key={s.id}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <span style={{ background:lc.bg, color:lc.col, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{s.level}단계</span>
                    <span style={{ background: s.status==="모집중"?C.greenLight:C.bg, color: s.status==="모집중"?C.green:C.muted, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{s.status}</span>
                  </div>
                  <button onClick={() => deleteItem("licenseSchedules", s.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>🗑️</button>
                </div>
                <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>📅 {s.date} {s.time}</div>
                {s.description && <div style={{ fontSize:13, color:C.text, marginBottom:10, lineHeight:1.6 }}>{s.description}</div>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:C.bg, borderRadius:8, marginBottom:10 }}>
                  <span style={{ fontSize:13, color:C.muted }}>신청 {apps.length}명 {s.maxCount > 0 ? `/ 최대 ${s.maxCount}명` : ""}</span>
                  <span style={{ fontSize:13, color:C.green, fontWeight:600 }}>출석 {attended}명</span>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={() => setSelSchedule(s)} color={C.teal} full>출석 체크</Btn>
                  <Btn onClick={() => updateItem("licenseSchedules", s.id, { status: s.status==="모집중"?"모집마감":"모집중" })} color={C.muted} outline full>
                    {s.status==="모집중" ? "마감" : "재오픈"}
                  </Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 신청 현황 탭 */}
      {tab === "applications" && (
        <div>
          {applications.length === 0 && <Empty icon="📋" text="신청 내역이 없습니다" />}
          {schedules.map(s => {
            const apps = getApps(s.id);
            if (apps.length === 0) return null;
            const lc = levelColor(s.level);
            return (
              <div key={s.id} style={{ marginBottom:24 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ background:lc.bg, color:lc.col, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{s.level}단계</span>
                  <span style={{ fontSize:15, fontWeight:800, color:C.navy }}>{s.title}</span>
                  <span style={{ fontSize:13, color:C.muted }}>{s.date} {s.time}</span>
                </div>
                {apps.map(app => (
                  <Card key={app.id} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{app.studentName}</div>
                        <div style={{ fontSize:12, color:C.muted }}>{app.dept} · {app.studentId}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>신청일: {formatDate(app.createdAt)}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {app.attended
                          ? <span style={{ background:C.greenLight, color:C.green, borderRadius:8, padding:"4px 14px", fontSize:13, fontWeight:700 }}>✅ 출석</span>
                          : <Btn onClick={() => checkAttendance(app)} color={C.teal} small disabled={saving}>출석 체크</Btn>
                        }
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 일정 등록 모달 */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} width={500}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>라이센스 수업 일정 등록</div>
          <Inp label="수업명 *" placeholder="예: 카메라 기초 라이센스 1단계" value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>날짜 *</div>
              <input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>시간 *</div>
              <input type="time" value={form.time} onChange={e => setForm(p=>({...p,time:e.target.value}))}
                style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>라이센스 단계 *</div>
            <div style={{ display:"flex", gap:8 }}>
              {LEVELS.map(lv => {
                const lc = levelColor(lv);
                return (
                  <button key={lv} onClick={() => setForm(p=>({...p,level:lv}))}
                    style={{ flex:1, padding:"10px 0", borderRadius:10, border:`2px solid ${form.level===lv?lc.col:C.border}`, background:form.level===lv?lc.bg:C.bg, color:form.level===lv?lc.col:C.muted, fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    {lv}단계
                  </button>
                );
              })}
            </div>
          </div>
          <Inp label="최대 인원" placeholder="0 = 제한없음" value={form.maxCount} onChange={e => setForm(p=>({...p,maxCount:e.target.value}))} type="number" />
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>수업 설명</div>
            <textarea placeholder="수업 내용, 준비물 등 안내" value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:80, boxSizing:"border-box" }} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={addSchedule} color={C.navy} full disabled={saving}>{saving?"등록중...":"등록"}</Btn>
          </div>
        </Modal>
      )}

      {/* 출석 체크 모달 */}
      {selSchedule && (() => {
        const apps = getApps(selSchedule.id);
        const lc   = levelColor(selSchedule.level);
        return (
          <Modal onClose={() => setSelSchedule(null)} width={520}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ background:lc.bg, color:lc.col, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{selSchedule.level}단계</span>
              <div style={{ fontSize:17, fontWeight:800, color:C.navy }}>{selSchedule.title}</div>
            </div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>{selSchedule.date} {selSchedule.time}</div>

            {apps.length === 0 && <Empty icon="👥" text="신청자가 없습니다" />}
            {apps.map(app => (
              <div key={app.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", background:app.attended?C.greenLight:C.bg, borderRadius:12, marginBottom:8, border:`1px solid ${app.attended?C.green:C.border}` }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{app.studentName}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{app.dept} · {app.studentId}</div>
                </div>
                {app.attended
                  ? <span style={{ color:C.green, fontWeight:700, fontSize:13 }}>✅ 출석완료 → {selSchedule.level}단계 부여</span>
                  : <Btn onClick={() => checkAttendance(app)} color={C.teal} small disabled={saving}>출석 체크</Btn>
                }
              </div>
            ))}
            <div style={{ marginTop:16 }}>
              <Btn onClick={() => setSelSchedule(null)} color={C.navy} full>닫기</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
