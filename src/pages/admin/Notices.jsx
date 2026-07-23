import { useState, useRef, useEffect } from "react";
import { C, NOTICE_CAT } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, Avatar } from "../../components/UI";
import { useCollection, addItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { doc, setDoc, getDoc, collection, getDocs, writeBatch, query, where, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import PdfViewer from "../../components/PdfViewer";
import { Pin, FileText, MessageCircle, Megaphone } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// 학생 화면 전용 톤 — 더보기 메뉴 "공지사항" 타일(tint #38bdf8 sky)을 액센트로 확장.
// 관리자 화면은 기존 C 모노톤 그대로 둠 (Calendar 처럼 공유 컴포넌트는 학생 뷰만 리스타일)
// ─────────────────────────────────────────────────────────────
const S = {
  card:     "#121218",
  card2:    "#0B0B0E",
  border:   "rgba(255,255,255,0.07)",
  text:     "#F1F5F9",
  sub:      "#64748B",
  subLight: "#a8adc4",
  sky:      "#38bdf8",
  skyTxt:   "#7dd3fc",
  skyBg:    "rgba(56,189,248,0.13)",
  skyBd:    "rgba(56,189,248,0.4)",
  grad:     "linear-gradient(90deg,#38bdf8,#3b82f6)",
};
// 카테고리·상태색은 History.jsx 의 PAL 값 계열로 통일
const S_CAT = {
  "공지":     { fg: "#7dd3fc", bg: "rgba(56,189,248,.16)" },
  "신규장비": { fg: "#5eead4", bg: "rgba(45,212,191,.16)" },
  "휴무":     { fg: "#fca5a5", bg: "rgba(239,68,68,.16)" },
};
const S_AMBER = { fg: "#fcd34d", bg: "rgba(245,158,11,.16)" };
const S_GRAY  = { fg: "#cbd5e1", bg: "rgba(148,163,184,.16)" };
const sCat = (c) => S_CAT[c] || S_GRAY;

// 작성자 역할 배지 — 학생 화면용 (관리자 화면은 기존 C 토큰 유지)
const S_ROLE = {
  super:     { label: "관리자", fg: "#7dd3fc", bg: "rgba(56,189,248,.16)" },
  admin:     { label: "관리자", fg: "#7dd3fc", bg: "rgba(56,189,248,.16)" },
  assistant: { label: "조교",   fg: "#5eead4", bg: "rgba(45,212,191,.16)" },
  teacher:   { label: "교사",   fg: "#7fa9ff", bg: "rgba(59,130,246,.16)" },
  professor: { label: "교수",   fg: "#c4b5fd", bg: "rgba(124,58,237,.16)" },
};

// PDF 등 첨부파일 업로드 (attachments 경로 — 기존 Storage 규칙 사용)
async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed", null, reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
  });
}

// 대량 퀴즈 텍스트 파싱: 빈 줄로 문제 구분, 각 블록 = 문제 1줄 + 보기 5줄(정답 보기 앞에 *)
function parseBulkQuizzes(text) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const quizzes = [];
  const errors  = [];
  blocks.forEach((block, bi) => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length !== 6) {
      errors.push(`${bi + 1}번: 6줄(문제1 + 보기5)이어야 해요 (현재 ${lines.length}줄)`);
      return;
    }
    const question = lines[0];
    let answer = -1;
    const options = lines.slice(1).map((l, i) => {
      if (l.startsWith("*")) { answer = i; return l.slice(1).trim(); }
      return l;
    });
    if (answer === -1) { errors.push(`${bi + 1}번: 정답 표시(*)가 없어요`); return; }
    if (!question)      { errors.push(`${bi + 1}번: 문제가 비었어요`); return; }
    if (options.some(o => !o)) { errors.push(`${bi + 1}번: 빈 보기가 있어요`); return; }
    quizzes.push({ question, options, answer });
  });
  return { quizzes, errors };
}

