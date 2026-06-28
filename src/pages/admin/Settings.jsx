import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db } from "../../firebase";
import { auth } from "../../firebase";
import { C } from "../../theme";
import { Card, Btn, PageTitle } from "../../components/UI";
import { useAuth } from "../../hooks/useAuth.jsx";

const DEFAULTS = { maxDays: 7, maxSimultaneous: 2, startHour: 9, endHour: 18 };

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm]       = useState(DEFAULTS);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  // 비밀번호 변경
  const [pwForm, setPwForm]   = useState({ current: "", next: "", confirm: "" });
  const [pwMsg,  setPwMsg]    = useState(null); // { type: "success"|"error", text }
  const [pwLoading, setPwLoading] = useState(false);

  const changePassword = async () => {
    const { current, next, confirm } = pwForm;
    if (!current || !next || !confirm) return setPwMsg({ type:"error", text:"모든 항목을 입력해주세요." });
    if (next.length < 6)              return setPwMsg({ type:"error", text:"새 비밀번호는 6자 이상이어야 합니다." });
    if (next !== confirm)             return setPwMsg({ type:"error", text:"새 비밀번호가 일치하지 않습니다." });
    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setPwMsg({ type:"success", text:"비밀번호가 변경됐습니다!" });
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      const msg =
        e.code === "auth/wrong-password"    ? "현재 비밀번호가 틀렸습니다." :
        e.code === "auth/weak-password"     ? "비밀번호가 너무 간단합니다. 6자 이상으로 설정해주세요." :
        e.code === "auth/too-many-requests" ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." :
        "오류가 발생했습니다. 다시 시도해주세요.";
      setPwMsg({ type:"error", text: msg });
    } finally {
      setPwLoading(false);
      setTimeout(() => setPwMsg(null), 4000);
    }
  };

  useEffect(() => {
    getDoc(doc(db, "settings", "rules"))
      .then(snap => {
        if (snap.exists()) setForm({ ...DEFAULTS, ...snap.data() });
        setLoading(false);
      })
      .catch(() => setLoading(false)); // 권한 오류 등에서도 로딩 해제
  }, []);

  const save = async () => {
    await setDoc(doc(db, "settings", "rules"), { ...form, updatedAt: serverTimestamp() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ color: C.muted, padding: 40 }}>로딩 중...</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle>설정 · 대여 규칙</PageTitle>

      {saved && (
        <div style={{ background: C.greenLight, color: C.green, borderRadius: 12, padding: "12px 18px", marginBottom: 20, border: `1px solid ${C.green}30`, fontWeight: 700, fontSize: 14 }}>
          ✅ 설정이 저장됐습니다!
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>📅 최대 대여 기간</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[1, 3, 5, 7, 14].map(d => (
            <button key={d} onClick={() => setForm(p => ({ ...p, maxDays: d }))} style={{
              flex: 1, background: form.maxDays === d ? C.navy : C.bg,
              color: form.maxDays === d ? C.bg : C.muted,
              border: `1.5px solid ${form.maxDays === d ? C.navy : C.border}`,
              borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>{d}일</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>학생이 한 번에 대여할 수 있는 최대 기간</div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>🔢 동시 대여 최대 개수</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[1, 2, 3, 5].map(n => (
            <button key={n} onClick={() => setForm(p => ({ ...p, maxSimultaneous: n }))} style={{
              flex: 1, background: form.maxSimultaneous === n ? C.blue : C.bg,
              color: form.maxSimultaneous === n ? C.bg : C.muted,
              border: `1.5px solid ${form.maxSimultaneous === n ? C.blue : C.border}`,
              borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>{n}개</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>학생 1명이 동시에 빌릴 수 있는 최대 장비 수</div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>🕐 운영 시간</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>시작 시간</div>
            <select value={form.startHour} onChange={e => setForm(p => ({ ...p, startHour: +e.target.value }))}
              style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}>
              {[7,8,9,10].map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          <div style={{ color: C.muted, fontSize: 20, paddingTop: 20 }}>~</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>종료 시간</div>
            <select value={form.endHour} onChange={e => setForm(p => ({ ...p, endHour: +e.target.value }))}
              style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}>
              {[17,18,19,20,21,22].map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </div>
        <div style={{ background: C.blueLight, borderRadius: 10, padding: "10px 14px", marginTop: 14, fontSize: 13, color: C.blue }}>
          현재 설정: 평일 {form.startHour}:00 ~ {form.endHour}:00
        </div>
      </Card>

      <Btn onClick={save} color={C.navy} full>설정 저장</Btn>

      {/* 비밀번호 변경 */}
      <Card style={{ marginTop: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 18 }}>🔐 비밀번호 변경</div>

        {pwMsg && (
          <div style={{ background: pwMsg.type === "success" ? C.greenLight : C.redLight,
            color: pwMsg.type === "success" ? C.green : C.red,
            borderRadius: 10, padding: "10px 14px", marginBottom: 14,
            border: `1px solid ${pwMsg.type === "success" ? C.green : C.red}30`,
            fontWeight: 600, fontSize: 13 }}>
            {pwMsg.type === "success" ? "✅ " : "⚠️ "}{pwMsg.text}
          </div>
        )}

        {[
          { key: "current", label: "현재 비밀번호" },
          { key: "next",    label: "새 비밀번호 (6자 이상)" },
          { key: "confirm", label: "새 비밀번호 확인" },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</div>
            <input
              type="password"
              value={pwForm[key]}
              onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && changePassword()}
              placeholder={label}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`,
                borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13,
                fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
            />
          </div>
        ))}

        <Btn onClick={changePassword} color={C.purple} full disabled={pwLoading}>
          {pwLoading ? "변경 중..." : "🔐 비밀번호 변경"}
        </Btn>
      </Card>
    </div>
  );
}
