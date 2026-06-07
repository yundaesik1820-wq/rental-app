import { useState, useRef, useEffect } from "react";
import { C } from "../../theme";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { serverTimestamp } from "firebase/firestore";
import EveryTimeIntro from "../../components/EveryTimeIntro";
import CinemaSlate from "../../components/CinemaSlate";
import ExposureLive from "../../components/ExposureLive";
import ExposureCalc from "../../components/ExposureCalc";
import DofCalc from "../../components/DofCalc";
import ColorTemp from "../../components/ColorTemp";
import FovCalc from "../../components/FovCalc";
import Scripter from "../../components/Scripter";
import SunSeeker from "../../components/SunSeeker";
import ResourceHub from "../../components/ResourceHub";

const CATEGORIES  = ["전체", "자유", "질문", "강의", "정보", "취업", "공모전", "팝니다", "삽니다", "새내기", "협업모집", "작품공유"];
const ANON_CATS   = ["자유", "질문", "강의", "새내기", "협업모집", "작품공유"]; // 익명
const REAL_CATS   = ["정보", "취업", "공모전", "팝니다", "삽니다"]; // 실명
const LECTURE_CAT = "강의"; // 강의 전용
const NEWBIE_CAT  = "새내기"; // 새내기 전용
// 크루 메이커스 모집 포지션 (드롭다운)
const CREW_POSITIONS = ["제작/기획", "연출/작가", "촬영", "조명", "동시녹음/음향", "미술/소품/세트", "분장/의상", "편집/D.I", "음악/사운드 후반", "배우/출연", "운송", "기타(직접 입력)"];
const CREW_ETC = "기타(직접 입력)";

