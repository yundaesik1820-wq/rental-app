import { C } from "../theme";

// 날짜+시간 → 분 단위 timestamp
function toMinutes(dateStr, timeStr = "00:00") {
  if (!dateStr) return 0;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, m]     = (timeStr || "00:00").split(":").map(Number);
  return Date.UTC(y, mo - 1, d, h, m) / 60000;
}

// 오늘 ~ N일 후까지 타임라인 표시
export default function RentalTimeline({ modelName, requests, days = 3 }) {
  const now      = new Date();
  const startMin = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 60000;
  const totalMin = days * 24 * 60;
  const endMin   = startMin + totalMin;

  // 이 모델에 대한 승인됨/대여중 신청 필터
  const related = requests.filter(r =>
    ["승인됨", "대여중"].includes(r.status) &&
    r.items?.some(i => i.modelName === modelName || i.equipName === modelName)
  );

  // 날짜 레이블 (오늘, 내일, 모레...)
  const labels = Array.from({ length: days + 1 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    return {
      label: i === 0 ? "오늘" : i === 1 ? "내일" : `${d.getMonth()+1}/${d.getDate()}`,
      min:   startMin + i * 24 * 60,
    };
  });

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      {/* 타임라인 바 */}
      <div style={{ position: "relative", height: 20, background: "#F1F5F9", borderRadius: 10, overflow: "hidden" }}>
        {/* 현재 시각 마커 */}
        {(() => {
          const nowMin = Date.now() / 60000;
          const pct    = Math.max(0, Math.min(100, ((nowMin - startMin) / totalMin) * 100));
          return (
            <div style={{ position: "absolute", left: `${pct}%`, top: 0, bottom: 0, width: 2, background: C.blue, zIndex: 3 }} />
          );
        })()}

        {/* 대여 중인 구간 */}
        {related.map((r, i) => {
          const rStart = toMinutes(r.startDate, r.startTime);
          const rEnd   = toMinutes(r.endDate,   r.endTime);
          const left   = Math.max(0, ((rStart - startMin) / totalMin) * 100);
          const right  = Math.min(100, ((rEnd - startMin) / totalMin) * 100);
          const width  = right - left;
          if (width <= 0) return null;
          return (
            <div key={i} title={`${r.studentName} · ${r.startDate} ${r.startTime || ""} ~ ${r.endDate} ${r.endTime || ""}`}
              style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 2, bottom: 2, background: C.red, borderRadius: 6, opacity: 0.75, zIndex: 2, cursor: "pointer" }} />
          );
        })}
      </div>

      {/* 날짜 레이블 */}
      <div style={{ position: "relative", height: 16, marginTop: 2 }}>
        {labels.map((l, i) => {
          const pct = ((l.min - startMin) / totalMin) * 100;
          return (
            <span key={i} style={{ position: "absolute", left: `${pct}%`, transform: "translateX(-50%)", fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>
              {l.label}
            </span>
          );
        })}
      </div>

      {/* 범례 */}
      {related.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <div style={{ width: 10, height: 10, background: C.red, borderRadius: 3, opacity: 0.75 }} />
          <span style={{ fontSize: 10, color: C.muted }}>대여 예정/진행 중</span>
          <div style={{ width: 2, height: 10, background: C.blue, marginLeft: 6 }} />
          <span style={{ fontSize: 10, color: C.muted }}>현재</span>
        </div>
      )}
    </div>
  );
}
