import { C } from "../../theme";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { LogOut } from "lucide-react";

function DashRow({ icon, label, onClick, alerts = [] }) {
  const totalCount = alerts.reduce((s, a) => s + a.count, 0);
  return (
    <div onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:12, background:C.surface, borderRadius:12, padding:"12px 14px", marginBottom:8, cursor: onClick ? "pointer" : "default", border:`1px solid ${C.border}` }}>
      <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
      <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>{label}</span>
      <div style={{ display:"flex", gap:5, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
        {alerts.filter(a => a.count > 0).map((a, i) => (
          <span key={i} style={{ background: a.color || C.red, color:"#fff", borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
            {a.label} {a.count}
          </span>
        ))}
        {totalCount === 0 && (
          <span style={{ background:C.greenLight, color:C.green, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700 }}>정상</span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ setTab }) {
  const { profile, logout } = useAuth();
  const { data: requests }         = useCollection("rentalRequests",    "createdAt");
  const { data: facilityRequests } = useCollection("facilityRequests",  "createdAt");
  const { data: equipments }       = useCollection("equipments",        "createdAt");
  const { data: users }            = useCollection("users",             "createdAt");
  const { data: notices }          = useCollection("notices",           "createdAt");
  const { data: licenseApps }      = useCollection("licenseApplications","createdAt");
  const { data: inquiries }        = useCollection("inquiries",         "createdAt");
  const { data: communityPosts }   = useCollection("communityPosts",    "createdAt");
  const { data: pwResets }         = useCollection("pwResetRequests",   "createdAt");
  const { data: schedules }        = useCollection("licenseSchedules",   "date");
  const { data: facilities }       = useCollection("facilities",          "createdAt");

  // 통계
  const pending       = requests.filter(r => r.status === "승인대기").length;
  const overdue       = requests.filter(r => r.status === "연체").length;
  const held          = requests.filter(r => r.status === "보류").length;
  const facilityPend  = facilityRequests.filter(r => r.status === "승인대기").length;
  const pendingUsers  = users.filter(u => u.status === "pending").length;
  const pwResetPend   = pwResets.filter(r => r.status === "pending").length;
  const lowStock      = equipments.filter(e => (e.available || 0) === 0).length;
  const licensePend   = licenseApps.filter(a => a.status === "대기").length;
  const unanswered    = inquiries.filter(i => i.status !== "답변완료").length;
  const today         = new Date().toISOString().slice(0, 10);
  const newNotices    = notices.filter(n => n.date === today).length;

  const roleName = profile?.adminRole === "teacher"   ? "교사" :
                   profile?.adminRole === "assistant" ? "조교" :
                   profile?.adminRole === "professor" ? "교수" : "관리자";

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ background:`linear-gradient(135deg,#1B2B6B,#2D9B8A)`, borderRadius:20, padding:"18px 20px", marginBottom:20, position:"relative" }}>
        <button onClick={logout} style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:8, padding:"6px 10px", color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          <LogOut size={14} /> 로그아웃
        </button>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginBottom:3, display:"flex", alignItems:"center", gap:6 }}>
          {roleName}
          <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{roleName}</span>
        </div>
        <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>
          안녕하세요, {profile?.name}님 👋
        </div>
      </div>

      {/* 연체 긴급 알림 */}
      {overdue > 0 && (
        <div style={{ background:C.redLight, borderRadius:14, padding:"12px 16px", marginBottom:16, border:`1px solid ${C.red}30`, display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.red }}>연체 {overdue}건 — 즉시 확인 필요</div>
            <div style={{ fontSize:11, color:C.muted }}>대여/반납 탭에서 처리하세요</div>
          </div>
        </div>
      )}

      {/* 업무별 현황 */}
      <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>📋 업무 현황</div>

      {/* 공지 관리 */}
      <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div onClick={() => setTab?.("notices")}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
          <span style={{ fontSize:20 }}>📢</span>
          <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>공지 관리</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
        </div>
        {notices.slice(0,3).map(n => (
          <div key={n.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 14px", borderTop:`1px solid ${C.border}`, gap:10 }}>
            <span style={{ fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{n.title}</span>
            <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{n.date}</span>
          </div>
        ))}
        {notices.length === 0 && (
          <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.border}`, fontSize:12, color:C.muted }}>등록된 공지가 없습니다</div>
        )}
      </div>

      {/* 학생 관리 */}
      <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div onClick={() => setTab?.("students")}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
          <span style={{ fontSize:20 }}>👥</span>
          <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>학생 관리</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
        </div>
        <div style={{ display:"flex", borderTop:`1px solid ${C.border}` }}>
          <div style={{ flex:1, padding:"10px 14px", borderRight:`1px solid ${C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color: pendingUsers>0 ? C.orange : C.green }}>{pendingUsers}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>승인 대기</div>
          </div>
          <div style={{ flex:1, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color: pwResetPend>0 ? C.yellow : C.green }}>{pwResetPend}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>비밀번호 초기화 요청</div>
          </div>
        </div>
      </div>

      {/* 장비/시설 관리 */}
      {(() => {
        const CAT_ORDER = ["촬영","렌즈","ACC","트라이포드/그립","모니터","조명","음향"];
        // 단품만, 동일 모델명은 1건으로 카운팅
        const units = equipments.filter(e => !e.isSet);
        const uniqueModels = [...new Set(units.map(e => e.modelName || e.name).filter(Boolean))];
        const cats = [...new Set(units.map(e => e.majorCategory).filter(Boolean))];
        const sortedCats = [
          ...CAT_ORDER.filter(c => cats.includes(c)),
          ...cats.filter(c => !CAT_ORDER.includes(c)),
        ];

        // 카테고리별 가용 모델 수 (모델 단위, available>0인 모델만)
        const catStats = sortedCats.map(cat => {
          const catUnits = units.filter(e => e.majorCategory === cat);
          const totalModels = [...new Set(catUnits.map(e => e.modelName||e.name).filter(Boolean))].length;
          const availModels = [...new Set(
            catUnits.filter(e => (e.available||0) > 0).map(e => e.modelName||e.name).filter(Boolean)
          )].length;
          return { cat, totalModels, availModels };
        });

        const [eqTab, setEqTab] = React.useState("장비");

        return (
          <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
            {/* 헤더 + 바로가기 */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }}>
              <span style={{ fontSize:20 }}>📦</span>
              <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>장비/시설 관리</span>
              <span onClick={() => setTab?.("equipment")} style={{ fontSize:12, color:C.blue, fontWeight:600, cursor:"pointer" }}>바로가기 →</span>
            </div>

            {/* 1행: 장비/시설 탭 전환 */}
            <div style={{ display:"flex", borderTop:`1px solid ${C.border}` }}>
              {["장비","시설"].map(t => (
                <button key={t} onClick={() => setEqTab(t)}
                  style={{ flex:1, padding:"8px 0", border:"none", background: eqTab===t ? C.navy : C.bg, color: eqTab===t ? "#fff" : C.muted, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  {t}
                </button>
              ))}
            </div>

            {/* 2행: 장비 카테고리별 현황 */}
            {eqTab === "장비" && (
              <div style={{ display:"flex", overflowX:"auto", borderTop:`1px solid ${C.border}`, padding:"12px 14px", gap:16 }}>
                {catStats.map(({ cat, totalModels, availModels }) => (
                  <div key={cat} style={{ textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:22, fontWeight:900, color: availModels < totalModels ? C.orange : C.green, lineHeight:1 }}>
                      {availModels}
                    </div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>/{totalModels}</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:3, whiteSpace:"nowrap" }}>{cat}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 2행: 시설 현황 */}
            {eqTab === "시설" && (
              <div style={{ borderTop:`1px solid ${C.border}` }}>
                {facilities.length === 0 ? (
                  <div style={{ padding:"12px 14px", fontSize:12, color:C.muted }}>등록된 시설이 없습니다</div>
                ) : facilities.map(f => (
                  <div key={f.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:`1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{f.name}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{f.location}</div>
                    </div>
                    <span style={{ background: f.available!==false ? C.greenLight : C.redLight, color: f.available!==false ? C.green : C.red, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                      {f.available!==false ? "정상" : "대여불가"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 장비/시설 대여관리 */}
      {(() => {
        const today    = new Date().toISOString().slice(0,10);
        const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10);

        const retStatus = ["승인됨", "대여중"];
        const todayRentEquip  = requests.filter(r => r.startDate === today     && r.status === "승인됨").length;
        const todayRentFac    = facilityRequests.filter(r => r.date === today     && r.status === "승인됨").length;
        const todayRetEquip   = requests.filter(r => r.endDate === today          && retStatus.includes(r.status)).length;
        const todayRetFac     = facilityRequests.filter(r => r.date === today     && retStatus.includes(r.status)).length;
        const tmrRentEquip    = requests.filter(r => r.startDate === tomorrow     && r.status === "승인됨").length;
        const tmrRentFac      = facilityRequests.filter(r => r.date === tomorrow  && r.status === "승인됨").length;
        const tmrRetEquip     = requests.filter(r => r.endDate === tomorrow       && retStatus.includes(r.status)).length;
        const tmrRetFac       = facilityRequests.filter(r => r.date === tomorrow  && retStatus.includes(r.status)).length;
        const totalPend       = pending + facilityPend;

        const Row = ({label, equip, fac}) => (
          <div style={{ display:"flex", alignItems:"center", padding:"8px 14px", borderTop:`1px solid ${C.border}`, gap:8 }}>
            <span style={{ fontSize:12, color:C.muted, minWidth:80 }}>{label}</span>
            <span style={{ fontSize:12, fontWeight:700, color:equip>0?C.navy:C.muted }}>장비 {equip}건</span>
            <span style={{ fontSize:12, color:C.border }}>·</span>
            <span style={{ fontSize:12, fontWeight:700, color:fac>0?C.teal:C.muted }}>시설 {fac}건</span>
          </div>
        );

        return (
          <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
            <div onClick={() => setTab?.("rental")}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
              <span style={{ fontSize:20 }}>📅</span>
              <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>장비/시설 대여관리</span>
              <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
            </div>
            {/* 승인 대기 - 항상 표시 */}
            <div style={{ display:"flex", borderTop:`1px solid ${C.border}` }}>
              <div style={{ flex:1, padding:"10px 14px", borderRight:`1px solid ${C.border}`, textAlign:"center", background: pending>0 ? C.yellowLight : C.bg }}>
                <div style={{ fontSize:18, fontWeight:900, color: pending>0 ? C.orange : C.green }}>{pending}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>장비대여 승인대기</div>
              </div>
              <div style={{ flex:1, padding:"10px 14px", textAlign:"center", background: facilityPend>0 ? C.tealLight : C.bg }}>
                <div style={{ fontSize:18, fontWeight:900, color: facilityPend>0 ? C.teal : C.green }}>{facilityPend}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>시설대여 승인대기</div>
              </div>
            </div>
            <Row label="오늘 대여" equip={todayRentEquip} fac={todayRentFac} />
            <Row label="오늘 반납" equip={todayRetEquip}  fac={todayRetFac} />
            <Row label="내일 대여" equip={tmrRentEquip}   fac={tmrRentFac} />
            <Row label="내일 반납" equip={tmrRetEquip}    fac={tmrRetFac} />
          </div>
        );
      })()}

      {/* 라이센스 관리 */}
      {(() => {
        const today = new Date().toISOString().slice(0,10);
        const upcoming = schedules
          .filter(s => s.date >= today && s.status !== "완료")
          .sort((a,b) => a.date > b.date ? 1 : -1)
          .slice(0, 3);

        const DEPTS = ["영상계열","성우계열","엔터테인먼트계열","음향계열","실용음악계열"];
        const students = users.filter(u => u.role === "student" && u.status === "approved");

        const LicBar = ({ dept }) => {
          const group = dept === "전체" ? students : students.filter(u => u.dept === dept);
          const total = group.length;
          if (total === 0) return null;
          const none = group.filter(u => !u.license || u.license === "없음").length;
          const lv1  = group.filter(u => u.license === "1단계").length;
          const lv2  = group.filter(u => u.license === "2단계").length;
          const lv3  = group.filter(u => u.license === "3단계").length;
          const pct  = n => Math.round(n/total*100);
          return (
            <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.navy }}>{dept === "전체" ? "전체" : dept.replace("계열","")}</span>
                <span style={{ fontSize:10, color:C.muted }}>총 {total}명</span>
              </div>
              {/* 게이지 바 */}
              {/* 없음:#B0BEC5 / 1단계:#5BB5A2 / 2단계:#7986CB / 3단계:#E57373 */}
              <div style={{ display:"flex", borderRadius:4, overflow:"hidden", height:8, marginBottom:4 }}>
                {none>0 && <div style={{ flex:none, background:"#B0BEC5" }} title={`없음 ${none}명`} />}
                {lv1 >0 && <div style={{ flex:lv1,  background:"#5BB5A2" }} title={`1단계 ${lv1}명`} />}
                {lv2 >0 && <div style={{ flex:lv2,  background:"#7986CB" }} title={`2단계 ${lv2}명`} />}
                {lv3 >0 && <div style={{ flex:lv3,  background:"#E57373" }} title={`3단계 ${lv3}명`} />}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {[["없음", none, "#90A4AE"], ["1단계", lv1, "#5BB5A2"], ["2단계", lv2, "#7986CB"], ["3단계", lv3, "#E57373"]].map(([label, n, col]) => (
                  <span key={label} style={{ fontSize:10, color:col, fontWeight:600 }}>
                    {label} {n}명({pct(n)}%)
                  </span>
                ))}
              </div>
            </div>
          );
        };

        return (
          <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
            <div onClick={() => setTab?.("license")}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
              <span style={{ fontSize:20 }}>🎖️</span>
              <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>라이센스 관리</span>
              <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
            </div>

            {/* 예정 수업 */}
            {upcoming.length > 0 && (
              <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.border}`, background:C.purpleLight }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.purple, marginBottom:4 }}>📅 예정 수업</div>
                {upcoming.map(s => (
                  <div key={s.id} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.text, marginBottom:2 }}>
                    <span>{s.title}</span>
                    <span style={{ color:C.muted }}>{s.date} {s.time}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 계열별 라이센스 현황 */}
            {DEPTS.map(dept => <LicBar key={dept} dept={dept} />)}
          </div>
        );
      })()}

      {/* 에브리타임 관리 */}
      <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div onClick={() => setTab?.("community")}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
          <span style={{ fontSize:20 }}>💬</span>
          <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>에브리타임 관리</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
        </div>
        {[...communityPosts]
          .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
          .slice(0,3)
          .map(p => (
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 14px", borderTop:`1px solid ${C.border}`, gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
                <span style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, padding:"1px 6px", fontSize:10, color:C.muted, flexShrink:0 }}>{p.category}</span>
                <span style={{ fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
              </div>
              <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>💬{p.likes||0}</span>
            </div>
          ))
        }
        {communityPosts.length === 0 && (
          <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.border}`, fontSize:12, color:C.muted }}>게시글이 없습니다</div>
        )}
      </div>

      {/* 문의 관리 */}
      <div style={{ background:C.surface, borderRadius:12, marginBottom:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div onClick={() => setTab?.("inquiry")}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}>
          <span style={{ fontSize:20 }}>📩</span>
          <span style={{ flex:1, fontSize:14, fontWeight:700, color:C.navy }}>문의 관리</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>바로가기 →</span>
        </div>
        <div style={{ display:"flex", borderTop:`1px solid ${C.border}` }}>
          <div style={{ flex:1, padding:"10px 14px", borderRight:`1px solid ${C.border}`, textAlign:"center", background: unanswered>0 ? C.redLight : C.bg }}>
            <div style={{ fontSize:18, fontWeight:900, color: unanswered>0 ? C.red : C.green }}>{unanswered}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>미답변</div>
          </div>
          <div style={{ flex:1, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:C.green }}>{inquiries.length - unanswered}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>답변완료</div>
          </div>
        </div>
      </div>
    </div>
  );
}