// 🎬 ROOMS 정의 - ZZOTKYO 진입 분기
const ROOMS = [
  {
    id:"community", studentOnly:true,
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
    id:"knowledge", studentOnly:true,
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
    subtitle:"KBATV BOXOFFICE",
    title:"KBATV 박스오피스",
    desc:"학생 단편·작품 상영관",
    color:"#a855f7",
    colorBg:"rgba(168,85,247,0.15)",
    borderStyle:"solid",
    categories:["작품공유"],
  },
  {
    id:"crew",
    number:"06",
    icon:"🤝",
    subtitle:"CREW MAKERS",
    title:"크루 메이커스",
    desc:"함께할 팀원·스태프 모집",
    color:"#f97316",
    colorBg:"rgba(249,115,22,0.15)",
    borderStyle:"solid",
    categories:["협업모집"],
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

// 유튜브 링크에서 영상 ID 추출 (watch / youtu.be / shorts / embed 모두 지원)
function getYouTubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// 모집 마감일 → 남은 일수 (양수: 남음, 0: 당일, 음수: 마감)
function getDday(deadline) {
  if (!deadline) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(deadline); end.setHours(0,0,0,0);
  if (isNaN(end.getTime())) return null;
  return Math.round((end - today) / 86400000);
}

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
  const [blockedRoom, setBlockedRoom] = useState(null); // 교수/교사가 학생전용 룸 클릭 시
  const currentRoom = ROOMS.find(r => r.id === selectedRoom);
  // 🛠️ 선택된 도구 (필름 도구 룸 안에서)
  const [selectedTool, setSelectedTool] = useState(null);

  const { data: posts }    = useCollection("communityPosts",    "createdAt");
  const { data: comments } = useCollection("communityComments", "createdAt");

  const adminRole  = profile?.adminRole || "super";
  // 학생 전용 룸 차단 대상: 교수·교사 (조교/슈퍼관리자/학생은 제외)
  //  - role:"professor"      → 교수님 목록에서 생성된 계정
  //  - role:"teacher"        → (혹시 모를) 별도 교사 계정
  //  - role:"admin" + adminRole:professor/teacher → 관리자로 등록된 교수·교사
  const isProfOrTeacher =
    profile?.role === "professor" ||
    profile?.role === "teacher" ||
    (profile?.role === "admin" && (profile?.adminRole === "teacher" || profile?.adminRole === "professor"));
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
  const [fsVideo,  setFsVideo]  = useState(null); // 가로 풀스크린 재생 (유튜브 ID)
  const [showWrite, setShowWrite] = useState(false);
  const [writeForm, setWriteForm] = useState({ title:"", content:"", category:"자유", images:[],
    lectureName:"", professor:"", schedule:"", useRealName:false,
    ytUrl:"", oneLiner:"", genres:[], genreInput:"", runtime:"", prodDate:"", credits:"",
    positions:[], positionInput:"", positionSelect:"", crewLogline:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"" }); // 강의/작품공유/크루 전용 필드 + 관리자 실명모드
  const [commentRating, setCommentRating] = useState(0); // 별점
  const [showEdit,    setShowEdit]    = useState(false); // 수정 모달
  const [editForm,    setEditForm]    = useState({ title:"", content:"", ytUrl:"", oneLiner:"", genres:[], genreInput:"", runtime:"", prodDate:"", credits:"", positions:[], positionInput:"", positionSelect:"", crewLogline:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"" });
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
    const isWorkPost = writeForm.category === "작품공유";
    const isCrewPost = writeForm.category === "협업모집";
    // 카테고리별 유효성 검사
    if (isLecturePost) {
      if (!writeForm.lectureName.trim() || !writeForm.professor.trim()) return;
    } else if (isWorkPost) {
      if (!writeForm.title.trim()) return;
      if (!getYouTubeId(writeForm.ytUrl)) { alert("올바른 유튜브 링크를 입력해주세요."); return; }
    } else if (isCrewPost) {
      if (!writeForm.title.trim()) return;
      if (writeForm.positions.length === 0) { alert("모집 포지션을 1개 이상 추가해주세요."); return; }
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
      // 작품공유 전용 필드
      ytUrl:       isWorkPost ? writeForm.ytUrl.trim() : "",
      oneLiner:    isWorkPost ? writeForm.oneLiner.trim() : "",
      genres:      isWorkPost ? writeForm.genres : [],
      runtime:     isWorkPost ? writeForm.runtime.trim() : "",
      prodDate:    isWorkPost ? writeForm.prodDate.trim() : "",
      credits:     isWorkPost ? writeForm.credits.trim() : "",
      // 크루 메이커스 전용 필드
      positions:   isCrewPost ? writeForm.positions : [],
      crewLogline: isCrewPost ? writeForm.crewLogline.trim() : "",
      crewSchedule:isCrewPost ? writeForm.crewSchedule.trim() : "",
      crewPlace:   isCrewPost ? writeForm.crewPlace.trim() : "",
      crewPay:     isCrewPost ? writeForm.crewPay.trim() : "",
      crewGenre:   isCrewPost ? writeForm.crewGenre.trim() : "",
      deadline:    isCrewPost ? writeForm.deadline : "",
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
    setWriteForm({ title:"", content:"", category:"자유", images:[], newbieBlocked:false, lectureName:"", professor:"", schedule:"", useRealName:false,
      ytUrl:"", oneLiner:"", genres:[], genreInput:"", runtime:"", prodDate:"", credits:"",
      positions:[], positionInput:"", positionSelect:"", crewLogline:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"" });
    setShowWrite(false);
    setSubmitting(false);
  };

  // 작품공유 장르 태그 추가/삭제
  const addGenre = () => {
    const g = writeForm.genreInput.trim();
    if (!g || writeForm.genres.includes(g) || writeForm.genres.length >= 5) {
      setWriteForm(p => ({ ...p, genreInput:"" }));
      return;
    }
    setWriteForm(p => ({ ...p, genres:[...p.genres, g], genreInput:"" }));
  };

  // 크루 모집 포지션 — 드롭다운 선택 / 기타 직접 입력
  const pickPosition = (val) => {
    if (!val) return;
    if (val === CREW_ETC) { setWriteForm(p => ({ ...p, positionSelect: val })); return; }
    setWriteForm(p => (p.positions.includes(val) || p.positions.length >= 8) ? { ...p, positionSelect:"" } : { ...p, positions:[...p.positions, val], positionSelect:"" });
  };
  const addPositionCustom = () => {
    const v = writeForm.positionInput.trim();
    if (!v || writeForm.positions.includes(v) || writeForm.positions.length >= 8) {
      setWriteForm(p => ({ ...p, positionInput:"", positionSelect:"" }));
      return;
    }
    setWriteForm(p => ({ ...p, positions:[...p.positions, v], positionInput:"", positionSelect:"" }));
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
    const isWork = selPost?.category === "작품공유";
    const isCrew = selPost?.category === "협업모집";
    if (isWork) {
      if (!editForm.title.trim() || !getYouTubeId(editForm.ytUrl)) { alert("작품 제목과 올바른 유튜브 링크가 필요해요."); return; }
      const patch = {
        title:    editForm.title.trim(),
        content:  editForm.content.trim(),
        ytUrl:    editForm.ytUrl.trim(),
        oneLiner: editForm.oneLiner.trim(),
        genres:   editForm.genres,
        runtime:  editForm.runtime.trim(),
        prodDate: editForm.prodDate.trim(),
        credits:  editForm.credits.trim(),
      };
      await updateItem("communityPosts", selPost.id, patch);
      setSelPost({ ...selPost, ...patch });
      setShowEdit(false);
      return;
    }
    if (isCrew) {
      if (!editForm.title.trim()) return;
      if (editForm.positions.length === 0) { alert("모집 포지션을 1개 이상 추가해주세요."); return; }
      const patch = {
        title:       editForm.title.trim(),
        content:     editForm.content.trim(),
        positions:   editForm.positions,
        crewLogline: editForm.crewLogline.trim(),
        crewSchedule:editForm.crewSchedule.trim(),
        crewPlace:   editForm.crewPlace.trim(),
        crewPay:     editForm.crewPay.trim(),
        crewGenre:   editForm.crewGenre.trim(),
        deadline:    editForm.deadline,
      };
      await updateItem("communityPosts", selPost.id, patch);
      setSelPost({ ...selPost, ...patch });
      setShowEdit(false);
      return;
    }
    if (!editForm.title.trim() || !editForm.content.trim()) return;
    await updateItem("communityPosts", selPost.id, {
      title:   editForm.title.trim(),
      content: editForm.content.trim(),
    });
    setSelPost({ ...selPost, title: editForm.title.trim(), content: editForm.content.trim() });
    setShowEdit(false);
  };

  // 수정 모달 크루 포지션 — 드롭다운 선택 / 기타 직접 입력
  const pickPositionEdit = (val) => {
    if (!val) return;
    if (val === CREW_ETC) { setEditForm(p => ({ ...p, positionSelect: val })); return; }
    setEditForm(p => (p.positions.includes(val) || p.positions.length >= 8) ? { ...p, positionSelect:"" } : { ...p, positions:[...p.positions, val], positionSelect:"" });
  };
  const addPositionCustomEdit = () => {
    const v = editForm.positionInput.trim();
    if (!v || editForm.positions.includes(v) || editForm.positions.length >= 8) {
      setEditForm(p => ({ ...p, positionInput:"", positionSelect:"" }));
      return;
    }
    setEditForm(p => ({ ...p, positions:[...p.positions, v], positionInput:"", positionSelect:"" }));
  };

  // 수정 모달 장르 태그 추가
  const addGenreEdit = () => {
    const g = editForm.genreInput.trim();
    if (!g || editForm.genres.includes(g) || editForm.genres.length >= 5) {
      setEditForm(p => ({ ...p, genreInput:"" }));
      return;
    }
    setEditForm(p => ({ ...p, genres:[...p.genres, g], genreInput:"" }));
  };

  const canEditDelete = (post) =>
    (REAL_CATS.includes(post?.category) || post?.category === "작품공유" || post?.category === "협업모집") && post?.authorId === profile?.uid;
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
          <button onClick={() => {
            if (selectedTool) {
              setSelectedTool(null);
            } else if (currentRoom) {
              setSelectedRoom(null);
              setSelectedTool(null);
            } else {
              onExit && onExit();
            }
          }}
            style={{
              background:`${currentRoom ? currentRoom.color : "#dc2626"}1A`,
              border:`1px solid ${currentRoom ? currentRoom.color : "#dc2626"}4D`,
              color:"#fafaf9", fontSize:12, fontWeight:600,
              padding:"7px 14px", borderRadius:8, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6,
            }}>
            <span style={{ color: currentRoom ? currentRoom.color : "#dc2626" }}>←</span>
            {selectedTool ? "도구" : (currentRoom ? "ROOMS" : "메인으로")}
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color: currentRoom ? currentRoom.color : "#dc2626", fontSize:10, fontWeight:700, letterSpacing:"0.2em" }}>● REC</span>
            <span style={{ color:"#fafaf9", fontSize:14, fontWeight:900, letterSpacing:"0.1em" }}>
              {selectedTool === "slate" ? "SLATE"
                : selectedTool === "live-exposure" ? "LIVE EXPOSURE"
                : selectedTool === "exposure-calc" ? "EXPOSURE CALC"
                : selectedTool === "dof" ? "DOF"
                : selectedTool === "color-temp" ? "COLOR TEMP"
                : selectedTool === "fov" ? "FOV"
                : selectedTool === "scripter" ? "SCRIPTER"
                : selectedTool === "sun" ? "SUN SEEKER"
                : selectedTool === "resources" ? "RESOURCES"
                : currentRoom ? currentRoom.title
                : "ZZOTKYO"}
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
              const locked = room.studentOnly && isProfOrTeacher;
              return (
                <div key={room.id} onClick={() => {
                    if (locked) { setBlockedRoom(room); return; }
                    setSelectedRoom(room.id); setCat("전체"); setPage(1); setSearch("");
                  }}
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    borderLeft: `4px solid ${room.color}`,
                    borderRadius:6, padding:"13px 14px", cursor:"pointer", position:"relative",
                    transition:"transform 0.15s",
                    opacity: locked ? 0.6 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <div style={{ position:"absolute", top:8, right:10, fontFamily:"'Courier New', monospace", fontSize:8, color:"#71706b", letterSpacing:"0.2em" }}>
                    {locked ? "🔒 STUDENTS" : `ROOM ${room.number}`}
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

          {/* 🔒 학생 전용 안내 모달 */}
          {blockedRoom && (
            <div onClick={() => setBlockedRoom(null)}
              style={{ position:"fixed", inset:0, zIndex:9500, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div onClick={e => e.stopPropagation()}
                style={{ background:"#0a0a0a", border:`1px solid ${blockedRoom.color}`, borderRadius:12, padding:"28px 24px", maxWidth:320, textAlign:"center" }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🔒</div>
                <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:blockedRoom.color, letterSpacing:"0.3em", fontWeight:700, marginBottom:10 }}>
                  STUDENTS ONLY
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:"#fafaf9", marginBottom:8 }}>
                  학생만 입장이 가능합니다
                </div>
                <div style={{ fontSize:12.5, color:"#a8a29e", lineHeight:1.6, marginBottom:20 }}>
                  <strong style={{ color:"#fafaf9" }}>{blockedRoom.title}</strong> 게시판은<br/>영상계열 학생들의 공간이에요.<br/>
                  <span style={{ color:"#71706b", fontSize:11 }}>필름 도구는 자유롭게 이용하실 수 있어요.</span>
                </div>
                <button onClick={() => setBlockedRoom(null)}
                  style={{ width:"100%", padding:"11px", minHeight:44, background:blockedRoom.color, color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:800, fontFamily:"Pretendard, sans-serif", cursor:"pointer", touchAction:"manipulation" }}>
                  확인
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🛠️ 필름 도구 룸 */}
      {selectedRoom === "tools" && !selectedTool && (
        <div style={{ marginTop:18 }}>
          {/* 안내 */}
          <div style={{ textAlign:"center", marginBottom:18, padding:"0 8px" }}>
            <div style={{ fontFamily:"'Courier New', monospace", fontSize:10, color:"#fbbf24", letterSpacing:"0.35em", fontWeight:700, marginBottom:5 }}>
              FILM TOOLS
            </div>
            <div style={{ fontSize:13, color:"#a8a29e" }}>촬영 현장에서 쓰는 실용 도구들</div>
          </div>

          {/* 도구 카드 그리드 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
            <ToolCard icon="🎬" label="SLATE" title="전자식 슬레이터" desc="타임코드 · CLAP" onClick={() => setSelectedTool("slate")} />
            <ToolCard icon="📝" label="SCRIPT" title="스크립터" desc="씬·테이크 기록" onClick={() => setSelectedTool("scripter")} />
            <ToolCard icon="🎥" label="LIVE EXPOSURE" title="라이브 노출" desc="폴스컬러 · 제브라" onClick={() => setSelectedTool("live-exposure")} />
            <ToolCard icon="📷" label="EXPOSURE CALC" title="노출 계산기" desc="180° 셔터 · 등가환산" onClick={() => setSelectedTool("exposure-calc")} />
            <ToolCard icon="📐" label="DOF" title="피사계 심도" desc="DOF 계산" onClick={() => setSelectedTool("dof")} />
            <ToolCard icon="🌡️" label="COLOR TEMP" title="색온도 계산기" desc="WB · 젤 계산" onClick={() => setSelectedTool("color-temp")} />
            <ToolCard icon="🔭" label="FOV" title="렌즈 화각" desc="화각 · 역계산" onClick={() => setSelectedTool("fov")} />
            <ToolCard icon="🌅" label="SUN SEEKER" title="태양 위치" desc="골든아워·일출일몰" onClick={() => setSelectedTool("sun")} />

            {/* 자료 큐레이션 (가로형, 통일 디자인) */}
            <div onClick={() => setSelectedTool("resources")}
              style={{
                gridColumn:"span 2",
                background:"#1a1a1a", border:"1px solid #2a2a2a", borderLeft:"3px solid #fbbf24",
                borderRadius:6, padding:"14px", cursor:"pointer",
                transition:"transform 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ fontSize:28 }}>📚</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Courier New', monospace", fontSize:8, color:"#fbbf24", letterSpacing:"0.25em", fontWeight:700, marginBottom:2 }}>RESOURCES</div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#fafaf9" }}>자료 큐레이션</div>
                  <div style={{ fontSize:9, color:"#a8a29e", marginTop:2 }}>무료 음원·효과음·LUT·폰트·영상·아이콘</div>
                </div>
                <div style={{ fontSize:14, color:"#fbbf24" }}>→</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎬 슬레이터 본체 표시 */}
      {selectedRoom === "tools" && selectedTool === "slate" && (
        <div style={{ marginTop:8 }}>
          <CinemaSlate onBack={() => setSelectedTool(null)} />
        </div>
      )}

      {/* 🎥 LIVE 노출 도우미 표시 */}
      {selectedRoom === "tools" && selectedTool === "live-exposure" && (
        <ExposureLive onBack={() => setSelectedTool(null)} />
      )}

      {/* 📷 노출 계산기 (이론) */}
      {selectedRoom === "tools" && selectedTool === "exposure-calc" && (
        <ExposureCalc onBack={() => setSelectedTool(null)} />
      )}

      {/* 📐 DOF 계산기 */}
      {selectedRoom === "tools" && selectedTool === "dof" && (
        <DofCalc onBack={() => setSelectedTool(null)} />
      )}

      {/* 🌡️ 색온도 계산기 */}
      {selectedRoom === "tools" && selectedTool === "color-temp" && (
        <ColorTemp onBack={() => setSelectedTool(null)} />
      )}

      {/* 🔭 렌즈 화각 */}
      {selectedRoom === "tools" && selectedTool === "fov" && (
        <FovCalc onBack={() => setSelectedTool(null)} />
      )}

      {/* 📝 스크립터 */}
      {selectedRoom === "tools" && selectedTool === "scripter" && (
        <Scripter onBack={() => setSelectedTool(null)} />
      )}

      {/* 🌅 태양 위치 */}
      {selectedRoom === "tools" && selectedTool === "sun" && (
        <SunSeeker onBack={() => setSelectedTool(null)} />
      )}

      {/* 📚 자료 큐레이션 */}
      {selectedRoom === "tools" && selectedTool === "resources" && (
        <ResourceHub onBack={() => setSelectedTool(null)} />
      )}

      {/* 게시판 룸들 (community, knowledge, marketplace, boxoffice) */}
      {selectedRoom && selectedRoom !== "tools" && (
        <>
      {selectedRoom === "boxoffice" ? (
        <BoxOfficeView posts={posts} onOpen={openPost} onPlay={setFsVideo} />
      ) : (
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
        {currentRoom?.id === "crew" && "🤝 함께할 팀원·스태프를 모집해보세요"}
      </div>

      {/* 검색 - 시네마 톤 */}
      <input placeholder="🔍 제목, 내용 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        style={{ display:"block", width:"100%", background:CINEMA.surface,
          border:`1px solid ${CINEMA.border}`, borderRadius:10, color:CINEMA.text,
          padding:"10px 16px", fontSize:13, fontFamily:"inherit", outline:"none",
          marginBottom:16, boxSizing:"border-box" }} />

      {/* 인기 게시글 TOP3 - 커뮤니티 룸에서만 표시 */}
      {selectedRoom === "community" && (() => {
        // 커뮤니티 룸의 카테고리에 해당하는 글만 대상
        const roomCats = currentRoom?.categories || [];
        const base = cat === "전체"
          ? posts.filter(p => roomCats.includes(p.category))
          : posts.filter(p => p.category === cat);
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

        // ===== 작품공유: 썸네일 카드 =====
        if (p.category === "작품공유") {
          const ytId = getYouTubeId(p.ytUrl);
          return (
            <div key={p.id} onClick={() => openPost(p)}
              style={{
                display:"flex", gap:10, background:CINEMA.surface,
                border:`1px solid ${CINEMA.border}`, borderLeft:"3px solid #a855f7",
                borderRadius:6, padding:10, marginBottom:9, cursor:"pointer",
              }}>
              <div style={{ position:"relative", width:116, height:65, flexShrink:0, borderRadius:5, overflow:"hidden", background:"#000" }}>
                {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />}
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ width:30, height:22, borderRadius:5, background:"rgba(220,38,38,0.92)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ color:"#fff", fontSize:10, marginLeft:1 }}>▶</span>
                  </div>
                </div>
                {p.runtime && <span style={{ position:"absolute", bottom:3, right:3, background:"rgba(0,0,0,0.82)", color:"#fff", fontSize:9, padding:"1px 4px", borderRadius:3 }}>{p.runtime}</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:CINEMA.text, marginBottom:3, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                {p.oneLiner && <div style={{ fontSize:11, color:CINEMA.muted, marginBottom:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.oneLiner}</div>}
                {(p.genres||[]).length > 0 && (
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:5 }}>
                    {(p.genres||[]).slice(0,3).map(g => (
                      <span key={g} style={{ background:"rgba(168,85,247,0.15)", color:"#a855f7", fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:3 }}>{g}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:10, color:CINEMA.muted, display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{displayName(p)}</span>
                  <span style={{ marginLeft:"auto", display:"flex", gap:8, flexShrink:0 }}>
                    <span>👁 {p.views||0}</span>
                    <span style={{ color:CINEMA.redBright }}>♥ {p.likes||0}</span>
                    <span>💬 {pComments.length}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        }

        // ===== 협업모집: 크루 공고 카드 =====
        if (p.category === "협업모집") {
          const dday = getDday(p.deadline);
          const closed = dday !== null && dday < 0;
          return (
            <div key={p.id} onClick={() => openPost(p)}
              style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderLeft:"3px solid #f97316", borderRadius:6, padding:"11px 12px", marginBottom:9, cursor:"pointer", opacity: closed ? 0.7 : 1 }}>
              <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                {p.deadline && <span style={{ background: closed ? "#444" : "#f97316", color: closed ? "#fff" : "#0a0a0a", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, fontFamily:"'Courier New', monospace" }}>{closed ? "마감" : dday===0 ? "D-DAY" : `D-${dday}`}</span>}
                <span style={{ background: closed ? "rgba(255,255,255,0.08)" : "rgba(249,115,22,0.15)", color: closed ? CINEMA.muted : "#f97316", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3 }}>{closed ? "모집완료" : "모집중"}</span>
                <span style={{ fontSize:9, color:CINEMA.mutedDim, marginLeft:"auto" }}>{formatDate(p.createdAt)}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:CINEMA.text, marginBottom:6, lineHeight:1.35, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
              {(p.positions||[]).length > 0 && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6, alignItems:"center" }}>
                  {(p.positions||[]).slice(0,3).map(v => (
                    <span key={v} style={{ background:"rgba(249,115,22,0.12)", color:"#f97316", fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:3 }}>{v}</span>
                  ))}
                  {(p.positions||[]).length > 3 && <span style={{ fontSize:9, color:CINEMA.muted }}>+{(p.positions||[]).length-3}</span>}
                </div>
              )}
              <div style={{ fontSize:10, color:CINEMA.muted, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                {p.crewSchedule && <span>📅 {p.crewSchedule}</span>}
                {p.crewPlace && <span>📍 {p.crewPlace}</span>}
                <span style={{ marginLeft:"auto", display:"flex", gap:8, flexShrink:0 }}>
                  <span>👁 {p.views||0}</span>
                  <span>💬 {pComments.length}</span>
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
                  <Btn onClick={() => {
                    const base = { title:selPost.title||"", content:selPost.content||"", ytUrl:"", oneLiner:"", genres:[], genreInput:"", runtime:"", prodDate:"", credits:"", positions:[], positionInput:"", positionSelect:"", crewLogline:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"" };
                    setEditForm(
                      selPost.category === "작품공유"
                        ? { ...base, ytUrl:selPost.ytUrl||"", oneLiner:selPost.oneLiner||"", genres:selPost.genres||[], runtime:selPost.runtime||"", prodDate:selPost.prodDate||"", credits:selPost.credits||"" }
                      : selPost.category === "협업모집"
                        ? { ...base, positions:selPost.positions||[], crewLogline:selPost.crewLogline||"", crewSchedule:selPost.crewSchedule||"", crewPlace:selPost.crewPlace||"", crewPay:selPost.crewPay||"", crewGenre:selPost.crewGenre||"", deadline:selPost.deadline||"" }
                        : base
                    );
                    setShowEdit(true);
                  }} color={C.green} small>수정</Btn>
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
          ) : selPost.category === "작품공유" ? (
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:CINEMA.text, marginBottom:6, lineHeight:1.3 }}>{selPost.title}</div>
              {selPost.oneLiner && <div style={{ fontSize:13, color:CINEMA.muted, marginBottom:10, fontStyle:"italic" }}>"{selPost.oneLiner}"</div>}
              <div style={{ display:"flex", gap:12, fontSize:11, color:CINEMA.muted, marginBottom:14, fontFamily:"'Courier New', monospace" }}>
                <span style={{ color: selPost.useRealName ? CINEMA.gold : CINEMA.muted }}>{selPost.useRealName ? "🏛️ " : ""}{displayName(selPost)}</span>
                <span>·</span>
                <span>{formatDate(selPost.createdAt)}</span>
                <span>·</span>
                <span>👁 {selPost.views||0}</span>
              </div>
              {getYouTubeId(selPost.ytUrl) && (
                <div onClick={() => setFsVideo(getYouTubeId(selPost.ytUrl))}
                  style={{ position:"relative", aspectRatio:"16/9", borderRadius:8, overflow:"hidden", background:"#000", cursor:"pointer", marginBottom:14 }}>
                  <img src={`https://img.youtube.com/vi/${getYouTubeId(selPost.ytUrl)}/hqdefault.jpg`} alt="작품 썸네일"
                    style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.28)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(220,38,38,0.94)", color:"#fff", padding:"9px 20px", borderRadius:8, fontSize:14, fontWeight:700 }}>
                      <span style={{ fontSize:16 }}>▶</span> 재생
                    </div>
                  </div>
                  <span style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.7)", color:"#fff", fontSize:9, padding:"2px 7px", borderRadius:4, fontFamily:"'Courier New', monospace", letterSpacing:"0.05em" }}>가로 전체화면</span>
                </div>
              )}
              {((selPost.genres||[]).length > 0 || selPost.runtime || selPost.prodDate) && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", marginBottom:14 }}>
                  {(selPost.genres||[]).map(g => (
                    <span key={g} style={{ background:CINEMA.surfaceAlt, color:CINEMA.gold, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12 }}>{g}</span>
                  ))}
                  {selPost.runtime && <span style={{ fontSize:12, color:CINEMA.muted }}>⏱ {selPost.runtime}</span>}
                  {selPost.prodDate && <span style={{ fontSize:12, color:CINEMA.muted }}>📅 {selPost.prodDate}</span>}
                </div>
              )}
              {selPost.credits && <div style={{ fontSize:12, color:CINEMA.muted, marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${CINEMA.border}` }}>🎬 {selPost.credits}</div>}
              {selPost.content && <div style={{ fontSize:14, color:CINEMA.text, lineHeight:1.8, marginBottom:20, whiteSpace:"pre-wrap" }}>{selPost.content}</div>}
            </div>
          ) : selPost.category === "협업모집" ? (() => {
            const dday = getDday(selPost.deadline);
            const closed = dday !== null && dday < 0;
            return (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  {selPost.deadline && (
                    <span style={{ background: closed ? "#444" : "#f97316", color: closed ? "#fff" : "#0a0a0a", fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:5, fontFamily:"'Courier New', monospace" }}>
                      {closed ? "마감" : dday === 0 ? "D-DAY" : `D-${dday}`}
                    </span>
                  )}
                  <span style={{ background: closed ? "rgba(255,255,255,0.08)" : "rgba(249,115,22,0.15)", color: closed ? CINEMA.muted : "#f97316", fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:5 }}>
                    {closed ? "모집완료" : "모집중"}
                  </span>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:CINEMA.text, marginBottom:6, lineHeight:1.3 }}>{selPost.title}</div>
                {selPost.crewLogline && <div style={{ fontSize:13, color:CINEMA.muted, marginBottom:10, fontStyle:"italic" }}>"{selPost.crewLogline}"</div>}
                <div style={{ display:"flex", gap:12, fontSize:11, color:CINEMA.muted, marginBottom:16, fontFamily:"'Courier New', monospace" }}>
                  <span>{displayName(selPost)}</span><span>·</span><span>{formatDate(selPost.createdAt)}</span><span>·</span><span>👁 {selPost.views||0}</span>
                </div>
                {(selPost.positions||[]).length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:"#f97316", letterSpacing:"0.2em", fontWeight:700, marginBottom:8 }}>RECRUITING POSITIONS</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {(selPost.positions||[]).map(v => (
                        <span key={v} style={{ background:CINEMA.surface, border:"1px solid #f97316", color:CINEMA.text, fontSize:12, fontWeight:500, padding:"5px 11px", borderRadius:14 }}>{v}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(selPost.crewSchedule || selPost.crewPlace || selPost.crewPay || selPost.crewGenre) && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
                    {selPost.crewSchedule && (
                      <div style={{ background:CINEMA.surfaceAlt, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:3 }}>📅 촬영 일정</div>
                        <div style={{ fontSize:12, color:CINEMA.text, fontWeight:500 }}>{selPost.crewSchedule}</div>
                      </div>
                    )}
                    {selPost.crewPlace && (
                      <div style={{ background:CINEMA.surfaceAlt, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:3 }}>📍 촬영 장소</div>
                        <div style={{ fontSize:12, color:CINEMA.text, fontWeight:500 }}>{selPost.crewPlace}</div>
                      </div>
                    )}
                    {selPost.crewPay && (
                      <div style={{ background:CINEMA.surfaceAlt, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:3 }}>💰 보수</div>
                        <div style={{ fontSize:12, color:CINEMA.text, fontWeight:500 }}>{selPost.crewPay}</div>
                      </div>
                    )}
                    {selPost.crewGenre && (
                      <div style={{ background:CINEMA.surfaceAlt, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:3 }}>🎬 장르</div>
                        <div style={{ fontSize:12, color:CINEMA.text, fontWeight:500 }}>{selPost.crewGenre}</div>
                      </div>
                    )}
                  </div>
                )}
                {selPost.content && <div style={{ fontSize:14, color:CINEMA.text, lineHeight:1.8, marginBottom:16, whiteSpace:"pre-wrap" }}>{selPost.content}</div>}
                <div style={{ background:"rgba(249,115,22,0.1)", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#f97316", marginBottom:4, textAlign:"center", fontWeight:600 }}>
                  {closed ? "🚫 모집이 마감되었어요" : "💬 지원은 아래 댓글로 남겨주세요"}
                </div>
              </div>
            );
          })() : (
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
          {selPost.category === "작품공유" ? (
            <div>
              <Inp label="작품 제목 *" placeholder="예: 완벽한 사과문" value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} />
              <Inp label="유튜브 링크 *" placeholder="https://youtu.be/..." value={editForm.ytUrl} onChange={e => setEditForm(p=>({...p,ytUrl:e.target.value}))} />
              {getYouTubeId(editForm.ytUrl) && (
                <div style={{ marginBottom:16 }}>
                  <YouTubeEmbed url={editForm.ytUrl} />
                </div>
              )}
              <Inp label="한 줄 소개" placeholder="작품을 한 문장으로" value={editForm.oneLiner} onChange={e => setEditForm(p=>({...p,oneLiner:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>장르 <span style={{ color:C.muted, fontWeight:400 }}>(최대 5개)</span></div>
                <div style={{ display:"flex", gap:6, marginBottom: editForm.genres.length ? 8 : 0 }}>
                  <input value={editForm.genreInput} placeholder="예: 드라마 (입력 후 추가)"
                    onChange={e => setEditForm(p=>({...p,genreInput:e.target.value}))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addGenreEdit(); } }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  <button type="button" onClick={addGenreEdit}
                    style={{ background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                </div>
                {editForm.genres.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {editForm.genres.map(g => (
                      <span key={g} onClick={() => setEditForm(p=>({...p, genres:p.genres.filter(x=>x!==g)}))}
                        style={{ background:C.yellowLight, color:"#92400E", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {g} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <Inp label="러닝타임" placeholder="예: 12분" value={editForm.runtime} onChange={e => setEditForm(p=>({...p,runtime:e.target.value}))} />
                </div>
                <div style={{ flex:1 }}>
                  <Inp label="제작년월" placeholder="예: 2026.03" value={editForm.prodDate} onChange={e => setEditForm(p=>({...p,prodDate:e.target.value}))} />
                </div>
              </div>
              <Inp label="크레딧 (선택)" placeholder="연출 윤대식 · 촬영 ○○○ · 편집 ○○○" value={editForm.credits} onChange={e => setEditForm(p=>({...p,credits:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>상세 내용 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
                <textarea placeholder="작품 설명, 비하인드 등" value={editForm.content} onChange={e => setEditForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:100, boxSizing:"border-box" }} />
              </div>
            </div>
          ) : selPost.category === "협업모집" ? (
            <div>
              <Inp label="프로젝트 제목 *" placeholder="예: 단편영화 「완벽한 사과문」 크루 모집" value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} />
              <Inp label="한 줄 소개" placeholder="작품을 한 문장으로 (로그라인)" value={editForm.crewLogline} onChange={e => setEditForm(p=>({...p,crewLogline:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>모집 포지션 * <span style={{ color:C.muted, fontWeight:400 }}>(최대 8개)</span></div>
                <select value={editForm.positionSelect} onChange={e => pickPositionEdit(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color: editForm.positionSelect ? C.text : C.muted, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark", cursor:"pointer" }}>
                  <option value="">＋ 포지션 선택...</option>
                  {CREW_POSITIONS.map(pos => (
                    <option key={pos} value={pos} disabled={pos !== CREW_ETC && editForm.positions.includes(pos)}>{pos}</option>
                  ))}
                </select>
                {editForm.positionSelect === CREW_ETC && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <input value={editForm.positionInput} placeholder="포지션 직접 입력 (예: 스틸 촬영)" autoFocus
                      onChange={e => setEditForm(p=>({...p,positionInput:e.target.value}))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPositionCustomEdit(); } }}
                      style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    <button type="button" onClick={addPositionCustomEdit}
                      style={{ background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                  </div>
                )}
                {editForm.positions.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {editForm.positions.map(v => (
                      <span key={v} onClick={() => setEditForm(p=>({...p, positions:p.positions.filter(x=>x!==v)}))}
                        style={{ background:"rgba(249,115,22,0.14)", color:"#f97316", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {v} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <Inp label="촬영 일정" placeholder="예: 2026.04.12~14" value={editForm.crewSchedule} onChange={e => setEditForm(p=>({...p,crewSchedule:e.target.value}))} />
                </div>
                <div style={{ flex:1 }}>
                  <Inp label="촬영 장소" placeholder="예: 서울·학교" value={editForm.crewPlace} onChange={e => setEditForm(p=>({...p,crewPlace:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <Inp label="보수" placeholder="예: 식비·크레딧" value={editForm.crewPay} onChange={e => setEditForm(p=>({...p,crewPay:e.target.value}))} />
                </div>
                <div style={{ flex:1 }}>
                  <Inp label="장르" placeholder="예: 드라마" value={editForm.crewGenre} onChange={e => setEditForm(p=>({...p,crewGenre:e.target.value}))} />
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>모집 마감일</div>
                <input type="date" value={editForm.deadline} onChange={e => setEditForm(p=>({...p,deadline:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
                {editForm.deadline && getDday(editForm.deadline) !== null && (
                  <div style={{ fontSize:11, color: getDday(editForm.deadline) < 0 ? C.red : C.muted, marginTop:5 }}>
                    {getDday(editForm.deadline) < 0 ? "이미 지난 날짜예요 (모집완료로 표시됩니다)" : getDday(editForm.deadline) === 0 ? "오늘 마감 (D-DAY)" : `마감까지 D-${getDday(editForm.deadline)}`}
                  </div>
                )}
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>상세 내용 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
                <textarea placeholder="작품 설명, 준비 상황, 지원 시 참고사항 등" value={editForm.content} onChange={e => setEditForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:100, boxSizing:"border-box" }} />
              </div>
            </div>
          ) : (
            <>
              <Inp label="제목 *" value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>내용 *</div>
                <textarea value={editForm.content} onChange={e => setEditForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:160, boxSizing:"border-box" }} />
              </div>
            </>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowEdit(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={updateMyPost} color={C.navy} full disabled={selPost.category === "작품공유"
              ? !editForm.title.trim() || !getYouTubeId(editForm.ytUrl)
              : selPost.category === "협업모집"
              ? !editForm.title.trim() || editForm.positions.length === 0
              : !editForm.title.trim() || !editForm.content.trim()}>수정 완료</Btn>
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
          ) : writeForm.category === "작품공유" ? (
            <div>
              <Inp label="작품 제목 *" placeholder="예: 완벽한 사과문" value={writeForm.title} onChange={e => setWriteForm(p=>({...p,title:e.target.value}))} />
              <Inp label="유튜브 링크 *" placeholder="https://youtu.be/..." value={writeForm.ytUrl} onChange={e => setWriteForm(p=>({...p,ytUrl:e.target.value}))} />
              {getYouTubeId(writeForm.ytUrl) && (
                <div style={{ marginBottom:16 }}>
                  <YouTubeEmbed url={writeForm.ytUrl} />
                </div>
              )}
              <Inp label="한 줄 소개" placeholder="작품을 한 문장으로" value={writeForm.oneLiner} onChange={e => setWriteForm(p=>({...p,oneLiner:e.target.value}))} />
              {/* 장르 태그 (직접 입력) */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>장르 <span style={{ color:C.muted, fontWeight:400 }}>(최대 5개)</span></div>
                <div style={{ display:"flex", gap:6, marginBottom: writeForm.genres.length ? 8 : 0 }}>
                  <input value={writeForm.genreInput} placeholder="예: 드라마 (입력 후 추가)"
                    onChange={e => setWriteForm(p=>({...p,genreInput:e.target.value}))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addGenre(); } }}
                    style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  <button type="button" onClick={addGenre}
                    style={{ background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                </div>
                {writeForm.genres.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {writeForm.genres.map(g => (
                      <span key={g} onClick={() => setWriteForm(p=>({...p, genres:p.genres.filter(x=>x!==g)}))}
                        style={{ background:C.yellowLight, color:"#92400E", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {g} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* 러닝타임 + 제작년월 */}
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <Inp label="러닝타임" placeholder="예: 12분" value={writeForm.runtime} onChange={e => setWriteForm(p=>({...p,runtime:e.target.value}))} />
                </div>
                <div style={{ flex:1 }}>
                  <Inp label="제작년월" placeholder="예: 2026.03" value={writeForm.prodDate} onChange={e => setWriteForm(p=>({...p,prodDate:e.target.value}))} />
                </div>
              </div>
              <Inp label="크레딧 (선택)" placeholder="연출 윤대식 · 촬영 ○○○ · 편집 ○○○" value={writeForm.credits} onChange={e => setWriteForm(p=>({...p,credits:e.target.value}))} />
              {/* 상세 내용 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>상세 내용 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
                <textarea placeholder="작품 설명, 비하인드 등" value={writeForm.content} onChange={e => setWriteForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:100, boxSizing:"border-box" }} />
              </div>
            </div>
          ) : writeForm.category === "협업모집" ? (
            <div>
              <Inp label="프로젝트 제목 *" placeholder="예: 단편영화 「완벽한 사과문」 크루 모집" value={writeForm.title} onChange={e => setWriteForm(p=>({...p,title:e.target.value}))} />
              <Inp label="한 줄 소개" placeholder="작품을 한 문장으로 (로그라인)" value={writeForm.crewLogline} onChange={e => setWriteForm(p=>({...p,crewLogline:e.target.value}))} />
              {/* 모집 포지션 (직접 입력) */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>모집 포지션 * <span style={{ color:C.muted, fontWeight:400 }}>(최대 8개)</span></div>
                <select value={writeForm.positionSelect} onChange={e => pickPosition(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color: writeForm.positionSelect ? C.text : C.muted, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark", cursor:"pointer" }}>
                  <option value="">＋ 포지션 선택...</option>
                  {CREW_POSITIONS.map(pos => (
                    <option key={pos} value={pos} disabled={pos !== CREW_ETC && writeForm.positions.includes(pos)}>{pos}</option>
                  ))}
                </select>
                {writeForm.positionSelect === CREW_ETC && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <input value={writeForm.positionInput} placeholder="포지션 직접 입력 (예: 스틸 촬영)" autoFocus
                      onChange={e => setWriteForm(p=>({...p,positionInput:e.target.value}))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPositionCustom(); } }}
                      style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    <button type="button" onClick={addPositionCustom}
                      style={{ background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                  </div>
                )}
                {writeForm.positions.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {writeForm.positions.map(v => (
                      <span key={v} onClick={() => setWriteForm(p=>({...p, positions:p.positions.filter(x=>x!==v)}))}
                        style={{ background:"rgba(249,115,22,0.14)", color:"#f97316", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {v} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* 일정 + 장소 */}
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <Inp label="촬영 일정" placeholder="예: 2026.04.12~14" value={writeForm.crewSchedule} onChange={e => setWriteForm(p=>({...p,crewSchedule:e.target.value}))} />
                </div>
                <div style={{ flex:1 }}>
                  <Inp label="촬영 장소" placeholder="예: 서울·학교" value={writeForm.crewPlace} onChange={e => setWriteForm(p=>({...p,crewPlace:e.target.value}))} />
                </div>
              </div>
              {/* 보수 + 장르 */}
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <Inp label="보수" placeholder="예: 식비·크레딧" value={writeForm.crewPay} onChange={e => setWriteForm(p=>({...p,crewPay:e.target.value}))} />
                </div>
                <div style={{ flex:1 }}>
                  <Inp label="장르" placeholder="예: 드라마" value={writeForm.crewGenre} onChange={e => setWriteForm(p=>({...p,crewGenre:e.target.value}))} />
                </div>
              </div>
              {/* 모집 마감일 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>모집 마감일</div>
                <input type="date" value={writeForm.deadline} onChange={e => setWriteForm(p=>({...p,deadline:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
                {writeForm.deadline && getDday(writeForm.deadline) !== null && (
                  <div style={{ fontSize:11, color: getDday(writeForm.deadline) < 0 ? C.red : C.muted, marginTop:5 }}>
                    {getDday(writeForm.deadline) < 0 ? "이미 지난 날짜예요 (모집완료로 표시됩니다)" : getDday(writeForm.deadline) === 0 ? "오늘 마감 (D-DAY)" : `마감까지 D-${getDday(writeForm.deadline)}`}
                  </div>
                )}
              </div>
              {/* 상세 내용 */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>상세 내용 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
                <textarea placeholder="작품 설명, 준비 상황, 지원 시 참고사항 등" value={writeForm.content} onChange={e => setWriteForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:100, boxSizing:"border-box" }} />
              </div>
              <div style={{ background:"rgba(249,115,22,0.1)", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#c2410c" }}>
                💬 지원은 이 글의 댓글로 받아요. 지원자는 댓글을 남기면 됩니다.
              </div>
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
          {/* 이미지 첨부 - 강의·작품공유·협업모집 게시판 제외 */}
          {writeForm.category !== LECTURE_CAT && writeForm.category !== "작품공유" && writeForm.category !== "협업모집" && <div style={{ marginBottom:14 }}>
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
              : writeForm.category === "작품공유"
              ? "🎬 게시 후에도 작품 정보를 수정할 수 있어요."
              : writeForm.category === "협업모집"
              ? "🤝 게시 후에도 모집 내용을 수정할 수 있어요. 지원은 댓글로 받아요."
              : REAL_CATS.includes(writeForm.category)
              ? "⚠️ 실명으로 게시되며, 게시 후 수정·삭제가 불가합니다."
              : "⚠️ 익명으로 게시되며, 게시 후 수정·삭제가 불가합니다."}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={() => setShowWrite(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={submitPost} color={C.navy} full disabled={submitting ||
              (writeForm.category === LECTURE_CAT
                ? !writeForm.lectureName.trim() || !writeForm.professor.trim()
                : writeForm.category === "작품공유"
                ? !writeForm.title.trim() || !getYouTubeId(writeForm.ytUrl)
                : writeForm.category === "협업모집"
                ? !writeForm.title.trim() || writeForm.positions.length === 0
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

      {/* 🎬 가로 풀스크린 재생 오버레이 */}
      {fsVideo && <FullscreenPlayer videoId={fsVideo} onClose={() => setFsVideo(null)} />}
    </>
  );
}

/** 🎬 가로 풀스크린 재생 — 세로로 들어도 영상이 가로로 꽉 (iOS/안드로이드 공통) */
function FullscreenPlayer({ videoId, onClose }) {
  const [box, setBox] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 0,
    h: typeof window !== "undefined" ? window.innerHeight : 0,
  });
  useEffect(() => {
    const update = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    const onOri = () => { setTimeout(update, 300); setTimeout(update, 600); };
    window.addEventListener("orientationchange", onOri);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", onOri); };
  }, []);
  const portrait = box.h > box.w;
  const stageW = portrait ? box.h : box.w;
  const stageH = portrait ? box.w : box.h;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:99999, background:"#000" }}>
      <div style={{ position:"absolute", top:"50%", left:"50%", width:stageW, height:stageH, transform:`translate(-50%,-50%) ${portrait ? "rotate(-90deg)" : ""}` }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
          title="작품 재생"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }}
        />
        <button onClick={onClose} aria-label="닫기"
          style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)", width:42, height:42, borderRadius:21, background:"rgba(0,0,0,0.55)", color:"#fff", border:"1px solid rgba(255,255,255,0.25)", fontSize:19, cursor:"pointer", zIndex:2, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
      </div>
    </div>
  );
}

/** 🎥 박스오피스 — 넷플릭스 스타일 작품 브라우징 */
function WorkCard({ p, rank, onOpen }) {
  const ytId = getYouTubeId(p.ytUrl);
  return (
    <div onClick={() => onOpen(p)} style={{ flex:"0 0 150px", cursor:"pointer" }}>
      <div style={{ position:"relative", aspectRatio:"16/9", background:"#1a1a1a", borderRadius:7, overflow:"hidden", marginBottom:6 }}>
        {ytId
          ? <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          : <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#444" }}>🎬</div>}
        {rank != null && (
          <span style={{ position:"absolute", top:5, left:5, background: rank===1 ? "#dc2626" : "rgba(0,0,0,0.72)", color:"#fff", fontSize:13, fontWeight:700, width:22, height:22, borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Courier New', monospace" }}>{rank}</span>
        )}
        {p.runtime && <span style={{ position:"absolute", bottom:4, right:4, background:"rgba(0,0,0,0.8)", color:"#fff", fontSize:9, padding:"1px 5px", borderRadius:3 }}>{p.runtime}</span>}
      </div>
      <div style={{ fontSize:12, fontWeight:500, color:"#fafaf9", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div>
    </div>
  );
}

function CarouselRow({ title, badge, items, onOpen, ranked }) {
  const ref = useRef(null);
  if (!items.length) return null;
  return (
    <div style={{ marginBottom:4 }}>
      <div style={{ padding:"16px 12px 8px", fontSize:14, fontWeight:600, color:"#fafaf9", display:"flex", alignItems:"center", gap:8 }}>
        {badge && <span style={{ background:"#dc2626", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, fontFamily:"'Courier New', monospace" }}>TOP 10</span>}
        {title}
      </div>
      <div style={{ position:"relative" }}>
        <div ref={ref} className="bo-car" style={{ display:"flex", gap:8, overflowX:"auto", padding:"0 12px 12px" }}>
          {items.map((p, i) => <WorkCard key={p.id} p={p} rank={ranked ? i+1 : null} onOpen={onOpen} />)}
        </div>
        {items.length > 2 && (
          <div onClick={() => ref.current?.scrollBy({ left:300, behavior:"smooth" })} className="bo-arrow"
            style={{ position:"absolute", top:0, right:0, width:34, height:84, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", borderTopLeftRadius:7, borderBottomLeftRadius:7 }}>
            <span style={{ color:"#fff", fontSize:24, fontWeight:300 }}>›</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BoxOfficeView({ posts, onOpen, onPlay }) {
  const works = posts.filter(p => p.category === "작품공유" && getYouTubeId(p.ytUrl));
  const byDate = [...works].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  const byViews = [...works].sort((a,b) => (b.views||0) - (a.views||0)).slice(0, 10);
  const hero = byDate[0];

  // 장르별 행 (작품이 2개 이상인 장르만)
  const genreMap = {};
  works.forEach(p => (p.genres||[]).forEach(g => { (genreMap[g] = genreMap[g] || []).push(p); }));
  const genreRows = Object.entries(genreMap).filter(([,arr]) => arr.length >= 2);

  if (works.length === 0) {
    return (
      <div style={{ background:"#0a0a0a", borderRadius:10, margin:"14px 0 0", padding:"60px 20px", textAlign:"center", color:"#71706b" }}>
        <div style={{ fontSize:48, opacity:0.3, marginBottom:12 }}>🎬</div>
        <div style={{ fontSize:13, fontFamily:"'Courier New', monospace", letterSpacing:"0.15em", marginBottom:6 }}>NO FILMS YET</div>
        <div style={{ fontSize:12 }}>첫 작품을 올려보세요</div>
      </div>
    );
  }

  const heroYt = getYouTubeId(hero.ytUrl);
  return (
    <div style={{ background:"#0a0a0a", borderRadius:10, overflow:"hidden", margin:"14px 0 0", paddingBottom:14 }}>
      <style>{`.bo-car::-webkit-scrollbar{display:none}.bo-car{scrollbar-width:none;-ms-overflow-style:none;scroll-behavior:smooth}.bo-arrow{transition:background 0.15s}.bo-arrow:active{background:rgba(0,0,0,0.78)}`}</style>

      {/* 히어로 — 최신작 */}
      <div onClick={() => onOpen(hero)} style={{ position:"relative", aspectRatio:"16/9", background:"#1a1a1a", cursor:"pointer" }}>
        {heroYt && <img src={`https://img.youtube.com/vi/${heroYt}/hqdefault.jpg`} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />}
        <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"16px 14px", background:"rgba(0,0,0,0.55)" }}>
          <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:"#fbbf24", letterSpacing:"0.25em", fontWeight:700, marginBottom:5 }}>FEATURED · 이번 주 작품</div>
          <div style={{ fontSize:19, fontWeight:600, color:"#fafaf9", marginBottom:4, lineHeight:1.25 }}>{hero.title}</div>
          <div style={{ fontSize:11, color:"#a8a29e", marginBottom:11 }}>
            {[(hero.genres||[]).join(" · "), hero.runtime, hero.prodDate].filter(Boolean).join(" · ")}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={(e) => { e.stopPropagation(); onPlay(heroYt); }}
              style={{ background:"#dc2626", color:"#fff", fontSize:12, fontWeight:600, padding:"7px 18px", borderRadius:6, border:"none", cursor:"pointer" }}>▶ 재생</button>
            <button onClick={(e) => { e.stopPropagation(); onOpen(hero); }}
              style={{ background:"rgba(255,255,255,0.16)", color:"#fafaf9", fontSize:12, padding:"7px 14px", borderRadius:6, border:"none", cursor:"pointer" }}>ⓘ 정보</button>
          </div>
        </div>
      </div>

      <CarouselRow title="🆕 최신작" items={byDate} onOpen={onOpen} />
      <CarouselRow title="인기작" badge items={byViews} onOpen={onOpen} ranked />
      {genreRows.map(([g, arr]) => (
        <CarouselRow key={g} title={`🎬 ${g}`} items={arr} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** ▶️ 유튜브 임베드 — 썸네일 먼저, 탭하면 재생 (의도적 재생이라 조회수에 유리) */
function YouTubeEmbed({ url }) {
  const id = getYouTubeId(url);
  const [play, setPlay] = useState(false);
  if (!id) return null;
  if (play) {
    return (
      <div style={{ position:"relative", paddingTop:"56.25%", borderRadius:8, overflow:"hidden", background:"#000" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="작품 영상"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }}
        />
      </div>
    );
  }
  return (
    <div onClick={() => setPlay(true)} role="button" aria-label="영상 재생"
      style={{ position:"relative", paddingTop:"56.25%", borderRadius:8, overflow:"hidden", background:"#000", cursor:"pointer" }}>
      <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="작품 썸네일"
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.28)" }}>
        <div style={{ width:56, height:40, borderRadius:10, background:"rgba(220,38,38,0.94)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#fff", fontSize:18, marginLeft:2 }}>▶</span>
        </div>
      </div>
    </div>
  );
}

/** 🛠️ 도구 카드 (필름 도구 룸) */
function ToolCard({ icon, label, title, desc, comingSoon, onClick }) {
  return (
    <div onClick={comingSoon ? undefined : onClick}
      onMouseEnter={e => { if (!comingSoon) e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      style={{
        background:"#1a1a1a",
        border:"1px solid #2a2a2a",
        borderLeft: comingSoon ? "1px solid #2a2a2a" : "3px solid #fbbf24",
        borderRadius:6, padding:"16px 12px",
        cursor: comingSoon ? "not-allowed" : "pointer",
        textAlign:"center", minHeight:130, opacity: comingSoon ? 0.5 : 1,
        display:"flex", flexDirection:"column", justifyContent:"center",
        position:"relative", transition:"transform 0.15s",
      }}>
      {comingSoon && (
        <div style={{
          position:"absolute", top:6, right:8,
          fontSize:8, color:"#71706b", fontFamily:"'Courier New', monospace", letterSpacing:"0.15em",
        }}>SOON</div>
      )}
      <div style={{ fontSize:40, marginBottom:6 }}>{icon}</div>
      <div style={{ fontFamily:"'Courier New', monospace", fontSize:8, color:"#fbbf24", letterSpacing:"0.25em", fontWeight:700, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:800, color:"#fafaf9" }}>{title}</div>
      <div style={{ fontSize:9, color:"#a8a29e", marginTop:3 }}>{desc}</div>
    </div>
  );
}
