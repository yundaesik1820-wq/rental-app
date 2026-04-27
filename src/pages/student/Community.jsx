import { useState } from "react";
import { C } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { MessageCircle, ThumbsUp, Eye } from "lucide-react";
import { serverTimestamp } from "firebase/firestore";

const CATEGORIES = ["전체", "자유", "질문", "정보", "새내기"];

// 현재 연도 기준 새내기 학번 앞 2자리
const currentYear = new Date().getFullYear();
const newbiePrefix = String(currentYear).slice(2); // ex) 2026 → "26"

export default function Community() {
  const { profile } = useAuth();

  const { data: posts }    = useCollection("communityPosts",    "createdAt");
  const { data: comments } = useCollection("communityComments", "createdAt");

  const adminRole  = profile?.adminRole || "super";
  const isSuper    = profile?.role === "admin" && adminRole === "super";
  const isAssist   = profile?.role === "admin" && adminRole === "assistant";
  const canSeeReal = isSuper || isAssist; // 실명 볼 수 있는 권한

  // 새내기 여부
  const studentId  = profile?.studentId || "";
  const isNewbie   = studentId.startsWith(newbiePrefix);

  const [cat, setCat]           = useState("전체");
  const [selPost, setSelPost]   = useState(null); // 상세 모달
  const [showWrite, setShowWrite] = useState(false);
  const [writeForm, setWriteForm] = useState({ title:"", content:"", category:"자유" });
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [search, setSearch]           = useState("");

  const formatDate = (ts) => {
    if (!ts?.seconds) return "";
    const d = new Date(ts.seconds * 1000);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  // 표시 이름 (권한에 따라 실명/익명)
  const displayName = (post) => {
    if (canSeeReal) return `${post.authorName || "익명"} (익명)`;
    return "익명";
  };
  const displayCommentName = (c) => {
    if (canSeeReal) return `${c.authorName || "익명"} (익명)`;
    return "익명";
  };

  // 필터링
  const filtered = posts
    .filter(p => {
      if (cat !== "전체" && p.category !== cat) return false;
      if (search && !p.title.includes(search) && !p.content.includes(search)) return false;
      return true;
    })
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

  const postComments = (postId) =>
    comments.filter(c => c.postId === postId)
      .sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));

  // 게시글 작성
  const submitPost = async () => {
    if (!writeForm.title.trim() || !writeForm.content.trim()) return;
    if (writeForm.category === "새내기" && !isNewbie && profile?.role !== "admin") {
      alert(`새내기 탭은 ${newbiePrefix}학번만 이용할 수 있습니다.`);
      return;
    }
    setSubmitting(true);
    await addItem("communityPosts", {
      title:      writeForm.title.trim(),
      content:    writeForm.content.trim(),
      category:   writeForm.category,
      authorId:   profile?.uid || "",
      authorName: profile?.name || "",
      views:      0,
      likes:      0,
      likedBy:    [],
      createdAt:  serverTimestamp(),
    });
    setWriteForm({ title:"", content:"", category:"자유" });
    setShowWrite(false);
    setSubmitting(false);
  };

  // 댓글 작성
  const submitComment = async (postId) => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    await addItem("communityComments", {
      postId,
      content:    commentText.trim(),
      authorId:   profile?.uid || "",
      authorName: profile?.name || "",
      likes:      0,
      likedBy:    [],
      createdAt:  serverTimestamp(),
    });
    setCommentText("");
    setSubmitting(false);
  };

  // 좋아요
  const toggleLike = async (type, item) => {
    const uid     = profile?.uid || "";
    const liked   = (item.likedBy || []).includes(uid);
    const newLikes  = liked ? item.likes - 1 : item.likes + 1;
    const newLikedBy = liked
      ? item.likedBy.filter(id => id !== uid)
      : [...(item.likedBy || []), uid];
    const col = type === "post" ? "communityPosts" : "communityComments";
    await updateItem(col, item.id, { likes: newLikes, likedBy: newLikedBy });
    if (type === "post" && selPost?.id === item.id) {
      setSelPost({ ...selPost, likes: newLikes, likedBy: newLikedBy });
    }
  };

  // 조회수 증가
  const openPost = async (post) => {
    await updateItem("communityPosts", post.id, { views: (post.views || 0) + 1 });
    setSelPost({ ...post, views: (post.views || 0) + 1 });
    setCommentText("");
  };

  // 관리자 삭제
  const adminDeletePost = async (postId) => {
    if (!window.confirm("이 게시글을 삭제하시겠습니까?")) return;
    await deleteItem("communityPosts", postId);
    setSelPost(null);
  };
  const adminDeleteComment = async (commentId) => {
    if (!window.confirm("이 댓글을 삭제하시겠습니까?")) return;
    await deleteItem("communityComments", commentId);
  };

  const catColor = (c) => {
    const m = { "자유":C.blue, "질문":C.orange, "정보":C.green, "새내기":C.purple };
    return m[c] || C.muted;
  };
  const catBg = (c) => {
    const m = { "자유":C.blueLight, "질문":C.orangeLight, "정보":C.greenLight, "새내기":C.purpleLight };
    return m[c] || C.bg;
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle>커뮤니티</PageTitle>
        <Btn onClick={() => setShowWrite(true)} color={C.navy}>✏️ 글쓰기</Btn>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        {CATEGORIES.map(c => {
          const isLocked = c === "새내기" && !isNewbie && profile?.role !== "admin";
          return (
            <button key={c} onClick={() => !isLocked && setCat(c)}
              style={{
                padding:"7px 16px", borderRadius:20, border:`1px solid ${cat===c ? C.navy : C.border}`,
                background: cat===c ? C.navy : C.bg,
                color: cat===c ? "#fff" : isLocked ? C.border : C.muted,
                fontSize:13, fontWeight:600, cursor: isLocked ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", gap:5,
              }}>
              {c === "새내기" && "🌱"} {c}
              {isLocked && <span style={{ fontSize:10 }}>🔒</span>}
            </button>
          );
        })}
      </div>

      {/* 새내기 안내 */}
      {cat === "새내기" && !isNewbie && profile?.role !== "admin" && (
        <div style={{ background:C.purpleLight, borderRadius:12, padding:"14px 18px", marginBottom:16, fontSize:13, color:C.purple }}>
          🌱 새내기 탭은 {newbiePrefix}학번({currentYear}년 입학) 학생만 이용할 수 있습니다.
        </div>
      )}

      {/* 검색 */}
      <input placeholder="🔍 제목, 내용 검색" value={search} onChange={e => setSearch(e.target.value)}
        style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:16, boxSizing:"border-box" }} />

      {/* 게시글 목록 */}
      {filtered.length === 0 && <Empty icon="📝" text="게시글이 없습니다" />}
      {filtered.map(p => (
        <Card key={p.id} onClick={() => openPost(p)} style={{ marginBottom:10, cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <span style={{ background:catBg(p.category), color:catColor(p.category), borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{p.category}</span>
              <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{p.title}</span>
            </div>
            <span style={{ fontSize:11, color:C.muted, flexShrink:0, marginLeft:8 }}>{formatDate(p.createdAt)}</span>
          </div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.content}</div>
          <div style={{ display:"flex", gap:14, fontSize:12, color:C.muted }}>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><Eye size={12} /> {p.views||0}</span>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><ThumbsUp size={12} /> {p.likes||0}</span>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><MessageCircle size={12} /> {postComments(p.id).length}</span>
            <span>익명</span>
          </div>
        </Card>
      ))}

      {/* 게시글 상세 모달 */}
      {selPost && (
        <Modal onClose={() => setSelPost(null)} width={600}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
            <span style={{ background:catBg(selPost.category), color:catColor(selPost.category), borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{selPost.category}</span>
            {isSuper && <Btn onClick={() => adminDeletePost(selPost.id)} color={C.red} small>삭제</Btn>}
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:C.navy, marginBottom:6 }}>{selPost.title}</div>
          <div style={{ display:"flex", gap:12, fontSize:12, color:C.muted, marginBottom:16 }}>
            <span>{canSeeReal ? `${selPost.authorName} (익명)` : "익명"}</span>
            <span>{formatDate(selPost.createdAt)}</span>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><Eye size=   {12} /> {selPost.views||0}</span>
          </div>
          <div style={{ fontSize:14, color:C.text, lineHeight:1.8, marginBottom:20, whiteSpace:"pre-wrap", borderBottom:`1px solid ${C.border}`, paddingBottom:20 }}>{selPost.content}</div>

          {/* 좋아요 */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
            <button onClick={() => toggleLike("post", selPost)}
              style={{ display:"flex", alignItems:"center", gap:6, background:(selPost.likedBy||[]).includes(profile?.uid)?C.blueLight:C.bg, border:`1px solid ${C.border}`, borderRadius:20, padding:"6px 20px", fontSize:13, color:(selPost.likedBy||[]).includes(profile?.uid)?C.blue:C.muted, cursor:"pointer" }}>
              <ThumbsUp size={14} /> {selPost.likes||0}
            </button>
          </div>

          {/* 댓글 */}
          <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginBottom:12 }}>
            댓글 {postComments(selPost.id).length}
          </div>
          {postComments(selPost.id).map(c => (
            <div key={c.id} style={{ background:C.bg, borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{displayCommentName(c)}</span>
                  <span style={{ fontSize:11, color:C.muted }}>{formatDate(c.createdAt)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button onClick={() => toggleLike("comment", c)}
                    style={{ display:"flex", alignItems:"center", gap:3, background:"none", border:"none", fontSize:11, color:(c.likedBy||[]).includes(profile?.uid)?C.blue:C.muted, cursor:"pointer" }}>
                    <ThumbsUp size={11} /> {c.likes||0}
                  </button>
                  {isSuper && (
                    <button onClick={() => adminDeleteComment(c.id)}
                      style={{ background:"none", border:"none", color:C.red, fontSize:11, cursor:"pointer" }}>삭제</button>
                  )}
                </div>
              </div>
              <div style={{ fontSize:13, color:C.text, lineHeight:1.6 }}>{c.content}</div>
            </div>
          ))}

          {/* 댓글 작성 */}
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <input placeholder="댓글을 입력하세요..." value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(selPost.id); }}}
              style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
            <Btn onClick={() => submitComment(selPost.id)} color={C.navy} disabled={submitting || !commentText.trim()}>등록</Btn>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>댓글은 익명으로 게시됩니다. Enter로 등록</div>
        </Modal>
      )}

      {/* 글쓰기 모달 */}
      {showWrite && (
        <Modal onClose={() => setShowWrite(false)} width={540}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>✏️ 글쓰기</div>

          {/* 카테고리 선택 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>카테고리</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {CATEGORIES.filter(c => c !== "전체").map(c => {
                const isLocked = c === "새내기" && !isNewbie && profile?.role !== "admin";
                return (
                  <button key={c} onClick={() => !isLocked && setWriteForm(p=>({...p,category:c}))}
                    style={{ padding:"7px 16px", borderRadius:20, border:`1px solid ${writeForm.category===c?catColor(c):C.border}`, background:writeForm.category===c?catBg(c):C.bg, color:writeForm.category===c?catColor(c):isLocked?C.border:C.muted, fontSize:13, fontWeight:600, cursor:isLocked?"not-allowed":"pointer" }}>
                    {c === "새내기" && "🌱"}{c}{isLocked && " 🔒"}
                  </button>
                );
              })}
            </div>
          </div>

          <Inp label="제목 *" placeholder="제목을 입력하세요" value={writeForm.title} onChange={e => setWriteForm(p=>({...p,title:e.target.value}))} />
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>내용 *</div>
            <textarea placeholder="내용을 입력하세요..." value={writeForm.content} onChange={e => setWriteForm(p=>({...p,content:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:160, boxSizing:"border-box" }} />
          </div>
          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            ⚠️ 익명으로 게시되며, 게시 후 수정·삭제가 불가합니다.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowWrite(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={submitPost} color={C.navy} full disabled={submitting || !writeForm.title.trim() || !writeForm.content.trim()}>
              {submitting ? "게시 중..." : "게시하기"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
