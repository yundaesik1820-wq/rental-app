import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { C } from "../../theme";
import { Card, Avatar, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, updateItem } from "../../hooks/useFirestore";

const DEPTS    = ["영상계열","성우계열","엔터테인먼트계열","음향계열","실용음악계열"];
const LICENSES = ["없음","1단계","2단계","3단계"];

// 학번 앞 2자리 → 학번 표시
const admYear = studentId => studentId ? `${studentId.slice(0,2)}학번` : "";

export default function Students() {
  const { data: allUsers } = useCollection("users", "createdAt");

  const pendingList  = allUsers.filter(s => s.role === "student" && s.status === "pending");
  const approvedList = allUsers.filter(s => s.role === "student" && s.status === "approved");
  const rejectedList = allUsers.filter(s => s.role === "student" && s.status === "rejected");

  const [tab, setTab]           = useState("pending");
  const [showAdd, setShowAdd]   = useState(false);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  // 승인 모달
  const [approveTarget, setApproveTarget] = useState(null);
  const [license, setLicense]             = useState("없음");

  // 직접 추가 폼
  const [form, setForm] = useState({ name:"", dept:"", studentId:"", phone:"", email:"", pw:"", license:"없음" });

  const handleAdd = async () => {
    if (!form.name || !form.dept || !form.studentId || !form.email || !form.pw) {
      setErr("필수 항목을 입력하세요"); return;
    }
    setLoading(true); setErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.pw);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: form.name, dept: form.dept, studentId: form.studentId,
        admissionYear: form.studentId.slice(0,2),
        phone: form.phone, email: form.email,
        license: form.license,
        role: "student", status: "approved", rentals: 0,
        createdAt: serverTimestamp(),
      });
      setForm({ name:"", dept:"", studentId:"", phone:"", email:"", pw:"", license:"없음" });
      setShowAdd(false);
    } catch(e) {
      setErr("계정 생성 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 승인 (라이센스 포함)
  const confirmApprove = async () => {
    await updateItem("users", approveTarget.id, {
      status: "approved",
      license: license,
      admissionYear: approveTarget.studentId?.slice(0,2) || "",
    });
    setApproveTarget(null);
    setLicense("없음");
  };

  const reject  = id => updateItem("users", id, { status: "rejected" });
  const reapprove = s => { setApproveTarget(s); setLicense(s.license || "없음"); };

  const tabs = [
    { id:"pending",  label:`승인 대기 (${pendingList.length})`,  color:C.yellow },
    { id:"approved", label:`승인됨 (${approvedList.length})`,    color:C.green  },
    { id:"rejected", label:`거절됨 (${rejectedList.length})`,    color:C.red    },
  ];

  const currentList = { pending:pendingList, approved:approvedList, rejected:rejectedList }[tab] || [];
  const filtered = currentList.filter(s =>
    s.name?.includes(search) || s.studentId?.includes(search) || s.dept?.includes(search)
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>👥 학생 관리</PageTitle>
        <Btn onClick={() => setShowAdd(true)} color={C.purple}>+ 학생 직접 추가</Btn>
      </div>

      {/* 승인 대기 알림 */}
      {pendingList.length > 0 && (
        <div style={{ background:C.yellowLight, borderRadius:14, padding:"14px 18px", marginBottom:20, border:`1px solid ${C.yellow}40`, display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:24 }}>⏳</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#92400E" }}>승인 대기 {pendingList.length}명</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>가입 신청한 학생이 있습니다. 확인 후 승인해주세요.</div>
          </div>
        </div>
      )}

      {/* 직접 추가 모달 */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>학생 직접 추가</div>
          {err && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14 }}>{err}</div>}
          <Inp label="이름 *" placeholder="홍길동" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} />
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>계열 *</div>
            <select value={form.dept} onChange={e => setForm(p=>({...p,dept:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:form.dept?C.text:C.muted, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none" }}>
              <option value="">계열 선택</option>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <Inp label="학번 *" placeholder="25237001" value={form.studentId} onChange={e => setForm(p=>({...p,studentId:e.target.value}))} />
          <Inp label="전화번호" placeholder="010-0000-0000" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} />
          <Inp label="이메일 *" placeholder="student@email.com" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} type="email" />
          <Inp label="초기 비밀번호 *" placeholder="6자리 이상" value={form.pw} onChange={e => setForm(p=>({...p,pw:e.target.value}))} type="password" />
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>라이센스</div>
            <select value={form.license} onChange={e => setForm(p=>({...p,license:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none" }}>
              {LICENSES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAdd} color={C.purple} full disabled={loading}>{loading?"처리 중...":"추가"}</Btn>
          </div>
        </Modal>
      )}

      {/* 승인 + 라이센스 입력 모달 */}
      {approveTarget && (
        <Modal onClose={() => { setApproveTarget(null); setLicense("없음"); }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>✅ 승인 처리</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>승인 전 라이센스 단계를 선택해주세요.</div>

          {/* 학생 정보 요약 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{approveTarget.name}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{admYear(approveTarget.studentId)} · {approveTarget.dept}</div>
            <div style={{ fontSize:12, color:C.muted }}>{approveTarget.phone} · {approveTarget.email}</div>
          </div>

          {/* 라이센스 선택 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>라이센스 단계</div>
            <div style={{ display:"flex", gap:10 }}>
              {LICENSES.map(l => (
                <button key={l} onClick={() => setLicense(l)} style={{
                  flex:1, padding:"12px 0", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer",
                  background: license===l ? C.navy : C.bg,
                  color: license===l ? "#fff" : C.muted,
                  border: `1.5px solid ${license===l ? C.navy : C.border}`,
                  fontFamily:"inherit",
                }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setApproveTarget(null); setLicense("없음"); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={confirmApprove} color={C.green} full>승인 완료</Btn>
          </div>
        </Modal>
      )}

      {/* 탭 */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background:tab===t.id?t.color:C.surface, color:tab===t.id?"#fff":C.muted, border:`1px solid ${tab===t.id?t.color:C.border}`, borderRadius:20, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>{t.label}</button>
        ))}
      </div>

      {/* 검색 */}
      <input placeholder="🔍 이름, 학번, 계열 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width:"100%", maxWidth:400, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:20, display:"block" }} />

      {/* 승인 대기 */}
      {tab==="pending" && (
        <>
          {filtered.length===0 && <Empty icon="⏳" text="승인 대기 중인 학생이 없습니다" />}
          {filtered.map(s => (
            <Card key={s.id} style={{ border:`2px solid ${C.yellow}40` }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <Avatar name={s.name||"?"} size={46}/>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.name}</span>
                    <span style={{ background:C.yellowLight, color:C.yellow, borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>승인 대기</span>
                  </div>
                  <div style={{ fontSize:12, color:C.blue, fontWeight:600, fontFamily:"monospace" }}>{s.studentId} · {admYear(s.studentId)}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{s.dept} · {s.phone}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{s.email}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <Btn onClick={() => { setApproveTarget(s); setLicense("없음"); }} color={C.green} small>✓ 승인</Btn>
                  <Btn onClick={() => reject(s.id)} color={C.red} small>✕ 거절</Btn>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* 승인됨 */}
      {tab==="approved" && (
        <>
          {filtered.length===0 && <Empty icon="👥" text="승인된 학생이 없습니다" />}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:16 }}>
            {filtered.map(s => (
              <Card key={s.id}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <Avatar name={s.name||"?"} size={46}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:4 }}>{s.name}</div>
                    <div style={{ fontSize:12, color:C.blue, fontWeight:600, fontFamily:"monospace" }}>{s.studentId} · {admYear(s.studentId)}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{s.dept} · {s.phone}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                      <span style={{ fontSize:11, color:C.muted }}>라이센스:</span>
                      <span style={{ background: s.license && s.license!=="없음" ? C.blueLight : C.bg, color: s.license && s.license!=="없음" ? C.blue : C.muted, borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>
                        {s.license || "없음"}
                      </span>
                      <button onClick={() => reapprove(s)} style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", textDecoration:"underline" }}>변경</button>
                    </div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:C.navy }}>{s.rentals||0}</div>
                    <div style={{ fontSize:9, color:C.muted }}>누적 대여</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* 거절됨 */}
      {tab==="rejected" && (
        <>
          {filtered.length===0 && <Empty icon="🚫" text="거절된 학생이 없습니다" />}
          {filtered.map(s => (
            <Card key={s.id} style={{ opacity:0.7 }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <Avatar name={s.name||"?"} size={46}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.name}</div>
                  <div style={{ fontSize:12, color:C.blue, fontFamily:"monospace" }}>{s.studentId} · {admYear(s.studentId)}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{s.dept} · {s.email}</div>
                </div>
                <Btn onClick={() => { setApproveTarget(s); setLicense("없음"); }} color={C.green} small>재승인</Btn>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
