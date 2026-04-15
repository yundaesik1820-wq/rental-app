import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { C } from "../../theme";
import { Card, Avatar, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, deleteItem } from "../../hooks/useFirestore";

export default function Students() {
  const { data: students } = useCollection("users", "name");
  const studentList = students.filter(s => s.role === "student");

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", studentId: "", dept: "", year: "", phone: "", email: "", pw: "" });

  const handleAdd = async () => {
    if (!form.name || !form.studentId || !form.email || !form.pw) { setErr("필수 항목을 입력하세요"); return; }
    setLoading(true); setErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.pw);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: form.name, studentId: form.studentId, dept: form.dept,
        year: +form.year, phone: form.phone, email: form.email,
        role: "student", rentals: 0, createdAt: serverTimestamp(),
      });
      setForm({ name: "", studentId: "", dept: "", year: "", phone: "", email: "", pw: "" });
      setShowAdd(false);
    } catch (e) {
      setErr("계정 생성 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = studentList.filter(s =>
    s.name?.includes(search) || s.studentId?.includes(search) || s.dept?.includes(search)
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>👥 학생 관리</PageTitle>
        <Btn onClick={() => setShowAdd(true)} color={C.purple}>+ 학생 등록</Btn>
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>학생 계정 등록</div>
          {err && <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}
          <Inp label="이름 *" placeholder="홍길동" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Inp label="학번 *" placeholder="20210001" value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))} />
          <Inp label="학과" placeholder="시각디자인학과" value={form.dept} onChange={e => setForm(p => ({ ...p, dept: e.target.value }))} />
          <Inp label="학년" placeholder="3" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} />
          <Inp label="연락처" placeholder="010-0000-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          <Inp label="이메일 (로그인용) *" placeholder="student@university.ac.kr" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email" />
          <Inp label="초기 비밀번호 *" placeholder="6자리 이상" value={form.pw} onChange={e => setForm(p => ({ ...p, pw: e.target.value }))} type="password" />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAdd} color={C.purple} full disabled={loading}>{loading ? "처리 중..." : "등록"}</Btn>
          </div>
        </Modal>
      )}

      <input placeholder="🔍 이름, 학번, 학과 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", maxWidth: 400, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 20, display: "block" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map(s => (
          <Card key={s.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={s.name || "?"} size={46} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.name}</span>
                  <span style={{ background: C.blueLight, color: C.blue, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{s.year}학년</span>
                </div>
                <div style={{ fontSize: 12, color: C.blue, fontWeight: 600, fontFamily: "monospace", marginTop: 3 }}>{s.studentId}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.dept}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.phone}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: C.navy }}>{s.rentals || 0}</div>
                <div style={{ fontSize: 10, color: C.muted }}>누적 대여</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && <Empty icon="👥" text="학생이 없습니다" />}
    </div>
  );
}
