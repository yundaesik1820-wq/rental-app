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
  const adminList     = allUsers.filter(s => s.role === "admin");
  const professorList = allUsers.filter(s => s.role === "professor");
  const approvedList = allUsers.filter(s => s.role === "student" && s.status === "approved");
  const rejectedList = allUsers.filter(s => s.role === "student" && s.status === "rejected");

  const [tab, setTab]           = useState("pending");
  const [showAdd, setShowAdd]         = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  // 승인 모달
  const [approveTarget, setApproveTarget] = useState(null);
  const [license, setLicense]             = useState("없음");

  // 직접 추가 폼
  const [form, setForm]           = useState({ name:"", dept:"", studentId:"", phone:"", email:"", pw:"", license:"없음" });
  const [adminForm, setAdminForm]   = useState({ name:"", email:"", pw:"" });
  const [showAddProf, setShowAddProf] = useState(false);
  const [profLoading, setProfLoading] = useState(false);
  const [profErr, setProfErr]         = useState("");
  const [profProgress, setProfProgress] = useState({ done:0, total:0 });
  // 교수 이름 편집
  const [profNames, setProfNames]     = useState({});
  const [editingProf, setEditingProf] = useState(null);
  const [profNameVal, setProfNameVal] = useState("");
  const [adminErr, setAdminErr]   = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

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

  // 교수 계정 일괄 생성
  const handleCreateProfs = async () => {
    setProfLoading(true); setProfErr(""); setProfProgress({ done:0, total:20 });
    let done = 0;
    for (let i = 1; i <= 20; i++) {
      const num   = String(i).padStart(5, "0");
      const email = `P${num}@kbas.kr`;
      const name  = profNames[`P${num}`] || "";
      // 이미 존재하는 계정은 건너뜀
      const exists = professorList.find(p => p.email === email);
      if (exists) { done++; setProfProgress({ done, total:20 }); continue; }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, "kbatv2026");
        await setDoc(doc(db, "users", cred.user.uid), {
          name:  name || `교수${num}`,
          email, role:"professor", status:"approved",
          profId: `P${num}`,
          createdAt: serverTimestamp(),
        });
      } catch(e) {
        if (!e.message.includes("already-in-use")) console.error(email, e.message);
      }
      done++;
      setProfProgress({ done, total:20 });
    }
    setProfLoading(false);
    setShowAddProf(false);
  };

  // 교수 이름 수정
  const saveProfName = async (prof) => {
    if (!profNameVal.trim()) return;
    await updateItem("users", prof.id, { name: profNameVal.trim() });
    setEditingProf(null);
    setProfNameVal("");
  };

  // 교수 계정 일괄 생성
  const handleAddProf = async () => {
    const toCreate = profForms.filter(p => p.name.trim());
    if (toCreate.length === 0) { setProfErr("이름을 하나 이상 입력하세요"); return; }
    setProfLoading(true); setProfErr(""); setProfDone(0);
    let done = 0;
    for (const p of toCreate) {
      try {
        // 이미 존재하는 계정이면 이름만 업데이트 (실제로는 새로 생성)
        const cred = await createUserWithEmailAndPassword(auth, p.email, p.pw);
        await setDoc(doc(db, "users", cred.user.uid), {
          name:   p.name.trim(),
          email:  p.email,
          role:   "professor",
          status: "approved",
          createdAt: serverTimestamp(),
        });
        done++;
        setProfDone(done);
      } catch(e) {
        if (e.code === "auth/email-already-in-use") {
          // 이미 있으면 이름만 Firestore에서 업데이트
          done++;
          setProfDone(done);
        }
      }
    }
    setProfLoading(false);
    setShowAddProf(false);
  };

  // 관리자 계정 추가
  const handleAddAdmin = async () => {
    if (!adminForm.name || !adminForm.email || !adminForm.pw) {
      setAdminErr("모든 항목을 입력하세요"); return;
    }
    if (adminForm.pw.length < 6) { setAdminErr("비밀번호는 6자리 이상이어야 합니다"); return; }
    setAdminLoading(true); setAdminErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, adminForm.email, adminForm.pw);
      await setDoc(doc(db, "users", cred.user.uid), {
        name:  adminForm.name,
        email: adminForm.email,
        role:  "admin",
        status:"approved",
        createdAt: serverTimestamp(),
      });
      setAdminForm({ name:"", email:"", pw:"" });
      setShowAddAdmin(false);
    } catch(e) {
      setAdminErr(e.code === "auth/email-already-in-use" ? "이미 사용 중인 이메일입니다" : "생성 실패: " + e.message);
    } finally {
      setAdminLoading(false);
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
    { id:"pending",  label:`승인 대기 (${pendingList.length})`,  color:C.yellow  },
    { id:"approved", label:`승인됨 (${approvedList.length})`,    color:C.green   },
    { id:"rejected", label:`거절됨 (${rejectedList.length})`,    color:C.red     },
    { id:"admin",    label:`관리자 (${adminList.length})`,       color:C.purple  },
    { id:"professor", label:`교수 (${profList.length})`,            color:C.blue    },
    { id:"professor", label:`교수 (${professorList.length})`,       color:"#0891B2" },
  ];

  const currentList = { pending:pendingList, approved:approvedList, rejected:rejectedList }[tab] || [];
  const filtered = currentList.filter(s =>
    s.name?.includes(search) || s.studentId?.includes(search) || s.dept?.includes(search)
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <PageTitle>👥 학생 관리</PageTitle>
        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={() => setShowAddProf(true)} color="#0891B2">🎓 교수 계정 생성</Btn>
          <Btn onClick={() => setShowAddProf(true)} color={C.blue}>+ 교수 계정 생성</Btn>
          <Btn onClick={() => setShowAddAdmin(true)} color={C.navy}>+ 관리자 추가</Btn>
          <Btn onClick={() => setShowAdd(true)} color={C.purple}>+ 학생 직접 추가</Btn>
        </div>
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

      {/* 교수 계정 생성 모달 */}
      {showAddProf && (
        <Modal onClose={() => !profLoading && setShowAddProf(false)} width={520}>
          <div style={{ fontSize:17, fontWeight:800, color:"#0891B2", marginBottom:4 }}>🎓 교수 계정 일괄 생성</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>
            P00001 ~ P00020 · 비밀번호: kbatv2026
          </div>
          {setProfErr && profErr && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14 }}>⚠️ {profErr}</div>}

          {/* 이름 입력 그리드 */}
          <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:10 }}>교수님 성함 입력 (선택, 나중에 수정 가능)</div>
          <div style={{ maxHeight:320, overflowY:"auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
            {Array.from({length:20},(_,i)=>{
              const num = String(i+1).padStart(5,"0");
              const pid = `P${num}`;
              const existing = professorList.find(p => p.email === `${pid}@kbas.kr`);
              return (
                <div key={pid} style={{ display:"flex", alignItems:"center", gap:8, background:existing?C.greenLight:C.bg, borderRadius:8, padding:"6px 10px", border:`1px solid ${existing?C.green:C.border}` }}>
                  <span style={{ fontSize:11, color:existing?C.green:C.muted, fontWeight:700, minWidth:52, fontFamily:"monospace" }}>{pid}</span>
                  <input
                    placeholder="성함 입력"
                    value={profNames[pid] || (existing?.name || "")}
                    onChange={e => setProfNames(p=>({...p,[pid]:e.target.value}))}
                    disabled={existing}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:13, color:C.text, fontFamily:"inherit" }}
                  />
                  {existing && <span style={{ fontSize:10, color:C.green }}>✓</span>}
                </div>
              );
            })}
          </div>

          {profLoading && (
            <div style={{ background:C.blueLight, borderRadius:10, padding:"10px 14px", fontSize:13, color:C.blue, marginBottom:14, textAlign:"center" }}>
              생성 중... {profProgress.done}/{profProgress.total}
            </div>
          )}

          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            ⚠️ 이미 생성된 계정은 건너뜁니다. 이름은 나중에 교수 탭에서도 수정 가능해요.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowAddProf(false)} color={C.muted} outline full disabled={profLoading}>취소</Btn>
            <Btn onClick={handleCreateProfs} color="#0891B2" full disabled={profLoading}>
              {profLoading ? `생성 중... (${profProgress.done}/20)` : "🎓 교수 계정 생성"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* 교수 계정 생성 모달 */}
      {showAddProf && (
        <Modal onClose={() => { setShowAddProf(false); setProfErr(""); }} width={600}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>🎓 교수 계정 생성</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>이름을 입력한 항목만 생성돼요 · 비밀번호: <strong>kbatv2026</strong></div>
          {profErr && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:12 }}>⚠️ {profErr}</div>}
          {profLoading && <div style={{ background:C.blueLight, color:C.blue, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:12 }}>⏳ 생성 중... ({profDone}명 완료)</div>}
          <div style={{ maxHeight:400, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:12, marginBottom:16 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.navy, position:"sticky", top:0 }}>
                  <th style={{ color:"#fff", padding:"10px 14px", textAlign:"left", fontWeight:700, width:100 }}>계정 ID</th>
                  <th style={{ color:"#fff", padding:"10px 14px", textAlign:"left", fontWeight:700 }}>이름</th>
                  <th style={{ color:"#fff", padding:"10px 14px", textAlign:"left", fontWeight:700, width:160 }}>이메일</th>
                </tr>
              </thead>
              <tbody>
                {profForms.map((p, i) => (
                  <tr key={p.id} style={{ background:i%2===0?C.bg:C.surface, borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"8px 14px", fontFamily:"monospace", color:C.blue, fontWeight:700 }}>{p.id}</td>
                    <td style={{ padding:"6px 14px" }}>
                      <input
                        placeholder="교수님 이름"
                        value={p.name}
                        onChange={e => setProfForms(prev => prev.map((f,j) => j===i ? {...f, name:e.target.value} : f))}
                        style={{ width:"100%", background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.text, padding:"5px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                      />
                    </td>
                    <td style={{ padding:"8px 14px", color:C.muted, fontSize:12 }}>{p.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowAddProf(false); setProfErr(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAddProf} color={C.blue} full disabled={profLoading}>
              {profLoading ? `생성 중... (${profDone}명)` : "계정 생성"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* 관리자 추가 모달 */}
      {showAddAdmin && (
        <Modal onClose={() => { setShowAddAdmin(false); setAdminForm({ name:"", email:"", pw:"" }); setAdminErr(""); }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>👑 관리자 계정 추가</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>관리자는 모든 기능에 접근할 수 있습니다</div>
          {adminErr && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14 }}>⚠️ {adminErr}</div>}
          <Inp label="이름 *" placeholder="홍길동" value={adminForm.name} onChange={e => setAdminForm(p=>({...p,name:e.target.value}))} />
          <Inp label="이메일 *" placeholder="admin@email.com" value={adminForm.email} onChange={e => setAdminForm(p=>({...p,email:e.target.value}))} type="email" />
          <Inp label="비밀번호 * (6자리 이상)" placeholder="비밀번호 입력" value={adminForm.pw} onChange={e => setAdminForm(p=>({...p,pw:e.target.value}))} type="password" />
          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            ⚠️ 관리자 계정은 장비 등록, 대여 승인, 학생 관리 등 모든 기능을 사용할 수 있습니다. 신중하게 추가해주세요.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowAddAdmin(false); setAdminForm({ name:"", email:"", pw:"" }); setAdminErr(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAddAdmin} color={C.navy} full disabled={adminLoading}>{adminLoading ? "처리 중..." : "관리자 추가"}</Btn>
          </div>
        </Modal>
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

      {/* 교수 목록 */}
      {tab === "professor" && (
        <>
          {professorList.length === 0 && <Empty icon="🎓" text="생성된 교수 계정이 없습니다" />}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:14 }}>
            {professorList.sort((a,b)=>(a.profId||"").localeCompare(b.profId||"")).map(p => (
              <Card key={p.id} style={{ border:`2px solid #0891B220` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#0891B2,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🎓</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:12, fontFamily:"monospace", color:"#0891B2", fontWeight:700 }}>{p.profId || p.email?.split("@")[0]}</span>
                      <span style={{ fontSize:10, color:C.muted }}>/ kbatv2026</span>
                    </div>
                    {editingProf === p.id ? (
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={profNameVal} onChange={e => setProfNameVal(e.target.value)}
                          onKeyDown={e => e.key==="Enter" && saveProfName(p)}
                          placeholder="교수님 성함" autoFocus
                          style={{ flex:1, background:C.bg, border:`1.5px solid ${C.blue}`, borderRadius:8, color:C.text, padding:"4px 8px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                        <Btn onClick={() => saveProfName(p)} small color={C.green}>저장</Btn>
                        <Btn onClick={() => setEditingProf(null)} small color={C.muted} outline>취소</Btn>
                      </div>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{p.name}</span>
                        <button onClick={() => { setEditingProf(p.id); setProfNameVal(p.name || ""); }}
                          style={{ background:"none", border:"none", color:C.muted, fontSize:12, cursor:"pointer", textDecoration:"underline" }}>이름 수정</button>
                      </div>
                    )}
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{p.email}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* 관리자 목록 */}
      {tab === "admin" && (
        <>
          {adminList.length === 0 && <Empty icon="👑" text="등록된 관리자가 없습니다" />}
          {adminList.map(s => (
            <Card key={s.id} style={{ border:`2px solid ${C.purple}20` }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:46, height:46, borderRadius:"50%", background:`linear-gradient(135deg,${C.navy},#2D4A9B)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>👑</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.name}</span>
                    <span style={{ background:C.purpleLight, color:C.purple, borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>관리자</span>
                  </div>
                  <div style={{ fontSize:12, color:C.muted }}>{s.email}</div>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* 검색 */}
      {/* 교수 목록 */}
      {tab === "professor" && (
        <>
          {profList.length === 0 && <Empty icon="🎓" text="등록된 교수 계정이 없습니다" />}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:14 }}>
            {profList.map(s => (
              <Card key={s.id} style={{ border:`2px solid ${C.blue}20` }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:46, height:46, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.teal})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🎓</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.name} 교수님</span>
                    </div>
                    <div style={{ fontSize:12, color:C.muted, fontFamily:"monospace" }}>{s.email}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab !== "admin" && tab !== "professor" && <input placeholder="🔍 이름, 학번, 계열 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width:"100%", maxWidth:400, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:20, display:"block" }} />}

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
