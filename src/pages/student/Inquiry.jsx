import { useState, useMemo } from "react";
import { useCollection, addItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { INQ_CATEGORIES, normCat, catInfo } from "../../data/inquiryCategories";
import { ChevronDown, Search } from "lucide-react";

// 더보기 계열 다크 톤 (theme.js C는 모노톤이라 로컬 상수 — Profile.jsx 와 동일 계열)
// 액센트는 퍼플: 더보기 메뉴의 "문의하기" 타일 tint(#8b5cf6)가 이 화면의 대표색.
// (블루 #3b82f6 은 "내 정보" 화면 색이라 여기서 쓰면 메뉴↔화면 색이 어긋남)
const P = {
  card: "#121218",
  border: "rgba(255,255,255,0.07)",
  text: "#F1F5F9",
  sub: "#64748B",
  subLight: "#a8adc4",
  purple:     "#8b5cf6",
  purpleText: "#c4b5fd",
  purpleBg:   "rgba(139,92,246,0.13)",
  purpleBd:   "rgba(139,92,246,0.32)",
  red: "#f87171",
};

// 상태색은 History.jsx 의 PAL 값을 그대로 사용 (예약내역 배지와 같은 톤)
const STATUS = {
  "답변대기": { c: "#fcd34d", bg: "rgba(245,158,11,.16)" },
  "처리중":   { c: "#7fa9ff", bg: "rgba(59,130,246,.16)" },
  "답변완료": { c: "#5eead4", bg: "rgba(45,212,191,.16)" },
};
const AMBER = { fg: "#fcd34d", bg: "rgba(245,158,11,.16)", bd: "rgba(245,158,11,.3)" };
const TEAL  = { fg: "#5eead4", bg: "rgba(45,212,191,.16)", line: "#2DD4BF" };

// 제목/내용에서 2글자 이상 토큰을 뽑아 FAQ 질문·답변과 겹치는 개수로 점수
function relatedFaqs(text, faqs) {
  const tokens = (text || "").split(/[\s,.!?·\-()[\]]+/).filter(t => t.length >= 2);
  if (!tokens.length) return [];
  return faqs
    .map(f => {
      const hay = `${f.question} ${f.answer}`;
      return { f, score: tokens.filter(t => hay.includes(t)).length };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.f);
}

export default function Inquiry() {
  const { profile } = useAuth();
  const { data: inquiries } = useCollection("inquiries", "createdAt");
  const { data: faqs }      = useCollection("faqs", "createdAt");

  const [kw, setKw]           = useState("");
  const [cat, setCat]         = useState("전체");
  const [openFaq, setOpenFaq] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ category: "", title: "", content: "" });
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [selected, setSelected] = useState(null);

  // 관리자가 order 로 순서를 잡고, 없으면 최신순
  const sortedFaqs = useMemo(
    () => [...faqs].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [faqs]
  );

  const shownFaqs = useMemo(() => {
    const k = kw.trim();
    return sortedFaqs.filter(f => {
      if (cat !== "전체" && normCat(f.category) !== cat) return false;
      if (!k) return true;
      return `${f.question} ${f.answer}`.includes(k);
    });
  }, [sortedFaqs, cat, kw]);

  const mine = inquiries
    .filter(i => i.studentId === profile?.studentId)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const suggested = useMemo(
    () => (showForm ? relatedFaqs(`${form.title} ${form.content}`, sortedFaqs) : []),
    [showForm, form.title, form.content, sortedFaqs]
  );

  const f = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(p => ({ ...p, [key]: "" })); };

  const validate = () => {
    const errs = {};
    if (!form.category)       errs.category = "문의 유형을 선택하세요";
    if (!form.title.trim())   errs.title    = "제목을 입력하세요";
    if (!form.content.trim()) errs.content  = "내용을 입력하세요";
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
        dept:        profile.dept  || "",
        phone:       profile.phone || "",
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

  const cardStyle = { background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 };
  const inputStyle = (bad) => ({
    display: "block", width: "100%", boxSizing: "border-box", background: "#0B0B0E",
    border: `1.5px solid ${bad ? P.red : P.border}`, borderRadius: 10, color: P.text,
    padding: "11px 14px", fontSize: 14, fontFamily: "inherit", outline: "none",
  });

  return (
    <div style={{ maxWidth: 720 }}>
      {done && (
        <div style={{ background: TEAL.bg, color: TEAL.fg, borderRadius: 12, padding: "13px 16px", marginBottom: 12, fontWeight: 700, fontSize: 13.5, border: `1px solid rgba(45,212,191,.3)` }}>
          ✅ 문의가 접수됐어요! 관리자 확인 후 답변드릴게요.
        </div>
      )}

      {/* ── 검색 ── */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={16} color={P.sub} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input
          value={kw}
          onChange={e => { setKw(e.target.value); setOpenFaq(null); }}
          placeholder="궁금한 걸 검색해보세요"
          style={{ ...inputStyle(false), background: P.card, paddingLeft: 38, borderRadius: 12 }}
        />
      </div>

      {/* ── 카테고리 칩 ── */}
      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, marginBottom: 12, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {["전체", ...INQ_CATEGORIES.map(c => c.id)].map(id => {
          const on = cat === id;
          const label = id === "전체" ? "전체" : catInfo(id).short;
          return (
            <button key={id} onClick={() => { setCat(id); setOpenFaq(null); }}
              style={{
                flexShrink: 0, minHeight: 0, padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                background: on ? P.purple : P.card, color: on ? "#fff" : P.subLight,
                border: `1px solid ${on ? P.purple : P.border}`, transition: "all .15s",
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── FAQ 아코디언 ── */}
      <div style={{ fontSize: 13, fontWeight: 800, color: P.text, marginBottom: 8 }}>
        자주 묻는 질문 {shownFaqs.length > 0 && <span style={{ color: P.sub, fontWeight: 600 }}>({shownFaqs.length})</span>}
      </div>

      {shownFaqs.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "26px 16px", color: P.sub, fontSize: 13 }}>
          {kw.trim() ? `"${kw.trim()}" 에 대한 답변을 찾지 못했어요` : "등록된 질문이 없어요"}
        </div>
      )}

      {shownFaqs.map(faq => {
        const on = openFaq === faq.id;
        return (
          <div key={faq.id} style={{ ...cardStyle, padding: 0, marginBottom: 8, overflow: "hidden" }}>
            <button onClick={() => setOpenFaq(on ? null : faq.id)}
              style={{
                width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
                padding: "14px 16px", textAlign: "left",
              }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{catInfo(faq.category).icon}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.text, lineHeight: 1.45 }}>{faq.question}</span>
              <ChevronDown size={17} color={P.sub} style={{ flexShrink: 0, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {on && (
              <div style={{ padding: "0 16px 15px 41px", fontSize: 13, color: P.subLight, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}

      {/* ── 못 찾았을 때 → 문의 작성 ── */}
      <div style={{ ...cardStyle, marginTop: 14, textAlign: "center", padding: "18px 16px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: P.text, marginBottom: 3 }}>원하는 답을 못 찾으셨나요?</div>
        <div style={{ fontSize: 11.5, color: P.sub, marginBottom: 13 }}>직접 문의를 남기면 관리자가 답변해드려요</div>
        <button onClick={() => { setShowForm(!showForm); setErrors({}); }}
          style={{
            width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 12, cursor: "pointer",
            fontFamily: "inherit", fontSize: 14, fontWeight: 700,
            background: showForm ? "transparent" : P.purpleBg,
            color: showForm ? P.sub : P.purpleText,
            border: `1.5px solid ${showForm ? P.border : P.purpleBd}`,
          }}>
          {showForm ? "작성 취소" : "+ 문의 작성"}
        </button>
      </div>

      {/* ── 문의 작성 폼 ── */}
      {showForm && (
        <div style={{ ...cardStyle, border: `1.5px solid ${P.purpleBd}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: P.text, marginBottom: 14 }}>문의 작성</div>

          {/* 유형 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: P.subLight, marginBottom: 7 }}>문의 유형 *</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: errors.category ? 5 : 14 }}>
            {INQ_CATEGORIES.map(c => {
              const on = form.category === c.id;
              return (
                <button key={c.id} onClick={() => f("category", c.id)}
                  style={{
                    minHeight: 0, padding: "8px 13px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                    fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                    background: on ? P.purple : "#0B0B0E", color: on ? "#fff" : P.subLight,
                    border: `1.5px solid ${on ? P.purple : P.border}`, transition: "all .15s",
                  }}>
                  {c.icon} {c.short}
                </button>
              );
            })}
          </div>
          {errors.category && <div style={{ color: P.red, fontSize: 11, marginBottom: 12 }}>⚠️ {errors.category}</div>}

          {form.category && (
            <div style={{ background: P.purpleBg, borderRadius: 10, padding: "8px 13px", fontSize: 11.5, color: P.purpleText, marginBottom: 12 }}>
              {catInfo(form.category).desc}
            </div>
          )}

          {/* 제목 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: P.subLight, marginBottom: 6 }}>제목 *</div>
          <input value={form.title} onChange={e => f("title", e.target.value)} placeholder="문의 제목을 입력하세요" style={inputStyle(errors.title)} />
          {errors.title && <div style={{ color: P.red, fontSize: 11, marginTop: 4 }}>⚠️ {errors.title}</div>}

          {/* 내용 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: P.subLight, margin: "12px 0 6px" }}>내용 *</div>
          <textarea value={form.content} onChange={e => f("content", e.target.value)} placeholder="문의 내용을 자세히 입력해주세요"
            style={{ ...inputStyle(errors.content), resize: "vertical", minHeight: 110 }} />
          {errors.content && <div style={{ color: P.red, fontSize: 11, marginTop: 4 }}>⚠️ {errors.content}</div>}

          {/* 관련 FAQ 자동 추천 — 중복 문의를 줄이는 핵심 */}
          {suggested.length > 0 && (
            <div style={{ background: AMBER.bg, border: `1px solid ${AMBER.bd}`, borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: AMBER.fg, marginBottom: 8 }}>💡 혹시 이 답변을 찾으시나요?</div>
              {suggested.map(faq => {
                const on = openFaq === `s_${faq.id}`;
                return (
                  <div key={faq.id} style={{ marginBottom: 6 }}>
                    <button onClick={() => setOpenFaq(on ? null : `s_${faq.id}`)}
                      style={{ width: "100%", boxSizing: "border-box", minHeight: 0, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "3px 0", fontSize: 12.5, fontWeight: 700, color: P.text, lineHeight: 1.5 }}>
                      {on ? "▾" : "▸"} {faq.question}
                    </button>
                    {on && (
                      <div style={{ fontSize: 12, color: P.subLight, lineHeight: 1.7, whiteSpace: "pre-wrap", padding: "4px 0 4px 14px" }}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ background: "#0B0B0E", borderRadius: 10, padding: "10px 13px", fontSize: 11.5, color: P.sub, margin: "14px 0" }}>
            📎 <strong style={{ color: P.subLight }}>{profile?.name}</strong> · {profile?.studentId} · {profile?.dept} 로 접수됩니다
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 12,
              cursor: submitting ? "default" : "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              background: P.purple, color: "#fff", border: "none", opacity: submitting ? 0.6 : 1,
            }}>
            {submitting ? "접수 중..." : "📨 문의 접수"}
          </button>
        </div>
      )}

      {/* ── 내 문의 내역 ── */}
      <div style={{ fontSize: 13, fontWeight: 800, color: P.text, margin: "20px 0 8px" }}>
        내 문의 내역 <span style={{ color: P.sub, fontWeight: 600 }}>({mine.length}건)</span>
      </div>

      {mine.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "24px 16px", color: P.sub, fontSize: 13 }}>
          아직 남긴 문의가 없어요
        </div>
      )}

      {mine.map(inq => {
        const on = selected === inq.id;
        const st = STATUS[inq.status] || { c: P.sub, bg: "rgba(255,255,255,0.05)" };
        return (
          <div key={inq.id} style={{ ...cardStyle, marginBottom: 8, cursor: "pointer" }} onClick={() => setSelected(on ? null : inq.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14 }}>{catInfo(inq.category).icon}</span>
                  <span style={{ background: "rgba(255,255,255,0.05)", color: P.sub, borderRadius: 6, padding: "2px 7px", fontSize: 10.5, fontWeight: 600 }}>{normCat(inq.category)}</span>
                  <span style={{ background: st.bg, color: st.c, borderRadius: 6, padding: "2px 7px", fontSize: 10.5, fontWeight: 800 }}>{inq.status}</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.text, lineHeight: 1.45 }}>{inq.title}</div>
                <div style={{ fontSize: 11, color: P.sub, marginTop: 4 }}>
                  {inq.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || ""}
                </div>
              </div>
              <ChevronDown size={17} color={P.sub} style={{ flexShrink: 0, marginTop: 2, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </div>

            {on && (
              <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${P.border}` }}>
                <div style={{ background: "#0B0B0E", borderRadius: 10, padding: "11px 14px", fontSize: 12.5, color: P.subLight, lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 11 }}>
                  {inq.content}
                </div>
                {inq.answer ? (
                  <div style={{ background: TEAL.bg, borderRadius: 10, padding: "11px 14px", borderLeft: `3px solid ${TEAL.line}` }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: TEAL.fg, marginBottom: 5 }}>✅ 관리자 답변</div>
                    <div style={{ fontSize: 12.5, color: P.text, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{inq.answer}</div>
                  </div>
                ) : (
                  <div style={{ background: AMBER.bg, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: AMBER.fg }}>
                    ⏳ 아직 답변이 등록되지 않았어요. 조금만 기다려주세요.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
