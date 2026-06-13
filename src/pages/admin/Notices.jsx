import { useState } from "react";
import { C, NOTICE_CAT } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle, Avatar } from "../../components/UI";
import { useCollection, addItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function Notices({ isAdmin = true }) {
  const { profile } = useAuth();
  const { data: notices }  = useCollection("notices", "createdAt");
  const { data: comments } = useCollection("noticeComments", "createdAt");

  const [showAdd, setShowAdd]   = useState(false);
  const [detail, setDetail]     = useState(null);
  const [form, setForm]         = useState({ title: "", content: "", category: "공지", pinned: true, sendAlert: false, popup: false });
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  // 푸시 알림 보내기 (관리자 수동 발송)
  const [showSend, setShowSend]     = useState(false);
  const [alertForm, setAlertForm]   = useState({ target: "all", studentId: "", title: "", body: "" });
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // 오늘의 퀴즈 등록
  const [showQuiz, setShowQuiz]   = useState(false);
  const [quizDate, setQuizDate]   = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });
  const [quizQ, setQuizQ]         = useState("");
  const [quizOpts, setQuizOpts]   = useState(["","","","",""]);
  const [quizAns, setQuizAns]     = useState(0);
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizMsg, setQuizMsg]     = useState(null);

  const saveQuiz = async () => {
    if (!quizQ.trim()) { setQuizMsg({ ok:false, m:"문제를 입력하세요" }); return; }
    if (quizOpts.some(o => !o.trim())) { setQuizMsg({ ok:false, m:"보기 5개를 모두 입력하세요" }); return; }
    setQuizSaving(true); setQuizMsg(null);
    try {
      await setDoc(doc(db, "quizzes", quizDate), {
        question: quizQ.trim(),
        options: quizOpts.map(o => o.trim()),
        answer: quizAns,
        date: quizDate,
      });
      setQuizMsg({ ok:true, m:"✅ 등록 완료! 학생들이 오늘 이 문제를 풀 수 있어요" });
      setQuizQ(""); setQuizOpts(["","","","",""]); setQuizAns(0);
    } catch (e) {
      setQuizMsg({ ok:false, m:"등록 실패: " + (e.message || "오류") });
    }
    setQuizSaving(false);
  };

  const loadQuizForDate = async (date) => {
    try {
      const snap = await getDoc(doc(db, "quizzes", date));
      if (snap.exists()) {
        const q = snap.data();
        setQuizQ(q.question || ""); setQuizOpts(q.options || ["","","","",""]); setQuizAns(q.answer || 0);
        setQuizMsg({ ok:true, m:"이 날짜에 등록된 퀴즈를 불러왔어요 (수정 후 다시 저장 가능)" });
      } else {
        setQuizQ(""); setQuizOpts(["","","","",""]); setQuizAns(0); setQuizMsg(null);
      }
    } catch (e) {}
  };

  const addNotice = async () => {
    if (!form.title || !form.content) return;
    const authorRole  = profile?.adminRole || "super";
    const authorLabel = authorRole === "teacher"   ? "교사" :
                        authorRole === "assistant" ? "조교" :
                        authorRole === "professor" ? "교수" : "관리자";
    await addItem("notices", { ...form, date: new Date().toISOString().slice(0, 10), author: `${profile?.name || "관리자"} (${authorLabel})` });
    setForm({ title: "", content: "", category: "공지", pinned: true, sendAlert: false, popup: false });
    setShowAdd(false);
  };

  const sendCustomAlert = async () => {
    if (!alertForm.title.trim()) { setSendResult({ ok: false, msg: "제목을 입력하세요" }); return; }
    if (alertForm.target === "one" && !alertForm.studentId.trim()) { setSendResult({ ok: false, msg: "학번을 입력하세요" }); return; }
    if (alertForm.target === "all" && !window.confirm("전체 학생에게 알림을 보낼까요?")) return;
    setSending(true); setSendResult(null);
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const fn  = httpsCallable(getFunctions(), "sendCustomAlert");
      const res = await fn({
        title:  alertForm.title.trim(),
        body:   alertForm.body.trim(),
        target: alertForm.target === "all" ? "all" : alertForm.studentId.trim(),
      });
      const nf = res.data?.notFound || [];
      setSendResult({
        ok: true,
        msg: `✅ ${res.data?.sent ?? 0}명에게 발송 완료` + (nf.length ? ` · 미발견 학번: ${nf.join(", ")}` : ""),
      });
      setAlertForm(p => ({ ...p, studentId: "", title: "", body: "" }));
    } catch (e) {
      setSendResult({ ok: false, msg: "발송 실패: " + (e.message || "오류") });
    }
    setSending(false);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !detail) return;
    setSubmitting(true);
    await addItem("noticeComments", {
      noticeId:   detail.id,
      authorId:   profile?.uid || "",
      authorName: profile?.name || "익명",
      authorRole: profile?.role === "admin" ? (profile?.adminRole || "super") : "student",
      content:    commentText.trim(),
    });
    setCommentText("");
    setSubmitting(false);
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    await deleteItem("noticeComments", commentId);
  };

  const getComments = (noticeId) =>
    comments
      .filter(c => c.noticeId === noticeId)
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  const formatTime = (ts) => {
    if (!ts?.seconds) return "";
    const d = new Date(ts.seconds * 1000);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  const pinned = notices.filter(n => n.pinned);
  const normal = notices.filter(n => !n.pinned);

  const NCard = ({ n }) => {
    const cat = NOTICE_CAT[n.category] || { bg: C.bg, col: C.muted };
    const cmtCount = comments.filter(c => c.noticeId === n.id).length;
    return (
      <Card onClick={() => { setDetail(n); setCommentText(""); }} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{n.category}</span>
              {n.pinned && <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>📌 고정</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{n.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{n.date} · {n.author}</span>
              {cmtCount > 0 && (
                <span style={{ fontSize: 12, color: C.blue, fontWeight: 600 }}>💬 댓글 {cmtCount}</span>
              )}
            </div>
          </div>
          {isAdmin && (
            <button onClick={e => { e.stopPropagation(); deleteItem("notices", n.id); }}
              style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: 4 }}>🗑️</button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div>
      {/* 페이지 안내 배너 (학생용) */}
      {!isAdmin && (
        <div style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src="/mascot/mega.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
            <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
              <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
              <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 공지사항 페이지야!</div>
              <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>장비대여실의 새로운 소식과 공지를<br/>확인할 수 있어.<br/>중요한 내용은 꼭 읽어봐 📢</div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>📢 공지사항</PageTitle>
        {isAdmin && <Btn onClick={() => setShowAdd(true)}>+ 공지 작성</Btn>}
      </div>

      {/* 푸시 알림 보내기 (관리자, 접이식) */}
      {isAdmin && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
          <button onClick={() => setShowSend(s => !s)}
            style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>🔔 푸시 알림 보내기</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>공지 등록 없이 학생들에게 알림만 보낼 수 있어요</div>
            </div>
            <span style={{ color: C.muted, fontSize: 13 }}>{showSend ? "▲" : "▼"}</span>
          </button>
          {showSend && (
            <div style={{ padding: "0 18px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>받는 사람</div>
              <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 4, marginBottom: 12 }}>
                {[["all", "전체 학생"], ["one", "특정 학번"]].map(([v, l]) => (
                  <button key={v} onClick={() => { setAlertForm(p => ({ ...p, target: v })); setSendResult(null); }}
                    style={{ flex: 1, background: alertForm.target === v ? C.navy : "transparent", color: alertForm.target === v ? "#fff" : C.muted, border: "none", borderRadius: 7, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
              {alertForm.target === "one" && (
                <Inp label="학번 (여러 명은 쉼표로 구분)" placeholder="예: 25237001, 25237002" value={alertForm.studentId} onChange={e => setAlertForm(p => ({ ...p, studentId: e.target.value }))} />
              )}
              <Inp label="제목" placeholder="알림 제목 입력" value={alertForm.title} onChange={e => setAlertForm(p => ({ ...p, title: e.target.value }))} />
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>내용</div>
                <textarea placeholder="알림 내용을 입력하세요..." value={alertForm.body} onChange={e => setAlertForm(p => ({ ...p, body: e.target.value }))}
                  style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 70, boxSizing: "border-box" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>미리보기</div>
              <div style={{ background: C.bg, borderRadius: 12, padding: "10px 12px", display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>KB</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{alertForm.title || "알림 제목"}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{alertForm.body || "알림 내용"}</div>
                </div>
              </div>
              <Btn onClick={sendCustomAlert} color={C.navy} full disabled={sending}>{sending ? "발송 중..." : "알림 보내기"}</Btn>
              {sendResult && (
                <div style={{ fontSize: 12, color: sendResult.ok ? C.teal : C.red, textAlign: "center", marginTop: 10 }}>{sendResult.msg}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 오늘의 퀴즈 등록 (관리자, 접이식) */}
      {isAdmin && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
          <button onClick={() => setShowQuiz(s => !s)}
            style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>📚 오늘의 퀴즈 등록</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>객관식 5지선다. 학생들이 펫 화면에서 풀어요</div>
            </div>
            <span style={{ color: C.muted, fontSize: 13 }}>{showQuiz ? "▲" : "▼"}</span>
          </button>
          {showQuiz && (
            <div style={{ padding: "0 18px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>날짜</div>
              <input type="date" value={quizDate} onChange={e => { setQuizDate(e.target.value); loadQuizForDate(e.target.value); }}
                style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />

              <Inp label="문제" placeholder="예: 다음 중 클로즈업 샷이 아닌 것은?" value={quizQ} onChange={e => setQuizQ(e.target.value)} />

              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, margin: "4px 0 6px" }}>보기 (정답을 ○로 선택)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {quizOpts.map((opt, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setQuizAns(i)}
                      style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", border: `2px solid ${quizAns === i ? C.teal : C.border}`, background: quizAns === i ? C.teal : "transparent", color: quizAns === i ? "#fff" : C.muted, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      {["①","②","③","④","⑤"][i]}
                    </button>
                    <input value={opt} placeholder={`보기 ${i+1}`}
                      onChange={e => setQuizOpts(p => { const n = [...p]; n[i] = e.target.value; return n; })}
                      style={{ flex: 1, background: C.bg, border: `1.5px solid ${quizAns === i ? C.teal : C.border}`, borderRadius: 10, color: C.text, padding: "9px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", minWidth: 0 }} />
                  </div>
                ))}
              </div>

              <Btn onClick={saveQuiz} color={C.navy} full disabled={quizSaving}>{quizSaving ? "저장 중..." : "오늘의 퀴즈 등록"}</Btn>
              {quizMsg && (
                <div style={{ fontSize: 12, color: quizMsg.ok ? C.teal : C.red, textAlign: "center", marginTop: 10 }}>{quizMsg.m}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 공지 작성 모달 */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} width={540}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>공지 작성</div>
          <Inp label="제목" placeholder="공지 제목 입력" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>내용</div>
            <textarea placeholder="공지 내용을 입력하세요..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 120, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>카테고리</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["공지", "신규장비", "휴무"].map(c => {
                const ct = NOTICE_CAT[c] || { bg: C.bg, col: C.muted };
                return (
                  <button key={c} onClick={() => setForm(p => ({ ...p, category: c }))} style={{ flex: 1, background: form.category === c ? ct.col : C.bg, color: form.category === c ? "#fff" : C.muted, border: `1px solid ${form.category === c ? ct.col : C.border}`, borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{c}</button>
                );
              })}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, color: C.text }}>📌 상단에 고정</span>
          </label>

          {/* 알림/팝업 설정 */}
          <div style={{ background:C.bg, borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:10 }}>발송 설정</div>
            <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, cursor:"pointer" }}>
              <input type="checkbox" checked={form.sendAlert} onChange={e => setForm(p => ({ ...p, sendAlert: e.target.checked }))} style={{ width:17, height:17 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>🔔 푸시 알림 전송</div>
                <div style={{ fontSize:11, color:C.muted }}>앱 설치 학생에게 알림을 보냅니다</div>
              </div>
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
              <input type="checkbox" checked={form.popup} onChange={e => setForm(p => ({ ...p, popup: e.target.checked }))} style={{ width:17, height:17 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>📢 홈 화면 팝업 표시</div>
                <div style={{ fontSize:11, color:C.muted }}>학생 홈 진입 시 팝업으로 표시됩니다 (다시 보지 않기 포함)</div>
              </div>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={addNotice} full>게시</Btn>
          </div>
        </Modal>
      )}

      {pinned.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10 }}>📌 고정 공지</div>
          {pinned.map(n => <NCard key={n.id} n={n} />)}
        </div>
      )}
      {normal.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>전체 공지</div>
          {normal.map(n => <NCard key={n.id} n={n} />)}
        </div>
      )}
      {notices.length === 0 && <Empty icon="📢" text="공지사항이 없습니다" />}

      {/* 공지 상세 + 댓글 모달 */}
      {detail && (() => {
        const cat = NOTICE_CAT[detail.category] || { bg: C.bg, col: C.muted };
        const detailComments = getComments(detail.id);
        return (
          <Modal onClose={() => setDetail(null)} width={580}>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{detail.category}</span>
              {detail.pinned && <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>📌 고정</span>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, marginBottom: 8, lineHeight: 1.4 }}>{detail.title}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{detail.date} · {detail.author}</div>

            {/* 본문 */}
            <div style={{ fontSize: 15, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 28 }}>{detail.content}</div>

            {/* 댓글 섹션 */}
            <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 16 }}>
                💬 댓글 {detailComments.length}
              </div>

              {/* 댓글 목록 */}
              {detailComments.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>
                  첫 댓글을 남겨보세요!
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {detailComments.map(c => {
                  const isMyComment = c.authorId === profile?.uid;
                  const canDelete   = isAdmin || isMyComment;
                  return (
                    <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Avatar name={c.authorName || "?"} size={34} />
                      <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "10px 14px", border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{c.authorName}</span>
                            {["super","teacher","assistant","professor","admin"].includes(c.authorRole) && (
                              <span style={{ background: (c.authorRole === "super" || c.authorRole === "admin") ? C.navy : c.authorRole === "professor" ? C.purple : c.authorRole === "teacher" ? C.blue : C.teal, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                                {c.authorRole === "professor" ? "교수" : c.authorRole === "teacher" ? "교사" : c.authorRole === "assistant" ? "조교" : "관리자"}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.muted }}>{formatTime(c.createdAt)}</span>
                            {canDelete && (
                              <button onClick={() => deleteComment(c.id)}
                                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 댓글 입력 */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <Avatar name={profile?.name || "?"} size={34} />
                <div style={{ flex: 1 }}>
                  <textarea
                    placeholder="댓글을 입력하세요..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                    style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", minHeight: 60, boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Enter로 등록 · Shift+Enter로 줄바꿈</div>
                </div>
                <Btn onClick={submitComment} color={C.teal} disabled={submitting || !commentText.trim()}>
                  {submitting ? "..." : "등록"}
                </Btn>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <Btn onClick={() => setDetail(null)} color={C.navy} full>닫기</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
