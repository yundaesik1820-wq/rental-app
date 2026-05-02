import { useState } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../../firebase";
import { C, setTheme, getThemeMode } from "../../theme";
import { Card, Avatar, PageTitle, Btn, Inp, Modal } from "../../components/UI";
import { useCollection, updateItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { Award } from "lucide-react";

export default function Profile() {
  const { profile, logout } = useAuth();
  const [showPwModal,    setShowPwModal]    = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneForm,      setPhoneForm]      = useState("");
  const [phoneDone,      setPhoneDone]      = useState(false);
  const [phoneErr,       setPhoneErr]       = useState("");
  const [themeMode,      setThemeModeState] = useState(getThemeMode());

  const handleTheme = (mode) => { setTheme(mode); setThemeModeState(mode); };

  const changePhone = async () => {
    if (!phoneForm.trim()) { setPhoneErr("전화번호를 입력하세요"); return; }
    const cleaned = phoneForm.replace(/[^0-9]/g, "");
    if (cleaned.length < 10) { setPhoneErr("올바른 전화번호를 입력하세요"); return; }
    try {
      await updateItem("users", profile.uid, { phone: phoneForm.trim() });
      setPhoneDone(true);
      setPhoneErr("");
    } catch(e) {
      setPhoneErr("변경 실패: " + e.message);
    }
  };
  const [pwForm, setPwForm]           = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr]             = useState("");
  const [pwDone, setPwDone]           = useState(false);
  const [pwLoading, setPwLoading]     = useState(false);

  const changePw = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwErr("모든 항목을 입력하세요"); return; }
    if (pwForm.next.length < 6) { setPwErr("새 비밀번호는 6자리 이상이어야 합니다"); return; }
    if (pwForm.next !== pwForm.confirm) { setPwErr("새 비밀번호가 일치하지 않습니다"); return; }
    setPwLoading(true); setPwErr("");
    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwForm.next);
      setPwDone(true);
      setPwForm({ current: "", next: "", confirm: "" });
    } catch(e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setPwErr("현재 비밀번호가 올바르지 않습니다");
      } else {
        setPwErr("변경 실패: " + e.message);
      }
    }
    setPwLoading(false);
  };
  const { data: allRequests } = useCollection("rentalRequests", "createdAt");

  const myId   = profile?.studentId || profile?.email || "";
  const mine   = allRequests.filter(r => r.studentId === myId || r.studentId === profile?.uid);
  const active = mine.filter(r => r.status === "대여중" || r.status === "연체").length;

  if (!profile) return null;

  const isProf  = profile.role === "professor";
  const admYear = isProf ? "교수" : (profile.studentId ? `${profile.studentId.slice(0, 2)}학번` : "-");

  const licenseColor = () => {
    if (!profile.license || profile.license === "없음") return { bg: C.bg, col: C.muted };
    if (profile.license === "1단계") return { bg: C.blueLight,   col: C.blue   };
    if (profile.license === "2단계") return { bg: C.tealLight,   col: C.teal   };
    if (profile.license === "3단계") return { bg: C.purpleLight, col: C.purple };
    return { bg: C.bg, col: C.muted };
  };
  const lc = licenseColor();

  return (
    <div style={{ maxWidth: 500 }}>
      {/* 페이지 안내 배너 */}
      <div style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img src="/mascot/shrug.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
          <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
            <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
            <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 내 정보 페이지야!</div>
            <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>내 계정 정보를 확인하고<br/>비밀번호도 변경할 수 있어 🙋</div>
          </div>
        </div>
      </div>
      <PageTitle>내 정보</PageTitle>

      {/* 프로필 카드 */}
      <Card style={{ textAlign: "center", padding: "32px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Avatar name={profile.name || "?"} size={72} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>{profile.name}</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{profile.dept}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ background: C.blueLight, color: C.blue, borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
            {profile.studentId}
          </div>
          <div style={{ background: C.bg, color: C.muted, borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 600 }}>
            {admYear}
          </div>
        </div>
      </Card>

      {/* 라이센스 카드 - 교수님은 숨김 */}
      {profile.role !== "professor" && <Card style={{ marginBottom: 16, border: `2px solid ${lc.col}30` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Award size={14} /> 장비 사용 라이센스</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: lc.bg, color: lc.col, borderRadius: 8, padding: "6px 16px", fontSize: 16, fontWeight: 800 }}>
                {profile.license || "없음"}
              </span>
              {(!profile.license || profile.license === "없음") && (
                <span style={{ fontSize: 12, color: C.muted }}>관리자 승인 후 등록됩니다</span>
              )}
            </div>
          </div>
        </div>
      </Card>}

      {/* 계정 정보 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 14 }}>계정 정보</div>
        {[
          ...(isProf ? [] : [
            ["학번",     profile.studentId || "-"],
            ["입학년도", admYear],
          ]),
          ["계열/소속",  profile.dept || (isProf ? "교수" : "-")],
          ["연락처",     profile.phone || "-"],
          ["이메일",     profile.email || "-"],
          ["누적 대여",  `${profile.rentals || mine.filter(r => r.status === "반납완료").length}회`],
          ["현재 대여중", `${active}개`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 14, color: C.muted }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{v}</span>
          </div>
        ))}
      </Card>

      <button onClick={() => { setShowPwModal(true); setPwErr(""); setPwDone(false); }}
        style={{ width: "100%", background: C.blueLight, color: C.blue, border: `1.5px solid ${C.blue}30`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
        🔒 비밀번호 변경
      </button>

      <button onClick={() => { setShowPhoneModal(true); setPhoneForm(profile?.phone||""); setPhoneErr(""); setPhoneDone(false); }}
        style={{ width: "100%", background: C.tealLight, color: C.teal, border: `1.5px solid ${C.teal}30`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
        📱 전화번호 변경
      </button>

      {/* 테마 설정 */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🎨 화면 테마</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleTheme("dark")}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${themeMode === "dark" ? "#60A5FA" : C.border}`, background: themeMode === "dark" ? "#1E3A5F" : C.bg, color: themeMode === "dark" ? "#60A5FA" : C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            🌙 다크 모드
          </button>
          <button onClick={() => handleTheme("light")}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${themeMode === "light" ? "#1B2B6B" : C.border}`, background: themeMode === "light" ? "#EEF2FF" : C.bg, color: themeMode === "light" ? "#1B2B6B" : C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ☀️ 라이트 모드
          </button>
        </div>
      </div>

      <button onClick={logout} style={{ width: "100%", background: C.redLight, color: C.red, border: `1.5px solid ${C.red}30`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        로그아웃
      </button>

      {/* 전화번호 변경 모달 */}
      {showPhoneModal && (
        <Modal onClose={() => { setShowPhoneModal(false); setPhoneDone(false); }} width={400}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>📱 전화번호 변경</div>
          {phoneDone ? (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700, color:C.green, marginBottom:8 }}>전화번호가 변경됐어요!</div>
              <Btn onClick={() => { setShowPhoneModal(false); setPhoneDone(false); }} color={C.navy} full>확인</Btn>
            </div>
          ) : (
            <>
              {phoneErr && (
                <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:16, border:`1px solid ${C.red}30` }}>
                  ⚠️ {phoneErr}
                </div>
              )}
              <Inp label="새 전화번호" placeholder="010-0000-0000" value={phoneForm} onChange={e => { setPhoneForm(e.target.value); setPhoneErr(""); }} />
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <Btn onClick={() => setShowPhoneModal(false)} color={C.muted} outline full>취소</Btn>
                <Btn onClick={changePhone} color={C.teal} full>변경하기</Btn>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* 비밀번호 변경 모달 */}
      {showPwModal && (
        <Modal onClose={() => { setShowPwModal(false); setPwDone(false); setPwErr(""); }} width={420}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>🔒 비밀번호 변경</div>
          {pwDone ? (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700, color:C.green, marginBottom:8 }}>비밀번호가 변경됐어요!</div>
              <Btn onClick={() => { setShowPwModal(false); setPwDone(false); }} color={C.navy} full>확인</Btn>
            </div>
          ) : (
            <>
              {pwErr && (
                <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:16, border:`1px solid ${C.red}30` }}>
                  ⚠️ {pwErr}
                </div>
              )}
              <Inp label="현재 비밀번호 *" placeholder="현재 비밀번호 입력" value={pwForm.current} onChange={e => { setPwForm(p=>({...p,current:e.target.value})); setPwErr(""); }} type="password" />
              <Inp label="새 비밀번호 * (6자리 이상)" placeholder="새 비밀번호 입력" value={pwForm.next} onChange={e => { setPwForm(p=>({...p,next:e.target.value})); setPwErr(""); }} type="password" />
              <Inp label="새 비밀번호 확인 *" placeholder="새 비밀번호 재입력" value={pwForm.confirm} onChange={e => { setPwForm(p=>({...p,confirm:e.target.value})); setPwErr(""); }} type="password" />
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <Btn onClick={() => setShowPwModal(false)} color={C.muted} outline full>취소</Btn>
                <Btn onClick={changePw} color={C.blue} full disabled={pwLoading}>
                  {pwLoading ? "변경 중..." : "변경하기"}
                </Btn>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
