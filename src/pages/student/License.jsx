import { useState, useEffect } from "react";
import { Modal } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { Sparkles, CalendarDays, Clock, Users, CalendarX, Trophy, Check, Megaphone, ChevronRight } from "lucide-react";

// 더보기 메뉴의 "라이선스" 타일 톤을 그대로 확장 (App.jsx tint #7c3aed / LICENSE LEVEL 배지 / blue→violet 그라데이션)
const L = {
  card:      "#121218",
  card2:     "#0B0B0E",
  border:    "rgba(255,255,255,0.07)",
  text:      "#F1F5F9",
  sub:       "#64748B",
  subLight:  "#a8adc4",
  violet:    "#7c3aed",
  violetTxt: "#c4b5fd",
  violetBg:  "rgba(124,58,237,0.13)",
  violetBd:  "rgba(124,58,237,0.5)",
  blueTxt:   "#7e9dff",
  grad:      "linear-gradient(90deg,#3b82f6,#7c3aed)",
};

// 상태색은 History.jsx 의 PAL 값 그대로 (예약내역 배지와 동일 톤)
const TEAL  = { fg: "#5eead4", bg: "rgba(45,212,191,.16)" };
const BLUE  = { fg: "#7fa9ff", bg: "rgba(59,130,246,.16)" };
const AMBER = { fg: "#fcd34d", bg: "rgba(245,158,11,.16)", bd: "rgba(245,158,11,.3)" };
const GRAY  = { fg: "#cbd5e1", bg: "rgba(148,163,184,.16)" };

// 단계별 액센트 — 앱 그라데이션(blue→violet) 진행 방향에 맞추고, 최고 단계는 골드
const LEVEL_PAL = {
  1: BLUE,
  2: { fg: L.violetTxt, bg: "rgba(124,58,237,.16)" },
  3: AMBER,
};
const lvPal = (lv) => LEVEL_PAL[lv] || GRAY;

