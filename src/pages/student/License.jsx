import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";

export default function License() {
  const { profile } = useAuth();
  const { data: schedules }    = useCollection("licenseSchedules", "date");
  const { data: applications } = useCollection("licenseApplications", "createdAt");

  const [showConfirm, setShowConfirm] = useState(null);
  const [applying, setApplying]       = useState(false);

  const licenseToNum = (lic) => {
    if (!lic || lic === "없음") return 0;
    const n = parseInt(lic);
    return isNaN(n) ? 0 : n;
  };

  const myLevel    = licenseToNum(profile?.license);
  const myId       = profile?.studentId || "";
  const myApps     = applications.filter(a => a.studentId === myId);
  const myAppIds   = new Set(myApps.map(a => a.scheduleId));

  // 신청 가능 여부 체크
  const canApply = (schedule) => {
    if (schedule.status !== "모집중") return { ok: false, reason: "모집 마감" };
    if (schedule.level !== myLevel + 1) return { ok: false, reason: `현재 ${myLevel}단계 — ${myLevel + 1}단계부터 신청 가능` };
    if (myAppIds.has(schedule.id)) return { ok: false, reason: "이미 신청함" };
    if (schedule.maxCount > 0) {
      const appCount = applications.filter(a => a.scheduleId === schedule.id).length;
      if (appCount >= schedule.maxCount) return { ok: false, reason: "정원 마감" };
    }
    return { ok: true };
  };

  const apply = async (schedule) => {
    setApplying(true);
    try {
      await addItem("licenseApplications", {
        scheduleId:   schedule.id,
        scheduleTitle: schedule.title,
        level:        schedule.level,
        date:         schedule.date,
        time:         schedule.time,
        studentId:    profile.studentId || "",
        studentName:  profile.name || "",
        dept:         profile.dept || "",
        userId:       profile.uid || "",
        attended:     false,
      });
      setShowConfirm(null);
    } catch(e) {
      alert("신청 중 오류: " + e.message);
    }
    setApplying(false);
  };

  const levelColor = (lv) => {
    const map = {
      1: { bg: C.blueLight,   col: C.blue   },
      2: { bg: C.purpleLight, col: C.purple },
      3: { bg: C.orangeLight, col: C.orange },
    };
    return map[lv] || { bg: C.bg, col: C.muted };
  };

  // 내 신청 이력 (일정 정보 포함)
  const myHistory = myApps.map(app => ({
    ...app,
    schedule: schedules.find(s => s.id === app.scheduleId),
  }));

  return (
    <div>
      <PageTitle>라이센스 신청</PageTitle>

      {/* 내 라이센스 현황 */}
      <Card style={{ marginBottom:24, background:`linear-gradient(135deg,${C.navy},#2D4A9B)` }}>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:6 }}>내 현재 라이센스</div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ fontSize:36, fontWeight:900, color:"#fff" }}>
            {myLevel === 0 ? "없음" : `${myLevel}단계`}
          </div>
          {myLevel < 3 && (
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.6 }}>
              다음 신청 가능 단계: <span style={{ color:"#93C5FD", fontWeight:700 }}>{myLevel + 1}단계</span>
            </div>
          )}
          {myLevel === 3 && (
            <div style={{ fontSize:13, color:"#6EE7B7", fontWeight:600 }}>최고 단계 달성!</div>
          )}
        </div>
        {/* 단계 진행바 */}
        <div style={{ display:"flex", gap:6, marginTop:16 }}>
          {[1,2,3].map(lv => (
            <div key={lv} style={{ flex:1, height:8, borderRadius:4, background: lv <= myLevel ? "#93C5FD" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          {[1,2,3].map(lv => (
            <div key={lv} style={{ fontSize:10, color: lv <= myLevel ? "#93C5FD" : "rgba(255,255,255,0.4)" }}>{lv}단계</div>
          ))}
        </div>
      </Card>

      {/* 신청 가능한 일정 */}
      <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginBottom:14 }}>신청 가능한 수업</div>
      {schedules.filter(s => s.level === myLevel + 1).length === 0 && myLevel < 3 && (
        <div style={{ background:C.yellowLight, borderRadius:12, padding:"14px 18px", fontSize:13, color:"#92400E", marginBottom:20 }}>
          현재 {myLevel + 1}단계 수업 일정이 없습니다. 공지사항을 확인해주세요.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14, marginBottom:28 }}>
        {schedules
          .filter(s => s.level === myLevel + 1 || myAppIds.has(s.id))
          .map(s => {
            const { ok, reason } = canApply(s);
            const lc = levelColor(s.level);
            const appCount = applications.filter(a => a.scheduleId === s.id).length;
            const myApp = myApps.find(a => a.scheduleId === s.id);
            return (
              <Card key={s.id} style={{ border:`2px solid ${myApp ? C.teal : ok ? lc.col+"40" : C.border}` }}>
                <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                  <span style={{ background:lc.bg, color:lc.col, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{s.level}단계</span>
                  <span style={{ background: s.status==="모집중"?C.greenLight:C.redLight, color: s.status==="모집중"?C.green:C.red, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{s.status}</span>
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>📅 {s.date}</div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:8 }}>🕐 {s.time}</div>
                {s.description && (
                  <div style={{ fontSize:13, color:C.text, lineHeight:1.6, marginBottom:10, whiteSpace:"pre-wrap" }}>{s.description}</div>
                )}
                <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
                  신청 {appCount}명{s.maxCount > 0 ? ` / 최대 ${s.maxCount}명` : ""}
                </div>
                {myApp ? (
                  <div style={{ background: myApp.attended ? C.greenLight : C.blueLight, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                    <div style={{ fontSize:13, fontWeight:700, color: myApp.attended ? C.green : C.blue }}>
                      {myApp.attended ? "✅ 출석 완료 → 라이센스 부여됨" : "📋 신청 완료 — 수업 대기중"}
                    </div>
                  </div>
                ) : ok ? (
                  <Btn onClick={() => setShowConfirm(s)} color={C.teal} full>신청하기</Btn>
                ) : (
                  <div style={{ background:C.bg, borderRadius:10, padding:"8px 12px", fontSize:12, color:C.muted, textAlign:"center" }}>{reason}</div>
                )}
              </Card>
            );
          })}
      </div>

      {/* 내 신청 이력 */}
      {myHistory.length > 0 && (
        <>
          <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginBottom:14 }}>내 신청 이력</div>
          {myHistory.map(app => {
            const lc = levelColor(app.level);
            return (
              <Card key={app.id} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ background:lc.bg, color:lc.col, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{app.level}단계</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{app.scheduleTitle}</div>
                      <div style={{ fontSize:12, color:C.muted }}>{app.date} {app.time}</div>
                    </div>
                  </div>
                  <span style={{ background: app.attended ? C.greenLight : C.yellowLight, color: app.attended ? C.green : C.yellow, borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
                    {app.attended ? "출석완료" : "대기중"}
                  </span>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {/* 신청 확인 모달 */}
      {showConfirm && (
        <Modal onClose={() => setShowConfirm(null)} width={440}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>라이센스 수업 신청</div>
          <div style={{ background:C.bg, borderRadius:12, padding:"16px", marginBottom:20 }}>
            {[
              ["수업명", showConfirm.title],
              ["단계", `${showConfirm.level}단계`],
              ["날짜", showConfirm.date],
              ["시간", showConfirm.time],
            ].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, color:C.muted }}>{k}</span>
                <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:13, color:"#92400E", marginBottom:20 }}>
            수업 당일 반드시 참석해야 라이센스가 부여됩니다.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowConfirm(null)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={() => apply(showConfirm)} color={C.teal} full disabled={applying}>{applying?"신청중...":"신청 완료"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
