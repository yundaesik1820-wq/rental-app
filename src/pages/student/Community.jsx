import { useState, useRef } from "react";
import { C } from "../../theme";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { serverTimestamp } from "firebase/firestore";

const CATEGORIES  = ["전체", "자유", "질문", "강의", "정보", "취업", "장터", "새내기"];
const ANON_CATS   = ["자유", "질문", "강의", "새내기"]; // 익명
const REAL_CATS   = ["정보", "취업", "장터"]; // 실명
const LECTURE_CAT = "강의"; // 강의 전용
const NEWBIE_CAT  = "새내기"; // 새내기 전용

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
  const isSuper    = profile?.role === "admin"; // 모든 관리자 동일
  const isAssist   = false;
  const canSeeReal = profile?.role === "admin"; // 모든 관리자 실명 확인 가능

  // 새내기 여부
  const studentId  = profile?.studentId || "";
  const isNewbie   = studentId.startsWith(newbiePrefix);

  const [cat, setCat]           = useState("전체");
  const [selPost, setSelPost]   = useState(null); // 상세 모달
  const [showWrite, setShowWrite] = useState(false);
  const [writeForm, setWriteForm] = useState({ title:"", content:"", category:"자유", images:[],
    lectureName:"", professor:"", schedule:"" }); // 강의 전용 필드
  const [commentRating, setCommentRating] = useState(0); // 별점
  const [showEdit,    setShowEdit]    = useState(false); // 수정 모달
  const [editForm,    setEditForm]    = useState({ title:"", content:"" });
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

  // 카테고리 기반 이름 표시
  const displayName = (post) => {
    if (post.category === LECTURE_CAT) return "익명"; // 강의는 항상 완전 익명
    if (REAL_CATS.includes(post.category)) return post.authorName || ""; // 실명
    if (canSeeReal) return `${post.authorName || "익명"} (익명)`; // 관리자는 실명 보임
    return "익명";
  };
  const displayCommentName = (c, postCategory) => {
    if (postCategory === LECTURE_CAT) return "익명"; // 강의 댓글 항상 익명
    if (REAL_CATS.includes(postCategory)) return c.authorName || ""; // 실명 게시판 댓글
    if (canSeeReal) return `${c.authorName || "익명"} (익명)`;
    return "익명";
  };

  // 필터링
  const allFiltered = posts
    .filter(p => {
      if (cat !== "전체" && p.category !== cat) return false;
      // 전체 탭에서는 강의 게시판 글 제외
      if (cat === "전체" && p.category === LECTURE_CAT) return false;
      if (search && !p.title.includes(search) && !(p.content||"").includes(search) &&
          !(p.lectureName||"").includes(search) && !(p.professor||"").includes(search)) return false;
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
    const isLecturePost = writeForm.category === LECTURE_CAT;
    // 카테고리별 유효성 검사
    if (isLecturePost) {
      if (!writeForm.lectureName.trim() || !writeForm.professor.trim()) return;
    } else {
      if (!writeForm.title.trim() || !writeForm.content.trim()) return;
      if (writeForm.category === "장터" && writeForm.images.length === 0) return;
    }
    if (writeForm.category === NEWBIE_CAT && !isNewbie && profile?.role !== "admin") {
      alert(`새내기 게시판은 ${newbiePrefix}학번 신입생만 이용할 수 있어요!`);
      return;
    }
    setSubmitting(true);
    const isLecture = isLecturePost;
    await addItem("communityPosts", {
      title:       isLecture ? writeForm.lectureName.trim() : writeForm.title.trim(),
      content:     isLecture ? "" : writeForm.content.trim(),
      category:    writeForm.category,
      authorId:    profile?.uid || "",
      authorName:  profile?.name || "",
      images:      writeForm.images || [],
      // 강의 전용 필드
      lectureName: isLecture ? writeForm.lectureName.trim() : "",
      professor:   isLecture ? writeForm.professor.trim() : "",
      schedule:    isLecture ? writeForm.schedule.trim() : "",
      views:      0,
      likes:      0,
      likedBy:    [],
      dislikes:   0,
      dislikedBy: [],
      createdAt:  serverTimestamp(),
    });
    setWriteForm({ title:"", content:"", category:"자유", images:[], newbieBlocked:false, lectureName:"", professor:"", schedule:"" });
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
      rating:     commentRating || 0,
      likes:      0,
      likedBy:    [],
      dislikes:   0,
      dislikedBy: [],
      createdAt:  serverTimestamp(),
    });
    setCommentText("");
    setCommentRating(0);
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

  // 비추천
  const toggleDislike = async (type, item) => {
    const uid        = profile?.uid || "";
    const disliked   = (item.dislikedBy || []).includes(uid);
    const newDislikes   = disliked ? item.dislikes - 1 : (item.dislikes || 0) + 1;
    const newDislikedBy = disliked
      ? (item.dislikedBy || []).filter(id => id !== uid)
      : [...(item.dislikedBy || []), uid];
    const col = type === "post" ? "communityPosts" : "communityComments";
    await updateItem(col, item.id, { dislikes: newDislikes, dislikedBy: newDislikedBy });
    if (type === "post" && selPost?.id === item.id) {
      setSelPost({ ...selPost, dislikes: newDislikes, dislikedBy: newDislikedBy });
    }
  };

  // 조회수 증가 (5분 쿨다운)
  const openPost = async (post) => {
    // 새내기 게시판은 신입생만 열람 가능
    if (post.category === NEWBIE_CAT && !isNewbie && profile?.role !== "admin") {
      alert("🌱 새내기 게시판은 신입생만 열람할 수 있어요!");
      return;
    }
    // 5분 쿨다운 체크 (localStorage)
    const viewKey = `viewed_${profile?.uid}_${post.id}`;
    const lastViewed = parseInt(localStorage.getItem(viewKey) || "0");
    const now = Date.now();
    const COOLDOWN = 5 * 60 * 1000; // 5분
    if (now - lastViewed > COOLDOWN) {
      localStorage.setItem(viewKey, String(now));
      await updateItem("communityPosts", post.id, { views: (post.views || 0) + 1 });
      setSelPost({ ...post, views: (post.views || 0) + 1 });
    } else {
      setSelPost(post);
    }
    setCommentText("");
  };

  // 관리자 삭제
  const adminDeletePost = async (postId) => {
    if (!window.confirm("이 게시글을 삭제하시겠습니까?")) return;
    await deleteItem("communityPosts", postId);
    setSelPost(null);
  };

  // 본인 글 삭제 (실명 게시판)
  const deleteMyPost = async (postId) => {
    if (!window.confirm("게시글을 삭제하시겠습니까?")) return;
    await deleteItem("communityPosts", postId);
    setSelPost(null);
  };

  // 본인 글 수정 (실명 게시판)
  const updateMyPost = async () => {
    if (!editForm.title.trim() || !editForm.content.trim()) return;
    await updateItem("communityPosts", selPost.id, {
      title:   editForm.title.trim(),
      content: editForm.content.trim(),
    });
    setSelPost({ ...selPost, title: editForm.title.trim(), content: editForm.content.trim() });
    setShowEdit(false);
  };

  const canEditDelete = (post) =>
    REAL_CATS.includes(post?.category) && post?.authorId === profile?.uid;
  const adminDeleteComment = async (commentId) => {
    if (!window.confirm("이 댓글을 삭제하시겠습니까?")) return;
    await deleteItem("communityComments", commentId);
  };

  const catColor = (c) => {
    const m = { "자유":C.blue, "질문":C.orange, "강의":C.purple, "정보":C.green, "취업":C.teal, "장터":C.yellow, "새내기":C.orange };
    return m[c] || C.muted;
  };
  const catBg = (c) => {
    const m = { "자유":C.blueLight, "질문":C.orangeLight, "강의":C.purpleLight, "정보":C.greenLight, "취업":C.tealLight, "장터":C.yellowLight, "새내기":C.orangeLight };
    return m[c] || C.bg;
  };
  // 카테고리에 따라 익명/실명 판단
  const isAnon = (category) => ANON_CATS.includes(category) || !REAL_CATS.includes(category);

  return (
    <div>
{/* 페이지 안내 배너 */}
      <div style={{ background:`linear-gradient(135deg,#1B2B6B,#0D9488)`, borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img src="/mascot/curious.png" alt="렌토리" style={{ width:90, height:90, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />
          <div style={{ position:"relative", background:"#fff", borderRadius:12, padding:"10px 14px", flex:1 }}>
            <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderRight:"9px solid #fff" }} />
            <div style={{ fontSize:12, fontWeight:700, color:"#1B2B6B", marginBottom:3 }}>여기는 에브리타임 페이지야!</div>
            <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>익명으로 자유롭게 소통할 수 있어.
질문, 정보, 저격까지 다양한 글을 올릴 수 있어 💬</div>
          </div>
        </div>
      </div>

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

      {/* 카테고리 탭 - 1줄 스크롤 */}
      <div style={{ display:"flex", gap:4, marginBottom:8, flexWrap:"nowrap", overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch" }}>
        {CATEGORIES.map(c => {
          const isLocked = c === NEWBIE_CAT && !isNewbie && profile?.role !== "admin";
          return (
            <button key={c} onClick={() => { setCat(c); setPage(1); }}
              style={{ padding:"5px 10px", borderRadius:14, border:`1px solid ${cat===c?C.navy:C.border}`,
                background:cat===c?C.navy:C.bg, color:cat===c?"#fff":isLocked?C.border:C.muted,
                fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
                display:"flex", alignItems:"center", gap:3 }}>
              {c === NEWBIE_CAT && "🌱"}{c}{isLocked && " 🔒"}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize:10, color:C.muted, marginBottom:10 }}>
        익명: 자유·질문·강의·새내기 &nbsp;|&nbsp; 실명: 정보·취업·장터
      </div>

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
                  {(p.dislikes||0) > 0 && <span>👎 {p.dislikes||0}</span>}
                  <span>💬 {postComments(p.id).length}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 게시글 목록 */}
      {filtered.length === 0 && <Empty icon="📝" text="게시글이 없습니다" />}
      {filtered.map(p => {
        const pComments = postComments(p.id);
        const isLecture = p.category === LECTURE_CAT;
        const avgRating = isLecture && pComments.length > 0
          ? (pComments.reduce((s,c) => s+(c.rating||0), 0) / pComments.length).toFixed(1)
          : null;
        return (
          <Card key={p.id} onClick={() => openPost(p)} style={{ marginBottom:10, cursor:"pointer" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", flex:1, minWidth:0 }}>
                <span style={{ background:catBg(p.category), color:catColor(p.category), borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, flexShrink:0 }}>{p.category}</span>
                <span style={{ fontSize:14, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {isLecture ? p.lectureName : p.title}
                </span>
              </div>
              <span style={{ fontSize:11, color:C.muted, flexShrink:0, marginLeft:8 }}>{formatDate(p.createdAt)}</span>
            </div>
            {isLecture ? (
              <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>
                <span>👨‍🏫 {p.professor}</span>
                {p.schedule && <span style={{ marginLeft:10 }}>🕐 {p.schedule}</span>}
                {avgRating && <span style={{ marginLeft:10, color:C.yellow, fontWeight:700 }}>⭐ {avgRating}</span>}
              </div>
            ) : (
              <div style={{ fontSize:13, color:C.muted, marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.content}</div>
            )}
            <div style={{ display:"flex", gap:14, fontSize:12, color:C.muted }}>
              <span>👁 {p.views||0}</span>
              {!isLecture && <span>👍 {p.likes||0}</span>}
              <span>💬 {pComments.length}{isLecture && avgRating ? ` · ⭐${avgRating}` : ""}</span>
              <span style={{ marginLeft:"auto" }}>{displayName(p)}</span>
              {p.images?.length > 0 && <span>📷 {p.images.length}</span>}
            </div>
          </Card>
        );
      })}

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
            <div style={{ display:"flex", gap:6 }}>
              {canEditDelete(selPost) && (
                <>
                  <Btn onClick={() => { setEditForm({ title:selPost.title, content:selPost.content }); setShowEdit(true); }} color={C.green} small>수정</Btn>
                  <Btn onClick={() => deleteMyPost(selPost.id)} color={C.red} small outline>삭제</Btn>
                </>
              )}
              {isSuper && <Btn onClick={() => adminDeletePost(selPost.id)} color={C.red} small>관리자삭제</Btn>}
            </div>
          </div>
          {selPost.category === LECTURE_CAT ? (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:19, fontWeight:800, color:C.navy, marginBottom:6 }}>{selPost.lectureName}</div>
              <div style={{ display:"flex", gap:12, fontSize:13, color:C.muted, flexWrap:"wrap" }}>
                <span>👨‍🏫 {selPost.professor}</span>
                {selPost.schedule && <span>🕐 {selPost.schedule}</span>}
                {(() => {
                  const pcs = postComments(selPost.id);
                  const rated = pcs.filter(c => c.rating > 0);
                  if (!rated.length) return null;
                  const avg = (rated.reduce((s,c)=>s+(c.rating||0),0)/rated.length).toFixed(1);
                  return <span style={{ color:C.yellow, fontWeight:700 }}>⭐ {avg} ({rated.length}명)</span>;
                })()}
                <span>👁 {selPost.views||0}</span>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:19, fontWeight:800, color:C.navy, marginBottom:6 }}>{selPost.title}</div>
              <div style={{ display:"flex", gap:12, fontSize:12, color:C.muted, marginBottom:16 }}>
                <span>{displayName(selPost)}</span>
                <span>{formatDate(selPost.createdAt)}</span>
                <span>👁 {selPost.views||0}</span>
              </div>
              <div style={{ fontSize:14, color:C.text, lineHeight:1.8, marginBottom: selPost.images?.length>0?12:20, whiteSpace:"pre-wrap" }}>{selPost.content}</div>
            </div>
          )}
          {selPost.images?.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8, marginBottom:20, paddingBottom:20, borderBottom:`1px solid ${C.border}` }}>
              {selPost.images.map((url, i) => (
                <img key={i} src={url} alt={`첨부${i+1}`} onClick={() => window.open(url,"_blank")}
                  style={{ width:"100%", height:180, borderRadius:8, objectFit:"cover", cursor:"pointer", border:`1px solid ${C.border}`, display:"block" }} />
              ))}
            </div>
          )}

          {/* 추천/비추천 */}
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:20 }}>
            <button onClick={() => toggleLike("post", selPost)}
              style={{ background:(selPost.likedBy||[]).includes(profile?.uid)?C.blueLight:C.bg, border:`1px solid ${(selPost.likedBy||[]).includes(profile?.uid)?C.blue:C.border}`, borderRadius:20, padding:"6px 20px", fontSize:13, color:(selPost.likedBy||[]).includes(profile?.uid)?C.blue:C.muted, cursor:"pointer", fontWeight:600 }}>
              👍 {selPost.likes||0}
            </button>
            <button onClick={() => toggleDislike("post", selPost)}
              style={{ background:(selPost.dislikedBy||[]).includes(profile?.uid)?C.redLight:C.bg, border:`1px solid ${(selPost.dislikedBy||[]).includes(profile?.uid)?C.red:C.border}`, borderRadius:20, padding:"6px 20px", fontSize:13, color:(selPost.dislikedBy||[]).includes(profile?.uid)?C.red:C.muted, cursor:"pointer", fontWeight:600 }}>
              👎 {selPost.dislikes||0}
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
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{displayCommentName(c, selPost.category)}</span>
                  <span style={{ fontSize:11, color:C.muted }}>{formatDate(c.createdAt)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button onClick={() => toggleLike("comment", c)}
                    style={{ background:"none", border:"none", fontSize:11, color:(c.likedBy||[]).includes(profile?.uid)?C.blue:C.muted, cursor:"pointer", fontWeight:600 }}>
                    👍 {c.likes||0}
                  </button>
                  <button onClick={() => toggleDislike("comment", c)}
                    style={{ background:"none", border:"none", fontSize:11, color:(c.dislikedBy||[]).includes(profile?.uid)?C.red:C.muted, cursor:"pointer", fontWeight:600 }}>
                    👎 {c.dislikes||0}
                  </button>
                  {isSuper && (
                    <button onClick={() => adminDeleteComment(c.id)}
                      style={{ background:"none", border:"none", color:C.red, fontSize:11, cursor:"pointer" }}>삭제</button>
                  )}
                </div>
              </div>
              {selPost.category === LECTURE_CAT && c.rating > 0 && (
                <div style={{ fontSize:13, color:C.yellow, marginBottom:4 }}>
                  {"⭐".repeat(c.rating)} <span style={{ fontSize:11, color:C.muted }}>({c.rating}/5)</span>
                </div>
              )}
              <div style={{ fontSize:13, color:C.text, lineHeight:1.6, wordBreak:"break-word", whiteSpace:"pre-wrap" }}>{c.content}</div>
            </div>
          ))}

          {/* 댓글 작성 */}
          {selPost.category === LECTURE_CAT && (
            <div style={{ marginTop:12, marginBottom:6 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:6 }}>별점</div>
              <div style={{ display:"flex", gap:4 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setCommentRating(commentRating===n?0:n)}
                    style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", opacity:n<=commentRating?1:0.3 }}>
                    ⭐
                  </button>
                ))}
                {commentRating > 0 && <span style={{ fontSize:12, color:C.muted, alignSelf:"center" }}>{commentRating}점</span>}
              </div>
            </div>
          )}
          <div style={{ background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginTop:8 }}>
            <input placeholder={selPost.category===LECTURE_CAT?"수강 후기를 남겨주세요...":"댓글을 입력하세요..."} value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(selPost.id); }}}
              style={{ width:"100%", background:"none", border:"none", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:11, color:C.muted }}>
                {REAL_CATS.includes(selPost.category) ? "실명으로 게시됩니다" : "익명으로 게시됩니다"}
              </span>
              <Btn onClick={() => submitComment(selPost.id)} color={C.navy} disabled={submitting || !commentText.trim()} small>등록</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* 수정 모달 */}
      {showEdit && selPost && (
        <Modal onClose={() => setShowEdit(false)} width={540}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:16 }}>✏️ 게시글 수정</div>
          <Inp label="제목 *" value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} />
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>내용 *</div>
            <textarea value={editForm.content} onChange={e => setEditForm(p=>({...p,content:e.target.value}))}
              style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:160, boxSizing:"border-box" }} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowEdit(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={updateMyPost} color={C.navy} full disabled={!editForm.title.trim() || !editForm.content.trim()}>수정 완료</Btn>
          </div>
        </Modal>
      )}

      {/* 글쓰기 모달 */}
      {showWrite && (
        <Modal onClose={() => setShowWrite(false)} width={540}>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:20 }}>✏️ 글쓰기</div>

          {/* 카테고리 선택 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>카테고리</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {CATEGORIES.filter(c => c !== "전체").map(c => {
                const isLocked = c === NEWBIE_CAT && !isNewbie && profile?.role !== "admin";
                return (
                  <button key={c} onClick={() => !isLocked && setWriteForm(p=>({...p, category:c}))}
                    style={{ padding:"5px 12px", borderRadius:12, border:`1px solid ${writeForm.category===c?catColor(c):C.border}`, background:writeForm.category===c?catBg(c):C.bg, color:writeForm.category===c?catColor(c):isLocked?C.border:C.muted, fontSize:12, fontWeight:600, cursor:isLocked?"not-allowed":"pointer" }}>
                    {c === NEWBIE_CAT && "🌱"}{c}{isLocked && " 🔒"}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize:10, color:C.muted, marginTop:6 }}>
              {REAL_CATS.includes(writeForm.category) ? "✅ 실명으로 게시됩니다" : "🔒 익명으로 게시됩니다"}
            </div>
          </div>

          {/* 강의 게시판 전용 폼 */}
          {writeForm.category === LECTURE_CAT ? (
            <div>
              <Inp label="강의명 *" placeholder="예: TV촬영실습I" value={writeForm.lectureName} onChange={e => setWriteForm(p=>({...p,lectureName:e.target.value}))} />
              <Inp label="담당 교수님 *" placeholder="예: 홍길동 교수님" value={writeForm.professor} onChange={e => setWriteForm(p=>({...p,professor:e.target.value}))} />
              <Inp label="강의 요일/시간" placeholder="예: 월 09:00~12:00" value={writeForm.schedule} onChange={e => setWriteForm(p=>({...p,schedule:e.target.value}))} />
            </div>
          ) : (
            <div>
              <Inp label="제목 *" placeholder="제목을 입력하세요" value={writeForm.title} onChange={e => setWriteForm(p=>({...p,title:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>내용 *</div>
                <textarea placeholder="내용을 입력하세요..." value={writeForm.content} onChange={e => setWriteForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:160, boxSizing:"border-box" }} />
              </div>
            </div>
          )}
          {/* 이미지 첨부 - 강의 게시판 제외 */}
          {writeForm.category !== LECTURE_CAT && <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>
              이미지 첨부{" "}
              <span style={{ color:C.muted, fontWeight:400 }}>(최대 3장)</span>
              {writeForm.category === "장터" && <span style={{ color:C.red, fontWeight:600, fontSize:11 }}> · 필수</span>}
            </div>
            {writeForm.category === "장터" && (
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>
                📦 장터 게시판은 제품 사진을 최소 1장 이상 업로드해야 글 작성이 가능해요
              </div>
            )}
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
          </div>}

          <div style={{ background:C.yellowLight, borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400E", marginBottom:16 }}>
            {writeForm.category === LECTURE_CAT
              ? "⚠️ 익명으로 게시되며, 학생들이 댓글로 후기를 남길 수 있어요."
              : REAL_CATS.includes(writeForm.category)
              ? "⚠️ 실명으로 게시되며, 게시 후 수정·삭제가 불가합니다."
              : "⚠️ 익명으로 게시되며, 게시 후 수정·삭제가 불가합니다."}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowWrite(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={submitPost} color={C.navy} full disabled={submitting ||
              (writeForm.category === LECTURE_CAT
                ? !writeForm.lectureName.trim() || !writeForm.professor.trim()
                : !writeForm.title.trim() || !writeForm.content.trim() ||
                  (writeForm.category === "장터" && writeForm.images.length === 0))
            }>
              {submitting ? "게시 중..." : "게시하기"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
