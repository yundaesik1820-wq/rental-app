import { C } from "../../theme";
import { Card, PageTitle, Btn, StatBox } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import * as XLSX from "xlsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

export default function Stats() {
  const { data: rentals }    = useCollection("rentalRequests", "createdAt");
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: students }   = useCollection("users", "name");

  const stuList = students.filter(s => s.role === "student");
  const total    = rentals.length;
  const renting  = rentals.filter(r => r.status === "대여중").length;
  const overdue  = rentals.filter(r => r.status === "연체").length;
  const returned = rentals.filter(r => r.status === "반납완료").length;

  // ── 월별 대여 추이 (rentalRequests.startDate 기준, 최근 6개월) ──
  const monthlyMap = {};
  const now = new Date();
  // 최근 6개월 키 미리 생성 (데이터 없는 달도 0으로 표시)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = 0;
  }
  rentals.forEach(r => {
    if (!r.startDate) return;
    const key = r.startDate.slice(0, 7); // "YYYY-MM"
    if (key in monthlyMap) monthlyMap[key]++;
  });
  const monthlyData = Object.entries(monthlyMap).map(([key, cnt]) => ({
    month: `${parseInt(key.slice(5))}월`,
    rentals: cnt,
  }));

  // ── 학과별 대여 현황 ──
  const deptMap = {};
  rentals.forEach(r => {
    const dept = r.dept || "";
    if (dept) deptMap[dept] = (deptMap[dept] || 0) + 1;
  });
  const topDepts = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
  const maxD = Math.max(...topDepts.map(d => d[1]), 1);

  // ── 장비 가동률 TOP 6 ──
  const utilMap = {};
  rentals.forEach(r => {
    (r.items || []).forEach(item => {
      const name = item.modelName || item.equipName || "";
      if (name) utilMap[name] = (utilMap[name] || 0) + (item.quantity || 1);
    });
    if (!r.items?.length && r.equipName) {
      utilMap[r.equipName] = (utilMap[r.equipName] || 0) + 1;
    }
  });
  const utilData = Object.entries(utilMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, cnt]) => ({
      name: name.length > 8 ? name.slice(0, 8) + "…" : name, cnt,
    }));

  // ── 최다 대여 학생 (rentalRequests 집계) ──
  const studentRentalMap = {}; // { studentId: { name, dept, count } }
  rentals.forEach(r => {
    if (!r.studentId || r.role === "professor") return;
    const id = r.studentId;
    if (!studentRentalMap[id]) {
      studentRentalMap[id] = { name: r.studentName || "-", dept: r.dept || "-", count: 0 };
    }
    studentRentalMap[id].count++;
  });
  const topStudents = Object.entries(studentRentalMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  // ── 엑셀 내보내기 ──
  const doExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rentals.map(r => ({
      학생명: r.studentName, 학번: r.studentId, 계열: r.dept,
      장비목록: (r.items || []).map(i => `${i.modelName || i.equipName} ${i.quantity}개`).join(", "),
      대여시작: `${r.startDate} ${r.startTime || ""}`,
      반납예정: `${r.endDate} ${r.endTime || ""}`,
      사용목적: r.purpose, 세부내용: r.purposeDetail,
      상태: r.status,
    }))), "대여내역");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipments.map(e => ({
      장비명: e.name, 카테고리: e.category, 상태: e.status, 보유: e.total, 가능: e.available,
    }))), "장비목록");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stuList.map(s => ({
      학번: s.studentId, 이름: s.name, 학과: s.dept, 연락처: s.phone,
      누적대여: studentRentalMap[s.studentId]?.count || 0,
    }))), "학생목록");
    XLSX.writeFile(wb, `장비대여현황_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <PageTitle>📊 통계 & 리포트</PageTitle>
        <Btn onClick={doExport} color={C.green}>📥 엑셀 다운로드</Btn>
      </div>

      {/* 요약 수치 */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <StatBox icon="📊" label="총 대여 건수"  value={total}    color={C.blue}   bg={C.blueLight}  />
        <StatBox icon="🚀" label="현재 대여중"   value={renting}  color={C.teal}   bg={C.tealLight}  />
        <StatBox icon="⚠️" label="연체"          value={overdue}  color={C.red}    bg={C.redLight}   />
        <StatBox icon="✅" label="반납 완료"      value={returned} color={C.green}  bg={C.greenLight} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* 월별 대여 추이 - rentalRequests 실데이터 */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>월별 대여 추이</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>최근 6개월 · 대여 시작일 기준</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="rentals" stroke={C.blue} strokeWidth={3} dot={{ fill: C.blue, r: 5 }} name="대여건수" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* 장비 가동률 TOP 6 */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>장비 가동률 TOP 6</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>전체 기간 누적 대여 횟수</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={utilData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10 }} />
              <Bar dataKey="cnt" name="대여횟수" radius={[6, 6, 0, 0]}>
                {utilData.map((_, i) => (
                  <Cell key={i} fill={[C.blue, C.teal, C.purple, C.orange, C.red, C.green][i % 6]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* 학과별 대여 현황 */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>학과별 대여 현황</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>전체 신청 건수 기준</div>
          {topDepts.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>데이터 없음</div>}
          {topDepts.map(([dept, cnt]) => (
            <div key={dept} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: C.text }}>{dept}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{cnt}건</span>
              </div>
              <div style={{ background: C.border, borderRadius: 8, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${(cnt / maxD) * 100}%`, background: `linear-gradient(90deg,${C.blue},${C.teal})`, height: "100%", borderRadius: 8, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </Card>

        {/* 최다 대여 학생 - rentalRequests 집계 */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>🏆 최다 대여 학생</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>전체 신청 건수 기준 (실시간 집계)</div>
          {topStudents.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>데이터 없음</div>}
          {topStudents.map(([studentId, info], i) => (
            <div key={studentId} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 22, width: 30 }}>{["🥇","🥈","🥉","4위","5위"][i]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{info.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{info.dept} · {studentId}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>
                {info.count}<span style={{ fontSize: 12, color: C.muted }}>건</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