export default function License({ focusId, onConsumed, onOpenNotices }) {
  const { profile } = useAuth();
  const { data: schedules }    = useCollection("licenseSchedules", "date");
  const { data: applications } = useCollection("licenseApplications", "createdAt");

  const [showConfirm, setShowConfirm] = useState(null);
  const [applying, setApplying]       = useState(false);

  // 🔔 알림 딥링크 — 해당 라이선스 일정으로 스크롤 + 하이라이트
  const [flashId, setFlashId] = useState(null);
  useEffect(() => {
    if (!focusId || !schedules.length) return;
    if (schedules.find(s => s.id === focusId)) setFlashId(focusId);
    onConsumed?.();
  }, [focusId, schedules]);
  useEffect(() => {
    if (!flashId) return;
    const t1 = setTimeout(() => {
      document.getElementById(`license-card-${flashId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    const t2 = setTimeout(() => setFlashId(null), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [flashId]);

  const licenseToNum = (lic) => {
    if (!lic || lic === "없음") return 0;
    const n = parseInt(lic);
    return isNaN(n) ? 0 : n;
  };

  const myLevel  = licenseToNum(profile?.license);
  const myId     = profile?.studentId || "";
  const myApps   = applications.filter(a => a.studentId === myId);
  const myAppIds = new Set(myApps.map(a => a.scheduleId));
  const isMax    = myLevel >= 3;

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
        scheduleId:    schedule.id,
        scheduleTitle: schedule.title,
        level:         schedule.level,
        date:          schedule.date,
        time:          schedule.time,
        studentId:     profile.studentId || "",
        studentName:   profile.name || "",
        dept:          profile.dept || "",
        userId:        profile.uid || "",
        attended:      false,
      });
      setShowConfirm(null);
    } catch (e) {
      alert("신청 중 오류: " + e.message);
    }
    setApplying(false);
  };

  // 내 신청 이력 (일정 정보 포함)
  const myHistory = myApps.map(app => ({ ...app, schedule: schedules.find(s => s.id === app.scheduleId) }));

  // 화면에 띄울 일정 = 다음 단계 교육 + 내가 이미 신청한 것
  const visible = schedules.filter(s => s.level === myLevel + 1 || myAppIds.has(s.id));

  const card = { background: L.card, border: `1px solid ${L.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 12 };
  const sectionTitle = { fontSize: 13, fontWeight: 800, color: L.text, margin: "22px 2px 10px" };

  return (
    <div style={{ maxWidth: 720 }}>

      {/* ─── 히어로: 내 라이선스 등급 ─── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: L.card, border: `1px solid ${L.border}`, borderRadius: 18, padding: "20px 20px 18px",
      }}>
        {/* 우상단 바이올렛 글로우 */}
        <div style={{ position: "absolute", top: -70, right: -50, width: 190, height: 190, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.30), transparent 70%)", pointerEvents: "none" }} />

        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 16, border: `1px solid ${L.violetBd}`, background: "rgba(124,58,237,0.1)" }}>
          <Sparkles size={11} color="#a78bfa" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: L.violetTxt }}>LICENSE LEVEL</span>
        </span>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, margin: "14px 0 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: L.subLight }}>Lv.</span>
            <span style={{
              fontSize: 40, fontWeight: 900, lineHeight: 1, color: L.violetTxt,
              background: L.grad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>{myLevel}</span>
          </div>

          {isMax ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: AMBER.bg, color: AMBER.fg, borderRadius: 9, padding: "6px 11px", fontSize: 11.5, fontWeight: 800 }}>
              <Trophy size={13} /> 최고 등급
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: L.sub, fontWeight: 600, paddingBottom: 3 }}>
              다음 <ChevronRight size={13} /> <strong style={{ color: L.blueTxt, fontWeight: 800 }}>Lv.{myLevel + 1}</strong>
            </span>
          )}
        </div>

        {/* 단계 진행 — 3분할 세그먼트 */}
        <div style={{ display: "flex", gap: 5 }}>
          {[1, 2, 3].map(lv => (
            <div key={lv} style={{ flex: 1, height: 7, borderRadius: 4, background: lv <= myLevel ? L.grad : "rgba(255,255,255,0.10)" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
          {[1, 2, 3].map(lv => (
            <div key={lv} style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: lv <= myLevel ? L.violetTxt : L.sub }}>{lv}단계</div>
          ))}
        </div>
      </div>

      {/* ─── 신청 가능한 교육 ─── */}
      <div style={sectionTitle}>
        신청 가능한 교육 {visible.length > 0 && <span style={{ color: L.sub, fontWeight: 600 }}>({visible.length})</span>}
      </div>

      {/* 비어 있을 때 — 최고 등급 / 일정 없음 두 가지 */}
      {visible.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "34px 22px" }}>
          <div style={{
            width: 58, height: 58, borderRadius: 20, margin: "0 auto 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isMax ? AMBER.bg : L.violetBg, border: `1px solid ${isMax ? AMBER.bd : L.violetBd}`,
          }}>
            {isMax ? <Trophy size={25} color={AMBER.fg} /> : <CalendarX size={25} color="#a78bfa" />}
          </div>

          <div style={{ fontSize: 14.5, fontWeight: 800, color: L.text, marginBottom: 6 }}>
            {isMax ? "최고 등급을 달성했어요" : `예정된 ${myLevel + 1}단계 교육이 없어요`}
          </div>
          <div style={{ fontSize: 12.5, color: L.sub, lineHeight: 1.7 }}>
            {isMax
              ? "더 이수할 교육이 없습니다.\n모든 등급의 장비를 대여할 수 있어요."
              : "새 교육이 열리면 공지사항으로 알려드릴게요.\n조금만 기다려주세요."}
          </div>

          {!isMax && onOpenNotices && (
            <button onClick={onOpenNotices}
              style={{
                marginTop: 16, padding: "10px 18px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7,
                background: L.violetBg, color: L.violetTxt, border: `1.5px solid ${L.violetBd}`,
              }}>
              <Megaphone size={14} /> 공지사항 보러가기
            </button>
          )}
        </div>
      )}

      {/* 일정 카드 */}
      {visible.map(s => {
        const { ok, reason } = canApply(s);
        const pal      = lvPal(s.level);
        const appCount = applications.filter(a => a.scheduleId === s.id).length;
        const myApp    = myApps.find(a => a.scheduleId === s.id);
        const open     = s.status === "모집중";
        const ratio    = s.maxCount > 0 ? Math.min(appCount / s.maxCount, 1) : 0;
        const flash    = flashId === s.id;

        return (
          <div key={s.id} id={`license-card-${s.id}`}
            style={{
              ...card,
              border: `1px solid ${flash ? L.violet : myApp ? "rgba(45,212,191,.35)" : L.border}`,
              ...(flash ? { boxShadow: `0 0 0 3px rgba(124,58,237,0.35)` } : {}),
              transition: "box-shadow .25s, border-color .25s",
            }}>

            {/* 배지 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ background: pal.bg, color: pal.fg, borderRadius: 7, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>{s.level}단계</span>
              <span style={{ background: open ? TEAL.bg : GRAY.bg, color: open ? TEAL.fg : GRAY.fg, borderRadius: 7, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>{s.status}</span>
            </div>

            <div style={{ fontSize: 15.5, fontWeight: 800, color: L.text, marginBottom: 11, lineHeight: 1.4 }}>{s.title}</div>

            {/* 날짜 · 시간 */}
            <div style={{ display: "flex", gap: 8, marginBottom: s.description ? 11 : 13, flexWrap: "wrap" }}>
              {[[CalendarDays, s.date], [Clock, s.time]].filter(([, v]) => v).map(([Icon, v]) => (
                <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: L.card2, border: `1px solid ${L.border}`, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, color: L.subLight }}>
                  <Icon size={13} color={L.sub} /> {v}
                </span>
              ))}
            </div>

            {s.description && (
              <div style={{ fontSize: 12.5, color: L.subLight, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 13 }}>{s.description}</div>
            )}

            {/* 정원 */}
            <div style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: L.sub, fontWeight: 600 }}>
                  <Users size={12} /> 신청 현황
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: L.subLight }}>
                  {appCount}명{s.maxCount > 0 ? ` / ${s.maxCount}명` : ""}
                </span>
              </div>
              {s.maxCount > 0 && (
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${ratio * 100}%`, height: "100%", borderRadius: 3, background: ratio >= 1 ? GRAY.fg : L.grad, transition: "width .3s" }} />
                </div>
              )}
            </div>

            {/* 액션 */}
            {myApp ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: myApp.attended ? TEAL.bg : BLUE.bg, color: myApp.attended ? TEAL.fg : BLUE.fg,
                borderRadius: 11, padding: "12px", fontSize: 13, fontWeight: 800,
              }}>
                {myApp.attended ? <><Check size={15} /> 출석 완료 · 라이선스 부여됨</> : <><Check size={15} /> 신청 완료 · 수업 대기중</>}
              </div>
            ) : ok ? (
              <button onClick={() => setShowConfirm(s)}
                style={{ width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, color: "#fff", border: "none", background: L.grad }}>
                신청하기
              </button>
            ) : (
              <div style={{ background: L.card2, border: `1px solid ${L.border}`, borderRadius: 11, padding: "11px", fontSize: 12.5, color: L.sub, textAlign: "center", fontWeight: 600 }}>{reason}</div>
            )}
          </div>
        );
      })}

      {/* ─── 내 신청 이력 ─── */}
      {myHistory.length > 0 && (
        <>
          <div style={sectionTitle}>내 신청 이력 <span style={{ color: L.sub, fontWeight: 600 }}>({myHistory.length})</span></div>
          {myHistory.map(app => {
            const pal = lvPal(app.level);
            return (
              <div key={app.id} style={{ ...card, padding: "13px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ background: pal.bg, color: pal.fg, borderRadius: 8, padding: "5px 9px", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{app.level}단계</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: L.text, lineHeight: 1.4 }}>{app.scheduleTitle}</div>
                  <div style={{ fontSize: 11.5, color: L.sub, marginTop: 3 }}>{app.date} {app.time}</div>
                </div>
                <span style={{ background: app.attended ? TEAL.bg : AMBER.bg, color: app.attended ? TEAL.fg : AMBER.fg, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                  {app.attended ? "출석완료" : "대기중"}
                </span>
              </div>
            );
          })}
        </>
      )}

      {/* ─── 신청 확인 모달 ─── */}
      {showConfirm && (
        <Modal onClose={() => setShowConfirm(null)} width={440}>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: L.text, marginBottom: 16 }}>라이선스 교육 신청</div>

          <div style={{ background: L.card2, border: `1px solid ${L.border}`, borderRadius: 12, padding: "6px 14px", marginBottom: 14 }}>
            {[
              ["수업명", showConfirm.title],
              ["단계",   `${showConfirm.level}단계`],
              ["날짜",   showConfirm.date],
              ["시간",   showConfirm.time],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${L.border}` }}>
                <span style={{ fontSize: 12.5, color: L.sub }}>{k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: L.text, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ background: AMBER.bg, border: `1px solid ${AMBER.bd}`, borderRadius: 11, padding: "11px 14px", fontSize: 12.5, color: AMBER.fg, fontWeight: 600, marginBottom: 18, lineHeight: 1.6 }}>
            수업 당일 반드시 참석해야 라이선스가 부여됩니다.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowConfirm(null)}
              style={{ flex: 1, boxSizing: "border-box", padding: "12px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: "transparent", color: L.sub, border: `1.5px solid ${L.border}` }}>
              취소
            </button>
            <button onClick={() => apply(showConfirm)} disabled={applying}
              style={{ flex: 1, boxSizing: "border-box", padding: "12px", borderRadius: 11, cursor: applying ? "default" : "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, color: "#fff", border: "none", background: L.grad, opacity: applying ? 0.6 : 1 }}>
              {applying ? "신청중..." : "신청 완료"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
