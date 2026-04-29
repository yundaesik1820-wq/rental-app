import { useState, useRef } from "react";
import { C } from "../../theme";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { serverTimestamp } from "firebase/firestore";

const CATEGORIES = ["전체", "자유", "질문", "정보", "저격", "새내기"];

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `community/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed", null, reject, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      resolve(url);
    });
  });
}

// 현재 연도 기준 새내기 학번 앞 2자리
const currentYear = new Date().getFullYear();
const newbiePrefix = String(currentYear).slice(2); // ex) 2026 → "26"

export default function Community() {
  const { profile } = useAuth();

  // 공지 팝업
  const NOTICE_KEY = "everytime_notice_hidden";
  const todayStr   = new Date().toISOString().slice(0, 10);
  const hiddenDate = localStorage.getItem(NOTICE_KEY);
  const [showNotice, setShowNotice] = useState(hiddenDate !== todayStr);
  const [dontShow, setDontShow]     = useState(false);

  const closeNotice = () => {
    if (dontShow) localStorage.setItem(NOTICE_KEY, todayStr);
    setShowNotice(false);
  };

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
  const [writeForm, setWriteForm] = useState({ title:"", content:"", category:"자유", images:[] });
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const imgInputRef = useRef(null);
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const PAGE_SIZE = 10;

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
  const allFiltered = posts
    .filter(p => {
      if (cat !== "전체" && p.category !== cat) return false;
      // 새내기 글은 새내기만 볼 수 있음 (전체 탭에서도)
      if (p.category === "새내기" && !isNewbie && profile?.role !== "admin") return false;
      if (search && !p.title.includes(search) && !p.content.includes(search)) return false;
      return true;
    })
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

  const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);
  const filtered   = allFiltered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

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
      images:     writeForm.images || [],
      views:      0,
      likes:      0,
      likedBy:    [],
      createdAt:  serverTimestamp(),
    });
    setWriteForm({ title:"", content:"", category:"자유", images:[] });
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
    const m = { "자유":C.blue, "질문":C.orange, "정보":C.green, "저격":C.red, "새내기":C.purple };
    return m[c] || C.muted;
  };
  const catBg = (c) => {
    const m = { "자유":C.blueLight, "질문":C.orangeLight, "정보":C.greenLight, "저격":C.redLight, "새내기":C.purpleLight };
    return m[c] || C.bg;
  };

  return (
    <div>
      {/* 공지 팝업 */}
      {showNotice && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.surface, borderRadius:16, width:"100%", maxWidth:480, boxShadow:"0 20px 60px rgba(0,0,0,0.3)", overflow:"hidden" }}>
            <div style={{ background:C.navy, padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:15, fontWeight:700, color:"#fff" }}>📢 에브리타임 공지</span>
              <button onClick={closeNotice} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:20, cursor:"pointer", lineHeight:1 }}>✕</button>
            </div>
            <div style={{ padding:"16px 20px", maxHeight:"60vh", overflowY:"auto", fontSize:12.5, color:C.text, lineHeight:1.9, whiteSpace:"pre-wrap" }}>{`📢 공지
한예진 영상계열 커뮤니티에 오신 여러분 환영합니다.
본 커뮤니티에는 자유 / 질문 / 정보 / 저격 / 새내기 탭이 존재합니다.
여러분의 숨겨진 흑염룡과 음지력을 마음껏 발산해주시길 바랍니다.

＜규칙＞
1. 올린 글과 댓글은 삭제되지 않습니다.
   손가락은 가볍게, 책임은 무겁게 부탁드립니다.
   삭제를 원하실 경우 어떤 글을 쓰셨는지 말씀해주시면 삭제할지말지 고민해보겠습니다.
2. 본 커뮤니티는 학생을 제외하고는 접근 권한이 부여되지 않아 교수님도 볼 수 없습니다.
3. 모든 글은 익명으로 작성되며, 관리자 또한 작성자가 누구인지 확인할 수 없습니다.
4. 인성도 같이 로그인하시길 추천드립니다.
5. 뭔가 욕을 먹은 기분이 들었다면, 그건 아마 당신이 맞을 겁니다.
   다만 실명 저격, 개인정보 공개, 과도한 비방은 금지입니다.
6. 흑염룡은 풀어도 개인정보는 풀지 마세요.
7. 질문은 자유롭게 올려주세요.
8. 정보 공유는 적극 환영합니다.
   꿀팁은 나누고, 헛소문은 마음속에만 저장해주세요.
