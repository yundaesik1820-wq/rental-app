import { useState } from "react";
import { C, NOTICE_CAT } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle, Avatar } from "../../components/UI";
import { useCollection, addItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";

export default function Notices({ isAdmin = true }) {
  const { profile } = useAuth();
  const { data: notices }  = useCollection("notices", "createdAt");
  const { data: comments } = useCollection("noticeComments", "createdAt");

  const [showAdd, setShowAdd]   = useState(false);
  const [detail, setDetail]     = useState(null);
  const [form, setForm]         = useState({ title: "", content: "", category: "공지", pinned: true });
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  const addNotice = async () => {
    if (!form.title || !form.content) return;
    const authorRole  = profile?.adminRole || "super";
    const authorLabel = authorRole === "teacher"   ? "교사" :
                        authorRole === "assistant" ? "조교" :
                        authorRole === "professor" ? "교수" : "관리자";
    await addItem("notices", { ...form, date: new Date().toISOString().slice(0, 10), author: `${profile?.name || "관리자"} (${authorLabel})` });
    setForm({ title: "", content: "", category: "공지", pinned: true });
    setShowAdd(false);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>📢 공지사항</PageTitle>
        {isAdmin && <Btn onClick={() => setShowAdd(true)}>+ 공지 작성</Btn>}
      </div>

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
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, color: C.text }}>📌 상단에 고정</span>
          </label>
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
