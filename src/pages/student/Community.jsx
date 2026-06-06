import { useState, useRef, useEffect } from "react";
import { C } from "../../theme";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { serverTimestamp } from "firebase/firestore";
import EveryTimeIntro from "../../components/EveryTimeIntro";

const CATEGORIES  = ["전체", "자유", "질문", "강의", "정보", "취업", "공모전", "팝니다", "삽니다", "새내기", "협업모집", "작품공유"];
const ANON_CATS   = ["자유", "질문", "강의", "새내기", "협업모집", "작품공유"]; // 익명
const REAL_CATS   = ["정보", "취업", "공모전", "팝니다", "삽니다"]; // 실명
const LECTURE_CAT = "강의"; // 강의 전용
const NEWBIE_CAT  = "새내기"; // 새내기 전용

// 🎬 ROOMS 정의 - ZZOTKYO 진입 분기
const ROOMS = [
  {
    id:"community",
    number:"01",
    icon:"💬",
    subtitle:"BEHIND THE SCENES",
    title:"커뮤니티",
    desc:"익명으로 나누는 영상계열 이야기",
    color:"#dc2626",
    colorBg:"rgba(220,38,38,0.15)",
    borderStyle:"solid",
    categories:["자유", "질문", "새내기"],
  },
  {
    id:"knowledge",
    number:"02",
    icon:"📚",
    subtitle:"KNOWLEDGE",
    title:"정보 공유",
    desc:"강의·정보·취업·공모전",
    color:"#06b6d4",
    colorBg:"rgba(6,182,212,0.15)",
    borderStyle:"solid",
    categories:["강의", "정보", "취업", "공모전"],
  },
  {
    id:"marketplace",
    number:"03",
    icon:"🛒",
    subtitle:"MARKETPLACE",
    title:"중고 장터",
    desc:"학생들 간 거래 게시판",
    color:"#10b981",
    colorBg:"rgba(16,185,129,0.15)",
    borderStyle:"solid",
    categories:["팝니다", "삽니다"],
  },
  {
    id:"tools",
    number:"04",
    icon:"🎬",
    subtitle:"FILM TOOLS",
    title:"필름 도구",
    desc:"촬영 현장 실용 도구",
    color:"#fbbf24",
    colorBg:"rgba(251,191,36,0.15)",
    borderStyle:"dashed",
    categories:[], // 도구는 카테고리 X
  },
  {
    id:"boxoffice",
    number:"05",
    icon:"🎥",
    subtitle:"STUDENT BOXOFFICE",
    title:"스튜던트 박스오피스",
    desc:"협업 모집 · 작품 공유",
    color:"#a855f7",
    colorBg:"rgba(168,85,247,0.15)",
    borderStyle:"solid",
    categories:["협업모집", "작품공유"],
  },
];

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

