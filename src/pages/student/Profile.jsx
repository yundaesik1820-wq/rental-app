import { useState, useRef, useEffect } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";
import { ref as sRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, storage } from "../../firebase";
import { C, setTheme, getThemeMode } from "../../theme";
import { Avatar, Btn, Inp, Modal } from "../../components/UI";
import { useCollection, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { Award, Pencil } from "lucide-react";

// 더보기 페이지와 동일한 블루·퍼플 다크 톤 (theme.js C는 모노톤이라 로컬 상수 — 2026-07-19 블루 리디자인 계열)
const P = {
  card: "#121218",
  border: "rgba(255,255,255,0.07)",
  text: "#F1F5F9",
  sub: "#64748B",
  subLight: "#a8adc4",
  blue: "#3b82f6",
  blueText: "#60a5fa",
  blueBg: "rgba(59,130,246,0.13)",
  teal: "#2dd4bf",
  tealBg: "rgba(45,212,191,0.13)",
  purpleLight: "#a78bfa",
  purpleBg: "rgba(124,58,237,0.13)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.12)",
};

// 프로필 사진 크롭 모달 — 원형 미리보기 안에서 드래그로 위치, 슬라이더로 확대. 확인해야 반영.
function PhotoCropModal({ src, onCancel, onConfirm, busy }) {
  const D = 240; // 미리보기 원 지름
  const [img, setImg]   = useState(null);          // { el, w, h }
  const [zoom, setZoom] = useState(1);             // 1(꽉 채움) ~ 3배
  const [off, setOff]   = useState({ x: 0, y: 0 }); // 원 중심 기준 이미지 이동량(px)
  const drag = useRef(null);

  useEffect(() => {
    const el = new Image();
    el.onload = () => { setImg({ el, w: el.naturalWidth, h: el.naturalHeight }); setZoom(1); setOff({ x: 0, y: 0 }); };
    el.src = src;
  }, [src]);

  const minScale = img ? D / Math.min(img.w, img.h) : 1; // 원을 빈틈없이 덮는 최소 배율
  const scale = minScale * zoom;

  // 이미지 가장자리가 원 안으로 들어오지 않게 이동량 제한
  const clamp = (o, z = scale) => {
    if (!img) return { x: 0, y: 0 };
    const mx = Math.max(0, (img.w * z - D) / 2);
    const my = Math.max(0, (img.h * z - D) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  };

  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (drag.current) setOff(clamp({ x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy })); };
  const onUp   = () => { drag.current = null; };
  const onZoom = (z) => { setZoom(z); setOff(o => clamp(o, minScale * z)); };

  // 미리보기 원과 동일한 영역을 512px 정사각으로 잘라 JPEG 추출
  const confirm = () => {
    if (!img || busy) return;
    const S = 512;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const sw = D / scale;
    const sx = img.w / 2 - off.x / scale - sw / 2;
    const sy = img.h / 2 - off.y / scale - sw / 2;
    cv.getContext("2d").drawImage(img.el, sx, sy, sw, sw, 0, 0, S, S);
    cv.toBlob(b => b && onConfirm(b), "image/jpeg", 0.85);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(92vw, 360px)", background: "#17171C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "22px 20px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: P.text, marginBottom: 6 }}>프로필 사진 조정</div>
        <div style={{ fontSize: 12, color: P.sub, marginBottom: 16 }}>드래그로 위치를 맞추고 슬라이더로 확대해보세요</div>

        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ width: D, height: D, borderRadius: "50%", overflow: "hidden", position: "relative", margin: "0 auto",
            touchAction: "none", cursor: "grab", background: "#000", border: "2px solid rgba(124,58,237,0.5)", boxShadow: "0 0 24px rgba(124,58,237,0.25)" }}>
          {img && (
            <img src={src} alt="" draggable={false}
              style={{ position: "absolute", maxWidth: "none", pointerEvents: "none",
                left: D / 2 + off.x - img.w * scale / 2, top: D / 2 + off.y - img.h * scale / 2,
                width: img.w * scale, height: img.h * scale }} />
          )}
        </div>

        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => onZoom(Number(e.target.value))}
          style={{ width: "100%", marginTop: 18, accentColor: "#7c3aed" }} />

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} disabled={busy}
            style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${P.border}`, background: "none", color: P.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            취소
          </button>
          <button onClick={confirm} disabled={busy || !img}
            style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#3b82f6,#7c3aed)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
            {busy ? "업로드 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { profile, setProfile, logout } = useAuth();
  // 🗑️ 회원 탈퇴(계정 삭제)
  const [showDelete, setShowDelete] = useState(false);
  const [delPw, setDelPw]   = useState("");
  const [delErr, setDelErr] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const handleDeleteAccount = async () => {
    if (!delPw) { setDelErr("비밀번호를 입력해주세요."); return; }
    setDelBusy(true); setDelErr("");
    try {
      // 보안을 위해 재인증 후 삭제
      const cred = EmailAuthProvider.credential(auth.currentUser.email, delPw);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await deleteItem("users", profile.uid);   // Firestore 프로필 삭제
      await deleteUser(auth.currentUser);        // Firebase 계정 삭제 → onAuthStateChanged가 자동 로그아웃
      alert("회원 탈퇴가 완료되었어요. 그동안 이용해주셔서 감사합니다.");
    } catch (e) {
      setDelBusy(false);
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setDelErr("비밀번호가 올바르지 않아요.");
      } else if (e.code === "auth/requires-recent-login") {
        setDelErr("보안을 위해 다시 로그인한 뒤 탈퇴를 진행해주세요.");
        setTimeout(() => logout(), 1800);
      } else {
        setDelErr("탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    }
  };
  const [showPwModal,    setShowPwModal]    = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneForm,      setPhoneForm]      = useState("");
  const [phoneDone,      setPhoneDone]      = useState(false);
  const [phoneErr,       setPhoneErr]       = useState("");
  const [themeMode,      setThemeModeState] = useState(getThemeMode());
  const [ttPublic,       setTtPublic]       = useState(profile?.timetablePublic !== false);

  // 📷 프로필 사진 변경 — 파일 선택 → 크롭 모달 → 확인 시 Storage 업로드 + photoURL 저장
  const fileRef = useRef(null);
  const [cropSrc,   setCropSrc]   = useState(null); // object URL
  const [photoBusy, setPhotoBusy] = useState(false);
  const onPickPhoto = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (f) setCropSrc(URL.createObjectURL(f));
  };
  const closeCrop = () => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); };
  const savePhoto = async (blob) => {
    setPhotoBusy(true);
    try {
      const storageRef = sRef(storage, `profile-photos/${profile.uid}.jpg`);
      const task = uploadBytesResumable(storageRef, blob);
      await task;
      const url = await getDownloadURL(task.snapshot.ref);
      await updateItem("users", profile.uid, { photoURL: url });
      setProfile(p => ({ ...p, photoURL: url })); // 더보기 히어로 등에 즉시 반영
      closeCrop();
    } catch (e) {
      alert("사진 업로드에 실패했어요: " + e.message);
    }
    setPhotoBusy(false);
  };

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
    if (!profile.license || profile.license === "없음") return { bg: "rgba(255,255,255,0.06)", col: P.sub };
    if (profile.license === "1단계") return { bg: P.blueBg,   col: P.blueText     };
    if (profile.license === "2단계") return { bg: P.tealBg,   col: P.teal         };
    if (profile.license === "3단계") return { bg: P.purpleBg, col: P.purpleLight  };
    return { bg: "rgba(255,255,255,0.06)", col: P.sub };
  };
  const lc = licenseColor();

  const cardStyle = { background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 12 };

  return (
    <div style={{ maxWidth: 560 }}>
      {/* 프로필 히어로 — 더보기 페이지와 동일한 퍼플 그라데이션 + 글로우 링 아바타 */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: "26px 20px", marginBottom: 16, textAlign: "center",
        background: "linear-gradient(135deg,#1a1f3d 0%,#241a3d 55%,#12101f 100%)", border: "1px solid rgba(124,58,237,0.3)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.28), transparent 70%)" }} />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <div style={{ padding: 3, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#7c3aed)", boxShadow: "0 0 20px rgba(124,58,237,0.45)" }}>
              <Avatar name={profile.name || "?"} size={78} src={profile.photoURL} />
            </div>
            {/* 사진 변경 연필 — width=height+padding:0 고정으로 완전한 원 (전역 button 스타일 영향 차단) */}
            <button onClick={() => fileRef.current?.click()} aria-label="프로필 사진 변경"
              style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, minWidth: 26, padding: 0, boxSizing: "border-box", lineHeight: 0,
                borderRadius: "50%", background: "#2a2a3d", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Pencil size={12} color="#c7c9d4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickPhoto} />
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", position: "relative" }}>{profile.name}</div>
        <div style={{ fontSize: 13.5, color: P.subLight, marginTop: 5, position: "relative" }}>{profile.dept}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap", position: "relative" }}>
          <div style={{ background: P.blueBg, color: P.blueText, borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
            {profile.studentId}
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", color: P.subLight, borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 600 }}>
            {admYear}
          </div>
        </div>
      </div>

      {/* 라이선스 카드 - 교수님은 숨김 */}
      {profile.role !== "professor" && (
        <div style={{ ...cardStyle, border: `1px solid rgba(124,58,237,0.35)` }}>
          <div style={{ fontSize: 13, color: P.sub, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Award size={14} color={P.purpleLight} /> 장비 사용 라이선스</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: lc.bg, color: lc.col, borderRadius: 8, padding: "6px 16px", fontSize: 16, fontWeight: 800 }}>
              {profile.license || "없음"}
            </span>
            {(!profile.license || profile.license === "없음") && (
              <span style={{ fontSize: 12, color: P.sub }}>관리자 승인 후 등록됩니다</span>
            )}
          </div>
        </div>
      )}

      {/* 계정 정보 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: P.text, marginBottom: 10 }}>계정 정보</div>
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
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${P.border}` }}>
            <span style={{ fontSize: 14, color: P.sub }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{v}</span>
          </div>
        ))}
      </div>

      <button onClick={() => { setShowPwModal(true); setPwErr(""); setPwDone(false); }}
        style={{ width: "100%", background: P.blueBg, color: P.blueText, border: `1.5px solid rgba(59,130,246,0.3)`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
        🔒 비밀번호 변경
      </button>

      <button onClick={() => { setShowPhoneModal(true); setPhoneForm(profile?.phone||""); setPhoneErr(""); setPhoneDone(false); }}
        style={{ width: "100%", background: P.tealBg, color: P.teal, border: `1.5px solid rgba(45,212,191,0.3)`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
        📱 전화번호 변경
      </button>

      {/* 시간표 공개 설정 */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:P.text, marginBottom:2 }}>🗓️ 시간표 공개</div>
            <div style={{ fontSize:11, color:P.sub }}>다른 학생이 내 시간표를 볼 수 있어요</div>
          </div>
          <button onClick={async () => {
            const next = !ttPublic;
            setTtPublic(next);
            await updateItem("users", profile.uid, { timetablePublic: next });
          }}
            style={{ width:44, height:24, borderRadius:12, border:"none", cursor:"pointer", background:ttPublic?P.blue:"#2A2A31", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:ttPublic?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
      </div>

      {/* 테마 설정 */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 10 }}>🎨 화면 테마</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleTheme("dark")}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${themeMode === "dark" ? "#60A5FA" : P.border}`, background: themeMode === "dark" ? "#1E3A5F" : "transparent", color: themeMode === "dark" ? "#60A5FA" : P.sub, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            🌙 다크 모드
          </button>
          <button onClick={() => handleTheme("light")}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${themeMode === "light" ? "#1B2B6B" : P.border}`, background: themeMode === "light" ? "#EEF2FF" : "transparent", color: themeMode === "light" ? "#1B2B6B" : P.sub, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ☀️ 라이트 모드
          </button>
        </div>
      </div>

      <button
        onClick={() => window.open("https://rental-app-delta-kohl.vercel.app/privacy.html", "_blank")}
        style={{ width: "100%", background: P.card, color: P.sub, border: `1px solid ${P.border}`, borderRadius: 12, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
        개인정보처리방침
      </button>

      <button onClick={logout} style={{ width: "100%", background: P.redBg, color: P.red, border: `1.5px solid rgba(248,113,113,0.3)`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        로그아웃
      </button>

      <button onClick={() => { setShowDelete(true); setDelPw(""); setDelErr(""); }}
        style={{ width: "100%", background: "none", color: P.sub, border: "none", padding: "14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", marginTop: 6, opacity: 0.85 }}>
        회원 탈퇴
      </button>

      {/* 📷 프로필 사진 크롭 모달 */}
      {cropSrc && (
        <PhotoCropModal src={cropSrc} busy={photoBusy}
          onCancel={() => { if (!photoBusy) closeCrop(); }}
          onConfirm={savePhoto} />
      )}

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

      {/* 🗑️ 회원 탈퇴 모달 */}
      {showDelete && (
        <Modal onClose={() => { setShowDelete(false); setDelPw(""); setDelErr(""); }} width={420}>
          <div style={{ fontSize:17, fontWeight:800, color:C.red, marginBottom:12 }}>회원 탈퇴</div>
          <div style={{ fontSize:13, color:C.muted, lineHeight:1.6, marginBottom:18 }}>
            탈퇴하면 계정과 프로필 정보가 <b style={{ color:C.text }}>영구적으로 삭제</b>되며 복구할 수 없어요. 계속하려면 비밀번호를 입력해주세요.
          </div>
          {delErr && (
            <div style={{ background:C.redLight, color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:16, border:`1px solid ${C.red}30` }}>
              ⚠️ {delErr}
            </div>
          )}
          <Inp label="비밀번호 확인" placeholder="비밀번호 입력" value={delPw} onChange={e => { setDelPw(e.target.value); setDelErr(""); }} type="password" />
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn onClick={() => { setShowDelete(false); setDelPw(""); setDelErr(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleDeleteAccount} color={C.red} full disabled={delBusy}>
              {delBusy ? "처리 중..." : "탈퇴하기"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
