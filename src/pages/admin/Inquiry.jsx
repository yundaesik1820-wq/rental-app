import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, PageTitle, Empty, Modal } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { INQ_CATEGORIES, normCat, catIcon, catFilterList } from "../../data/inquiryCategories";
import { FAQ_SEED } from "../../data/faqSeed";

const STATUS_COL = { "답변대기": C.yellow, "처리중": C.blue, "답변완료": C.green };
const STATUS_BG  = { "답변대기": C.yellowLight, "처리중": C.blueLight, "답변완료": C.greenLight };

export default function AdminInquiry() {
  const { data: inquiries } = useCollection("inquiries", "createdAt");

  const [mode, setMode]       = useState("inquiry"); // inquiry | faq
  const [filter, setFilter]   = useState("전체");
  const [target, setTarget]   = useState(null);  // 답변 작성 대상
  const [answer, setAnswer]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [selected, setSelected] = useState(null); // 상세보기

  const filtered = [...inquiries]
    .filter(i => filter === "전체" || normCat(i.category) === filter)
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

      {/* 문의 답변 / FAQ 관리 전환 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["inquiry", `💬 문의 답변${pending ? ` (${pending})` : ""}`], ["faq", "❓ FAQ 관리"]].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} style={{
            flex: 1, boxSizing: "border-box", padding: "11px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700,
            background: mode === id ? C.navy : C.surface,
            color:      mode === id ? C.bg   : C.muted,
            border: `1.5px solid ${mode === id ? C.navy : C.border}`,
          }}>{label}</button>
        ))}
      </div>

      {mode === "faq" && <FaqManager />}

      {mode === "inquiry" && <>
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
        {catFilterList(inquiries).map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? C.navy : C.surface, color: filter === c ? C.bg : C.muted, border: `1px solid ${filter === c ? C.navy : C.border}`, borderRadius: 20, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 && <Empty icon="💬" text="문의가 없습니다" />}

      {filtered.map(inq => (
        <Card key={inq.id} style={{ marginBottom: 12, border: inq.status === "답변대기" ? `2px solid ${C.yellow}40` : `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              {/* 카테고리 + 상태 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18 }}>{catIcon(inq.category)}</span>
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
      </>}

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

// ─────────────────────────────────────────────────────────
// FAQ 관리 — 학생 문의 화면 상단에 노출되는 자주 묻는 질문
// order 오름차순으로 정렬(값 없으면 뒤로). ▲▼ 로 인접 항목과 order 를 맞바꿈.
// ─────────────────────────────────────────────────────────
const EMPTY_FAQ = { category: INQ_CATEGORIES[0].id, question: "", answer: "" };

function FaqManager() {
  const { data: faqs } = useCollection("faqs", "createdAt");
  const [edit, setEdit]     = useState(null);   // { id?, category, question, answer }
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const sorted = [...faqs].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const save = async () => {
    if (!edit.question.trim() || !edit.answer.trim()) return;
    setSaving(true);
    try {
      const payload = {
        category: edit.category,
        question: edit.question.trim(),
        answer:   edit.answer.trim(),
      };
      if (edit.id) await updateItem("faqs", edit.id, payload);
      else         await addItem("faqs", { ...payload, order: sorted.length });
      setEdit(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // 인접 항목과 order 교환 — order 가 비어 있던 문서도 현재 인덱스로 채워짐
  const move = async (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= sorted.length) return;
    const a = sorted[idx], b = sorted[to];
    await Promise.all([
      updateItem("faqs", a.id, { order: to }),
      updateItem("faqs", b.id, { order: idx }),
    ]);
  };

  const seed = async () => {
    setSeeding(true);
    try {
      for (let i = 0; i < FAQ_SEED.length; i++) {
        await addItem("faqs", { ...FAQ_SEED[i], order: sorted.length + i });
      }
    } catch (e) { console.error(e); }
    finally { setSeeding(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          학생 문의 화면 맨 위에 노출됩니다 · 총 {sorted.length}개
        </div>
        <Btn onClick={() => setEdit({ ...EMPTY_FAQ })} color={C.blue} small>+ FAQ 추가</Btn>
      </div>

      {sorted.length === 0 && (
        <Card style={{ textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>❓</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>등록된 FAQ가 없습니다</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.7 }}>
            대여·반납·라이선스·계정 기본 질문 {FAQ_SEED.length}개를 한 번에 등록할 수 있어요.<br />
            등록 후 내용은 자유롭게 수정하세요.
          </div>
          <Btn onClick={seed} color={C.blue} disabled={seeding}>
            {seeding ? "등록 중..." : `📥 기본 FAQ ${FAQ_SEED.length}개 불러오기`}
          </Btn>
        </Card>
      )}

      {sorted.map((faq, idx) => (
        <Card key={faq.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {/* 순서 이동 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              {[["▲", -1, idx === 0], ["▼", 1, idx === sorted.length - 1]].map(([sym, dir, off]) => (
                <button key={sym} onClick={() => move(idx, dir)} disabled={off}
                  style={{ width: 26, height: 22, minHeight: 22, padding: 0, boxSizing: "border-box", borderRadius: 6, cursor: off ? "default" : "pointer", fontFamily: "inherit", fontSize: 10, background: C.bg, color: off ? C.border : C.muted, border: `1px solid ${C.border}` }}>
                  {sym}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15 }}>{catIcon(faq.category)}</span>
                <span style={{ background: C.bg, color: C.muted, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}` }}>{normCat(faq.category)}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 5, lineHeight: 1.45 }}>{faq.question}</div>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{faq.answer}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <Btn onClick={() => setEdit({ id: faq.id, category: normCat(faq.category), question: faq.question, answer: faq.answer })} small color={C.blue} outline>수정</Btn>
              <Btn onClick={() => setConfirmDel(faq)} small color={C.red} outline>삭제</Btn>
            </div>
          </div>
        </Card>
      ))}

      {/* 추가 · 수정 모달 */}
      {edit && (
        <Modal onClose={() => setEdit(null)} width={560}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 16 }}>
            {edit.id ? "✏️ FAQ 수정" : "➕ FAQ 추가"}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 7 }}>카테고리 *</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
            {INQ_CATEGORIES.map(c => {
              const on = edit.category === c.id;
              return (
                <button key={c.id} onClick={() => setEdit(p => ({ ...p, category: c.id }))}
                  style={{ padding: "8px 13px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", background: on ? C.navy : C.bg, color: on ? C.bg : C.muted, border: `1.5px solid ${on ? C.navy : C.border}` }}>
                  {c.icon} {c.short}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>질문 *</div>
          <input
            value={edit.question}
            onChange={e => setEdit(p => ({ ...p, question: e.target.value }))}
            placeholder="예약은 며칠 전에 신청해야 하나요?"
            autoFocus
            style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 14 }}
          />

          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>답변 *</div>
          <textarea
            value={edit.answer}
            onChange={e => setEdit(p => ({ ...p, answer: e.target.value }))}
            placeholder="줄바꿈은 그대로 학생 화면에 표시됩니다"
            style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 150, boxSizing: "border-box", marginBottom: 18 }}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setEdit(null)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={save} color={C.green} full disabled={saving || !edit.question.trim() || !edit.answer.trim()}>
              {saving ? "저장 중..." : "✅ 저장"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* 삭제 확인 */}
      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} width={420}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 10 }}>FAQ 삭제</div>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7, marginBottom: 18 }}>
            "{confirmDel.question}"<br />
            <span style={{ color: C.muted, fontSize: 12.5 }}>삭제하면 되돌릴 수 없습니다.</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setConfirmDel(null)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={async () => { await deleteItem("faqs", confirmDel.id); setConfirmDel(null); }} color={C.red} full>삭제</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