export default function Community({ onExit }) {
  const { profile } = useAuth();

  // 진입 인트로 - 세션당 한 번만 표시
  const INTRO_KEY = "everytime_intro_shown_session";
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(INTRO_KEY) !== "1";
  });
  useEffect(() => {
    if (!showIntro && typeof window !== "undefined") {
      sessionStorage.setItem(INTRO_KEY, "1");
    }
  }, [showIntro]);

  // 🎬 선택된 룸 - null이면 분기 화면, 그 외엔 해당 룸 표시
  const [selectedRoom, setSelectedRoom] = useState(null);
  const currentRoom = ROOMS.find(r => r.id === selectedRoom);

  const { data: posts }    = useCollection("communityPosts",    "createdAt");
  const { data: comments } = useCollection("communityComments", "createdAt");

  const adminRole  = profile?.adminRole || "super";
  const isSuper    = profile?.role === "admin"; // 모든 관리자 동일
  const isAssist   = false;
  const canSeeReal = profile?.role === "admin"; // 모든 관리자 실명 확인 가능
  // 실명 모드 사용 권한: 슈퍼관리자 + 조교만
  const canUseRealName = profile?.role === "admin" &&
    (adminRole === "super" || adminRole === "assistant");
  // 관리자 역할 라벨 (에브리타임에서는 super도 조교로 표시 - 학생 친화적)
  const adminRoleLabel = adminRole === "teacher"   ? "교사"
                       : adminRole === "professor" ? "교수"
                       : "조교";  // super, assistant 둘 다 조교

  // 새내기 여부
  const studentId  = profile?.studentId || "";
  const isNewbie   = studentId.startsWith(newbiePrefix);

  const [cat, setCat]           = useState("전체");
  const [selPost, setSelPost]   = useState(null); // 상세 모달
  const [showWrite, setShowWrite] = useState(false);
  const [writeForm, setWriteForm] = useState({ title:"", content:"", category:"자유", images:[],
    lectureName:"", professor:"", schedule:"", useRealName:false }); // 강의 전용 필드 + 관리자 실명모드
  const [commentRating, setCommentRating] = useState(0); // 별점
  const [showEdit,    setShowEdit]    = useState(false); // 수정 모달
  const [editForm,    setEditForm]    = useState({ title:"", content:"" });
  const [commentText, setCommentText] = useState("");
  const [commentUseRealName, setCommentUseRealName] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [selImage, setSelImage]   = useState(null); // 이미지 라이트박스
  const imgInputRef = useRef(null);
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const PAGE_SIZE = 10;

  // 🎬 시네마 톤 컬러 팔레트
  const CINEMA = {
    bg:        "#0a0a0a",
    surface:   "#1a1a1a",
    surfaceAlt:"#16130d",  // 메모지 골드 배경
    border:    "#2a2a2a",
    borderRed: "rgba(220,38,38,0.3)",
    text:      "#fafaf9",
    muted:     "#a8a29e",
    mutedDim:  "#71706b",
    red:       "#dc2626",
    redBright: "#ef4444",
    redBg:     "rgba(220,38,38,0.15)",
    gold:      "#fbbf24",
    goldBg:    "rgba(251,191,36,0.15)",
    goldText:  "#92400e",
  };

  const formatDate = (ts) => {
    if (!ts?.seconds) return "";
    const d = new Date(ts.seconds * 1000);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  // 카테고리 기반 이름 표시
  const displayName = (post) => {
    // 관리자가 실명 모드로 작성한 글: 이름(역할)로 모두에게 표시
    if (post.useRealName && post.adminRoleAtWrite) {
      const lbl = post.adminRoleAtWrite === "teacher"   ? "교사"
                : post.adminRoleAtWrite === "professor" ? "교수"
                : "조교";  // super, assistant 둘 다 조교
      return `${post.authorName || "관리자"}(${lbl})`;
    }
    if (post.category === LECTURE_CAT) return "익명"; // 강의는 항상 완전 익명
    if (REAL_CATS.includes(post.category)) return post.authorName || ""; // 실명
    if (canSeeReal) return `${post.authorName || "익명"} (익명)`; // 관리자는 실명 보임
    return "익명";
  };
  const displayCommentName = (c, postCategory) => {
    // 관리자가 실명 모드로 작성한 댓글
    if (c.useRealName && c.adminRoleAtWrite) {
      const lbl = c.adminRoleAtWrite === "teacher"   ? "교사"
                : c.adminRoleAtWrite === "professor" ? "교수"
                : "조교";  // super, assistant 둘 다 조교
      return `${c.authorName || "관리자"}(${lbl})`;
    }
    if (postCategory === LECTURE_CAT) return "익명"; // 강의 댓글 항상 익명
    if (REAL_CATS.includes(postCategory)) return c.authorName || ""; // 실명 게시판 댓글
    if (canSeeReal) return `${c.authorName || "익명"} (익명)`;
    return "익명";
  };

  // 필터링
  // 룸별 카테고리 필터링: 현재 룸이 허용하는 카테고리만 표시
  const roomCategories = currentRoom?.categories || [];
  const allFiltered = posts
    .filter(p => {
      // 룸의 허용 카테고리에 속하지 않으면 제외
      if (currentRoom && roomCategories.length > 0 && !roomCategories.includes(p.category)) return false;
      // 카테고리 탭 필터
      if (cat !== "전체" && p.category !== cat) return false;
      // 전체 탭에서는 강의 게시판 글 제외 (정보 룸에서는 강의 보이게)
      if (cat === "전체" && p.category === LECTURE_CAT && currentRoom?.id !== "knowledge") return false;
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
    // 강의 게시판은 완전 익명이므로 실명 모드 사용 안 함
    const useRealNameFinal = canUseRealName && writeForm.useRealName && !isLecture;
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
      // 관리자 실명 모드 플래그
      useRealName:        useRealNameFinal,
      adminRoleAtWrite:   useRealNameFinal ? adminRole : "",
      views:      0,
      likes:      0,
      likedBy:    [],
      dislikes:   0,
      dislikedBy: [],
      createdAt:  serverTimestamp(),
    });
    setWriteForm({ title:"", content:"", category:"자유", images:[], newbieBlocked:false, lectureName:"", professor:"", schedule:"", useRealName:false });
    setShowWrite(false);
    setSubmitting(false);
  };

  // 댓글 작성
  const submitComment = async (postId) => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    // 강의 게시판 댓글은 완전 익명이므로 실명 모드 사용 안 함
    const postCategory = selPost?.category;
    const useRealNameFinal = canUseRealName && commentUseRealName && postCategory !== LECTURE_CAT;
    await addItem("communityComments", {
      postId,
      content:    commentText.trim(),
      authorId:   profile?.uid || "",
      authorName: profile?.name || "",
      rating:     commentRating || 0,
      // 관리자 실명 모드 플래그
      useRealName:        useRealNameFinal,
      adminRoleAtWrite:   useRealNameFinal ? adminRole : "",
      likes:      0,
      likedBy:    [],
      dislikes:   0,
      dislikedBy: [],
      createdAt:  serverTimestamp(),
    });
    setCommentText("");
    setCommentRating(0);
    setCommentUseRealName(false);
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

  // 조회수 증가 (쿨다운 없음 - 클릭할 때마다 +1)
  const openPost = async (post) => {
    // 새내기 게시판은 신입생만 열람 가능
    if (post.category === NEWBIE_CAT && !isNewbie && profile?.role !== "admin") {
      alert("🌱 새내기 게시판은 신입생만 열람할 수 있어요!");
      return;
    }
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
    <>
      {/* 🎬 진입 인트로 (세션당 1회) */}
      {showIntro && <EveryTimeIntro onComplete={() => setShowIntro(false)} />}

      {/* 🎬 시네마 톤 풀스크린 컨테이너 */}
      <div style={{
        position:"fixed", inset:0, zIndex:90,
        background:"#0a0a0a",
        color:"#fafaf9",
        overflowY:"auto",
        WebkitOverflowScrolling:"touch",
        paddingBottom:"env(safe-area-inset-bottom, 16px)",
      }}>
        {/* 상단 시네마 헤더 - 룸별 동적 */}
        <div style={{
          position:"sticky", top:0, zIndex:50,
          background:"linear-gradient(180deg, rgba(10,10,10,0.98) 0%, rgba(10,10,10,0.85) 80%, rgba(10,10,10,0) 100%)",
          backdropFilter:"blur(8px)",
          padding:"14px 18px 18px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          borderBottom:`1px solid ${currentRoom ? currentRoom.color + "33" : "rgba(220,38,38,0.2)"}`,
        }}>
          <button onClick={() => currentRoom ? setSelectedRoom(null) : (onExit && onExit())}
            style={{
              background:`${currentRoom ? currentRoom.color : "#dc2626"}1A`,
              border:`1px solid ${currentRoom ? currentRoom.color : "#dc2626"}4D`,
              color:"#fafaf9", fontSize:12, fontWeight:600,
              padding:"7px 14px", borderRadius:8, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6,
            }}>
            <span style={{ color: currentRoom ? currentRoom.color : "#dc2626" }}>←</span>
            {currentRoom ? "ROOMS" : "메인으로"}
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color: currentRoom ? currentRoom.color : "#dc2626", fontSize:10, fontWeight:700, letterSpacing:"0.2em" }}>● REC</span>
            <span style={{ color:"#fafaf9", fontSize:14, fontWeight:900, letterSpacing:"0.1em" }}>
              {currentRoom ? currentRoom.title : "ZZOTKYO"}
            </span>
          </div>
          <div style={{ width:80 }} /> {/* 우측 여백 균형 */}
        </div>

        {/* 본문 콘텐츠 */}
        <div style={{ padding:"4px 14px 80px", maxWidth:1000, margin:"0 auto" }}>
    <div>
{/* 페이지 안내 배너 제거됨 - 시네마 헤더가 대체 */}

      {/* 공지 팝업 제거됨 */}

      {/* PageTitle 제거됨 (헤더의 "에브리타임"이 대체) - 글쓰기는 우하단 FAB으로 이동 */}

      {/* 🎬 룸 분기 화면 (selectedRoom === null) */}
      {!selectedRoom && (
        <div style={{ marginTop:20 }}>
          {/* CHOOSE YOUR ROOM 안내 */}
          <div style={{ textAlign:"center", marginBottom:18, padding:"0 8px" }}>
            <div style={{ fontFamily:"'Courier New', monospace", fontSize:10, color:"#dc2626", letterSpacing:"0.35em", fontWeight:700, marginBottom:5 }}>
              CHOOSE YOUR ROOM
            </div>
            <div style={{ fontSize:13, color:"#a8a29e" }}>어디로 가시겠습니까?</div>
          </div>

          {/* 5개 룸 박스 */}
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {ROOMS.map(room => {
              const isDashed = room.borderStyle === "dashed";
              return (
                <div key={room.id} onClick={() => { setSelectedRoom(room.id); setCat("전체"); setPage(1); setSearch(""); }}
                  style={{
                    background: isDashed ? "#16130d" : "#1a1a1a",
                    border: isDashed ? `1px dashed ${room.color}` : `1px solid #2a2a2a`,
                    borderLeft: isDashed ? `1px dashed ${room.color}` : `4px solid ${room.color}`,
                    borderRadius:6, padding:"13px 14px", cursor:"pointer", position:"relative",
                    transition:"transform 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <div style={{ position:"absolute", top:8, right:10, fontFamily:"'Courier New', monospace", fontSize:8, color:"#71706b", letterSpacing:"0.2em" }}>
                    ROOM {room.number}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ fontSize:32, lineHeight:1 }}>{room.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Courier New', monospace", fontSize:8, color:room.color, letterSpacing:"0.25em", fontWeight:700, marginBottom:3 }}>
                        {room.subtitle}
                      </div>
                      <div style={{ fontSize:16, fontWeight:900, color:"#fafaf9", marginBottom:4 }}>{room.title}</div>
                      {room.id === "tools" ? (
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {["슬레이터","스크립터","계산기","자료"].map(t => (
                            <span key={t} style={{ background:room.colorBg, color:room.color, fontSize:9, padding:"1px 6px", borderRadius:3, fontWeight:700 }}>{t}</span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {room.categories.map(c => (
                            <span key={c} style={{ background:room.colorBg, color:room.color, fontSize:9, padding:"1px 6px", borderRadius:3, fontWeight:700 }}>{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 푸터 */}
          <div style={{ padding:"18px 8px 30px", textAlign:"center", fontFamily:"'Courier New', monospace", fontSize:9, color:"#71706b", letterSpacing:"0.2em" }}>
            A ZZOTKYO PRESENTATION · {new Date().getFullYear()}
          </div>
        </div>
      )}

      {/* 🛠️ 필름 도구 룸 - 임시 placeholder */}
      {selectedRoom === "tools" && (
        <div style={{ textAlign:"center", padding:"80px 20px", color:"#a8a29e" }}>
          <div style={{ fontSize:60, opacity:0.4, marginBottom:18 }}>🎬</div>
          <div style={{ fontFamily:"'Courier New', monospace", fontSize:12, color:"#fbbf24", letterSpacing:"0.3em", marginBottom:8, fontWeight:700 }}>COMING SOON</div>
          <div style={{ fontSize:14, color:"#fafaf9", marginBottom:8 }}>필름 도구 룸</div>
          <div style={{ fontSize:12, color:"#71706b" }}>슬레이터 · 스크립터 · 계산기 · 자료 큐레이션</div>
        </div>
      )}

      {/* 게시판 룸들 (community, knowledge, marketplace, boxoffice) */}
      {selectedRoom && selectedRoom !== "tools" && (
        <>

      {/* 카테고리 탭 - 룸별 카테고리만 (시네마 톤 pill) */}
      <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"nowrap", overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch", marginTop:14 }}>
        {["전체", ...(currentRoom?.categories || [])].map(c => {
          const isLocked = c === NEWBIE_CAT && !isNewbie && profile?.role !== "admin";
          const active = cat === c;
          const roomColor = currentRoom?.color || CINEMA.red;
          return (
            <button key={c} onClick={() => { setCat(c); setPage(1); }}
              style={{ padding:"6px 14px", borderRadius:14,
                border:`1px solid ${active ? roomColor : CINEMA.border}`,
                background: active ? roomColor : CINEMA.surface,
                color: active ? "#fff" : (isLocked ? CINEMA.mutedDim : CINEMA.muted),
                fontSize:11, fontWeight: active ? 700 : 500, cursor:"pointer",
                whiteSpace:"nowrap", flexShrink:0,
                display:"flex", alignItems:"center", gap:3,
                transition:"all 0.15s",
              }}>
              {c === NEWBIE_CAT && "🌱"}{c}{isLocked && " 🔒"}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:12, letterSpacing:"0.05em" }}>
        {currentRoom?.id === "community" && "🔒 익명 게시판"}
        {currentRoom?.id === "knowledge" && "강의는 익명 · 정보·취업·공모전은 실명"}
        {currentRoom?.id === "marketplace" && "✅ 실명으로 게시"}
        {currentRoom?.id === "boxoffice" && "🔒 익명으로 게시"}
      </div>

      {/* 검색 - 시네마 톤 */}
      <input placeholder="🔍 제목, 내용 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        style={{ display:"block", width:"100%", background:CINEMA.surface,
          border:`1px solid ${CINEMA.border}`, borderRadius:10, color:CINEMA.text,
          padding:"10px 16px", fontSize:13, fontFamily:"inherit", outline:"none",
          marginBottom:16, boxSizing:"border-box" }} />

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
          <div style={{ background:CINEMA.surfaceAlt, borderRadius:10, padding:"12px 14px", marginBottom:16, border:`1px dashed ${CINEMA.gold}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:CINEMA.gold, marginBottom:10, letterSpacing:"0.2em", fontFamily:"'Courier New', monospace" }}>
              ★ BOX OFFICE · TOP 3
            </div>
            {top3.map((p, i) => (
              <div key={p.id} onClick={() => openPost(p)}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom: i<2?`1px solid rgba(251,191,36,0.15)`:"none", cursor:"pointer" }}>
                <span style={{ fontSize:15, fontWeight:900, color:["#fbbf24","#a8a29e","#cd7c3a"][i], minWidth:20, fontFamily:"'Courier New', monospace" }}>
                  {["01","02","03"][i]}
                </span>
                <span style={{ fontSize:10, background:CINEMA.goldBg, border:`1px solid ${CINEMA.gold}60`, borderRadius:4, padding:"1px 6px", color:CINEMA.gold, flexShrink:0, fontWeight:600 }}>
                  {p.category}
                </span>
                <span style={{ fontSize:12, fontWeight:600, color:CINEMA.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                <div style={{ display:"flex", gap:8, fontSize:10, color:CINEMA.muted, flexShrink:0 }}>
                  <span>👁 {p.views||0}</span>
                  <span style={{ color: CINEMA.redBright }}>♥ {p.likes||0}</span>
                  <span>💬 {postComments(p.id).length}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 게시글 목록 - 시네마 톤 */}
      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 20px", color:CINEMA.mutedDim }}>
          <div style={{ fontSize:48, opacity:0.3, marginBottom:12 }}>📝</div>
          <div style={{ fontSize:13, fontFamily:"'Courier New', monospace", letterSpacing:"0.15em" }}>NO POSTS YET</div>
        </div>
      )}
      {filtered.map(p => {
        const pComments = postComments(p.id);
        const isLecture = p.category === LECTURE_CAT;
        const avgRating = isLecture && pComments.length > 0
          ? (pComments.reduce((s,c) => s+(c.rating||0), 0) / pComments.length).toFixed(1)
          : null;
        // 관리자 실명 모드 글은 메모지(C) 스타일로 강조
        const isMemo = p.useRealName && (p.adminRoleAtWrite === "super" || p.adminRoleAtWrite === "assistant");

        if (isMemo) {
          // ===== C 스타일: 골드 메모지 =====
          return (
            <div key={p.id} onClick={() => openPost(p)}
              style={{
                background:CINEMA.surfaceAlt, border:`1px dashed ${CINEMA.gold}`,
                borderRadius:6, padding:"13px 14px", marginBottom:10, cursor:"pointer",
              }}>
              <div style={{
                fontFamily:"'Courier New', monospace", fontSize:9, color:CINEMA.gold,
                letterSpacing:"0.25em", marginBottom:8, fontWeight:700,
              }}>
                ★ MEMO PINNED · {p.category}
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:CINEMA.text, marginBottom:6, lineHeight:1.35 }}>
                {isLecture ? p.lectureName : p.title}
              </div>
              {isLecture && (
                <div style={{ fontSize:11, color:CINEMA.muted, marginBottom:6 }}>
                  👨‍🏫 {p.professor}
                  {avgRating && <span style={{ marginLeft:10, color:CINEMA.gold, fontWeight:700 }}>★ {avgRating}</span>}
                </div>
              )}
              {!isLecture && p.content && (
                <div style={{ fontSize:12, color:CINEMA.muted, marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.content}</div>
              )}
              <div style={{ fontFamily:"'Courier New', monospace", fontSize:10, color:CINEMA.muted, display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:CINEMA.gold }}>🏛️ {displayName(p)}</span>
                <span>·</span>
                <span>{formatDate(p.createdAt)}</span>
                <span style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
                  <span>👁 {p.views||0}</span>
                  <span style={{ color:CINEMA.redBright }}>♥ {p.likes||0}</span>
                  <span>💬 {pComments.length}</span>
                  {p.images?.length > 0 && <span>📷 {p.images.length}</span>}
                </span>
              </div>
            </div>
          );
        }

        // ===== A 스타일: 일반 글 카드 =====
        return (
          <div key={p.id} onClick={() => openPost(p)}
            style={{
              background:CINEMA.surface, borderLeft:`3px solid ${CINEMA.red}`,
              borderRadius:6, padding:"11px 12px", marginBottom:9, cursor:"pointer",
              border:`1px solid ${CINEMA.border}`, borderLeftWidth:3, borderLeftColor:CINEMA.red,
            }}>
            <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
              <span style={{ background:CINEMA.redBg, color:CINEMA.redBright, fontSize:9, padding:"2px 7px", borderRadius:3, fontWeight:700, letterSpacing:"0.05em", flexShrink:0 }}>
                {p.category}
              </span>
              <span style={{ fontSize:9, color:CINEMA.mutedDim, marginLeft:"auto", flexShrink:0 }}>
                {formatDate(p.createdAt)}
              </span>
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:CINEMA.text, marginBottom:6, lineHeight:1.35, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {isLecture ? p.lectureName : p.title}
            </div>
            {isLecture ? (
              <div style={{ fontSize:11, color:CINEMA.muted, marginBottom:6 }}>
                👨‍🏫 {p.professor}
                {p.schedule && <span style={{ marginLeft:10 }}>🕐 {p.schedule}</span>}
                {avgRating && <span style={{ marginLeft:10, color:CINEMA.gold, fontWeight:700 }}>★ {avgRating}</span>}
              </div>
            ) : (
              p.content && (
                <div style={{ fontSize:12, color:CINEMA.muted, marginBottom:7, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.content}</div>
              )
            )}
            <div style={{ fontSize:10, color:CINEMA.muted, display:"flex", gap:10, alignItems:"center" }}>
              <span>{displayName(p)}</span>
              <span style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
                <span>👁 {p.views||0}</span>
                {!isLecture && <span style={{ color:CINEMA.redBright }}>♥ {p.likes||0}</span>}
                <span>💬 {pComments.length}</span>
                {p.images?.length > 0 && <span>📷 {p.images.length}</span>}
              </span>
            </div>
          </div>
        );
      })}

      {/* 페이지네이션 - 시네마 톤 */}
      {totalPages > 1 && (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:6, marginTop:16, flexWrap:"wrap" }}>
          <button onClick={() => setPage(1)} disabled={page===1}
            style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:6, padding:"6px 10px", fontSize:12, color:page===1?CINEMA.mutedDim:CINEMA.muted, cursor:page===1?"not-allowed":"pointer" }}>«</button>
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
            style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:6, padding:"6px 12px", fontSize:12, color:page===1?CINEMA.mutedDim:CINEMA.muted, cursor:page===1?"not-allowed":"pointer" }}>‹</button>
          {Array.from({length:totalPages},(_,i)=>i+1)
            .filter(n => n===1 || n===totalPages || Math.abs(n-page)<=1)
            .reduce((acc,n,i,arr) => { if(i>0 && n-arr[i-1]>1) acc.push("..."); acc.push(n); return acc; },[])
            .map((n,i) => n==="..." ? (
              <span key={`d${i}`} style={{ color:CINEMA.muted, fontSize:12 }}>…</span>
            ) : (
              <button key={n} onClick={() => setPage(n)}
                style={{ background:page===n?CINEMA.red:CINEMA.surface, border:`1px solid ${page===n?CINEMA.red:CINEMA.border}`, borderRadius:6, padding:"6px 12px", fontSize:12, fontWeight:page===n?700:400, color:page===n?"#fff":CINEMA.muted, cursor:"pointer" }}>
                {n}
              </button>
            ))}
          <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
            style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:6, padding:"6px 12px", fontSize:12, color:page===totalPages?CINEMA.mutedDim:CINEMA.muted, cursor:page===totalPages?"not-allowed":"pointer" }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page===totalPages}
            style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:6, padding:"6px 10px", fontSize:12, color:page===totalPages?CINEMA.mutedDim:CINEMA.muted, cursor:page===totalPages?"not-allowed":"pointer" }}>»</button>
        </div>
      )}
      {allFiltered.length > 0 && (
        <div style={{ fontSize:10, color:CINEMA.mutedDim, textAlign:"center", marginTop:8, fontFamily:"'Courier New', monospace", letterSpacing:"0.1em" }}>
          {(page-1)*PAGE_SIZE+1}~{Math.min(page*PAGE_SIZE, allFiltered.length)} / 전체 {allFiltered.length}개
        </div>
      )}
        </>
      )} {/* /게시판 룸 조건부 끝 */}

      {/* 게시글 상세 모달 - 시네마 톤 */}
      {selPost && (
        <Modal onClose={() => setSelPost(null)} width={600} cinema>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <span style={{ background:CINEMA.redBg, color:CINEMA.redBright, borderRadius:4, padding:"3px 9px", fontSize:10, fontWeight:700, letterSpacing:"0.05em" }}>
              {selPost.category}
            </span>
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
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:20, fontWeight:800, color:CINEMA.text, marginBottom:8 }}>{selPost.lectureName}</div>
              <div style={{ display:"flex", gap:12, fontSize:12, color:CINEMA.muted, flexWrap:"wrap" }}>
                <span>👨‍🏫 {selPost.professor}</span>
                {selPost.schedule && <span>🕐 {selPost.schedule}</span>}
                {(() => {
                  const pcs = postComments(selPost.id);
                  const rated = pcs.filter(c => c.rating > 0);
                  if (!rated.length) return null;
                  const avg = (rated.reduce((s,c)=>s+(c.rating||0),0)/rated.length).toFixed(1);
                  return <span style={{ color:CINEMA.gold, fontWeight:700 }}>★ {avg} ({rated.length}명)</span>;
                })()}
                <span>👁 {selPost.views||0}</span>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:CINEMA.text, marginBottom:8, lineHeight:1.3 }}>{selPost.title}</div>
              <div style={{ display:"flex", gap:12, fontSize:11, color:CINEMA.muted, marginBottom:18, fontFamily:"'Courier New', monospace" }}>
                <span style={{ color: selPost.useRealName ? CINEMA.gold : CINEMA.muted }}>
                  {selPost.useRealName ? "🏛️ " : ""}{displayName(selPost)}
                </span>
                <span>·</span>
                <span>{formatDate(selPost.createdAt)}</span>
                <span>·</span>
                <span>👁 {selPost.views||0}</span>
              </div>
              <div style={{ fontSize:14, color:CINEMA.text, lineHeight:1.8, marginBottom: selPost.images?.length>0?12:20, whiteSpace:"pre-wrap" }}>{selPost.content}</div>
            </div>
          )}
          {selPost.images?.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8, marginBottom:20, paddingBottom:20, borderBottom:`1px solid ${CINEMA.border}` }}>
              {selPost.images.map((url, i) => (
                <img key={i} src={url} alt={`첨부${i+1}`} onClick={() => setSelImage(url)}
                  style={{ width:"100%", height:180, borderRadius:8, objectFit:"cover", cursor:"pointer", border:`1px solid ${CINEMA.border}`, display:"block" }} />
              ))}
            </div>
          )}

          {/* 추천/비추천 - 시네마 톤 (하트) */}
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:16 }}>
            <button onClick={() => toggleLike("post", selPost)}
              style={{
                background:(selPost.likedBy||[]).includes(profile?.uid) ? CINEMA.redBg : CINEMA.surface,
                border:`1px solid ${(selPost.likedBy||[]).includes(profile?.uid) ? CINEMA.red : CINEMA.border}`,
                borderRadius:20, padding:"6px 20px", fontSize:13,
                color:(selPost.likedBy||[]).includes(profile?.uid) ? CINEMA.redBright : CINEMA.muted,
                cursor:"pointer", fontWeight:700,
              }}>
              ♥ {selPost.likes||0}
            </button>
            <button onClick={() => toggleDislike("post", selPost)}
              style={{
                background:(selPost.dislikedBy||[]).includes(profile?.uid) ? CINEMA.surface : CINEMA.surface,
                border:`1px solid ${(selPost.dislikedBy||[]).includes(profile?.uid) ? CINEMA.muted : CINEMA.border}`,
                borderRadius:20, padding:"6px 20px", fontSize:13,
                color:(selPost.dislikedBy||[]).includes(profile?.uid) ? CINEMA.text : CINEMA.mutedDim,
                cursor:"pointer", fontWeight:600,
              }}>
              👎 {selPost.dislikes||0}
            </button>
          </div>

          {/* 댓글 헤더 - 시네마 톤 */}
          <div style={{
            fontSize:10, fontWeight:700, color:CINEMA.red, marginBottom:10,
            fontFamily:"'Courier New', monospace", letterSpacing:"0.25em",
            paddingBottom:6, borderBottom:`1px solid ${CINEMA.border}`,
          }}>
            ── COMMENTS · {postComments(selPost.id).length} ──
          </div>
          {postComments(selPost.id).map(c => {
            const isMemoComment = c.useRealName && (c.adminRoleAtWrite === "super" || c.adminRoleAtWrite === "assistant");
            return (
              <div key={c.id} style={{
                background: isMemoComment ? CINEMA.surfaceAlt : "transparent",
                border: isMemoComment ? `1px dashed ${CINEMA.gold}` : "none",
                borderBottom: isMemoComment ? `1px dashed ${CINEMA.gold}` : `1px solid ${CINEMA.border}`,
                borderRadius: isMemoComment ? 6 : 0,
                padding: isMemoComment ? "9px 10px" : "8px 4px",
                marginBottom: isMemoComment ? 8 : 0,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{
                      fontSize:11, fontWeight:700,
                      color: isMemoComment ? CINEMA.gold : CINEMA.text,
                      fontFamily: isMemoComment ? "'Courier New', monospace" : "inherit",
                    }}>
                      {isMemoComment ? "🏛️ " : ""}{displayCommentName(c, selPost.category)}
                    </span>
                    <span style={{ fontSize:10, color:CINEMA.mutedDim, fontFamily:"'Courier New', monospace" }}>{formatDate(c.createdAt)}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={() => toggleLike("comment", c)}
                      style={{ background:"none", border:"none", fontSize:11,
                        color:(c.likedBy||[]).includes(profile?.uid) ? CINEMA.redBright : CINEMA.mutedDim,
                        cursor:"pointer", fontWeight:600, padding:0 }}>
                      ♥ {c.likes||0}
                    </button>
                    <button onClick={() => toggleDislike("comment", c)}
                      style={{ background:"none", border:"none", fontSize:11,
                        color:(c.dislikedBy||[]).includes(profile?.uid) ? CINEMA.text : CINEMA.mutedDim,
                        cursor:"pointer", fontWeight:500, padding:0 }}>
                      👎 {c.dislikes||0}
                    </button>
                    {isSuper && (
                      <button onClick={() => adminDeleteComment(c.id)}
                        style={{ background:"none", border:"none", color:CINEMA.red, fontSize:10, cursor:"pointer", fontWeight:600, padding:0 }}>
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                {selPost.category === LECTURE_CAT && c.rating > 0 && (
                  <div style={{ fontSize:12, color:CINEMA.gold, marginBottom:3 }}>
                    {"★".repeat(c.rating)}{"☆".repeat(5-c.rating)} <span style={{ fontSize:10, color:CINEMA.mutedDim, marginLeft:4 }}>({c.rating}/5)</span>
                  </div>
                )}
                <div style={{ fontSize:13, color:CINEMA.text, lineHeight:1.55, wordBreak:"break-word", whiteSpace:"pre-wrap" }}>{c.content}</div>
              </div>
            );
          })}

          {/* 댓글 작성 - 시네마 톤 자막 박스 */}
          {selPost.category === LECTURE_CAT && (
            <div style={{ marginTop:16, marginBottom:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:CINEMA.muted, marginBottom:6, fontFamily:"'Courier New', monospace", letterSpacing:"0.2em" }}>RATING</div>
              <div style={{ display:"flex", gap:4 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setCommentRating(commentRating===n?0:n)}
                    style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", color: n<=commentRating ? CINEMA.gold : CINEMA.border }}>
                    ★
                  </button>
                ))}
                {commentRating > 0 && <span style={{ fontSize:12, color:CINEMA.muted, alignSelf:"center", marginLeft:4 }}>{commentRating}/5</span>}
              </div>
            </div>
          )}
          <div style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.borderRed}`, borderRadius:10, padding:"10px 14px", marginTop:8 }}>
            <input placeholder={selPost.category===LECTURE_CAT?"수강 후기를 남겨주세요...":"댓글을 입력하세요..."} value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(selPost.id); }}}
              style={{ width:"100%", background:"none", border:"none", color:CINEMA.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
            {/* 관리자(슈퍼/조교) 실명 체크박스 — 익명 게시판 + 강의 아닐 때만 */}
            {canUseRealName && !REAL_CATS.includes(selPost.category) && selPost.category !== LECTURE_CAT && (
              <label style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, padding:"5px 8px", background:CINEMA.surfaceAlt, borderRadius:6, cursor:"pointer", border:`1px solid ${CINEMA.gold}` }}>
                <input
                  type="checkbox"
                  checked={commentUseRealName}
                  onChange={e => setCommentUseRealName(e.target.checked)}
                  style={{ width:13, height:13, cursor:"pointer" }}
                />
                <span style={{ fontSize:11, fontWeight:600, color:CINEMA.gold }}>
                  🏛️ 관리자 실명으로 댓글
                  {commentUseRealName && <span style={{ color:CINEMA.muted, fontWeight:400, marginLeft:4 }}>→ {profile?.name || "관리자"}({adminRoleLabel})</span>}
                </span>
              </label>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:CINEMA.mutedDim, fontFamily:"'Courier New', monospace" }}>
                {commentUseRealName && canUseRealName && selPost.category !== LECTURE_CAT
                  ? `🏛️ ${profile?.name || "관리자"}(${adminRoleLabel}) 실명으로 게시됩니다`
                  : (REAL_CATS.includes(selPost.category) ? "실명으로 게시됩니다" : "익명으로 게시됩니다")}
              </span>
              <Btn onClick={() => submitComment(selPost.id)} color={C.navy} disabled={submitting || !commentText.trim()} small>등록</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* 수정 모달 */}
      {showEdit && selPost && (
        <Modal onClose={() => setShowEdit(false)} width={540} cinema>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <span style={{ color:CINEMA.gold, fontSize:10, fontWeight:700, letterSpacing:"0.3em", fontFamily:"'Courier New', monospace" }}>✎ EDIT</span>
            <span style={{ fontSize:18, fontWeight:800, color:CINEMA.text, letterSpacing:"0.05em" }}>글 수정</span>
          </div>
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
        <Modal onClose={() => setShowWrite(false)} width={540} cinema>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
            <span style={{ color:CINEMA.red, fontSize:10, fontWeight:700, letterSpacing:"0.3em", fontFamily:"'Courier New', monospace" }}>● REC</span>
            <span style={{ fontSize:18, fontWeight:800, color:CINEMA.text, letterSpacing:"0.05em" }}>새 글 작성</span>
          </div>

          {/* 카테고리 선택 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:CINEMA.muted, marginBottom:8, fontFamily:"'Courier New', monospace", letterSpacing:"0.25em" }}>CATEGORY</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {(currentRoom?.categories || []).map(c => {
                const isLocked = c === NEWBIE_CAT && !isNewbie && profile?.role !== "admin";
                const active = writeForm.category === c;
                const roomColor = currentRoom?.color || CINEMA.red;
                return (
                  <button key={c} onClick={() => !isLocked && setWriteForm(p=>({...p, category:c}))}
                    style={{
                      padding:"6px 13px", borderRadius:14,
                      border:`1px solid ${active ? roomColor : CINEMA.border}`,
                      background: active ? roomColor : CINEMA.surface,
                      color: active ? "#fff" : (isLocked ? CINEMA.mutedDim : CINEMA.muted),
                      fontSize:11, fontWeight: active ? 700 : 500,
                      cursor: isLocked ? "not-allowed" : "pointer",
                    }}>
                    {c === NEWBIE_CAT && "🌱"}{c}{isLocked && " 🔒"}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize:10, color:CINEMA.mutedDim, marginTop:8, fontFamily:"'Courier New', monospace", letterSpacing:"0.1em" }}>
              {REAL_CATS.includes(writeForm.category) ? "✅ 실명으로 게시됩니다" : "🔒 익명으로 게시됩니다"}
            </div>
            {/* 관리자(슈퍼/조교)만 - 익명 게시판에서 실명 모드 선택 가능 */}
            {canUseRealName && !REAL_CATS.includes(writeForm.category) && writeForm.category !== LECTURE_CAT && (
              <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, padding:"8px 10px", background:CINEMA.surfaceAlt, borderRadius:8, cursor:"pointer", border:`1px dashed ${CINEMA.gold}` }}>
                <input
                  type="checkbox"
                  checked={writeForm.useRealName}
                  onChange={e => setWriteForm(p => ({ ...p, useRealName: e.target.checked }))}
                  style={{ width:15, height:15, cursor:"pointer" }}
                />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:CINEMA.gold }}>🏛️ 관리자 실명으로 게시</div>
                  <div style={{ fontSize:10, color:CINEMA.muted, marginTop:1 }}>
                    {writeForm.useRealName ? `→ "${profile?.name || "관리자"}(${adminRoleLabel})"로 표시됩니다` : "체크하면 익명 대신 이름·역할이 공개돼요"}
                  </div>
                </div>
              </label>
            )}
          </div>

          {/* 강의 게시판 전용 폼 */}
          {writeForm.category === LECTURE_CAT ? (
            <div>
              <Inp label="강의명 *" placeholder="예: TV촬영실습I" value={writeForm.lectureName} onChange={e => setWriteForm(p=>({...p,lectureName:e.target.value}))} />
              <Inp label="담당 교수님 *" placeholder="예: 홍길동 교수님" value={writeForm.professor} onChange={e => setWriteForm(p=>({...p,professor:e.target.value}))} />
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
        </div> {/* /본문 콘텐츠 */}

        {/* 🖼️ 이미지 라이트박스 — 사진 클릭 시 풀스크린 뷰어 */}
        {selImage && (
          <div onClick={() => setSelImage(null)}
            style={{
              position:"fixed", inset:0, zIndex:9999,
              background:"rgba(0,0,0,0.95)",
              display:"flex", alignItems:"center", justifyContent:"center",
              padding:20, cursor:"zoom-out",
            }}>
            {/* 닫기 버튼 */}
            <button onClick={(e) => { e.stopPropagation(); setSelImage(null); }}
              aria-label="닫기"
              style={{
                position:"absolute", top:"calc(20px + env(safe-area-inset-top, 0px))", right:20,
                background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.3)",
                color:"#fff", fontSize:24, fontWeight:300,
                width:42, height:42, borderRadius:"50%",
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                lineHeight:1, padding:0,
              }}>✕</button>
            {/* 이미지 */}
            <img src={selImage} alt="확대 이미지"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth:"100%", maxHeight:"90vh", objectFit:"contain",
                borderRadius:4, cursor:"default",
              }} />
            {/* 안내 텍스트 */}
            <div style={{
              position:"absolute", bottom:"calc(20px + env(safe-area-inset-bottom, 0px))",
              left:0, right:0, textAlign:"center",
              color:"#a8a29e", fontSize:11,
              fontFamily:"'Courier New', monospace", letterSpacing:"0.15em",
            }}>
              TAP TO CLOSE
            </div>
          </div>
        )}

        {/* 🎬 글쓰기 FAB - 게시판 룸에서만 표시, 룸 컬러 사용 */}
        {selectedRoom && selectedRoom !== "tools" && (
        <button
          onClick={() => {
            const defaultCat = currentRoom?.categories?.[0] || "자유";
            setWriteForm(p => ({ ...p, category: defaultCat }));
            setShowWrite(true);
          }}
          aria-label="글쓰기"
          style={{
            position:"fixed", bottom:"calc(20px + env(safe-area-inset-bottom, 0px))", right:18,
            width:60, height:60, borderRadius:18,
            background: currentRoom?.color || CINEMA.red, border:"none",
            color:"#fff", fontSize:26, fontWeight:900,
            boxShadow:`0 6px 20px ${currentRoom?.color || CINEMA.red}80, 0 0 0 1px rgba(255,255,255,0.05)`,
            cursor:"pointer", zIndex:95,
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"transform 0.15s",
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          ✏
        </button>
        )} {/* /FAB 조건부 끝 */}
      </div> {/* /시네마 풀스크린 컨테이너 */}
    </>
  );
}