export default function Notices({ isAdmin = true, initialNoticeId, onConsumed }) {
  const { profile } = useAuth();
  const { data: notices }  = useCollection("notices", "createdAt");
  const { data: comments } = useCollection("noticeComments", "createdAt");

  const [showAdd, setShowAdd]   = useState(false);
  const [detail, setDetail]     = useState(null);
  const [stuCat, setStuCat]     = useState("전체"); // 학생 화면 카테고리 필터

  // 알림 딥링크 — 특정 공지 상세 자동 열기
  useEffect(() => {
    if (!initialNoticeId || !notices.length) return;
    const n = notices.find(x => x.id === initialNoticeId);
    if (n) { setDetail(n); setCommentText(""); }
    onConsumed?.();
  }, [initialNoticeId, notices]);
  const [pdfView, setPdfView]   = useState(null); // 풀스크린 PDF 보기 {url, title}
  const pdfRef = useRef();
  const [pdfUploading, setPdfUploading] = useState(false);
  const [form, setForm]         = useState({ title: "", content: "", category: "공지", pinned: true, sendAlert: false, popup: false, pdfUrl: "", pdfName: "" });
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

  // 대량 등록 (quizPool) — 매일 오전 9시 자동 소진
  const [bulkText, setBulkText]   = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg]     = useState(null);
  const [poolCount, setPoolCount] = useState(null); // 남은(미사용) 문제 수
  useEffect(() => {
    if (!showQuiz) return;
    getDocs(query(collection(db, "quizPool"), where("used", "==", false)))
      .then(s => setPoolCount(s.size)).catch(() => setPoolCount(null));
  }, [showQuiz, bulkMsg]);

  const saveBulk = async () => {
    const { quizzes, errors } = parseBulkQuizzes(bulkText);
    if (errors.length) { setBulkMsg({ ok: false, m: "형식 오류: " + errors.join(" / ") }); return; }
    if (!quizzes.length) { setBulkMsg({ ok: false, m: "등록할 문제가 없어요" }); return; }
    setBulkSaving(true); setBulkMsg(null);
    try {
      const batch = writeBatch(db);
      quizzes.forEach(q => {
        batch.set(doc(collection(db, "quizPool")), {
          question: q.question, options: q.options, answer: q.answer,
          used: false, usedDate: null, createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setBulkMsg({ ok: true, m: `✅ ${quizzes.length}개 등록 완료! 매일 오전 9시에 하나씩 자동 출제돼요` });
      setBulkText("");
    } catch (e) {
      setBulkMsg({ ok: false, m: "등록 실패: " + (e.message || "오류") });
    }
    setBulkSaving(false);
  };

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

  const handlePdf = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("PDF 파일만 올릴 수 있어요"); return;
    }
    setPdfUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(p => ({ ...p, pdfUrl: url, pdfName: file.name }));
    } catch (err) {
      alert("PDF 업로드 실패: " + err.message);
    }
    setPdfUploading(false);
    if (pdfRef.current) pdfRef.current.value = "";
  };

  const addNotice = async () => {
    if (!form.title.trim()) { alert("제목을 입력해 주세요"); return; }
    if (!form.content.trim() && !form.pdfUrl) { alert("내용이나 PDF 중 하나는 넣어 주세요"); return; }
    const authorRole  = profile?.adminRole || "super";
    const authorLabel = authorRole === "teacher"   ? "교사" :
                        authorRole === "assistant" ? "조교" :
                        authorRole === "professor" ? "교수" : "관리자";
    await addItem("notices", { ...form, date: new Date().toISOString().slice(0, 10), author: `${profile?.name || "관리자"} (${authorLabel})` });
    setForm({ title: "", content: "", category: "공지", pinned: true, sendAlert: false, popup: false, pdfUrl: "", pdfName: "" });
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

  // 상세 모달 색 토큰 — 관리자는 기존 C 값 1:1, 학생은 sky 톤
  const T = isAdmin
    ? { title: C.navy, text: C.text, sub: C.muted, panel: C.bg, border: C.border, accent: C.teal, pin: C.orange }
    : { title: S.text, text: S.text, sub: S.sub, panel: S.card2, border: S.border, accent: S.sky, pin: S_AMBER.fg };

  const shown = isAdmin ? notices : notices.filter(n => stuCat === "전체" || n.category === stuCat);
  const pinned = shown.filter(n => n.pinned);
  const normal = shown.filter(n => !n.pinned);

  // ── 학생용 공지 카드 ──
  const StuCard = ({ n }) => {
    const cat = sCat(n.category);
    const cmtCount = comments.filter(c => c.noticeId === n.id).length;
    return (
      <button
        onClick={() => {
          if (n.pdfUrl && !n.content?.trim()) setPdfView({ url: n.pdfUrl, title: n.title });
          else { setDetail(n); setCommentText(""); }
        }}
        style={{
          width: "100%", boxSizing: "border-box", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
          position: "relative", overflow: "hidden",
          background: S.card, border: `1px solid ${n.pinned ? S.skyBd : S.border}`,
          borderRadius: 14, padding: "14px 16px", marginBottom: 9,
        }}>
        {/* 고정 공지는 좌측 액센트 바 */}
        {n.pinned && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: S.grad }} />}

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
          <span style={{ background: cat.bg, color: cat.fg, borderRadius: 7, padding: "3px 9px", fontSize: 10.5, fontWeight: 800 }}>{n.category}</span>
          {n.pinned && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: S_AMBER.bg, color: S_AMBER.fg, borderRadius: 7, padding: "3px 8px", fontSize: 10.5, fontWeight: 800 }}>
              <Pin size={10} /> 고정
            </span>
          )}
          {n.pdfUrl && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: S_GRAY.bg, color: S_GRAY.fg, borderRadius: 7, padding: "3px 8px", fontSize: 10.5, fontWeight: 800 }}>
              <FileText size={10} /> PDF
            </span>
          )}
        </div>

        <div style={{ fontSize: 14.5, fontWeight: 800, color: S.text, lineHeight: 1.45, marginBottom: 7 }}>{n.title}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: S.sub }}>
          <span>{n.date}</span>
          <span style={{ color: S.border }}>·</span>
          <span>{n.author}</span>
          {cmtCount > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: S.skyTxt, fontWeight: 700 }}>
              <MessageCircle size={11} /> {cmtCount}
            </span>
          )}
        </div>
      </button>
    );
  };

  const NCard = ({ n }) => {
    const cat = NOTICE_CAT[n.category] || { bg: C.bg, col: C.muted };
    const cmtCount = comments.filter(c => c.noticeId === n.id).length;
    return (
      <Card onClick={() => {
        if (n.pdfUrl && !n.content?.trim()) setPdfView({ url: n.pdfUrl, title: n.title });
        else { setDetail(n); setCommentText(""); }
      }} style={{ cursor: "pointer" }}>
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
      {isAdmin && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 20 }}>
          <Btn onClick={() => setShowAdd(true)}>+ 공지 작성</Btn>
        </div>
      )}

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
                    style={{ flex: 1, background: alertForm.target === v ? C.navy : "transparent", color: alertForm.target === v ? C.bg : C.muted, border: "none", borderRadius: 7, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{l}</button>
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
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, whiteSpace: "pre-line" }}>{alertForm.body || "알림 내용"}</div>
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

              <Btn onClick={saveQuiz} color={C.navy} full disabled={quizSaving}>{quizSaving ? "저장 중..." : "이 날짜에 퀴즈 등록"}</Btn>
              {quizMsg && (
                <div style={{ fontSize: 12, color: quizMsg.ok ? C.teal : C.red, textAlign: "center", marginTop: 10 }}>{quizMsg.m}</div>
              )}

              {/* ── 대량 등록 (풀) ── */}
              <div style={{ borderTop: `1px solid ${C.border}`, margin: "18px 0 14px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>📦 여러 문제 한 번에 등록</div>
                <span style={{ fontSize: 11, color: poolCount === 0 ? C.red : C.teal }}>
                  {poolCount == null ? "" : `남은 문제 ${poolCount}개`}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, marginBottom: 8 }}>
                아래에 붙여넣으면 풀(pool)에 쌓이고, <b>매일 오전 9시</b>에 자동으로 하나씩 출제돼요.<br />
                문제끼리는 <b>빈 줄</b>로 구분 · 각 문제는 <b>문제 1줄 + 보기 5줄</b> · <b>정답 보기 앞에 *</b>
              </div>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                placeholder={"다음 중 클로즈업 샷이 아닌 것은?\n익스트림 클로즈업\n바스트 샷\n*롱 샷\n미디엄 클로즈업\n빅 클로즈업\n\n조리개 F값이 작을수록 나타나는 현상은?\n심도가 깊어진다\n*배경이 흐려진다\n노출이 어두워진다\n화각이 넓어진다\n초점이 안 맞는다"}
                style={{ width: "100%", minHeight: 160, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, marginBottom: 10 }} />
              <Btn onClick={saveBulk} color={C.teal} full disabled={bulkSaving}>{bulkSaving ? "등록 중..." : "풀에 대량 등록"}</Btn>
              {bulkMsg && (
                <div style={{ fontSize: 12, color: bulkMsg.ok ? C.teal : C.red, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>{bulkMsg.m}</div>
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

          {/* PDF 첨부 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>📄 PDF 첨부 (선택)</div>
            <input ref={pdfRef} type="file" accept="application/pdf,.pdf" onChange={handlePdf} style={{ display: "none" }} />
            {form.pdfUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
                <span style={{ fontSize: 13, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {form.pdfName}</span>
                <button onClick={() => setForm(p => ({ ...p, pdfUrl: "", pdfName: "" }))}
                  style={{ background: "transparent", color: C.red, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>삭제</button>
              </div>
            ) : (
              <button onClick={() => pdfRef.current?.click()} disabled={pdfUploading}
                style={{ width: "100%", padding: "11px", border: `1px dashed ${C.border}`, borderRadius: 10, background: C.bg, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {pdfUploading ? "업로드 중..." : "+ PDF 선택"}
              </button>
            )}
          </div>

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

      {/* ── 목록: 학생 뷰 ── */}
      {!isAdmin && (<>
        {/* 카테고리 필터 칩 */}
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none" }}>
          {["전체", "공지", "신규장비", "휴무"].map(c => {
            const on = stuCat === c;
            return (
              <button key={c} onClick={() => setStuCat(c)}
                style={{
                  flexShrink: 0, minHeight: 0, padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                  background: on ? S.sky : S.card, color: on ? "#08131a" : S.subLight,
                  border: `1px solid ${on ? S.sky : S.border}`, transition: "all .15s",
                }}>
                {c}
              </button>
            );
          })}
        </div>

        {pinned.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: S_AMBER.fg, margin: "0 2px 9px" }}>
              <Pin size={12} /> 고정 공지 <span style={{ color: S.sub, fontWeight: 600 }}>({pinned.length})</span>
            </div>
            {pinned.map(n => <StuCard key={n.id} n={n} />)}
          </div>
        )}
        {normal.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: S.text, margin: "0 2px 9px" }}>
              전체 공지 <span style={{ color: S.sub, fontWeight: 600 }}>({normal.length})</span>
            </div>
            {normal.map(n => <StuCard key={n.id} n={n} />)}
          </div>
        )}
        {shown.length === 0 && (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: "36px 22px", textAlign: "center" }}>
            <div style={{ width: 58, height: 58, borderRadius: 20, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: S.skyBg, border: `1px solid ${S.skyBd}` }}>
              <Megaphone size={25} color={S.skyTxt} />
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: S.text, marginBottom: 6 }}>
              {stuCat === "전체" ? "등록된 공지가 없어요" : `'${stuCat}' 공지가 없어요`}
            </div>
            <div style={{ fontSize: 12.5, color: S.sub, lineHeight: 1.7 }}>
              {stuCat === "전체" ? "새 소식이 올라오면 여기에 표시돼요." : "다른 카테고리를 확인해보세요."}
            </div>
          </div>
        )}
      </>)}

      {/* ── 목록: 관리자 뷰 (기존 그대로) ── */}
      {isAdmin && (<>
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
      </>)}

      {/* 공지 상세 + 댓글 모달 */}
      {detail && (() => {
        const cat = isAdmin ? (NOTICE_CAT[detail.category] || { bg: C.bg, col: C.muted }) : { bg: sCat(detail.category).bg, col: sCat(detail.category).fg };
        const detailComments = getComments(detail.id);
        return (
          <Modal onClose={() => setDetail(null)} width={580}>
            {(detail.pdfUrl && !detail.content?.trim()) ? (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.title, marginBottom: 12, lineHeight: 1.4 }}>📄 {detail.title}</div>
                <div style={{ width: "100%", height: "72vh", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, background: "#fff" }}>
                  <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(detail.pdfUrl)}&embedded=true`}
                    title="첨부 PDF" style={{ width: "100%", height: "100%", border: "none" }} />
                </div>
                <button onClick={() => window.open(detail.pdfUrl, "_blank")}
                  style={{ width: "100%", marginTop: 10, padding: "12px", background: C.navy, color: C.bg, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  전체화면으로 보기 / 다운로드
                </button>
              </div>
            ) : (<>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{detail.category}</span>
              {detail.pinned && <span style={{ fontSize: 12, color: T.pin, fontWeight: 700 }}>📌 고정</span>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.title, marginBottom: 8, lineHeight: 1.4 }}>{detail.title}</div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 20 }}>{detail.date} · {detail.author}</div>

            {/* 본문 */}
            <div style={{ fontSize: 15, color: T.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: detail.pdfUrl ? 16 : 28 }}>{detail.content}</div>

            {/* PDF 첨부 미리보기 */}
            {detail.pdfUrl && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.title, marginBottom: 8 }}>📄 첨부 문서{detail.pdfName ? ` — ${detail.pdfName}` : ""}</div>
                <div style={{ width: "100%", height: 460, borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, background: "#fff" }}>
                  <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(detail.pdfUrl)}&embedded=true`}
                    title="첨부 PDF" style={{ width: "100%", height: "100%", border: "none" }} />
                </div>
                <button onClick={() => window.open(detail.pdfUrl, "_blank")}
                  style={{ width: "100%", marginTop: 8, padding: "11px", background: C.navy, color: C.bg, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  전체화면으로 보기 / 다운로드
                </button>
              </div>
            )}

            {/* 댓글 섹션 */}
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.title, marginBottom: 16 }}>
                💬 댓글 {detailComments.length}
              </div>

              {/* 댓글 목록 */}
              {detailComments.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: T.sub, fontSize: 13 }}>
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
                      <div style={{ flex: 1, background: T.panel, borderRadius: 12, padding: "10px 14px", border: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.title }}>{c.authorName}</span>
                            {["super","teacher","assistant","professor","admin"].includes(c.authorRole) && (
                              isAdmin ? (
                                <span style={{ background: (c.authorRole === "super" || c.authorRole === "admin") ? C.navy : c.authorRole === "professor" ? C.purple : c.authorRole === "teacher" ? C.blue : C.teal, color: C.bg, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                                  {c.authorRole === "professor" ? "교수" : c.authorRole === "teacher" ? "교사" : c.authorRole === "assistant" ? "조교" : "관리자"}
                                </span>
                              ) : (
                                <span style={{ background: S_ROLE[c.authorRole].bg, color: S_ROLE[c.authorRole].fg, borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>
                                  {S_ROLE[c.authorRole].label}
                                </span>
                              )
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: T.sub }}>{formatTime(c.createdAt)}</span>
                            {canDelete && (
                              <button onClick={() => deleteComment(c.id)}
                                style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 댓글 입력 */}
              {isAdmin ? (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <Avatar name={profile?.name || "?"} size={34} />
                  <div style={{ flex: 1 }}>
                    <textarea
                      placeholder="댓글을 입력하세요..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                      style={{ display: "block", width: "100%", background: T.panel, border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", minHeight: 60, boxSizing: "border-box" }}
                    />
                    <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>Enter로 등록 · Shift+Enter로 줄바꿈</div>
                  </div>
                  <Btn onClick={submitComment} color={T.accent} disabled={submitting || !commentText.trim()}>
                    {submitting ? "..." : "등록"}
                  </Btn>
                </div>
              ) : (
                // 학생 뷰 — 안내문 제거하고 입력칸·등록버튼 높이를 맞춤 (Enter 등록 단축키는 그대로 동작)
                <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                  <div style={{ alignSelf: "center", flexShrink: 0, display: "flex" }}>
                    <Avatar name={profile?.name || "?"} size={34} />
                  </div>
                  <textarea
                    placeholder="댓글을 입력하세요..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                    style={{ flex: 1, minWidth: 0, minHeight: 56, background: S.card2, border: `1.5px solid ${S.border}`, borderRadius: 12, color: S.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }}
                  />
                  <button onClick={submitComment} disabled={submitting || !commentText.trim()}
                    style={{
                      flexShrink: 0, alignSelf: "center", minHeight: 40, height: 40, padding: "0 14px", borderRadius: 10,
                      border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 800,
                      background: S.sky, color: "#08131a",
                      cursor: (submitting || !commentText.trim()) ? "default" : "pointer",
                      opacity: (submitting || !commentText.trim()) ? 0.4 : 1,
                    }}>
                    {submitting ? "..." : "등록"}
                  </button>
                </div>
              )}
            </div>
            </>)}

            <div style={{ marginTop: 20 }}>
              {isAdmin ? (
                <Btn onClick={() => setDetail(null)} color={C.navy} full>닫기</Btn>
              ) : (
                <button onClick={() => setDetail(null)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: S.skyBg, color: S.skyTxt, border: `1.5px solid ${S.skyBd}` }}>
                  닫기
                </button>
              )}
            </div>
          </Modal>
        );
      })()}

      {pdfView && <PdfViewer url={pdfView.url} title={pdfView.title} onClose={() => setPdfView(null)} />}
    </div>
  );
}
