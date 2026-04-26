import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { createUserWithEmailAndPassword, updatePassword as fbUpdatePassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { C } from "../../theme";
import { Card, Avatar, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, updateItem } from "../../hooks/useFirestore";

const DEPTS    = ["영상계열","성우계열","엔터테인먼트계열","음향계열","실용음악계열"];
const LICENSES = ["없음","1단계","2단계","3단계"];
const admYear  = id => id ? `${id.slice(0,2)}학번` : "";

export default function Students({ readOnly = false }) {
  const { data: allUsers }    = useCollection("users", "createdAt");
  const { data: allRequests }   = useCollection("rentalRequests", "createdAt");
  const { data: resetRequests } = useCollection("pwResetRequests", "createdAt");

  // studentId 기준 대여 횟수 실시간 집계
  const getRentalCount = (studentId) =>
    allRequests.filter(r => r.studentId === studentId).length;

  // readOnly(일반직원)일 때 탭을 승인학생 목록만 표시
  const TABS_ALL = [
    { id:"pending",  label:`승인대기 (${allUsers.filter(s=>s.role==="student"&&s.status==="pending").length})`,   color:C.yellow },
    { id:"approved", label:`승인학생 (${allUsers.filter(s=>s.role==="student"&&s.status==="approved").length})`,  color:C.teal   },
    { id:"rejected", label:`거절됨 (${allUsers.filter(s=>s.role==="student"&&s.status==="rejected").length})`,    color:C.red    },
    { id:"admin",    label:`직원 (${allUsers.filter(s=>s.role==="admin").length})`,                               color:C.purple },
  ];
  const TABS = readOnly ? TABS_ALL.filter(t => t.id === "approved") : TABS_ALL;

  const pendingList   = allUsers.filter(s => s.role === "student" && s.status === "pending");
  const approvedList  = allUsers.filter(s => s.role === "student" && s.status === "approved");
  const rejectedList  = allUsers.filter(s => s.role === "student" && s.status === "rejected");
  const withdrawnList = allUsers.filter(s => s.role === "student" && s.status === "withdrawn");
  const adminList     = allUsers.filter(s => s.role === "admin");
  const profList      = allUsers.filter(s => s.role === "professor");

  const [tab, setTab]     = useState("pending");
  const [search, setSearch] = useState("");

  // ── 학생 직접 추가 ──────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name:"", dept:"", studentId:"", phone:"", email:"", pw:"", license:"없음" });
  const [addErr, setAddErr]   = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const handleAdd = async () => {
    if (!addForm.name || !addForm.dept || !addForm.studentId || !addForm.email || !addForm.pw) {
      setAddErr("필수 항목을 입력하세요"); return;
    }
    setAddLoading(true); setAddErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, addForm.email, addForm.pw);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: addForm.name, dept: addForm.dept, studentId: addForm.studentId,
        admissionYear: addForm.studentId.slice(0,2),
        phone: addForm.phone, email: addForm.email,
        license: addForm.license,
        role: "student", status: "approved", rentals: 0,
        createdAt: serverTimestamp(),
      });
      setAddForm({ name:"", dept:"", studentId:"", phone:"", email:"", pw:"", license:"없음" });
      setShowAdd(false);
    } catch(e) {
      setAddErr(e.code === "auth/email-already-in-use" ? "이미 사용 중인 이메일" : "생성 실패: " + e.message);
    } finally { setAddLoading(false); }
  };

  // ── 관리자 추가 ─────────────────────────────────────────
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminForm, setAdminForm]       = useState({ name:"", email:"", pw:"", adminRole:"teacher" });
  const [adminErr, setAdminErr]         = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const handleAddAdmin = async () => {
    if (!adminForm.name || !adminForm.email || !adminForm.pw) { setAdminErr("모든 항목을 입력하세요"); return; }
    if (adminForm.pw.length < 6) { setAdminErr("비밀번호는 6자리 이상"); return; }
    setAdminLoading(true); setAdminErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, adminForm.email, adminForm.pw);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: adminForm.name, email: adminForm.email,
        role: "admin", adminRole: adminForm.adminRole,
        status: "approved",
        createdAt: serverTimestamp(),
      });
      setAdminForm({ name:"", email:"", pw:"", adminRole:"teacher" });
      setShowAddAdmin(false);
    } catch(e) {
      setAdminErr(e.code === "auth/email-already-in-use" ? "이미 사용 중인 이메일" : "생성 실패: " + e.message);
    } finally { setAdminLoading(false); }
  };

  // ── 교수 계정 생성 ──────────────────────────────────────
  const [showAddProf, setShowAddProf] = useState(false);
  // 20명 이름 입력 상태
  const [profNames, setProfNames] = useState(
    Object.fromEntries(Array.from({length:20}, (_,i) => [`P${String(i+1).padStart(5,"0")}`, ""]))
  );
  const [profLoading, setProfLoading] = useState(false);
  const [profErr, setProfErr]         = useState("");
  const [profDone, setProfDone]       = useState(0);

  // 학생 일괄 등록
  const [showBulk, setShowBulk]       = useState(false);
  const [bulkRows, setBulkRows]       = useState([]);  // 파싱된 학생 목록
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDone, setBulkDone]       = useState(0);
  const [bulkErr, setBulkErr]         = useState("");
  const bulkFileRef                   = useRef(null);

  // 교수 이름 수정
  const [editingProf, setEditingProf] = useState(null);
  const [profNameVal, setProfNameVal] = useState("");

  // 엑셀 템플릿 다운로드
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["이름", "계열", "학번", "전화번호"],
      ["홍길동", "영상계열", "25237001", "010-0000-0000"],
      ["이서연", "음향계열", "25238002", "010-1111-1111"],
    ]);
    ws["!cols"] = [{ wch:10 }, { wch:16 }, { wch:12 }, { wch:16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생목록");
    XLSX.writeFile(wb, "학생_일괄등록_템플릿.xlsx");
  };

  // 엑셀 파일 파싱
  const handleBulkFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target.result, { type: "binary" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // 헤더 제외
      const parsed = rows
        .filter(r => r[0] && r[2]) // 이름, 학번 필수
        .map(r => ({
          name:      String(r[0] || "").trim(),
          dept:      String(r[1] || "").trim(),
          studentId: String(r[2] || "").trim(),
          phone:     String(r[3] || "").trim(),
        }));
      setBulkRows(parsed);
      setBulkErr("");
      setBulkDone(0);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // 학생 일괄 등록 (10명마다 6초 딜레이 - Firebase 분당 제한 대응)
  const handleBulkCreate = async () => {
    if (bulkRows.length === 0) { setBulkErr("파일을 먼저 업로드하세요"); return; }
    setBulkLoading(true); setBulkErr(""); setBulkDone(0);
    let done = 0;
    for (let i = 0; i < bulkRows.length; i++) {
      const s = bulkRows[i];
      const email = `${s.studentId}@kbas.ac.kr`;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, "123456");
        await setDoc(doc(db, "users", cred.user.uid), {
          name:          s.name,
          dept:          s.dept,
          studentId:     s.studentId,
          phone:         s.phone,
          email,
          admissionYear: s.studentId.slice(0, 2),
          license:       "",
          role:          "student",
          status:        "approved",
          rentals:       0,
          createdAt:     serverTimestamp(),
        });
      } catch(e) {
        if (!e.code?.includes("already-in-use")) console.error(s.studentId, e.message);
      }
      done++; setBulkDone(done);
      // 10명마다 6초 대기 (Firebase 분당 10개 제한 대응)
      if (done % 10 === 0 && done < bulkRows.length) {
        setBulkErr(`⏳ Firebase 제한으로 잠시 대기 중... (${done}/${bulkRows.length}명 완료)`);
        await new Promise(r => setTimeout(r, 6000));
        setBulkErr("");
      }
    }
    setBulkLoading(false);
    setBulkRows([]);
    setShowBulk(false);
  };

  const handleCreateProfs = async () => {
    const toCreate = Object.entries(profNames).filter(([_, name]) => name.trim());
    if (toCreate.length === 0) { setProfErr("이름을 하나 이상 입력하세요"); return; }
    setProfLoading(true); setProfErr(""); setProfDone(0);
    let done = 0;
    for (const [profId, name] of toCreate) {
      const email = `${profId}@kbas.kr`;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, "kbatv2026");
        await setDoc(doc(db, "users", cred.user.uid), {
          name: name.trim(), email, role: "professor",
          status: "approved", profId,
          createdAt: serverTimestamp(),
        });
      } catch(e) {
        if (!e.code?.includes("already-in-use")) console.error(email, e.message);
      }
      done++; setProfDone(done);
    }
    setProfLoading(false); setShowAddProf(false);
  };

  const saveProfName = async (prof) => {
    if (!profNameVal.trim()) return;
    await updateItem("users", prof.id, { name: profNameVal.trim() });
    setEditingProf(null); setProfNameVal("");
  };

  // ── 승인 모달 ───────────────────────────────────────────
  const [approveTarget, setApproveTarget] = useState(null);
  const [license, setLicense]             = useState("없음");

  const confirmApprove = async () => {
    await updateItem("users", approveTarget.id, {
      status: "approved", license,
      admissionYear: approveTarget.studentId?.slice(0,2) || "",
    });
    setApproveTarget(null); setLicense("없음");
  };
  const reject    = id => updateItem("users", id, { status: "rejected" });
  const reapprove = s  => { setApproveTarget(s); setLicense(s.license || "없음"); };

  // 비밀번호 초기화 요청 처리
  // 비밀번호 초기화 요청 처리 (Cloud Function 호출)
  const handlePwReset = async (req) => {
    if (!window.confirm(`${req.studentName}(${req.studentId}) 학생의 비밀번호를 123456으로 초기화하시겠습니까?`)) return;
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions     = getFunctions();
      const resetPassword = httpsCallable(functions, "resetStudentPassword");
      const result        = await resetPassword({ studentId: req.studentId, requestId: req.id });
      alert("✅ " + result.data.message);
    } catch(e) {
      alert("오류: " + (e.message || JSON.stringify(e)));
    }
  };

  };

  // 강제 탈퇴 / 복구
  const withdraw = async (s) => {
    if (!window.confirm(`${s.name} 학생을 강제 탈퇴시키겠습니까?\n탈퇴 후에는 로그인이 차단됩니다.`)) return;
    await updateItem("users", s.id, { status: "withdrawn", withdrawnAt: new Date().toISOString() });
  };
  const restore = async (s) => {
    if (!window.confirm(`${s.name} 학생의 계정을 복구하겠습니까?`)) return;
    await updateItem("users", s.id, { status: "approved", withdrawnAt: null });
  };

  // ── 탭 + 필터 ───────────────────────────────────────────
  const pendingResets = resetRequests.filter(r => r.status === "pending");

  const allTabs = [
    { id:"pwreset",   label:`비밀번호 초기화 요청 ${pendingResets.length > 0 ? `(${pendingResets.length})` : ""}`, color:C.orange },
    { id:"pending",   label:`승인 대기 (${pendingList.length})`,   color:C.yellow  },
    { id:"approved",  label:`승인됨 (${approvedList.length})`,     color:C.green   },
    { id:"rejected",  label:`거절됨 (${rejectedList.length})`,     color:C.red     },
    { id:"professor", label:`교수 (${profList.length})`,           color:C.blue    },
    { id:"admin",     label:`직원 (${adminList.length})`,          color:C.purple  },
    { id:"withdrawn", label:`탈퇴 (${withdrawnList.length})`,      color:C.muted   },
  ];
  const tabs = readOnly ? allTabs.filter(t => t.id === "approved") : allTabs;

  const listMap = { pending:pendingList, approved:approvedList, rejected:rejectedList };
  const filtered = (listMap[tab] || []).filter(s =>
    s.name?.includes(search) || s.studentId?.includes(search) || s.dept?.includes(search)
  );

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <PageTitle>👥 학생 관리</PageTitle>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Btn onClick={() => setShowAddProf(true)}  color={C.blue}>🎓 교수 계정 생성</Btn>
          {!readOnly && <>
          <Btn onClick={() => { setShowBulk(true); setBulkRows([]); setBulkErr(""); }} color={C.blue}>📥 학생 일괄 등록</Btn>
          <Btn onClick={() => setShowAddAdmin(true)} color={C.navy}>직원 추가</Btn>
        </>}
          <Btn onClick={() => setShowAdd(true)}       color={C.purple}>+ 학생 직접 추가</Btn>
        </div>
      </div>

      {/* 승인 대기 배너 */}
      {pendingList.length > 0 && (
        <div style={{ background:C.yellowLight, borderRadius:14, padding:"14px 18px", marginBottom:20, border:`1px solid ${C.yellow}40`, display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:24 }}>⏳</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#92400E" }}>승인 대기 {pendingList.length}명</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>가입 신청한 학생이 있습니다</div>
          </div>
        </div>
      )}

      {/* ── 교수 계정 생성 모달 ── */}
      {showAddProf && (
        <Modal onClose={() => { setShowAddProf(false); setProfErr(""); }} width={600}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>🎓 교수 계정 생성</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>
            이름 입력한 항목만 생성돼요 · 이메일: <strong>P00001@kbas.kr</strong> · 비밀번호: <strong>kbatv2026</strong>
          </div>
          {profErr && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:12 }}>⚠️ {profErr}</div>}
          {profLoading && (
            <div style={{ background:C.blueLight, color:C.blue, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:12 }}>
              ⏳ 생성 중... ({profDone}명 완료)
            </div>
          )}
          <div style={{ maxHeight:380, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:12, marginBottom:16 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.navy, position:"sticky", top:0 }}>
                  <th style={{ color:"#fff", padding:"10px 14px", textAlign:"left", fontWeight:700, width:100 }}>ID</th>
                  <th style={{ color:"#fff", padding:"10px 14px", textAlign:"left", fontWeight:700 }}>이름</th>
                  <th style={{ color:"#fff", padding:"10px 14px", textAlign:"left", fontWeight:700, width:180 }}>이메일</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({length:20}, (_,i) => {
                  const profId = `P${String(i+1).padStart(5,"0")}`;
                  const exists = profList.find(p => p.profId === profId || p.email === `${profId}@kbas.kr`);
                  return (
                    <tr key={profId} style={{ background:i%2===0?C.bg:C.surface, borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:"8px 14px", fontFamily:"monospace", color:C.blue, fontWeight:700 }}>
                        {profId}
                        {exists && <span style={{ marginLeft:6, fontSize:10, color:C.green }}>✓생성됨</span>}
                      </td>
                      <td style={{ padding:"6px 14px" }}>
                        <input
                          placeholder={exists ? exists.name : "교수님 이름 입력"}
                          value={profNames[profId]}
                          onChange={e => setProfNames(p => ({ ...p, [profId]: e.target.value }))}
                          disabled={!!exists}
                          style={{ width:"100%", background: exists ? C.bg : "transparent", border:`1px solid ${C.border}`, borderRadius:6, color: exists ? C.muted : C.text, padding:"5px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                        />
                      </td>
                      <td style={{ padding:"8px 14px", color:C.muted, fontSize:12 }}>{profId}@kbas.kr</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowAddProf(false); setProfErr(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleCreateProfs} color={C.blue} full disabled={profLoading}>
              {profLoading ? `생성 중... (${profDone}명)` : "계정 생성"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* ── 관리자 추가 모달 ── */}
      {/* 학생 일괄 등록 모달 */}
      {showBulk && (
        <Modal onClose={() => setShowBulk(false)} width={560}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>📥 학생 일괄 등록</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>엑셀 파일로 여러 학생을 한번에 등록합니다</div>

          {/* 템플릿 다운로드 */}
          <div style={{ background:C.blueLight, borderRadius:12, padding:"14px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.blue, marginBottom:2 }}>엑셀 템플릿 다운로드</div>
              <div style={{ fontSize:12, color:C.muted }}>이름 · 계열 · 학번 · 전화번호</div>
            </div>
            <Btn onClick={downloadTemplate} color={C.blue} small>📄 템플릿 받기</Btn>
          </div>

          {/* 파일 업로드 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>엑셀 파일 업로드</div>
            <label style={{ display:"flex", alignItems:"center", gap:10, background:C.bg, border:`2px dashed ${C.border}`, borderRadius:12, padding:"16px 20px", cursor:"pointer" }}>
              <span style={{ fontSize:13, color:C.muted }}>
                {bulkRows.length > 0 ? `✅ ${bulkRows.length}명 파싱 완료` : "파일을 선택하세요 (.xlsx)"}
              </span>
              <input ref={bulkFileRef} type="file" accept=".xlsx,.xls" onChange={handleBulkFile} style={{ display:"none" }} />
            </label>
          </div>

          {/* 파싱 미리보기 */}
          {bulkRows.length > 0 && (
            <div style={{ background:C.bg, borderRadius:10, padding:"12px 14px", marginBottom:16, maxHeight:200, overflowY:"auto" }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:8 }}>등록 예정 학생 {bulkRows.length}명</div>
              {bulkRows.map((s, i) => (
                <div key={i} style={{ display:"flex", gap:10, padding:"5px 0", borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.text }}>
                  <span style={{ fontWeight:600, minWidth:60 }}>{s.studentId}</span>
                  <span style={{ minWidth:60 }}>{s.name}</span>
                  <span style={{ color:C.muted }}>{s.dept}</span>
                  <span style={{ color:C.muted }}>{s.phone}</span>
                </div>
              ))}
            </div>
          )}

          {/* 안내 */}
          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            ⚠️ 초기 비밀번호는 <strong>123456</strong>으로 설정됩니다. 학생에게 변경을 안내해주세요.<br/>
            이미 가입된 학번은 자동으로 건너뜁니다.
          </div>

          {bulkErr && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>⚠️ {bulkErr}</div>}
          {bulkLoading && (
            <div style={{ background:C.blueLight, borderRadius:10, padding:"12px 14px", fontSize:13, color:C.blue, marginBottom:16 }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>등록 중... {bulkDone} / {bulkRows.length}명</div>
              <div style={{ background:"rgba(0,0,0,0.08)", borderRadius:6, height:8, overflow:"hidden" }}>
                <div style={{ width:`${(bulkDone/bulkRows.length)*100}%`, background:C.blue, height:"100%", borderRadius:6, transition:"width 0.3s" }} />
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>
                116명 등록 시 약 1~2분 소요될 수 있습니다. 창을 닫지 마세요.
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowBulk(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleBulkCreate} color={C.blue} full disabled={bulkLoading || bulkRows.length === 0}>
              {bulkLoading ? `등록 중... ${bulkDone}/${bulkRows.length}` : `✅ ${bulkRows.length}명 등록`}
            </Btn>
          </div>
        </Modal>
      )}

      {showAddAdmin && (
        <Modal onClose={() => { setShowAddAdmin(false); setAdminErr(""); }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>직원 계정 추가</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>역할을 선택하고 계정을 생성하세요</div>
          {adminErr && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14 }}>⚠️ {adminErr}</div>}
          <Inp label="이름 *" placeholder="홍길동" value={adminForm.name} onChange={e => setAdminForm(p=>({...p,name:e.target.value}))} />
          <Inp label="이메일 *" placeholder="admin@email.com" value={adminForm.email} onChange={e => setAdminForm(p=>({...p,email:e.target.value}))} type="email" />
          <Inp label="비밀번호 *" placeholder="6자리 이상" value={adminForm.pw} onChange={e => setAdminForm(p=>({...p,pw:e.target.value}))} type="password" />

          {/* 역할 선택 */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>역할 *</div>
            <div style={{ display:"flex", gap:10 }}>
              {[["teacher","교사"],["assistant","조교"]].map(([val, label]) => (
                <button key={val} onClick={() => setAdminForm(p=>({...p, adminRole:val}))}
                  style={{ flex:1, padding:"10px 0", borderRadius:10, border:`2px solid ${adminForm.adminRole===val ? C.navy : C.border}`, background: adminForm.adminRole===val ? C.navy : C.bg, color: adminForm.adminRole===val ? "#fff" : C.muted, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:8, lineHeight:1.6 }}>
              {adminForm.adminRole === "teacher" ? "📚 교사: 장비관리, 캘린더, 통계, 공지, QR, 문의(답변), 설정 접근 가능" : "🔧 조교: 장비관리, 캘린더, 통계, 공지, QR, 문의(답변), 설정 접근 가능"}
            </div>
          </div>

          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            ⚠️ 대여/반납 및 학생 관리 기능은 최고관리자만 사용 가능합니다.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowAddAdmin(false); setAdminErr(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAddAdmin} color={C.navy} full disabled={adminLoading}>{adminLoading ? "처리 중..." : "직원 계정 추가"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── 학생 직접 추가 모달 ── */}
      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setAddErr(""); }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>학생 직접 추가</div>
          {addErr && <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14 }}>{addErr}</div>}
          <Inp label="이름 *" placeholder="홍길동" value={addForm.name} onChange={e => setAddForm(p=>({...p,name:e.target.value}))} />
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>계열 *</div>
            <select value={addForm.dept} onChange={e => setAddForm(p=>({...p,dept:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:addForm.dept?C.text:C.muted, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none" }}>
              <option value="">계열 선택</option>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <Inp label="학번 *" placeholder="25237001" value={addForm.studentId} onChange={e => setAddForm(p=>({...p,studentId:e.target.value}))} />
          <Inp label="전화번호" placeholder="010-0000-0000" value={addForm.phone} onChange={e => setAddForm(p=>({...p,phone:e.target.value}))} />
          <Inp label="이메일 *" value={addForm.email} onChange={e => setAddForm(p=>({...p,email:e.target.value}))} type="email" />
          <Inp label="초기 비밀번호 *" placeholder="6자리 이상" value={addForm.pw} onChange={e => setAddForm(p=>({...p,pw:e.target.value}))} type="password" />
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>라이센스</div>
            <select value={addForm.license} onChange={e => setAddForm(p=>({...p,license:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none" }}>
              {LICENSES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setShowAdd(false); setAddErr(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAdd} color={C.purple} full disabled={addLoading}>{addLoading?"처리 중...":"추가"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── 승인+라이센스 모달 ── */}
      {approveTarget && (
        <Modal onClose={() => { setApproveTarget(null); setLicense("없음"); }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:6 }}>✅ 승인 처리</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>승인 전 라이센스 단계를 선택해주세요</div>
          <div style={{ background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{approveTarget.name}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{admYear(approveTarget.studentId)} · {approveTarget.dept}</div>
            <div style={{ fontSize:12, color:C.muted }}>{approveTarget.phone} · {approveTarget.email}</div>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>라이센스 단계</div>
          <div style={{ display:"flex", gap:10, marginBottom:20 }}>
            {LICENSES.map(l => (
              <button key={l} onClick={() => setLicense(l)} style={{ flex:1, padding:"12px 0", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit",
                background: license===l ? C.navy : C.bg, color: license===l ? "#fff" : C.muted, border:`1.5px solid ${license===l ? C.navy : C.border}` }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => { setApproveTarget(null); setLicense("없음"); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={confirmApprove} color={C.green} full>승인 완료</Btn>
          </div>
        </Modal>
      )}

      {/* ── 탭 ── */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(""); }}
            style={{ background:tab===t.id?t.color:C.surface, color:tab===t.id?"#fff":C.muted, border:`1px solid ${tab===t.id?t.color:C.border}`, borderRadius:20, padding:"7px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 검색 (학생 탭에서만) ── */}
      {["pending","approved","rejected"].includes(tab) && (
        <input placeholder="🔍 이름, 학번, 계열 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:"100%", maxWidth:400, background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:20, display:"block" }} />
      )}

      {/* ── 승인 대기 ── */}
      {tab === "pwreset" && (
        <>
          {pendingResets.length === 0 && <Empty icon="🔑" text="비밀번호 초기화 요청이 없습니다" />}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {pendingResets.map(req => (
              <Card key={req.id}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:2 }}>{req.studentName}</div>
                    <div style={{ fontSize:13, color:C.muted }}>학번: {req.studentId}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                      요청일: {req.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || ""}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <Btn onClick={() => handlePwReset(req)} color={C.orange} small>🔑 123456으로 초기화</Btn>
                    <Btn onClick={() => updateDoc(doc(db, "pwResetRequests", req.id), { status:"done" })} color={C.muted} outline small>무시</Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "pending" && (
        <>
          {filtered.length === 0 && <Empty icon="⏳" text="승인 대기 중인 학생이 없습니다" />}
          {filtered.map(s => (
            <Card key={s.id} style={{ border:`2px solid ${C.yellow}40` }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <Avatar name={s.name||"?"} size={46} />
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

      {/* ── 승인됨 ── */}
      {tab === "approved" && (
        <>
          {filtered.length === 0 && <Empty icon="👥" text="승인된 학생이 없습니다" />}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:16 }}>
            {filtered.map(s => (
              <Card key={s.id}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <Avatar name={s.name||"?"} size={46} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:4 }}>{s.name}</div>
                    <div style={{ fontSize:12, color:C.blue, fontWeight:600, fontFamily:"monospace" }}>{s.studentId} · {admYear(s.studentId)}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{s.dept} · {s.phone}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                      <span style={{ fontSize:11, color:C.muted }}>라이센스:</span>
                      <span style={{ background:s.license&&s.license!=="없음"?C.blueLight:C.bg, color:s.license&&s.license!=="없음"?C.blue:C.muted, borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{s.license||"없음"}</span>
                      {!readOnly && <button onClick={() => reapprove(s)} style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", textDecoration:"underline" }}>변경</button>}
                    </div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:C.navy }}>{getRentalCount(s.studentId)}</div>
                    <div style={{ fontSize:9, color:C.muted }}>누적 대여</div>
                  </div>
                </div>
                {!readOnly && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                    <Btn onClick={() => withdraw(s)} color={C.red} outline full small>강제 탈퇴</Btn>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── 거절됨 ── */}
      {tab === "rejected" && (
        <>
          {filtered.length === 0 && <Empty icon="🚫" text="거절된 학생이 없습니다" />}
          {filtered.map(s => (
            <Card key={s.id} style={{ opacity:0.7 }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <Avatar name={s.name||"?"} size={46} />
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

      {/* ── 교수 목록 ── */}
      {tab === "professor" && (
        <>
          {profList.length === 0 && <Empty icon="🎓" text="등록된 교수 계정이 없습니다" />}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:14 }}>
            {profList.map(s => (
              <Card key={s.id} style={{ border:`2px solid ${C.blue}20` }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:46, height:46, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.teal})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🎓</div>
                  <div style={{ flex:1 }}>
                    {editingProf === s.id ? (
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={profNameVal} onChange={e => setProfNameVal(e.target.value)}
                          style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, padding:"4px 8px", fontSize:13, fontFamily:"inherit", outline:"none" }} autoFocus />
                        <Btn onClick={() => saveProfName(s)} color={C.green} small>저장</Btn>
                        <Btn onClick={() => setEditingProf(null)} color={C.muted} outline small>취소</Btn>
                      </div>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.name} 교수님</span>
                        <button onClick={() => { setEditingProf(s.id); setProfNameVal(s.name); }}
                          style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", textDecoration:"underline" }}>수정</button>
                      </div>
                    )}
                    <div style={{ fontSize:12, color:C.muted, fontFamily:"monospace", marginTop:3 }}>{s.profId || ""} · {s.email}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── 관리자 목록 ── */}
      {tab === "withdrawn" && (
        <>
          <div style={{ background:C.yellowLight, borderRadius:12, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#92400E" }}>
            ⚠️ 탈퇴 처리된 학생 목록입니다. 계정은 유지되지만 로그인이 차단됩니다.
          </div>
          {withdrawnList.length === 0 && <Empty icon="🗑️" text="탈퇴된 학생이 없습니다" />}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
            {withdrawnList.map(s => (
              <Card key={s.id} style={{ border:`2px solid ${C.muted}30`, opacity:0.8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                  <Avatar name={s.name} size={44} />
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.name}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{s.dept} · {s.studentId}</div>
                    {s.withdrawnAt && <div style={{ fontSize:11, color:C.red }}>탈퇴일: {new Date(s.withdrawnAt).toLocaleDateString("ko-KR")}</div>}
                  </div>
                </div>
                <Btn onClick={() => restore(s)} color={C.green} full small>계정 복구</Btn>
              </Card>
            ))}
          </div>
        </>
      )}

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
                    <span style={{ background: s.adminRole==="teacher" ? C.blueLight : s.adminRole==="assistant" ? C.tealLight : C.purpleLight, color: s.adminRole==="teacher" ? C.blue : s.adminRole==="assistant" ? C.teal : C.purple, borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700 }}>
                      {s.adminRole==="teacher" ? "교사" : s.adminRole==="assistant" ? "조교" : "관리자"}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:C.muted }}>{s.email}</div>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
