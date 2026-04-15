import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { C } from "../theme";
import { Btn, Inp } from "../components/UI";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]   = useState("");
  const [pw, setPw]         = useState("");
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pw) { setErr("이메일과 비밀번호를 입력하세요"); return; }
    setLoading(true); setErr("");
    try {
      await login(email, pw);
    } catch (e) {
      setErr("이메일 또는 비밀번호가 올바르지 않습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.navy} 0%, #2D4A9B 50%, ${C.teal} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.surface, borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🎓</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.navy }}>장비대여실</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>대학교 미디어센터 장비 관리 시스템</div>
        </div>

        {err && (
          <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16, border: `1px solid ${C.red}30` }}>
            ⚠️ {err}
          </div>
        )}

        <Inp label="이메일" placeholder="example@university.ac.kr" value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} type="email" />
        <Inp label="비밀번호" placeholder="비밀번호 입력" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }} type="password" />

        <div style={{ marginTop: 8 }}>
          <Btn onClick={handleLogin} color={C.navy} full disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Btn>
        </div>

        <div style={{ marginTop: 24, background: C.bg, borderRadius: 12, padding: "14px 16px", fontSize: 12, color: C.muted, lineHeight: 1.9 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4, fontSize: 13 }}>💡 계정 안내</div>
          <div>관리자 계정은 Firebase Console에서 생성하세요.</div>
          <div>학생 계정은 관리자가 학생 관리 탭에서 생성합니다.</div>
        </div>
      </div>
    </div>
  );
}
