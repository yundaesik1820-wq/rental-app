import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../hooks/useAuth.jsx";
import { C } from "../theme";
import { Btn, Inp } from "../components/UI";

const DEPTS = ["영상계열", "성우계열", "엔터테인먼트계열", "음향계열", "실용음악계열"];
const toEmail = (studentId) => `${studentId.trim()}@kbas.ac.kr`;

export default function Login() {
  const { login, pendingError } = useAuth();
  const [tab, setTab] = useState("login");

  const [studentId, setStudentId]       = useState("");
  const [pw, setPw]                     = useState("");
  const [loginErr, setLoginErr]         = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [form, setForm] = useState({ name:"", dept:"", studentId:"", phone:"", pw:"", pwConfirm:"" });
  const [signupErr, setSignupErr]         = useState("");
  const [signupDone, setSignupDone]       = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const [showReset, setShowReset]       = useState(false);
  const [resetId, setResetId]           = useState("");
  const [resetName, setResetName]       = useState("");
  const [resetDone, setResetDone]       = useState(false);
  const [resetErr, setResetErr]         = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    if (!studentId || !pw) { setLoginErr("학번과 비밀번호를 입력하세요"); return; }
    setLoginLoading(true); setLoginErr("");
    try {
      const loginEmail = studentId.includes("@") ? studentId.trim() : toEmail(studentId);
      await login(loginEmail, pw);
    } catch (e) {
      setLoginErr("학번 또는 비밀번호가 올바르지 않습니다");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!form.name || !form.dept || !form.studentId || !form.phone || !form.pw) {
      setSignupErr("모든 항목을 입력하세요"); return;
    }
    if (form.pw !== form.pwConfirm) { setSignupErr("비밀번호가 일치하지 않습니다"); return; }
    if (form.pw.length < 6) { setSignupErr("비밀번호는 6자리 이상이어야 합니다"); return; }
    setSignupLoading(true); setSignupErr("");
    try {
      const email = toEmail(form.studentId);
      const cred  = await createUserWithEmailAndPassword(auth, email, form.pw);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: form.name, dept: form.dept, studentId: form.studentId,
        phone: form.phone, email,
        admissionYear: form.studentId.slice(0, 2),
        license: "", role: "student", status: "pending", rentals: 0,
        createdAt: serverTimestamp(),
      });
      setSignupDone(true);
    } catch (e) {
      setSignupErr(e.code === "auth/email-already-in-use" ? "이미 가입된 학번입니다" : "가입 실패: " + e.message);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleReset = async () => {
    if (!resetId.trim() || !resetName.trim()) { setResetErr("학번과 이름을 모두 입력하세요"); return; }
    setResetLoading(true); setResetErr("");
    try {
      await addDoc(collection(db, "pwResetRequests"), {
        studentId: resetId.trim(), studentName: resetName.trim(),
        status: "pending", createdAt: serverTimestamp(),
      });
      setResetDone(true);
    } catch(e) {
      setResetErr("요청 중 오류: " + e.message);
    }
    setResetLoading(false);
  };

  const resetSignup = () => {
    setTab("login"); setSignupDone(false);
    setForm({ name:"", dept:"", studentId:"", phone:"", pw:"", pwConfirm:"" });
  };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${C.navy} 0%,#2D4A9B 50%,${C.teal} 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.surface, borderRadius:24, padding:"40px 36px", width:"100%", maxWidth:440, boxShadow:"0 30px 80px rgba(0,0,0,0.3)" }}>

        {/* 로고 */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <img src="/logo.png" alt="한예진 로고" style={{ width:100, height:100, objectFit:"contain", marginBottom:10 }} />
          <div style={{ fontSize:22, fontWeight:900, color:C.navy }}>한국방송예술진흥원 장비대여실</div>
          <div style={{ fontSize:14, color:C.muted, marginTop:6 }}>한예진 장비관리시스템</div>
        </div>

        {/* 탭 */}
        <div style={{ display:"flex", background:C.bg, borderRadius:12, padding:4, marginBottom:24 }}>
          {[["login","로그인"],["signup","회원가입"]].map(([v,l]) => (
            <button key={v} onClick={() => { setTab(v); setLoginErr(""); setSignupErr(""); setSignupDone(false); }}
              style={{ flex:1, background:tab===v?C.navy:"transparent", color:tab===v?"#fff":C.muted, border:"none", borderRadius:9, padding:"9px 0", fontSize:14, fontWeight:700, cursor:"pointer", transition:"all 0.2s" }}>{l}</button>
          ))}
        </div>

        {/* 로그인 */}
        {tab === "login" && (
          <>
            {(loginErr || pendingError) && (
              <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:16, border:`1px solid ${C.red}30` }}>
                ⚠️ {loginErr || pendingError}
              </div>
            )}
            <Inp label="학번" placeholder="예: 25237001" value={studentId} onChange={e => { setStudentId(e.target.value); setLoginErr(""); }} />
            <Inp label="비밀번호" placeholder="비밀번호 입력" value={pw} onChange={e => { setPw(e.target.value); setLoginErr(""); }} type="password" />
            <div style={{ marginTop:8 }}>
              <Btn onClick={handleLogin} color={C.navy} full disabled={loginLoading}>
                {loginLoading ? "로그인 중..." : "로그인"}
              </Btn>
            </div>
            <div style={{ textAlign:"center", marginTop:12 }}>
              <button onClick={() => { setShowReset(true); setResetDone(false); setResetErr(""); setResetId(""); setResetName(""); }}
                style={{ background:"none", border:"none", color:C.muted, fontSize:12, cursor:"pointer", textDecoration:"underline" }}>
                비밀번호를 잊으셨나요?
              </button>
            </div>
            <div style={{ marginTop:20, background:C.bg, borderRadius:12, padding:"12px 16px", fontSize:12, color:C.muted, lineHeight:1.8 }}>
              <div style={{ fontWeight:700, color:C.navy, marginBottom:4 }}>💡 안내</div>
              <div>계정이 없으면 회원가입 탭에서 신청하세요.</div>
              <div>관리자 승인 후 로그인이 가능합니다.</div>
              <div style={{ marginTop:4, color:C.orange }}>⏳ 가입 신청 후 승인까지 다소 시간이 소요될 수 있습니다. 승인 완료 후 다시 로그인해 주세요.</div>
              <div style={{ marginTop:6, paddingTop:6, borderTop:`1px solid ${C.border}` }}>오류문의는 윤대식 조교(010-9576-6028)로 연락 부탁드립니다.</div>
            </div>
            <div style={{ textAlign:"center", marginTop:10, fontSize:10, color:"rgba(100,100,120,0.45)", fontStyle:"italic" }}>
              Designed &amp; Developed by 윤대식
            </div>
          </>
        )}

        {/* 회원가입 */}
        {tab === "signup" && (
          <>
            {signupDone ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
                <div style={{ fontSize:18, fontWeight:800, color:C.navy, marginBottom:10 }}>가입 신청 완료!</div>
                <div style={{ fontSize:14, color:C.muted, lineHeight:1.8, marginBottom:24 }}>관리자 승인 후 로그인이 가능합니다.<br/>승인까지 잠시 기다려 주세요.</div>
                <Btn onClick={resetSignup} color={C.navy} full>로그인 화면으로</Btn>
              </div>
            ) : (
              <>
                {signupErr && (
                  <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:16, border:`1px solid ${C.red}30` }}>
                    ⚠️ {signupErr}
                  </div>
                )}
                <Inp label="이름 *" placeholder="홍길동" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} />
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>계열 *</div>
                  <select value={form.dept} onChange={e => setForm(p=>({...p,dept:e.target.value}))}
                    style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:form.dept?C.text:C.muted, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none", cursor:"pointer" }}>
                    <option value="">계열 선택</option>
                    {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <Inp label="학번 *" placeholder="25237001" value={form.studentId} onChange={e => setForm(p=>({...p,studentId:e.target.value}))} />
                <Inp label="전화번호 *" placeholder="010-0000-0000" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} />
                <Inp label="비밀번호 * (6자리 이상)" placeholder="비밀번호 입력" value={form.pw} onChange={e => setForm(p=>({...p,pw:e.target.value}))} type="password" />
                <Inp label="비밀번호 확인 *" placeholder="비밀번호 재입력" value={form.pwConfirm} onChange={e => setForm(p=>({...p,pwConfirm:e.target.value}))} type="password" />
                <div style={{ marginTop:4 }}>
                  <Btn onClick={handleSignup} color={C.teal} full disabled={signupLoading}>
                    {signupLoading ? "가입 신청 중..." : "가입 신청"}
                  </Btn>
                </div>
                <div style={{ marginTop:14, fontSize:12, color:C.muted, textAlign:"center", lineHeight:1.7 }}>
                  가입 신청 후 관리자 승인이 필요합니다.<br/>승인 전까지는 로그인이 제한됩니다.
                </div>
              </>
            )}
          </>
        )}

        {/* 비밀번호 초기화 요청 모달 */}
        {showReset && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
            <div style={{ background:C.surface, borderRadius:20, padding:"32px 28px", width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
              {resetDone ? (
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.navy, marginBottom:8 }}>요청이 접수됐어요!</div>
                  <div style={{ fontSize:13, color:C.muted, lineHeight:1.7, marginBottom:20 }}>
                    관리자가 확인 후 비밀번호를<br/>123456으로 초기화해드릴게요.
                  </div>
                  <Btn onClick={() => setShowReset(false)} color={C.navy} full>확인</Btn>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:4 }}>비밀번호 초기화 요청</div>
                  <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>학번과 이름을 입력하면 관리자에게 요청이 전달됩니다</div>
                  {resetErr && (
                    <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:14, border:`1px solid ${C.red}30` }}>
                      ⚠️ {resetErr}
                    </div>
                  )}
                  <Inp label="학번 *" placeholder="예: 25237001" value={resetId} onChange={e => { setResetId(e.target.value); setResetErr(""); }} />
                  <Inp label="이름 *" placeholder="홍길동" value={resetName} onChange={e => { setResetName(e.target.value); setResetErr(""); }} />
                  <div style={{ display:"flex", gap:10, marginTop:8 }}>
                    <Btn onClick={() => setShowReset(false)} color={C.muted} outline full>취소</Btn>
                    <Btn onClick={handleReset} color={C.navy} full disabled={resetLoading}>
                      {resetLoading ? "요청 중..." : "초기화 요청"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
