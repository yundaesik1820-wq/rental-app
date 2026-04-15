import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, PageTitle, Empty, Modal } from "../../components/UI";
import { useCollection, updateItem } from "../../hooks/useFirestore";

const CATEGORIES = ["전체", "일반 문의", "라이센스 문의", "기타 문의"];
const CAT_ICON   = { "일반 문의": "💬", "라이센스 문의": "🎖️", "기타 문의": "📝" };
const STATUS_COL = { "답변대기": C.yellow, "처리중": C.blue, "답변완료": C.green };
const STATUS_BG  = { "답변대기": C.yellowLight, "처리중": C.blueLight, "답변완료": C.greenLight };

export default function AdminInquiry() {
  const { data: inquiries } = useCollection("inquiries", "createdAt");

  const [filter, setFilter]   = useState("전체");
  const [target, setTarget]   = useState(null);  // 답변 작성 대상
  const [answer, setAnswer]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [selected, setSelected] = useState(null); // 상세보기

  const filtered = [...inquiries]
    .filter(i => filter === "전체" || i.category === filter)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const pending = inquiries.filter(i => i.status === "답변대기").length;

  const handleAnswer = async () => {
    if (!answer.trim()) return;
    setSaving(true);
    await updateItem("inquiries", target.id, { status: "답변완료", answer: answer.trim() });
    setSaving(false);
    setTarget(null);
    setAnswer("");
  };

  return (
    <div>
      <PageTitle>💬 문의 관리</PageTitle>

      {/* 대기 알림 */}
      {pending > 0 && (
        <div style={{ background: C.yellowLight, borderRadius: 14, padding: "14px 18px", marginBottom: 20, border: `1px solid ${C.yellow}40`, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 24 }}>💬</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>답변 대기 {pending}건</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>미답변 문의가 있습니다</div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? C.navy : C.surface, color: filter === c ? "#fff" : C.muted, border: `1px solid ${filter === c ? C.navy : C.border}`, borderRadius: 20, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 && <Empty icon="💬" text="문의가 없습니다" />}

      {filtered.map(inq => (
        <Card key={inq.id} style={{ marginBottom: 12, border: inq.status === "답변대기" ? `2px solid ${C.yellow}40` : `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              {/* 카테고리 + 상태 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18 }}>{CAT_ICON[inq.category] || "📝"}</span>
                <span style={{ background: C.bg, color: C.muted, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}` }}>{inq.category}</span>
                <span style={{ background: STATUS_BG[inq.status] || C.bg, color: STATUS_COL[inq.status] || C.muted, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{inq.status}</span>
              </div>
              {/* 제목 */}
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{inq.title}</div>
              {/* 신청자 정보 */}
              <div style={{ fontSize: 12, color: C.muted }}>
                👤 {inq.studentName} · {inq.studentId} · {inq.dept}
                {inq.phone && ` · ${inq.phone}`}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {inq.createdAt?.toDate?.()?.toLocaleString("ko-KR") || ""}
              </div>
            </div>

            {/* 버튼들 */}
            <div style={{ display: "flex", gap: 8, marginLeft: 12, flexShrink: 0 }}>
              <Btn onClick={() => setSelected(selected?.id === inq.id ? null : inq)} small color={C.muted} outline>
                {selected?.id === inq.id ? "닫기" : "상세보기"}
              </Btn>
              {inq.status !== "답변완료" && (
                <Btn onClick={() => { setTarget(inq); setAnswer(inq.answer || ""); }} small color={C.blue}>
                  ✏️ 답변
                </Btn>
              )}
              {inq.status === "답변완료" && (
                <Btn onClick={() => { setTarget(inq); setAnswer(inq.answer || ""); }} small color={C.green} outline>
                  수정
                </Btn>
              )}
            </div>
          </div>

          {/* 상세 */}
          {selected?.id === inq.id && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>문의 내용</div>
              <div style={{ background: C.bg, borderRadius: 10, padding: "12px 16px", fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 14 }}>
                {inq.content}
              </div>
              {inq.answer && (
                <div style={{ background: C.greenLight, borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${C.green}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 6 }}>✅ 등록된 답변</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{inq.answer}</div>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}

      {/* 답변 작성 모달 */}
      {target && (
        <Modal onClose={() => { setTarget(null); setAnswer(""); }} width={560}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 4 }}>✏️ 답변 작성</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{target.studentName} · {target.category}</div>

          {/* 문의 내용 요약 */}
          <div style={{ background: C.bg, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{target.title}</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{target.content}</div>
          </div>

          {/* 답변 입력 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>답변 내용 *</div>
            <textarea
              placeholder="답변을 입력하세요"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              autoFocus
              style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 140, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => { setTarget(null); setAnswer(""); }} color={C.muted} outline full>취소</Btn>
            <Btn onClick={handleAnswer} color={C.green} full disabled={saving || !answer.trim()}>
              {saving ? "저장 중..." : "✅ 답변 등록"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
