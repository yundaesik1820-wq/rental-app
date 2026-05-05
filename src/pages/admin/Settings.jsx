import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { C } from "../../theme";
import { Card, Btn, PageTitle } from "../../components/UI";

const DEFAULTS = { maxDays: 7, maxSimultaneous: 2, startHour: 9, endHour: 18 };

export default function Settings() {
  const [form, setForm]       = useState(DEFAULTS);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

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
              color: form.maxDays === d ? "#fff" : C.muted,
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
              color: form.maxSimultaneous === n ? "#fff" : C.muted,
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
    </div>
  );
}
