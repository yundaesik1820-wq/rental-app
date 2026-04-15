import { C } from "../../theme";
import { Card, PageTitle, Btn, StatBox } from "../../components/UI";
import { useCollection } from "../../hooks/useFirestore";
import * as XLSX from "xlsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const MONTHLY = [
  { month: "11월", rentals: 18 }, { month: "12월", rentals: 12 },
  { month: "1월",  rentals: 8  }, { month: "2월",  rentals: 15 },
  { month: "3월",  rentals: 24 }, { month: "4월",  rentals: 21 },
];

export default function Stats() {
  const { data: rentals }    = useCollection("rentalRequests", "createdAt");
  const { data: equipments } = useCollection("equipments", "createdAt");
  const { data: students }   = useCollection("users", "name");

  const stuList = students.filter(s => s.role === "student");
  const total    = rentals.length;
  const renting  = rentals.filter(r => r.status === "승인됨").length;
  const overdue  = rentals.filter(r => r.status === "연체").length;
  const returned = rentals.filter(r => r.status === "반납완료").length;

  const deptMap = {};
  rentals.forEach(r => { deptMap[r.dept] = (deptMap[r.dept] || 0) + 1; });
  const topDepts = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
  const maxD = Math.max(...topDepts.map(d => d[1]), 1);

  const utilMap = {};
  rentals.forEach(r => { utilMap[r.equipName] = (utilMap[r.equipName] || 0) + 1; });
  const utilData = Object.entries(utilMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, cnt]) => ({ name: name.length > 8 ? name.slice(0, 8) + "…" : name, cnt }));

  const doExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rentals.map(r => ({
      학생명: r.studentName, 학번: r.studentId, 학과: r.dept,
      장비명: r.equipName, 대여일: r.rentDate, 반납예정: r.dueDate,
      상태: r.status, 목적: r.purpose,
    }))), "대여내역");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipments.map(e => ({
      장비명: e.name, 카테고리: e.category, 상태: e.status, 보유: e.total, 가능: e.available,
    }))), "장비목록");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stuList.map(s => ({
      학번: s.studentId, 이름: s.name, 학과: s.dept, 학년: s.year, 연락처: s.phone, 누적대여: s.rentals || 0,
    }))), "학생목록");
    XLSX.writeFile(wb, `장비대여현황_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <PageTitle>📊 통계 & 리포트</PageTitle>
        <Btn onClick={doExport} color={C.green}>📥 엑셀 다운로드</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <StatBox icon="📊" label="총 대여 건수"  value={total}    color={C.blue}   bg={C.blueLight}  />
        <StatBox icon="🔄" label="현재 대여중"   value={renting}  color={C.teal}   bg={C.tealLight}  />
        <StatBox icon="⚠️" label="연체"          value={overdue}  color={C.red}    bg={C.redLight}   />
        <StatBox icon="✅" label="반납 완료"      value={returned} color={C.green}  bg={C.greenLight} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Monthly trend */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>월별 대여 추이</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MONTHLY} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} />
              <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="rentals" stroke={C.blue} strokeWidth={3} dot={{ fill: C.blue, r: 5 }} name="대여건수" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Utilization */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>장비 가동률 TOP 6</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={utilData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} />
              <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10 }} />
              <Bar dataKey="cnt" name="대여횟수" radius={[6, 6, 0, 0]}>
                {utilData.map((_, i) => <Cell key={i} fill={[C.blue, C.teal, C.purple, C.orange, C.red, C.green][i % 6]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Dept bar */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>학과별 대여 현황</div>
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
          {topDepts.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>데이터 없음</div>}
        </Card>

        {/* Top students */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>🏆 최다 대여 학생</div>
          {[...stuList].sort((a, b) => (b.rentals || 0) - (a.rentals || 0)).slice(0, 5).map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 22, width: 30 }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.dept} {s.year}학년</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>{s.rentals || 0}<span style={{ fontSize: 12, color: C.muted }}>회</span></div>
            </div>
          ))}
          {stuList.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>데이터 없음</div>}
        </Card>
      </div>
    </div>
  );
}