9. 새내기 탭은 새내기를 위한 공간입니다.
   고인물 여러분은 텃세 대신 생존 팁을 남겨주세요.
10. 드립은 환영합니다.
    다만 누군가의 멘탈을 편집점으로 삼는 드립은 컷하겠습니다.
11. 싸움이 길어질 경우 장르가 토론에서 막장드라마로 변경됩니다.
    적당히 엔딩 크레딧 올려주세요.
12. 과한 혐오 표현, 성적 발언, 불법 자료 공유, 개인정보 유출은 제재될 수 있습니다.
    음지는 환영하지만 범죄는 안 됩니다.
13. 관리자도 최대한 개입하지 않겠습니다.
    하지만 선을 넘으면 조용히 나타납니다.
14. 최선을 다해 여러분의 음지력을 발산해주시되,
    최소한 사람 하나 보내버릴 말은 하지 맙시다.`}</div>
            <div style={{ padding:"10px 20px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.muted, cursor:"pointer" }}>
                <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} style={{ cursor:"pointer" }} />
                오늘 하루 그만 보기
              </label>
              <button onClick={closeNotice}
                style={{ background:C.navy, color:"#fff", border:"none", borderRadius:8, padding:"7px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <PageTitle>에브리타임</PageTitle>
        <Btn onClick={() => setShowWrite(true)} color={C.navy}>✏️ 글쓰기</Btn>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        {CATEGORIES.map(c => {
          const isLocked = c === "새내기" && !isNewbie && profile?.role !== "admin";
          return (
            <button key={c} onClick={() => { if(!isLocked) { setCat(c); setPage(1); } }}
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
      <input placeholder="🔍 제목, 내용 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        style={{ display:"block", width:"100%", background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 16px", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:16, boxSizing:"border-box" }} />

      {/* 인기 게시글 TOP3 */}
      {(() => {
        const base = cat === "전체" ? posts : posts.filter(p => p.category === cat);
        const top3 = [...base]
          .sort((a,b) =>
            ((b.views||0)*1 + (b.likes||0)*3 + postComments(b.id).length*2) -
            ((a.views||0)*1 + (a.likes||0)*3 + postComments(a.id).length*2)
          ).slice(0, 3);
        if (top3.length === 0) return null;
        return (
          <div style={{ background:C.yellowLight, borderRadius:14, padding:"14px 16px", marginBottom:16, border:`1px solid ${C.yellow}40` }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#92400E", marginBottom:10 }}>
              🔥 인기 게시글 TOP 3
            </div>
            {top3.map((p, i) => (
              <div key={p.id} onClick={() => openPost(p)}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom: i<2?`1px solid ${C.yellow}30`:"none", cursor:"pointer" }}>
                <span style={{ fontSize:15, fontWeight:900, color:["#F59E0B","#9CA3AF","#CD7C3A"][i], minWidth:20 }}>
                  {["1","2","3"][i]}
                </span>
                <span style={{ fontSize:12, background:C.yellowLight, border:`1px solid ${C.yellow}60`, borderRadius:5, padding:"1px 6px", color:"#92400E", flexShrink:0 }}>
                  {p.category}
                </span>
                <span style={{ fontSize:13, fontWeight:600, color:C.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                <div style={{ display:"flex", gap:8, fontSize:11, color:C.muted, flexShrink:0 }}>
                  <span>👁 {p.views||0}</span>
                  <span>👍 {p.likes||0}</span>
                  <span>💬 {postComments(p.id).length}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

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
            <span>👁 {p.views||0}</span>
            <span>👍 {p.likes||0}</span>
            <span>💬 {postComments(p.id).length}</span>
            <span>익명</span>
            {p.images?.length > 0 && <span>📷 {p.images.length}</span>}
          </div>
        </Card>
      ))}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:6, marginTop:16, flexWrap:"wrap" }}>
          <button onClick={() => setPage(1)} disabled={page===1}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", fontSize:12, color:page===1?C.border:C.muted, cursor:page===1?"not-allowed":"pointer" }}>«</button>
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", fontSize:12, color:page===1?C.border:C.muted, cursor:page===1?"not-allowed":"pointer" }}>‹</button>
          {Array.from({length:totalPages},(_,i)=>i+1)
            .filter(n => n===1 || n===totalPages || Math.abs(n-page)<=1)
            .reduce((acc,n,i,arr) => { if(i>0 && n-arr[i-1]>1) acc.push("..."); acc.push(n); return acc; },[])
            .map((n,i) => n==="..." ? (
              <span key={`d${i}`} style={{ color:C.muted, fontSize:12 }}>…</span>
            ) : (
              <button key={n} onClick={() => setPage(n)}
                style={{ background:page===n?C.navy:"none", border:`1px solid ${page===n?C.navy:C.border}`, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:page===n?700:400, color:page===n?"#fff":C.muted, cursor:"pointer" }}>
                {n}
              </button>
            ))}
          <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", fontSize:12, color:page===totalPages?C.border:C.muted, cursor:page===totalPages?"not-allowed":"pointer" }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page===totalPages}
            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", fontSize:12, color:page===totalPages?C.border:C.muted, cursor:page===totalPages?"not-allowed":"pointer" }}>»</button>
        </div>
      )}
      {allFiltered.length > 0 && (
        <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:6 }}>
          {(page-1)*PAGE_SIZE+1}~{Math.min(page*PAGE_SIZE, allFiltered.length)} / 전체 {allFiltered.length}개
        </div>
      )}

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
            <span>👁 {selPost.views||0}</span>
          </div>
          <div style={{ fontSize:14, color:C.text, lineHeight:1.8, marginBottom: selPost.images?.length>0?12:20, whiteSpace:"pre-wrap" }}>{selPost.content}</div>
          {selPost.images?.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8, marginBottom:20, paddingBottom:20, borderBottom:`1px solid ${C.border}` }}>
              {selPost.images.map((url, i) => (
                <img key={i} src={url} alt={`첨부${i+1}`} onClick={() => window.open(url,"_blank")}
                  style={{ width:"100%", height:180, borderRadius:8, objectFit:"cover", cursor:"pointer", border:`1px solid ${C.border}`, display:"block" }} />
              ))}
            </div>
          )}

          {/* 좋아요 */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
            <button onClick={() => toggleLike("post", selPost)}
              style={{ background:(selPost.likedBy||[]).includes(profile?.uid)?C.blueLight:C.bg, border:`1px solid ${C.border}`, borderRadius:20, padding:"6px 20px", fontSize:13, color:(selPost.likedBy||[]).includes(profile?.uid)?C.blue:C.muted, cursor:"pointer" }}>
              👍 {selPost.likes||0}
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
                    style={{ background:"none", border:"none", fontSize:11, color:(c.likedBy||[]).includes(profile?.uid)?C.blue:C.muted, cursor:"pointer" }}>
                    👍 {c.likes||0}
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
          {/* 이미지 첨부 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>
              이미지 첨부 <span style={{ color:C.muted, fontWeight:400 }}>(최대 3장)</span>
            </div>
            {writeForm.images.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:8 }}>
                {writeForm.images.map((url, i) => (
                  <div key={i} style={{ position:"relative", paddingTop:"75%", borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg }}>
                    <img src={url} alt={`첨부${i+1}`} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                    <button onClick={() => setWriteForm(p=>({...p, images:p.images.filter((_,j)=>j!==i)}))}
                      style={{ position:"absolute", top:3, right:3, background:C.red, color:"#fff", border:"none", borderRadius:"50%", width:20, height:20, cursor:"pointer", fontSize:11, fontWeight:700 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {writeForm.images.length < 3 && (
              <button onClick={() => imgInputRef.current?.click()}
                disabled={imgUploading}
                style={{ display:"flex", alignItems:"center", gap:6, background:C.bg, border:`1.5px dashed ${C.border}`, borderRadius:10, padding:"9px 16px", fontSize:13, color:C.muted, cursor:"pointer", width:"100%" }}>
                {imgUploading ? "⏳ 업로드 중..." : "📷 이미지 추가"}
              </button>
            )}
            <input ref={imgInputRef} type="file" accept="image/*" multiple style={{ display:"none" }}
              onChange={async (e) => {
                const files = Array.from(e.target.files).slice(0, 3 - writeForm.images.length);
                if (!files.length) return;
                setImgUploading(true);
                try {
                  const urls = await Promise.all(files.map(uploadImage));
                  setWriteForm(p => ({ ...p, images: [...p.images, ...urls] }));
                } catch { alert("이미지 업로드 실패"); }
                finally { setImgUploading(false); e.target.value = ""; }
              }} />
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
