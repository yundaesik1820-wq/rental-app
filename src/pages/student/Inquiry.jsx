import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, PageTitle, Badge, Empty } from "../../components/UI";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";

const CATEGORIES = [
  { id: "일반 문의",     icon: "💬", desc: "대여 방법, 운영시간 등 일반적인 질문" },
  { id: "라이센스 문의", icon: "🎖️", desc: "라이센스 취득, 단계 변경 관련 문의"  },
  { id: "기타 문의",     icon: "📝", desc: "위 항목에 해당하지 않는 기타 문의"    },
];

const STATUS_COLOR = {
  "답변대기": C.yellow,
  "답변완료": C.green,
  "처리중":   C.blue,
};
const STATUS_BG = {
  "답변대기": C.yellowLight,
  "답변완료": C.greenLight,
  "처리중":   C.blueLight,
};

export default function Inquiry() {
  const { profile } = useAuth();
  const { data: inquiries } = useCollection("inquiries", "createdAt");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ category: "", title: "", content: "" });
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [selected, setSelected] = useState(null); // 상세보기

  const mine = inquiries.filter(i => i.studentId === profile?.studentId)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const f = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(p => ({ ...p, [key]: "" })); };

  const validate = () => {
    const errs = {};
    if (!form.category) errs.category = "문의 유형을 선택하세요";
    if (!form.title.trim())   errs.title   = "제목을 입력하세요";
    if (!form.content.trim()) errs.content = "내용을 입력하세요";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await addItem("inquiries", {
        studentId:   profile.studentId,
        studentName: profile.name,
        dept:        profile.dept    || "",
        phone:       profile.phone   || "",
        category:    form.category,
        title:       form.title.trim(),
        content:     form.content.trim(),
        status:      "답변대기",
        answer:      "",
      });
      setForm({ category: "", title: "", content: "" });
      setShowForm(false);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>💬 문의하기</PageTitle>
        <Btn onClick={() => { setShowForm(!showForm); setErrors({}); }} color={showForm ? C.muted : C.blue} outline={showForm}>
          {showForm ? "취소" : "+ 문의 작성"}
        </Btn>
      </div>

      {done && (
        <div style={{ background: C.greenLight, color: C.green, borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontWeight: 700, fontSize: 14, border: `1px solid ${C.green}30` }}>
          ✅ 문의가 접수됐어요! 관리자 확인 후 답변드릴게요.
        </div>
      )}

      {/* 문의 작성 폼 */}
      {showForm && (
        <Card style={{ marginBottom: 24, border: `2px solid ${C.blue}30` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>문의 작성</div>

          {/* 카테고리 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>문의 유형 *</div>
            <div style={{ display: "flex", gap: 10 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => f("category", cat.id)} style={{
                  flex: 1, padding: "12px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                  background: form.category === cat.id ? C.navy : C.bg,
                  color:      form.category === cat.id ? "#fff"  : C.muted,
                  border:     `1.5px solid ${form.category === cat.id ? C.navy : C.border}`,
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{cat.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{cat.id}</div>
                </button>
              ))}
            </div>
            {errors.category && <div style={{ color: C.red, fontSize: 11, marginTop: 6 }}>⚠️ {errors.category}</div>}
          </div>

          {/* 선택한 카테고리 설명 */}
          {form.category && (
            <div style={{ background: C.blueLight, borderRadius: 10, padding: "8px 14px", fontSize: 12, color: C.blue, marginBottom: 14 }}>
              {CATEGORIES.find(c => c.id === form.category)?.desc}
            </div>
          )}

          {/* 제목 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 5 }}>제목 *</div>
            <input
              placeholder="문의 제목을 입력하세요"
              value={form.title}
              onChange={e => f("title", e.target.value)}
              style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${errors.title ? C.red : C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
            {errors.title && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>⚠️ {errors.title}</div>}
          </div>

          {/* 내용 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 5 }}>내용 *</div>
            <textarea
              placeholder="문의 내용을 자세히 입력해주세요"
              value={form.content}
              onChange={e => f("content", e.target.value)}
              style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${errors.content ? C.red : C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 120, boxSizing: "border-box" }}
            />
            {errors.content && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>⚠️ {errors.content}</div>}
          </div>

          {/* 신청자 정보 자동입력 안내 */}
          <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: C.muted, marginBottom: 16 }}>
            📎 이름: <strong style={{ color: C.text }}>{profile?.name}</strong> · 학번: <strong style={{ color: C.text }}>{profile?.studentId}</strong> · 계열: <strong style={{ color: C.text }}>{profile?.dept}</strong> 로 접수됩니다
          </div>

          <Btn onClick={handleSubmit} color={C.blue} full disabled={submitting}>
            {submitting ? "접수 중..." : "📨 문의 접수"}
          </Btn>
        </Card>
      )}

      {/* 내 문의 목록 */}
      <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 12 }}>내 문의 내역 ({mine.length}건)</div>

      {mine.length === 0 && <Empty icon="💬" text="문의 내역이 없습니다" />}

      {mine.map(inq => {
        const cat = CATEGORIES.find(c => c.id === inq.category) || { icon: "📝" };
        return (
          <Card key={inq.id} onClick={() => setSelected(selected?.id === inq.id ? null : inq)} style={{ cursor: "pointer", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ background: C.bg, color: C.muted, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}` }}>{inq.category}</span>
                  <span style={{ background: STATUS_BG[inq.status] || C.bg, color: STATUS_COLOR[inq.status] || C.muted, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{inq.status}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{inq.title}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {inq.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || ""}
                </div>
              </div>
              <span style={{ fontSize: 18, color: C.muted, marginLeft: 8 }}>{selected?.id === inq.id ? "▲" : "▼"}</span>
            </div>

            {/* 상세 펼치기 */}
            {selected?.id === inq.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 14, background: C.bg, borderRadius: 10, padding: "10px 14px" }}>
                  {inq.content}
                </div>
                {inq.answer ? (
                  <div style={{ background: C.greenLight, borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${C.green}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 6 }}>✅ 관리자 답변</div>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{inq.answer}</div>
                  </div>
                ) : (
                  <div style={{ background: C.yellowLight, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400E" }}>
                    ⏳ 아직 답변이 등록되지 않았습니다. 잠시 기다려주세요.
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
