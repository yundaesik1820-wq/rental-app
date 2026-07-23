import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { Search, Bell, ChevronLeft, ChevronRight, MessageCircle, BookOpen, Users, Clapperboard, Video, GraduationCap, Star } from "lucide-react";
import { C } from "../../theme";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import CinemaSlate from "../../components/CinemaSlate";
import ExposureLive from "../../components/ExposureLive";
import ExposureCalc from "../../components/ExposureCalc";
import DofCalc from "../../components/DofCalc";
import ColorTemp from "../../components/ColorTemp";
import FovCalc from "../../components/FovCalc";
import ScripterTool from "../../components/ScripterTool";
import SunSeeker from "../../components/SunSeeker";
import ResourceHub from "../../components/ResourceHub";

// 🚫 욕설/혐오 표현 필터 (Apple App Store 가이드라인 1.2 — UGC 욕설 필터링 요건)
// 학교 커뮤니티 운영 정책에 맞게 아래 목록을 자유롭게 추가/삭제하세요.
const BAD_WORDS = [
  // 욕설
  "씨발", "시발", "씨빨", "시방새", "씨바", "좆", "좇", "존나", "개새끼", "개색끼", "개세끼",
  "병신", "빙신", "븅신", "지랄", "니미", "느금", "엠창", "애미", "ㅄ", "ㅂㅅ", "ㅆㅂ", "ㅈㄴ",
  // 비하/혐오
  "게이새끼", "호모새끼", "게이년", "장애인새끼", "정신병자새끼",
  // 영문
  "fuck", "fucking", "shit", "bitch", "asshole",
];
// 원문 + 정규화(공백·일부 특수문자 제거)본을 함께 검사해 우회 입력을 잡는다.
function containsBadWord(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  const norm = lower.replace(/[\s.\-_*]/g, "");
  for (const w of BAD_WORDS) {
    if (!w) continue;
    if (lower.includes(w) || norm.includes(w)) return w;
  }
  return null;
}

// 🚨 신고 누적 시 자동 숨김 임계값 (이 수 이상 신고되면 작성자·관리자 외에는 안 보임)
const REPORT_HIDE_THRESHOLD = 5;

const CATEGORIES  = ["전체", "자유", "질문", "강의", "정보", "취업", "공모전", "기타", "협업모집", "작품공유", "스탭프로필", "클래스"];
const ANON_CATS   = ["자유", "질문", "강의", "작품공유", "정보", "공모전", "기타"]; // 익명
const REAL_CATS   = ["협업모집", "스탭프로필", "클래스"]; // 실명
// 카드형 리스트(com.png) 카테고리별 액센트 색
const CAT_COLOR = {
  "자유":"#f4718a", "질문":"#60a5fa", "강의":"#c084fc", "정보":"#34d399",
  "취업":"#22d3ee", "공모전":"#fb923c", "기타":"#94a3b8",
  "작품공유":"#a78bfa", "협업모집":"#fbbf24", "스탭프로필":"#f472b6", "클래스":"#38bdf8",
};
const catAccent = (c) => CAT_COLOR[c] || "#9ca3af";
// 게시글 상세 액센트 톤 — 앱 파랑→보라 그라데이션으로 통일 (카테고리 무관)
const POST_ACCENT = {
  gradient: "linear-gradient(135deg,#5b8def,#7c3aed)",
  solid:    "#7c3aed",              // 그라데이션 못 쓰는 곳(테두리)용 단색
  bright:   "#7e9dff",              // 활성 텍스트색
  border:   "rgba(124,58,237,0.35)",
  glow:     "rgba(124,58,237,0.30)",
};
const postAccent = () => POST_ACCENT;
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
    subEn:"Community",
    title:"커뮤니티",
    desc:"익명으로 나누는 영상계열 이야기",
    color:"#dc2626",
    colorBg:"rgba(220,38,38,0.15)",
    borderStyle:"solid",
    categories:["자유", "질문"],
  },
  {
    id:"knowledge", studentOnly:true,
    number:"03",
    icon:"📚",
    subtitle:"KNOWLEDGE",
    subEn:"Info Share",
    title:"정보 공유",
    desc:"정보·공모전·기타",
    color:"#06b6d4",
    colorBg:"rgba(6,182,212,0.15)",
    borderStyle:"solid",
    categories:["정보", "공모전", "기타"],
  },
  {
    id:"crew",
    number:"05",
    icon:"🤝",
    subtitle:"CREW MAKERS",
    subEn:"Crew Makers",
    title:"크루 메이커스",
    desc:"함께할 팀원·스태프 모집",
    color:"#f97316",
    colorBg:"rgba(249,115,22,0.15)",
    borderStyle:"solid",
    categories:["협업모집", "스탭프로필"],
  },
  {
    id:"tools",
    number:"06",
    icon:"🎬",
    subtitle:"FILM TOOLS",
    subEn:"Film Tools",
    title:"필름 도구",
    desc:"촬영 현장 실용 도구",
    color:"#fbbf24",
    colorBg:"rgba(251,191,36,0.15)",
    borderStyle:"dashed",
    categories:[], // 도구는 카테고리 X
  },
  {
    id:"boxoffice",
    number:"07",
    icon:"🎥",
    subtitle:"KBATV BOXOFFICE",
    subEn:"Box Office",
    title:"KBATV 박스오피스",
    desc:"학생 단편·작품 상영관",
    color:"#a855f7",
    colorBg:"rgba(168,85,247,0.15)",
    borderStyle:"solid",
    categories:["작품공유"],
  },
  {
    id:"class",
    number:"08",
    icon:"🎓",
    subtitle:"FILM CLASS",
    subEn:"Film Class",
    title:"필름 클래스",
    desc:"영상 제작 강의 모음",
    color:"#6366f1",
    colorBg:"rgba(99,102,241,0.15)",
    borderStyle:"solid",
    categories:["클래스"],
  },
];

// 🎞️ 필름도구 스와이프 박스 — 이미지 전용 (public/film-tools/*.png, 480×240 제작 → 160×80 표시)
//    윗줄 5개 + 아랫줄 4개, 가로 스냅 스와이프. 클릭 시 해당 도구 바로 진입.
const FILM_TOOL_BOXES = [
  { key:"slate",         img:"/film-tools/slate.png" },
  { key:"scripter",      img:"/film-tools/scripter.png" },
  { key:"live-exposure", img:"/film-tools/live-exposure.png" },
  { key:"exposure-calc", img:"/film-tools/exposure-calc.png" },
  { key:"dof",           img:"/film-tools/dof.png" },
  { key:"color-temp",    img:"/film-tools/color-temp.png" },
  { key:"fov",           img:"/film-tools/fov.png" },
  { key:"sun",           img:"/film-tools/sun.png" },
  { key:"resources",     img:"/film-tools/resources.png" },
];

// 🎬 룸 → 라인 아이콘 (목업 00.png 디자인)
const ROOM_ICON = {
  community:   MessageCircle,
  knowledge:   BookOpen,
  crew:        Users,
  tools:       Clapperboard,
  boxoffice:   Video,
  class:       GraduationCap,
};

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

// 유튜브 썸네일 (maxres→hq→mq→0 단계 폴백)
// ⚠️ 유튜브는 썸네일이 없어도 120x90 회색 더미를 200 OK로 반환 → onError가 안 터짐.
//    그래서 onLoad에서 naturalWidth로 더미(<=120px)를 감지해 다음 단계로 넘긴다.
function YtThumb({ id, alt = "", style }) {
  const [stage, setStage] = useState(0);
  useEffect(() => { setStage(0); }, [id]);  // id 바뀌면 처음부터
  if (!id) return <div style={{ ...style, display:"flex", alignItems:"center", justifyContent:"center", background:"#1a1a1a", color:"#444", fontSize:28 }}>🎬</div>;
  const urls = [
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,  // 1280
    `https://img.youtube.com/vi/${id}/sddefault.jpg`,      // 640
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,      // 480 (항상 존재)
  ];
  if (stage >= urls.length) {
    // hqdefault까지 실패하면 hqdefault를 그냥 표시 (거의 항상 존재함)
    return <img loading="lazy" decoding="async" src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt={alt} style={style} />;
  }
  const handleLoad = (e) => {
    // 유튜브 더미 회색 이미지는 120px → 다음(더 낮은) 화질로
    if (e.currentTarget.naturalWidth <= 121 && stage < urls.length) setStage(s => s + 1);
  };
  return <img loading="lazy" decoding="async" src={urls[stage]} alt={alt} onLoad={handleLoad} onError={() => setStage(s => s + 1)} style={style} />;
}

// 모집 마감일 → 남은 일수 (양수: 남음, 0: 당일, 음수: 마감)
function getDday(deadline) {
  if (!deadline) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(deadline); end.setHours(0,0,0,0);
  if (isNaN(end.getTime())) return null;
  return Math.round((end - today) / 86400000);
}

/* 🎠 공용 자동 캐러셀 — 4초 자동 넘김 + 손 스와이프(스냅), 끝나면 오른쪽으로 무한 루프 */
function AutoCarousel({ list, accent, renderSlide }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimer = useRef(null);
  const [idx, setIdx] = useState(0);

  // 끝 뒤에 첫 장 복제를 붙여 항상 오른쪽으로 이어지는 무한 루프
  const slides = list.length > 1 ? [...list, list[0]] : list;

  // 자동 넘김 — 현재 스크롤 위치 기준으로 다음 장 (수동 스와이프 후에도 자연스럽게 이어짐)
  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => {
      const el = trackRef.current;
      if (!el || pausedRef.current || !el.clientWidth) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      el.scrollTo({ left: Math.min(cur + 1, list.length) * el.clientWidth, behavior: "smooth" });
    }, 4000);
    return () => clearInterval(id);
  }, [list.length]);

  const pause = () => {
    pausedRef.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const resume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { pausedRef.current = false; }, 4000);
  };
  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const w = el.clientWidth;
    // 복제 슬라이드(마지막)에 완전히 도달하면 진짜 첫 장으로 순간이동 — 똑같이 보여서 티 안 남
    if (list.length > 1 && el.scrollLeft >= list.length * w - 1) {
      el.scrollTo({ left: 0, behavior: "auto" });
      setIdx(0);
      return;
    }
    setIdx(Math.min(list.length - 1, Math.round(el.scrollLeft / w)));
  };

  return (
    <div>
      <style>{`.contest-swipe::-webkit-scrollbar{display:none}.contest-swipe{scrollbar-width:none;-ms-overflow-style:none}`}</style>
      <div ref={trackRef} className="contest-swipe" onScroll={onScroll}
        onTouchStart={pause} onTouchEnd={resume} onTouchCancel={resume}
        style={{ display:"flex", overflowX:"auto", scrollSnapType:"x mandatory", borderRadius:16 }}>
        {slides.map((p, si) => (
          <div key={si === list.length ? `${p.id}-clone` : p.id}
            style={{ flexShrink:0, width:"100%", scrollSnapAlign:"start", boxSizing:"border-box" }}>
            {renderSlide(p)}
          </div>
        ))}
      </div>
      {/* 인디케이터 점 */}
      {list.length > 1 && (
        <div style={{ display:"flex", justifyContent:"center", gap:5, marginTop:7 }}>
          {list.map((_, i) => (
            <span key={i} style={{ width: i === idx ? 14 : 5, height:5, borderRadius:3, background: i === idx ? accent : "rgba(255,255,255,0.18)", transition:"all 0.25s" }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* 🎓 필름 클래스 카드 캐러셀 */
function ClassCarousel({ list, onOpen }) {
  return (
    <AutoCarousel list={list} accent="#6366f1" renderSlide={(p) => {
      const ytId = getYouTubeId(p.lessons?.[0]?.url);
      return (
        <div onClick={() => onOpen(p)}
          style={{ display:"flex", alignItems:"center", gap:12, background:"linear-gradient(160deg, rgba(99,102,241,0.10) 0%, rgba(79,70,229,0.05) 40%, #101018 100%)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:16, padding:"10px 12px", cursor:"pointer" }}>
          {/* 좌: 첫 강의 썸네일 */}
          <div style={{ position:"relative", width:116, height:65, flexShrink:0, borderRadius:10, overflow:"hidden", background:"#1a1a1f", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {ytId
              ? <YtThumb id={ytId} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              : <span style={{ fontSize:24, opacity:0.5 }}>🎓</span>}
          </div>
          {/* 우: 강좌명 / 분야·부제 / n강 */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#e7e5e4", lineHeight:1.35, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
            {p.classField && <div style={{ fontSize:11, color:"#8a8a92", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.classField}</div>}
            <div style={{ fontSize:11, color:"#818cf8", fontWeight:700 }}>{(p.lessons||[]).length}강</div>
          </div>
        </div>
      );
    }} />
  );
}

/* 🏆 공모전 카드 캐러셀 */
function ContestCarousel({ list, onOpen }) {
  const fmt = (d) => (d || "").split("-").join(".");
  return (
    <AutoCarousel list={list} accent="#fb923c" renderSlide={(p) => {
      const dday = getDday(p.deadline);
      return (
        <div onClick={() => onOpen(p)}
          style={{ display:"flex", alignItems:"center", gap:12, background:"linear-gradient(160deg, rgba(251,146,60,0.10) 0%, rgba(249,115,22,0.05) 40%, #101018 100%)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:16, padding:"10px 12px", cursor:"pointer" }}>
          {/* 좌: 공모전 이미지 */}
          <div style={{ width:100, height:76, borderRadius:10, flexShrink:0, overflow:"hidden", background:"#1a1a1f", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {p.images?.[0]
              ? <img loading="lazy" decoding="async" src={p.images[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <span style={{ fontSize:24, opacity:0.5 }}>🏆</span>}
          </div>
          {/* 우: 이름 / 기간 / D-day */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:5 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#e7e5e4", lineHeight:1.35, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{p.title}</div>
            <div style={{ fontSize:11, color:"#8a8a92" }}>{fmt(p.contestStart)} ~ {fmt(p.deadline)}</div>
            <span style={{ alignSelf:"flex-start", background:"#fb923c", color:"#0a0a0a", fontSize:9.5, fontWeight:700, padding:"2px 8px", borderRadius:5 }}>
              {dday === 0 ? "D-DAY" : `D-${dday}`}
            </span>
          </div>
        </div>
      );
    }} />
  );
}

/* 🎬 오늘의 추천작 카드 캐러셀 */
function WorkCarousel({ list, onOpen }) {
  return (
    <AutoCarousel list={list} accent="#a855f7" renderSlide={(p) => {
      const ytId = getYouTubeId(p.ytUrl);
      return (
        <div onClick={() => onOpen(p)}
          style={{ display:"flex", alignItems:"center", gap:12, background:"linear-gradient(160deg, rgba(168,85,247,0.10) 0%, rgba(124,58,237,0.05) 40%, #101018 100%)", border:"1px solid rgba(168,85,247,0.25)", borderRadius:16, padding:"10px 12px", cursor:"pointer" }}>
          {/* 좌: 썸네일 */}
          <div style={{ position:"relative", width:116, height:65, flexShrink:0, borderRadius:10, overflow:"hidden", background:"#000" }}>
            <YtThumb id={ytId} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:28, height:20, borderRadius:5, background:"rgba(220,38,38,0.92)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ color:"#fff", fontSize:9, marginLeft:1 }}>▶</span>
              </div>
            </div>
          </div>
          {/* 우: 제목 / 크레딧 / 러닝타임 */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#e7e5e4", lineHeight:1.35, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
            {p.credits && <div style={{ fontSize:11, color:"#8a8a92", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>🎬 {p.credits}</div>}
            {p.runtime && <div style={{ fontSize:11, color:"#8a8a92" }}>⏱ {p.runtime}</div>}
          </div>
        </div>
      );
    }} />
  );
}

// 포지션 표시: {role, count} 객체 또는 기존 문자열 모두 지원
function posLabel(pos) {
  if (typeof pos === "string") return pos;
  if (!pos) return "";
  return pos.count ? `${pos.role} ${pos.count}명` : pos.role;
}

/** 🤝 크루 메이커스 홈 섹션 — 좌: 구인글 / 우: 스탭 프로필, 각 열 독립 자동 순환 */
function CrewMakersSection({ crews, staffs, onOpen, onAll, bookmarks, onToggleBookmark }) {
  const [crewIdx, setCrewIdx] = useState(0);
  const [staffIdx, setStaffIdx] = useState(0);
  useEffect(() => {
    if (crews.length <= 1) return;
    const t = setInterval(() => setCrewIdx(i => (i + 1) % crews.length), 5000);
    return () => clearInterval(t);
  }, [crews.length]);
  useEffect(() => {
    if (staffs.length <= 1) return;
    const t = setInterval(() => setStaffIdx(i => (i + 1) % staffs.length), 5000);
    return () => clearInterval(t);
  }, [staffs.length]);

  const CHIP_COLORS = ["#ef4444","#f97316","#22c55e","#3b82f6","#a855f7","#eab308"];
  const CARD_H = 196;
  const crew  = crews.length  ? crews[crewIdx % crews.length]    : null;
  const staff = staffs.length ? staffs[staffIdx % staffs.length] : null;

  const Dots = ({ n, idx, onSet }) => n > 1 ? (
    <div style={{ display:"flex", justifyContent:"center", gap:4, marginTop:7 }}>
      {Array.from({ length:n }, (_, i) => (
        <span key={i} onClick={() => onSet(i)}
          style={{ width: i===idx ? 14 : 5, height:5, borderRadius:3, background: i===idx ? "#f97316" : "rgba(255,255,255,0.22)", transition:"all .25s", cursor:"pointer" }} />
      ))}
    </div>
  ) : null;

  const EmptyCol = ({ label }) => (
    <div style={{ height:CARD_H, boxSizing:"border-box", border:"1px dashed rgba(255,255,255,0.14)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10.5, color:"#6b6b74" }}>{label}</div>
  );

  const BookmarkStar = ({ postId }) => (
    <span onClick={(e) => onToggleBookmark(e, postId)}
      style={{ position:"absolute", top:5, right:5, width:26, height:26, borderRadius:"50%", background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:1 }}>
      <Star size={14} color={bookmarks.includes(postId) ? "#facc15" : "#fff"} fill={bookmarks.includes(postId) ? "#facc15" : "none"} />
    </span>
  );

  return (
    <div style={{ marginTop:14 }}>
      <style>{`@keyframes crewFade{from{opacity:.3}to{opacity:1}}`}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7, padding:"0 2px" }}>
        <span style={{ display:"flex", alignItems:"baseline", gap:6, minWidth:0 }}>
          <span style={{ fontSize:12.5, fontWeight:800, letterSpacing:"-0.02em", color:"#f97316", flexShrink:0 }}>크루 메이커스</span>
          <span style={{ fontSize:10, color:"#8a8a92", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>함께할 크루를 찾아보세요!</span>
        </span>
        <span onClick={onAll} style={{ display:"flex", alignItems:"center", gap:1, fontSize:10.5, fontWeight:600, color:"#8a8a92", cursor:"pointer", flexShrink:0 }}>
          전체보기 <ChevronRight size={12} color="#8a8a92" />
        </span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {/* 좌: 구인글 (협업모집) */}
        <div style={{ minWidth:0 }}>
          {!crew ? <EmptyCol label="구인글이 아직 없어요" /> : (() => {
            const dday = getDday(crew.deadline);
            const urgent = dday !== null && dday <= 3;
            const tot = (crew.positions||[]).reduce((s,v) => s + (parseInt(typeof v === "object" ? v.count : 0, 10) || 0), 0);
            const cur = (crew.applicants||[]).length;
            const full = tot > 0 && cur >= tot;
            const thumb = crew.images?.[0];
            return (
              <div key={crew.id} onClick={() => onOpen(crew)}
                style={{ height:CARD_H, boxSizing:"border-box", display:"flex", flexDirection:"column", background:"#131318", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, overflow:"hidden", cursor:"pointer", animation:"crewFade .45s ease" }}>
                <div style={{ position:"relative", height:64, flexShrink:0, background:"linear-gradient(135deg,#1c1c26,#101014)" }}>
                  {thumb
                    ? <img loading="lazy" decoding="async" src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, opacity:0.4 }}>🎬</div>}
                  <span style={{ position:"absolute", top:7, left:7, background: urgent ? "#f97316" : "#ef4444", color:"#fff", fontSize:8.5, fontWeight:800, padding:"2.5px 8px", borderRadius:20 }}>{urgent ? "마감임박" : "모집중"}</span>
                  <BookmarkStar postId={crew.id} />
                </div>
                <div style={{ padding:"8px 9px 9px", flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color:"#e7e5e4", marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{crew.title}</div>
                  {(crew.positions||[]).length > 0 && (
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6, overflow:"hidden", maxHeight:17 }}>
                      {(crew.positions||[]).slice(0,2).map((v, i) => {
                        const c = CHIP_COLORS[i % CHIP_COLORS.length];
                        const role = (typeof v === "string" ? v : v.role || "").split("/")[0];
                        return <span key={i} style={{ background:c+"22", color:c, fontSize:8.5, fontWeight:700, padding:"2px 6px", borderRadius:5, whiteSpace:"nowrap" }}>{role}</span>;
                      })}
                      {(crew.positions||[]).length > 2 && <span style={{ fontSize:8.5, color:"#8a8a92", alignSelf:"center" }}>+{(crew.positions||[]).length-2}</span>}
                    </div>
                  )}
                  <div style={{ fontSize:9.5, color:"#8a8a92", display:"flex", flexDirection:"column", gap:2 }}>
                    {crew.crewSchedule && <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📅 {crew.crewSchedule}</span>}
                    {crew.crewPlace && <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📍 {crew.crewPlace}</span>}
                  </div>
                  <div style={{ marginTop:"auto", display:"flex", alignItems:"center", gap:5, paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ fontSize:10, fontWeight:600, color:"#b8b8c0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{crew.crewDirector || crew.authorName || "익명"}</span>
                    {tot > 0 && <span style={{ fontSize:9.5, fontWeight:700, color: full ? "#facc15" : "#8a8a92", flexShrink:0 }}>👥 {cur}/{tot}</span>}
                  </div>
                </div>
              </div>
            );
          })()}
          <Dots n={crews.length} idx={crewIdx % Math.max(crews.length,1)} onSet={setCrewIdx} />
        </div>
        {/* 우: 스탭 프로필 */}
        <div style={{ minWidth:0 }}>
          {!staff ? <EmptyCol label="프로필이 아직 없어요" /> : (
            <div key={staff.id} onClick={() => onOpen(staff)}
              style={{ position:"relative", height:CARD_H, boxSizing:"border-box", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", background:"#131318", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"16px 10px 10px", cursor:"pointer", overflow:"hidden", animation:"crewFade .45s ease" }}>
              <BookmarkStar postId={staff.id} />
              <div style={{ width:52, height:52, borderRadius:"50%", overflow:"hidden", background:"rgba(244,114,182,0.12)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8, flexShrink:0, border:"1px solid rgba(244,114,182,0.3)" }}>
                {staff.profileImage
                  ? <img loading="lazy" decoding="async" src={staff.profileImage} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                  : <span style={{ fontSize:22 }}>🙋</span>}
              </div>
              <div style={{ fontSize:12.5, fontWeight:700, color:"#e7e5e4", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"100%" }}>{staff.authorName || "익명"}</div>
              {staff.staffMajor && <div style={{ fontSize:9.5, color:"#8a8a92", marginBottom:7, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"100%" }}>{staff.staffMajor}</div>}
              {(staff.staffRoles||[]).length > 0 && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"center", overflow:"hidden", maxHeight:38 }}>
                  {(staff.staffRoles||[]).slice(0,3).map((r, i) => (
                    <span key={i} style={{ background:"rgba(244,114,182,0.13)", color:"#f472b6", fontSize:8.5, fontWeight:700, padding:"2px 7px", borderRadius:5, whiteSpace:"nowrap" }}>{String(r).split("/")[0]}</span>
                  ))}
                  {(staff.staffRoles||[]).length > 3 && <span style={{ fontSize:8.5, color:"#8a8a92", alignSelf:"center" }}>+{(staff.staffRoles||[]).length-3}</span>}
                </div>
              )}
            </div>
          )}
          <Dots n={staffs.length} idx={staffIdx % Math.max(staffs.length,1)} onSet={setStaffIdx} />
        </div>
      </div>
    </div>
  );
}

export default function Community({ onExit, onNotif, initialRoom, initialPostId, initialArticleId, onRoomConsumed, onOpenProjectStudio }) {
  const { profile } = useAuth();

  // 🎬 선택된 룸 - null이면 분기 화면, 그 외엔 해당 룸 표시
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [blockedRoom, setBlockedRoom] = useState(null); // 교수/교사가 학생전용 룸 클릭 시
  // 🎬 룸 진입 스플래시 — 전체보기 진입 연출 (null | { src, phase: "in"|"out" })
  const [roomSplash, setRoomSplash] = useState(null);
  const roomSplashTimers = useRef([]);
  useEffect(() => {
    ["/boxoffice-splash.webp", "/class-splash.webp"].forEach(src => { const img = new Image(); img.src = src; });   // 미리 로드 (첫 진입 지연 방지)
    return () => roomSplashTimers.current.forEach(clearTimeout);
  }, []);
  const runRoomSplash = (src) => {
    setRoomSplash({ src, phase:"in" });
    roomSplashTimers.current.push(setTimeout(() => setRoomSplash({ src, phase:"out" }), 900));
    roomSplashTimers.current.push(setTimeout(() => setRoomSplash(null), 1500));
  };
  // ⭐ 크루 북마크 — users/{uid}.crewBookmarks 배열 (seenNotifs와 같은 패턴, 낙관적 로컬 갱신)
  const [crewBookmarks, setCrewBookmarks] = useState(profile?.crewBookmarks || []);
  const toggleCrewBookmark = (e, postId) => {
    e.stopPropagation();
    const on = crewBookmarks.includes(postId);
    setCrewBookmarks(prev => on ? prev.filter(id => id !== postId) : [...prev, postId]);
    if (profile?.uid) updateItem("users", profile.uid, { crewBookmarks: on ? arrayRemove(postId) : arrayUnion(postId) }).catch(() => {});
  };
  const [showSearch, setShowSearch] = useState(false); // 헤더 검색(추후 구현 — 현재 자리만)
  const currentRoom = ROOMS.find(r => r.id === selectedRoom);
  // 🛠️ 선택된 도구 (필름 도구 룸 안에서)
  const [selectedTool, setSelectedTool] = useState(null);

  // 🔔 알림 딥링크 — 룸/기사/글 진입 (App에서 받은 타깃을 로컬로 복사 후 즉시 소비)
  const [deepArticleId, setDeepArticleId] = useState(null);
  const [deepPostId, setDeepPostId] = useState(null);
  useEffect(() => {
    if (!initialRoom && !initialArticleId && !initialPostId) return;
    if (initialRoom)      setSelectedRoom(initialRoom);
    if (initialArticleId) setDeepArticleId(initialArticleId);
    if (initialPostId)    setDeepPostId(initialPostId);
    onRoomConsumed?.();
  }, [initialRoom, initialArticleId, initialPostId]);

  // 🔧 상태바(노치) 높이를 JS로 직접 측정해서 px로 적용
  //    일부 WebView(특히 구형 안드로이드)는 calc() 안에 중첩된 max()+env()를
  //    무효 처리해서 padding이 통째로 0이 되는 버그가 있음 → 헤더가 상태바에 겹침.
  //    probe 엘리먼트의 실제 렌더 높이를 읽어 픽셀 값으로 박으면 파싱 이슈를 완전히 우회.
  //    최소 48px 바닥값은 네이티브 앱에서만 — 웹/PWA는 상태바가 없으니 0부터 시작.
  const SAFE_FLOOR = Capacitor.isNativePlatform() ? 24 : 0;
  const [safeTop, setSafeTop] = useState(SAFE_FLOOR);
  useEffect(() => {
    const measure = () => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;top:0;left:-9999px;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;";
      document.documentElement.appendChild(probe);
      const measured = probe.getBoundingClientRect().height || 0;
      probe.remove();
      setSafeTop(Math.max(measured, SAFE_FLOOR)); // 상태바 최소 확보 높이(바닥값, 네이티브 전용)
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  // 하단 네비 높이 실측 → 컨테이너 하단을 그만큼 비워 하단바가 보이게 (모바일: 실측값 / 데스크톱: 0=풀스크린)
  const [navH, setNavH] = useState(0);
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(".mobile-nav");
      setNavH(el ? el.offsetHeight : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const { data: posts }    = useCollection("communityPosts",    "createdAt");
  const { data: comments } = useCollection("communityComments", "createdAt");

  // 🔔 알림 딥링크 — 글이 속한 룸 진입 후 글 상세 열기 (텀은 App의 onNavigate에서 일괄 적용)
  useEffect(() => {
    if (!deepPostId || !posts.length) return;
    const p = posts.find(x => x.id === deepPostId);
    if (!p) { setDeepPostId(null); return; }
    const room = ROOMS.find(r => (r.categories || []).includes(p.category));
    if (room) setSelectedRoom(room.id);
    openPost(p);
    setDeepPostId(null);
  }, [deepPostId, posts]);

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
  // 관리자 실명 게시 기능 제거됨 — 항상 비활성
  const canUseRealName = false;
  // 관리자 역할 라벨 (에브리타임에서는 super도 조교로 표시 - 학생 친화적)
  const adminRoleLabel = adminRole === "teacher"   ? "교사"
                       : adminRole === "professor" ? "교수"
                       : "조교";  // super, assistant 둘 다 조교

  // 새내기 여부
  const studentId  = profile?.studentId || "";
  const isNewbie   = studentId.startsWith(newbiePrefix);

  const [cat, setCat]           = useState("전체");
  const [selPost, setSelPost]   = useState(null); // 상세 모달
  // 🚫 차단 목록: profile에서 초기화 후 로컬 state로 즉시 반영 (useAuth는 1회 로드라 실시간 아님)
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockList, setShowBlockList] = useState(false);
  const [fsVideo,  setFsVideo]  = useState(null); // 가로 풀스크린 재생 (유튜브 ID)
  const [applyPosition, setApplyPosition] = useState(""); // 크루 지원 시 선택 포지션
  const [showWrite, setShowWrite] = useState(false);
  const [writeForm, setWriteForm] = useState({ title:"", content:"", category:"자유", images:[],
    lectureName:"", professor:"", schedule:"", useRealName:false,
    ytUrl:"", oneLiner:"", genres:[], genreInput:"", runtime:"", prodDate:"", credits:"",
    positions:[], positionInput:"", positionSelect:"", positionCount:"", crewLogline:"", crewDirector:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"", contestStart:"", contestUrl:"", profileImage:"", staffRoles:[], staffRoleSelect:"", staffRoleInput:"", staffMajor:"", staffContact:"", classDesc:"", classField:"", channelUrl:"", lessons:[], lessonTitle:"", lessonUrl:"", lessonDuration:"" }); // 강의/작품공유/크루/공모전 전용 필드 + 관리자 실명모드
  const [commentRating, setCommentRating] = useState(0); // 별점
  const [showEdit,    setShowEdit]    = useState(false); // 수정 모달
  const [editForm,    setEditForm]    = useState({ title:"", content:"", ytUrl:"", oneLiner:"", genres:[], genreInput:"", runtime:"", prodDate:"", credits:"", positions:[], positionInput:"", positionSelect:"", positionCount:"", crewLogline:"", crewDirector:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"", profileImage:"", staffRoles:[], staffRoleSelect:"", staffRoleInput:"", staffMajor:"", staffContact:"", classDesc:"", classField:"", channelUrl:"", lessons:[], lessonTitle:"", lessonUrl:"", lessonDuration:"" });
  const [commentText, setCommentText] = useState("");
  const [commentUseRealName, setCommentUseRealName] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [selImage, setSelImage]   = useState(null); // 이미지 라이트박스
  const imgInputRef = useRef(null);
  const staffImgRef = useRef(null);
  const [search, setSearch]           = useState("");
  const [searchScope, setSearchScope] = useState("title"); // "title" | "content"
  const [cmtMenu, setCmtMenu]         = useState(null); // 열린 댓글 ⋮ 메뉴 id
  const [postMenu, setPostMenu]       = useState(false); // 글 신고/차단 삼선 메뉴
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
  // 상대 시간 표기 (방금/분/시간/일 전, 그보다 오래되면 날짜)
  const timeAgo = (ts) => {
    if (!ts?.seconds) return "";
    const diff = Math.floor(Date.now()/1000) - ts.seconds;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
    if (diff < 86400*7) return `${Math.floor(diff/86400)}일 전`;
    return formatDate(ts);
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
  // 룸별 카테고리 필터링: 현재 룸이 허용하는 카테고리만 표시
  const roomCategories = currentRoom?.categories || [];
  const allFiltered = posts
    .filter(p => {
      // 🚫 차단한 사용자의 글 숨김
      if (blockedUsers.some(b => b.uid === p.authorId)) return false;
      // 🚨 신고 누적 자동 숨김 (작성자 본인·관리자는 계속 보임)
      if ((p.reportCount || 0) >= REPORT_HIDE_THRESHOLD && p.authorId !== profile?.uid && !isSuper) return false;
      // 룸의 허용 카테고리에 속하지 않으면 제외
      if (currentRoom && roomCategories.length > 0 && !roomCategories.includes(p.category)) return false;
      // 카테고리 탭 필터
      if (cat !== "전체" && p.category !== cat) return false;
      // 전체 탭에서는 강의 게시판 글 제외 (정보 룸에서는 강의 보이게)
      if (cat === "전체" && p.category === LECTURE_CAT && currentRoom?.id !== "knowledge") return false;
      if (search) {
        const inTitle   = p.title.includes(search) || (p.lectureName||"").includes(search) || (p.professor||"").includes(search);
        const inContent = (p.content||"").includes(search);
        if (searchScope === "title"   && !inTitle)   return false;
        if (searchScope === "content" && !inContent) return false;
      }
      return true;
    })
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

  const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);
  const filtered   = allFiltered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const postComments = (postId) =>
    comments.filter(c => c.postId === postId
      && !blockedUsers.some(b => b.uid === c.authorId)
      && !((c.reportCount || 0) >= REPORT_HIDE_THRESHOLD && c.authorId !== profile?.uid && !isSuper))
      .sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));

  // 게시글 작성
  const submitPost = async () => {
    const isLecturePost = writeForm.category === LECTURE_CAT;
    const isWorkPost = writeForm.category === "작품공유";
    const isCrewPost = writeForm.category === "협업모집";
    const isStaffPost = writeForm.category === "스탭프로필";
    const isClassPost = writeForm.category === "클래스";
    const isContestPost = writeForm.category === "공모전";
    // 카테고리별 유효성 검사
    if (isLecturePost) {
      if (!writeForm.lectureName.trim() || !writeForm.professor.trim()) return;
    } else if (isWorkPost) {
      if (!writeForm.title.trim()) return;
      if (!getYouTubeId(writeForm.ytUrl)) { alert("올바른 유튜브 링크를 입력해주세요."); return; }
    } else if (isCrewPost) {
      if (!writeForm.title.trim()) return;
      if (writeForm.positions.length === 0) { alert("모집 포지션을 1개 이상 추가해주세요."); return; }
    } else if (isStaffPost) {
      if (writeForm.staffRoles.length === 0) { alert("담당 분야를 1개 이상 선택해주세요."); return; }
    } else if (isClassPost) {
      if (!canUseRealName) { alert("강좌 등록은 조교·관리자만 가능해요."); return; }
      if (!writeForm.title.trim()) { alert("강좌명을 입력해주세요."); return; }
      if (writeForm.lessons.length === 0) { alert("영상을 1개 이상 추가해주세요."); return; }
    } else if (isContestPost) {
      if (!writeForm.title.trim()) return;
      if (!writeForm.contestStart || !writeForm.deadline) { alert("시작일자와 종료일자를 입력해주세요."); return; }
      if ((writeForm.images || []).length === 0) { alert("공모전 이미지를 1장 이상 첨부해주세요."); return; }
    } else {
      if (!writeForm.title.trim() || !writeForm.content.trim()) return;
    }
    if (writeForm.category === NEWBIE_CAT && !isNewbie && profile?.role !== "admin") {
      alert(`새내기 게시판은 ${newbiePrefix}학번 신입생만 이용할 수 있어요!`);
      return;
    }
    // 🚫 욕설/혐오 표현 필터
    const badWordInPost =
      containsBadWord(writeForm.title) ||
      containsBadWord(writeForm.content) ||
      containsBadWord(writeForm.oneLiner) ||
      containsBadWord(writeForm.crewLogline) ||
      containsBadWord(writeForm.classDesc);
    if (badWordInPost) {
      alert(`부적절한 표현이 포함되어 있어 등록할 수 없어요.\n(문제된 표현: "${badWordInPost}")\n\n수정한 뒤 다시 등록해주세요.`);
      return;
    }
    setSubmitting(true);
    const isLecture = isLecturePost;
    // 강의 게시판은 완전 익명이므로 실명 모드 사용 안 함
    const useRealNameFinal = canUseRealName && writeForm.useRealName && !isLecture;
    await addItem("communityPosts", {
      title:       isLecture ? writeForm.lectureName.trim() : isStaffPost ? (profile?.name || "") : writeForm.title.trim(),
      content:     isLecture || isContestPost ? "" : writeForm.content,
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
      crewDirector:isCrewPost ? writeForm.crewDirector.trim() : "",
      crewLogline: isCrewPost ? writeForm.crewLogline.trim() : "",
      crewSchedule:isCrewPost ? writeForm.crewSchedule.trim() : "",
      crewPlace:   isCrewPost ? writeForm.crewPlace.trim() : "",
      crewPay:     isCrewPost ? writeForm.crewPay.trim() : "",
      crewGenre:   isCrewPost ? writeForm.crewGenre.trim() : "",
      deadline:    isCrewPost || isContestPost ? writeForm.deadline : "",
      applicants:  [],
      // 공모전 전용 필드
      contestStart: isContestPost ? writeForm.contestStart : "",
      contestUrl:   isContestPost ? writeForm.contestUrl.trim() : "",
      // 스탭 프로필 전용 필드
      profileImage:  isStaffPost ? writeForm.profileImage : "",
      staffRoles:    isStaffPost ? writeForm.staffRoles : [],
      staffMajor:    isStaffPost ? writeForm.staffMajor.trim() : "",
      staffContact:  isStaffPost ? writeForm.staffContact.trim() : "",
      staffStudentId:isStaffPost ? (profile?.studentId || "") : "",
      staffDept:     isStaffPost ? (profile?.dept || "") : "",
      // 필름 클래스 전용 필드
      classDesc:     isClassPost ? writeForm.classDesc.trim() : "",
      classField:    isClassPost ? writeForm.classField.trim() : "",
      channelUrl:    isClassPost ? writeForm.channelUrl.trim() : "",
      lessons:       isClassPost ? writeForm.lessons : [],
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
      positions:[], positionInput:"", positionSelect:"", positionCount:"", crewLogline:"", crewDirector:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"", contestStart:"", contestUrl:"", profileImage:"", staffRoles:[], staffRoleSelect:"", staffRoleInput:"", staffMajor:"", staffContact:"", classDesc:"", classField:"", channelUrl:"", lessons:[], lessonTitle:"", lessonUrl:"", lessonDuration:"" });
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

  // 크루 모집 포지션 — 드롭다운 선택 후 인원 입력 / 기타 직접 입력
  const pickPosition = (val) => {
    setWriteForm(p => ({ ...p, positionSelect: val, positionInput:"", positionCount: val ? (p.positionCount || "1") : "" }));
  };
  const addPosition = () => {
    const role = writeForm.positionSelect === CREW_ETC ? writeForm.positionInput.trim() : writeForm.positionSelect;
    const count = (writeForm.positionCount || "1").trim();
    if (!role || writeForm.positions.length >= 8 || writeForm.positions.some(p => p.role === role)) {
      setWriteForm(p => ({ ...p, positionSelect:"", positionInput:"", positionCount:"" }));
      return;
    }
    setWriteForm(p => ({ ...p, positions:[...p.positions, { role, count }], positionSelect:"", positionInput:"", positionCount:"" }));
  };

  // 댓글 작성
  const submitComment = async (postId) => {
    if (!commentText.trim()) return;
    // 🚫 욕설/혐오 표현 필터
    const badWordInComment = containsBadWord(commentText);
    if (badWordInComment) {
      alert(`부적절한 표현이 포함되어 있어 등록할 수 없어요.\n(문제된 표현: "${badWordInComment}")`);
      return;
    }
    setSubmitting(true);
    // 강의 게시판 댓글은 완전 익명이므로 실명 모드 사용 안 함
    const postCategory = selPost?.category;
    const useRealNameFinal = canUseRealName && commentUseRealName && postCategory !== LECTURE_CAT;
    const postAuthorId = selPost?.authorId || posts.find(p => p.id === postId)?.authorId || "";
    await addItem("communityComments", {
      postId,
      postAuthorId,  // 알림용: 글 작성자 uid (내 글 댓글만 구독하기 위함)
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

  // 🚨 신고 (게시글/댓글 공용)
  const reportItem = async (type, item) => {
    const uid = profile?.uid || "";
    if (!uid) { alert("로그인이 필요해요."); return; }
    if (item.authorId === uid) { alert("본인이 작성한 글은 신고할 수 없어요."); return; }
    if ((item.reportedBy || []).includes(uid)) { alert("이미 신고한 콘텐츠예요."); return; }
    if (!window.confirm("이 콘텐츠를 신고할까요?\n신고가 누적되면 자동으로 숨겨지고, 관리자가 확인 후 조치합니다.")) return;
    const col = type === "post" ? "communityPosts" : "communityComments";
    const newReportedBy = [...(item.reportedBy || []), uid];
    await updateItem(col, item.id, { reportedBy: newReportedBy, reportCount: newReportedBy.length });
    await addItem("communityReports", {
      targetType:       type,
      targetId:         item.id,
      targetContent:    (item.title || item.content || "").slice(0, 200),
      targetAuthorId:   item.authorId || "",
      targetAuthorName: item.authorName || "",
      reporterId:       uid,
      reporterName:     profile?.name || "",
      resolved:         false,
      createdAt:        serverTimestamp(),
    });
    if (type === "post" && selPost?.id === item.id) {
      setSelPost({ ...selPost, reportedBy: newReportedBy, reportCount: newReportedBy.length });
    }
    alert("신고가 접수되었어요. 관리자가 확인 후 조치할게요.");
  };

  // 🚫 차단 목록을 profile에서 동기화 (로그인/profile 변경 시)
  useEffect(() => { setBlockedUsers(profile?.blockedUsers || []); }, [profile]);

  // 🚫 사용자 차단 / 해제
  const blockUser = async (targetId, targetName) => {
    const uid = profile?.uid || "";
    if (!uid || !targetId) return;
    if (targetId === uid) { alert("본인은 차단할 수 없어요."); return; }
    if (blockedUsers.some(b => b.uid === targetId)) { alert("이미 차단한 사용자예요."); return; }
    if (!window.confirm("이 작성자를 차단할까요?\n차단하면 이 사용자의 모든 글과 댓글이 보이지 않게 됩니다.")) return;
    const next = [...blockedUsers, { uid: targetId, name: targetName || "익명 사용자" }];
    setBlockedUsers(next);
    await updateItem("users", uid, { blockedUsers: next });
    if (selPost?.authorId === targetId) setSelPost(null);
    alert("차단했어요. 이 사용자의 글과 댓글이 더 이상 보이지 않아요.");
  };
  const unblockUser = async (targetId) => {
    const uid = profile?.uid || "";
    if (!uid) return;
    const next = blockedUsers.filter(b => b.uid !== targetId);
    setBlockedUsers(next);
    await updateItem("users", uid, { blockedUsers: next });
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
    const isStaff = selPost?.category === "스탭프로필";
    const isClass = selPost?.category === "클래스";
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
        crewDirector:editForm.crewDirector.trim(),
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
    if (isStaff) {
      if (editForm.staffRoles.length === 0) { alert("담당 분야를 1개 이상 선택해주세요."); return; }
      const patch = {
        profileImage: editForm.profileImage,
        staffRoles:   editForm.staffRoles,
        staffMajor:   editForm.staffMajor.trim(),
        staffContact: editForm.staffContact.trim(),
        content:      editForm.content.trim(),
      };
      await updateItem("communityPosts", selPost.id, patch);
      setSelPost({ ...selPost, ...patch });
      setShowEdit(false);
      return;
    }
    if (isClass) {
      if (!editForm.title.trim()) { alert("강좌명을 입력해주세요."); return; }
      if (editForm.lessons.length === 0) { alert("영상을 1개 이상 추가해주세요."); return; }
      const patch = {
        title:      editForm.title.trim(),
        classField: editForm.classField.trim(),
        classDesc:  editForm.classDesc.trim(),
        channelUrl: editForm.channelUrl.trim(),
        lessons:    editForm.lessons,
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

  // 수정 모달 크루 포지션 — 드롭다운 선택 후 인원 입력 / 기타 직접 입력
  const pickPositionEdit = (val) => {
    setEditForm(p => ({ ...p, positionSelect: val, positionInput:"", positionCount: val ? (p.positionCount || "1") : "" }));
  };
  const addPositionEdit = () => {
    const role = editForm.positionSelect === CREW_ETC ? editForm.positionInput.trim() : editForm.positionSelect;
    const count = (editForm.positionCount || "1").trim();
    if (!role || editForm.positions.length >= 8 || editForm.positions.some(p => p.role === role)) {
      setEditForm(p => ({ ...p, positionSelect:"", positionInput:"", positionCount:"" }));
      return;
    }
    setEditForm(p => ({ ...p, positions:[...p.positions, { role, count }], positionSelect:"", positionInput:"", positionCount:"" }));
  };

  // 크루 모집 지원 (포지션 선택) / 취소 — 실명
  const applyToCrew = async (position) => {
    if (!selPost || !position) return;
    const apps = selPost.applicants || [];
    if (apps.some(a => a.uid === profile?.uid)) return;
    const next = [...apps, { uid: profile?.uid || "", name: profile?.name || "", position, status: "pending", at: Date.now() }];
    await updateItem("communityPosts", selPost.id, { applicants: next });
    setSelPost({ ...selPost, applicants: next });
    setApplyPosition("");
  };
  const cancelApply = async () => {
    if (!selPost) return;
    const apps = selPost.applicants || [];
    const next = apps.filter(a => a.uid !== profile?.uid);
    await updateItem("communityPosts", selPost.id, { applicants: next });
    setSelPost({ ...selPost, applicants: next });
  };
  // 필름 클래스 — 영상(차시) 추가 / 삭제
  const addLesson = () => {
    const title = writeForm.lessonTitle.trim();
    const url = writeForm.lessonUrl.trim();
    if (!title || !getYouTubeId(url)) { alert("영상 제목과 올바른 유튜브 링크를 입력해주세요."); return; }
    setWriteForm(p => ({ ...p, lessons:[...p.lessons, { title, url, duration: p.lessonDuration.trim() }], lessonTitle:"", lessonUrl:"", lessonDuration:"" }));
  };
  const removeLesson = (idx) => setWriteForm(p => ({ ...p, lessons: p.lessons.filter((_, i) => i !== idx) }));
  const addLessonEdit = () => {
    const title = editForm.lessonTitle.trim();
    const url = editForm.lessonUrl.trim();
    if (!title || !getYouTubeId(url)) { alert("영상 제목과 올바른 유튜브 링크를 입력해주세요."); return; }
    setEditForm(p => ({ ...p, lessons:[...p.lessons, { title, url, duration: p.lessonDuration.trim() }], lessonTitle:"", lessonUrl:"", lessonDuration:"" }));
  };
  const removeLessonEdit = (idx) => setEditForm(p => ({ ...p, lessons: p.lessons.filter((_, i) => i !== idx) }));

  // 스탭 프로필 담당 분야 — 드롭다운 선택 / 기타 직접 입력 (인원 없음)
  const pickStaffRole = (val) => {
    if (!val) return;
    if (val === CREW_ETC) { setWriteForm(p => ({ ...p, staffRoleSelect: val })); return; }
    setWriteForm(p => (p.staffRoles.includes(val) || p.staffRoles.length >= 8) ? { ...p, staffRoleSelect:"" } : { ...p, staffRoles:[...p.staffRoles, val], staffRoleSelect:"" });
  };
  const addStaffRoleCustom = () => {
    const v = writeForm.staffRoleInput.trim();
    if (!v || writeForm.staffRoles.includes(v) || writeForm.staffRoles.length >= 8) {
      setWriteForm(p => ({ ...p, staffRoleInput:"", staffRoleSelect:"" }));
      return;
    }
    setWriteForm(p => ({ ...p, staffRoles:[...p.staffRoles, v], staffRoleInput:"", staffRoleSelect:"" }));
  };
  const pickStaffRoleEdit = (val) => {
    if (!val) return;
    if (val === CREW_ETC) { setEditForm(p => ({ ...p, staffRoleSelect: val })); return; }
    setEditForm(p => (p.staffRoles.includes(val) || p.staffRoles.length >= 8) ? { ...p, staffRoleSelect:"" } : { ...p, staffRoles:[...p.staffRoles, val], staffRoleSelect:"" });
  };
  const addStaffRoleCustomEdit = () => {
    const v = editForm.staffRoleInput.trim();
    if (!v || editForm.staffRoles.includes(v) || editForm.staffRoles.length >= 8) {
      setEditForm(p => ({ ...p, staffRoleInput:"", staffRoleSelect:"" }));
      return;
    }
    setEditForm(p => ({ ...p, staffRoles:[...p.staffRoles, v], staffRoleInput:"", staffRoleSelect:"" }));
  };

  // 작성자: 포지션별 마감/재개 토글 (수동)
  const togglePositionClosed = async (idx) => {
    if (!selPost) return;
    const next = (selPost.positions || []).map((p, i) => i === idx ? { ...p, closed: !p.closed } : p);
    await updateItem("communityPosts", selPost.id, { positions: next });
    setSelPost({ ...selPost, positions: next });
  };
  // 작성자: 지원자 수락/거절
  const setApplicantStatus = async (uid, status) => {
    if (!selPost) return;
    const next = (selPost.applicants || []).map(a => a.uid === uid ? { ...a, status } : a);
    await updateItem("communityPosts", selPost.id, { applicants: next });
    setSelPost({ ...selPost, applicants: next });
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
    const m = { "자유":C.blue, "질문":C.orange, "강의":C.purple, "정보":C.green, "취업":C.teal };
    return m[c] || C.muted;
  };
  const catBg = (c) => {
    const m = { "자유":C.blueLight, "질문":C.orangeLight, "강의":C.purpleLight, "정보":C.greenLight, "취업":C.tealLight };
    return m[c] || C.bg;
  };
  // 카테고리에 따라 익명/실명 판단
  const isAnon = (category) => ANON_CATS.includes(category) || !REAL_CATS.includes(category);

  return (
    <>
      {/* 🎬 룸 진입 스플래시 오버레이 — z-200 컨테이너 함정 회피용 createPortal(body) */}
      {roomSplash && createPortal(
        <div style={{
          position:"fixed", inset:0, zIndex:100000, background:"#0a0a12",
          opacity: roomSplash.phase === "out" ? 0 : 1, transition:"opacity .6s ease",
          pointerEvents: roomSplash.phase === "out" ? "none" : "auto",
        }}>
          <img src={roomSplash.src} alt=""
            style={{ width:"100%", height:"100%", maxWidth:"none", objectFit:"cover", display:"block" }} />
        </div>,
        document.body
      )}
      {/* 🎬 시네마 톤 풀스크린 컨테이너 — 하단은 네비 높이만큼 비워 하단바가 보이게 */}
      <div style={{
        position:"fixed", top:0, left:0, right:0, bottom: navH, zIndex:200,
        background:"#0a0a0a",
        color:"#fafaf9",
        overflowY:"auto",
        WebkitOverflowScrolling:"touch",
        paddingBottom:16,
      }}>
        {/* 상단 헤더 - 최상위는 목업(커뮤니티+검색+벨), 룸/도구 안은 시네마 헤더 */}
        {(!currentRoom && !selectedTool) ? (
          <div data-cinema="1" style={{
            position:"sticky", top:0, zIndex:50,
            background:"#0a0a0a",
            paddingTop: safeTop + 14, paddingRight: 18, paddingBottom: 16, paddingLeft: 18,
            display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <span style={{ fontSize:20, fontWeight:900, color:"#fafaf9", letterSpacing:"-0.02em", lineHeight:1 }}>커뮤니티</span>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <button onClick={() => setShowSearch(true)}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", color:"#e7e5e4" }}>
                <Search size={20} strokeWidth={2} />
              </button>
              <button onClick={() => onNotif && onNotif()}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", color:"#e7e5e4", position:"relative" }}>
                <Bell size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            position:"sticky", top:0, zIndex:50,
            background:"#0a0a0a",
            paddingTop: safeTop + 14, paddingRight: 18, paddingBottom: 16, paddingLeft: 18,
            display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
              <button onClick={() => {
                  // 도구 룸 그리드가 없어져서 도구에서 뒤로가기 = 루트 직행
                  if (selectedTool) { setSelectedTool(null); setSelectedRoom(null); }
                  else { setSelectedRoom(null); setSelectedTool(null); }
                }}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", color:"#fafaf9", flexShrink:0 }}>
                <ChevronLeft size={24} strokeWidth={2.2} />
              </button>
              <span style={{ fontSize:20, fontWeight:900, color:"#fafaf9", letterSpacing:"-0.02em", lineHeight:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {selectedTool ? "도구" : currentRoom ? currentRoom.title : "커뮤니티"}
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
              <button onClick={() => setShowSearch(true)}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", color:"#e7e5e4" }}>
                <Search size={20} strokeWidth={2} />
              </button>
              <button onClick={() => onNotif && onNotif()}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", color:"#e7e5e4", position:"relative" }}>
                <Bell size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {/* 본문 콘텐츠 */}
        <div style={{ padding:"4px 14px 80px", maxWidth:1000, margin:"0 auto" }}>
    <div>
{/* 페이지 안내 배너 제거됨 - 시네마 헤더가 대체 */}

      {/* 공지 팝업 제거됨 */}

      {/* PageTitle 제거됨 (헤더의 "에브리타임"이 대체) - 글쓰기는 우하단 FAB으로 이동 */}

      {/* 🚫 차단 관리 진입 (차단한 사용자가 있을 때만) */}
      {blockedUsers.length > 0 && (
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8, marginBottom:4 }}>
          <button onClick={() => setShowBlockList(true)}
            style={{ background:"none", border:`1px solid ${CINEMA.border}`, borderRadius:14, color:CINEMA.mutedDim, fontSize:11, cursor:"pointer", padding:"4px 12px", fontFamily:"inherit" }}>
            🚫 차단 관리 ({blockedUsers.length})
          </button>
        </div>
      )}

      {/* 🎬 룸 분기 화면 (selectedRoom === null) */}
      {!selectedRoom && (
        <div style={{ marginTop:4 }}>
          {(() => {
            const openRoom = (room) => {
              if (room.studentOnly && isProfOrTeacher) { setBlockedRoom(room); return; }
              setSelectedRoom(room.id);
              setCat(room.id === "crew" ? "협업모집" : room.id === "class" ? "클래스" : "전체");
              setPage(1); setSearch("");
            };
            // 🌈 네온 카드 (목업 dd.png) — 색 틴트 배경 + 글로우 아이콘 + 영문 서브타이틀
            const NeonIcon = ({ room }) => {
              const Ic = ROOM_ICON[room.id];
              return Ic ? (
                <Ic size={42} color={room.color} strokeWidth={1.9}
                  style={{ filter:`drop-shadow(0 0 5px ${room.color}E6) drop-shadow(0 0 14px ${room.color}80)` }} />
              ) : null;
            };
            const cardBg = (room) =>
              `linear-gradient(150deg, ${room.color}26 0%, ${room.color}0D 46%, #121216 100%)`;
            return (
              <>
                {/* 프로젝트 시작 배너 (이미지) → Project Studio (prop 없으면 크루 메이커스 폴백) */}
                <div onClick={() => onOpenProjectStudio ? onOpenProjectStudio() : openRoom(ROOMS.find(r => r.id === "crew"))}
                  style={{
                    marginBottom:14, cursor:"pointer", borderRadius:18, overflow:"hidden",
                    border:"1px solid #26262b", lineHeight:0, position:"relative",
                  }}>
                  <img src="/project-banner.png" alt="나만의 프로젝트를 시작해보세요"
                    style={{ width:"100%", display:"block" }} />
                  <ChevronRight size={20} color="#fff" strokeWidth={2.2}
                    style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", opacity:0.45 }} />
                </div>

                {/* 에브리타임(자유) / 질문 — 2열 최신글 카드 */}
                {(() => {
                  const cRoom = ROOMS.find(r => r.id === "community");
                  const latest = (category) => [...posts]
                    .filter(p => p.category === category)
                    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                    .slice(0, 3);
                  const goCat = (c) => {
                    if (cRoom?.studentOnly && isProfOrTeacher) { setBlockedRoom(cRoom); return; }
                    setSelectedRoom("community"); setCat(c); setPage(1); setSearch("");
                  };
                  const FeedCard = ({ title, titleColor, list, onMore }) => (
                    <div style={{ minWidth:0 }}>
                      {/* 제목행 — 박스 바깥 */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7, padding:"0 2px" }}>
                        <span style={{ fontSize:12.5, fontWeight:800, letterSpacing:"-0.02em", color:titleColor }}>{title}</span>
                        <span onClick={onMore} style={{ display:"flex", alignItems:"center", gap:1, fontSize:10.5, fontWeight:600, color:"#8a8a92", cursor:"pointer", flexShrink:0 }}>
                          전체보기 <ChevronRight size={12} color="#8a8a92" />
                        </span>
                      </div>
                      {/* 리스트 박스 */}
                      <div style={{
                        background:"linear-gradient(160deg, rgba(124,58,237,0.10) 0%, rgba(59,130,246,0.05) 40%, #101018 100%)",
                        border:"1px solid rgba(124,58,237,0.22)", borderRadius:16, padding:"11px 13px",
                      }}>
                        {list.length === 0 ? (
                          <div style={{ padding:"14px 0", textAlign:"center", color:"#6b6b74", fontSize:11 }}>아직 글이 없어요</div>
                        ) : list.map((p, i) => (
                          <div key={p.id} onClick={() => openPost(p)}
                            style={{ display:"flex", alignItems:"center", gap:7, padding:"4.5px 0", cursor:"pointer" }}>
                            <span style={{ fontSize:11.5, fontWeight:800, color:"#7e9dff", minWidth:12, flexShrink:0 }}>{i + 1}</span>
                            <span style={{ flex:1, minWidth:0, fontSize:11, color:"#cfcfd6", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                  const goInfo = () => {
                    const kRoom = ROOMS.find(r => r.id === "knowledge");
                    if (kRoom?.studentOnly && isProfOrTeacher) { setBlockedRoom(kRoom); return; }
                    setSelectedRoom("knowledge"); setCat("정보"); setPage(1); setSearch("");
                  };
                  const InfoFeed = ({ list, onMore }) => (
                    <div style={{ marginTop:14 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7, padding:"0 2px" }}>
                        <span style={{ fontSize:12.5, fontWeight:800, letterSpacing:"-0.02em", color:"#34d399" }}>정보 최신글</span>
                        <span onClick={onMore} style={{ display:"flex", alignItems:"center", gap:1, fontSize:10.5, fontWeight:600, color:"#8a8a92", cursor:"pointer", flexShrink:0 }}>
                          전체보기 <ChevronRight size={12} color="#8a8a92" />
                        </span>
                      </div>
                      <div style={{ background:"linear-gradient(160deg, rgba(124,58,237,0.10) 0%, rgba(59,130,246,0.05) 40%, #101018 100%)", border:"1px solid rgba(124,58,237,0.22)", borderRadius:16, padding:"5px 12px" }}>
                        {list.length === 0 ? (
                          <div style={{ padding:"18px 0", textAlign:"center", color:"#6b6b74", fontSize:11 }}>아직 글이 없어요</div>
                        ) : list.map((p, i) => {
                          const thumb = p.images?.[0];
                          return (
                            <div key={p.id} onClick={() => openPost(p)}
                              style={{ display:"flex", alignItems:"center", gap:11, padding:"6px 0", borderTop: i>0 ? "1px solid rgba(255,255,255,0.06)" : "none", cursor:"pointer" }}>
                              <div style={{ width:46, height:46, borderRadius:9, flexShrink:0, overflow:"hidden", background:"#1a1a1f", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                {thumb
                                  ? <img loading="lazy" decoding="async" src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                                  : <span style={{ fontSize:19, opacity:0.5 }}>📄</span>}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:700, color:"#e7e5e4", lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:9, flexShrink:0, fontSize:10.5, color:"#8a8a92" }}>
                                <span>👁 {p.views||0}</span>
                                <span>💬 {postComments(p.id).length}</span>
                                <span style={{ minWidth:46, textAlign:"right" }}>{timeAgo(p.createdAt)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                  return (
                    <>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                        <FeedCard title="에타 최신글" titleColor="#fb7185" list={latest("자유")} onMore={() => goCat("자유")} />
                        <FeedCard title="질문 최신글" titleColor="#7e9dff" list={latest("질문")} onMore={() => goCat("질문")} />
                      </div>

                      {/* 🤝 크루 메이커스 — 좌: 구인글 / 우: 스탭 프로필 2열 자동 순환 */}
                      {(() => {
                        const byNew = (a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0);
                        const crews = [...posts]
                          .filter(p => p.category === "협업모집")
                          .filter(p => { const d = getDday(p.deadline); return d === null || d >= 0; })
                          .sort(byNew).slice(0, 6);
                        const staffs = [...posts].filter(p => p.category === "스탭프로필").sort(byNew).slice(0, 6);
                        if (crews.length === 0 && staffs.length === 0) return null;
                        const goCrew = () => {
                          const cRoom = ROOMS.find(r => r.id === "crew");
                          if (cRoom?.studentOnly && isProfOrTeacher) { setBlockedRoom(cRoom); return; }
                          setSelectedRoom("crew"); setCat("협업모집"); setPage(1); setSearch("");
                        };
                        return <CrewMakersSection crews={crews} staffs={staffs} onOpen={openPost} onAll={goCrew} bookmarks={crewBookmarks} onToggleBookmark={toggleCrewBookmark} />;
                      })()}

                      <InfoFeed list={[...posts].filter(p => p.category !== "공모전" && (ROOMS.find(r => r.id === "knowledge")?.categories || []).includes(p.category)).sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).slice(0,3)} onMore={goInfo} />

                      {/* 🏆 공모전 정보 — 자동 슬라이드 캐러셀 (마감 안 지난 것만, 임박순) */}
                      {(() => {
                        const contests = [...posts]
                          .filter(p => p.category === "공모전" && p.deadline && getDday(p.deadline) >= 0)
                          .sort((a, b) => getDday(a.deadline) - getDday(b.deadline));
                        if (contests.length === 0) return null;
                        const goContest = () => {
                          const kRoom = ROOMS.find(r => r.id === "knowledge");
                          if (kRoom?.studentOnly && isProfOrTeacher) { setBlockedRoom(kRoom); return; }
                          setSelectedRoom("knowledge"); setCat("공모전"); setPage(1); setSearch("");
                        };
                        return (
                          <div style={{ marginTop:14 }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7, padding:"0 2px" }}>
                              <span style={{ fontSize:12.5, fontWeight:800, letterSpacing:"-0.02em", color:"#fb923c" }}>공모전 정보</span>
                              <span onClick={goContest} style={{ display:"flex", alignItems:"center", gap:1, fontSize:10.5, fontWeight:600, color:"#8a8a92", cursor:"pointer", flexShrink:0 }}>
                                전체보기 <ChevronRight size={12} color="#8a8a92" />
                              </span>
                            </div>
                            <ContestCarousel list={contests} onOpen={openPost} />
                          </div>
                        );
                      })()}

                      {/* 🎞️ 필름도구 — 이미지 박스 가로 스와이프 (윗줄 5 + 아랫줄 4) */}
                      <div style={{ marginTop:14 }}>
                        <div style={{ display:"flex", alignItems:"center", marginBottom:7, padding:"0 2px" }}>
                          <span style={{ fontSize:12.5, fontWeight:800, letterSpacing:"-0.02em", color:"#fbbf24" }}>필름도구</span>
                        </div>
                        <style>{`.ft-swipe::-webkit-scrollbar{display:none}.ft-swipe{scrollbar-width:none;-ms-overflow-style:none}`}</style>
                        <div className="ft-swipe" style={{
                          display:"grid", gridTemplateRows:"repeat(2, 80px)", gap:8,
                          overflowX:"auto", WebkitOverflowScrolling:"touch",
                          scrollSnapType:"x mandatory", touchAction:"pan-x pan-y",
                        }}>
                          {FILM_TOOL_BOXES.map((t, i) => (
                            <div key={t.key}
                              onClick={() => { setSelectedRoom("tools"); setSelectedTool(t.key); }}
                              style={{
                                gridRow: i < 5 ? 1 : 2, gridColumn: (i < 5 ? i : i - 5) + 1,
                                width:160, height:80, borderRadius:14, overflow:"hidden", cursor:"pointer",
                                scrollSnapAlign:"start", flexShrink:0,
                                background:"#17171c", border:"1px solid rgba(255,255,255,0.07)",
                              }}>
                              <img loading="lazy" decoding="async" src={t.img} alt=""
                                style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                                onError={e => { e.currentTarget.style.opacity = 0; }} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 🎬 오늘의 추천작 — 매일 00시 기준 날짜 시드 랜덤 (모두에게 같은 작품) */}
                      {(() => {
                        const works = posts.filter(p => p.category === "작품공유" && getYouTubeId(p.ytUrl));
                        if (works.length === 0) return null;
                        const t = new Date();
                        const seedStr = `${t.getFullYear()}-${t.getMonth()+1}-${t.getDate()}`;
                        let seed = 0;
                        for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
                        // 시드 셔플로 매일 3개 선정 (모두에게 같은 순서, 자정마다 교체)
                        const sorted = [...works].sort((a, b) => (a.id > b.id ? 1 : -1));
                        const rand = (() => { let s = seed || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
                        for (let i = sorted.length - 1; i > 0; i--) {
                          const j = Math.floor(rand() * (i + 1));
                          [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
                        }
                        const picks = sorted.slice(0, 3);
                        const goBoxoffice = () => {
                          const bRoom = ROOMS.find(r => r.id === "boxoffice");
                          if (bRoom?.studentOnly && isProfOrTeacher) { setBlockedRoom(bRoom); return; }
                          runRoomSplash("/boxoffice-splash.webp");
                          setSelectedRoom("boxoffice"); setPage(1); setSearch("");
                        };
                        return (
                          <div style={{ marginTop:14 }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7, padding:"0 2px" }}>
                              <span style={{ fontSize:12.5, fontWeight:800, letterSpacing:"-0.02em", color:"#a855f7" }}>오늘의 추천작</span>
                              <span onClick={goBoxoffice} style={{ display:"flex", alignItems:"center", gap:1, fontSize:10.5, fontWeight:600, color:"#8a8a92", cursor:"pointer", flexShrink:0 }}>
                                전체보기 <ChevronRight size={12} color="#8a8a92" />
                              </span>
                            </div>
                            <WorkCarousel list={picks} onOpen={openPost} />
                          </div>
                        );
                      })()}

                      {/* 🎓 필름 클래스 — 매일 00시 기준 3개 캐러셀 (오늘의 추천작과 동일 규칙) */}
                      {(() => {
                        const classes = posts.filter(p => p.category === "클래스");
                        if (classes.length === 0) return null;
                        const t = new Date();
                        const seedStr = `${t.getFullYear()}-${t.getMonth()+1}-${t.getDate()}`;
                        let seed = 0;
                        for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
                        const sorted = [...classes].sort((a, b) => (a.id > b.id ? 1 : -1));
                        const rand = (() => { let s = (seed ^ 0x9e3779b9) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
                        for (let i = sorted.length - 1; i > 0; i--) {
                          const j = Math.floor(rand() * (i + 1));
                          [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
                        }
                        const picks = sorted.slice(0, 3);
                        const goClass = () => {
                          const clRoom = ROOMS.find(r => r.id === "class");
                          if (clRoom?.studentOnly && isProfOrTeacher) { setBlockedRoom(clRoom); return; }
                          runRoomSplash("/class-splash.webp");
                          setSelectedRoom("class"); setCat("클래스"); setPage(1); setSearch("");
                        };
                        return (
                          <div style={{ marginTop:14 }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7, padding:"0 2px" }}>
                              <span style={{ fontSize:12.5, fontWeight:800, letterSpacing:"-0.02em", color:"#6366f1" }}>필름 클래스</span>
                              <span onClick={goClass} style={{ display:"flex", alignItems:"center", gap:1, fontSize:10.5, fontWeight:600, color:"#8a8a92", cursor:"pointer", flexShrink:0 }}>
                                전체보기 <ChevronRight size={12} color="#8a8a92" />
                              </span>
                            </div>
                            <ClassCarousel list={picks} onOpen={openPost} />
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

              </>
            );
          })()}

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

          {/* 🔍 검색 (자리만 — 추후 구현) */}
          {showSearch && (
            <div onClick={() => setShowSearch(false)}
              style={{ position:"fixed", inset:0, zIndex:9500, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div onClick={e => e.stopPropagation()}
                style={{ background:"#0a0a0a", border:"1px solid #2a2a2a", borderRadius:12, padding:"28px 24px", maxWidth:320, textAlign:"center" }}>
                <Search size={40} color="#a8a29e" strokeWidth={2} style={{ marginBottom:12 }} />
                <div style={{ fontSize:15, fontWeight:800, color:"#fafaf9", marginBottom:8 }}>통합 검색 준비 중</div>
                <div style={{ fontSize:12.5, color:"#a8a29e", lineHeight:1.6, marginBottom:20 }}>
                  곧 커뮤니티 전체 글을 검색할 수 있어요.<br/>
                  <span style={{ color:"#71706b", fontSize:11 }}>지금은 각 게시판 안에서 검색해 주세요.</span>
                </div>
                <button onClick={() => setShowSearch(false)}
                  style={{ width:"100%", padding:"11px", minHeight:44, background:"#dc2626", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:800, fontFamily:"Pretendard, sans-serif", cursor:"pointer", touchAction:"manipulation" }}>
                  확인
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🛠️ 필름 도구 룸 그리드 제거됨 (2026-07-22) — 루트의 필름도구 이미지 박스 스와이프가 대체.
          진입: 루트 박스 클릭 → 도구 직행 / 뒤로가기 → 루트 복귀 */}

      {/* 🎬 슬레이터 본체 표시 */}
      {selectedRoom === "tools" && selectedTool === "slate" && (
        <div style={{ marginTop:8 }}>
          <CinemaSlate onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
        </div>
      )}

      {/* 🎥 LIVE 노출 도우미 표시 */}
      {selectedRoom === "tools" && selectedTool === "live-exposure" && (
        <ExposureLive onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 📷 노출 계산기 (이론) */}
      {selectedRoom === "tools" && selectedTool === "exposure-calc" && (
        <ExposureCalc onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 📐 DOF 계산기 */}
      {selectedRoom === "tools" && selectedTool === "dof" && (
        <DofCalc onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 🌡️ 색온도 계산기 */}
      {selectedRoom === "tools" && selectedTool === "color-temp" && (
        <ColorTemp onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 🔭 렌즈 화각 */}
      {selectedRoom === "tools" && selectedTool === "fov" && (
        <FovCalc onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 📝 스크립터 */}
      {selectedRoom === "tools" && selectedTool === "scripter" && (
        <ScripterTool C={C} onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 🌅 태양 위치 */}
      {selectedRoom === "tools" && selectedTool === "sun" && (
        <SunSeeker onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 📚 자료 큐레이션 */}
      {selectedRoom === "tools" && selectedTool === "resources" && (
        <ResourceHub onBack={() => { setSelectedTool(null); setSelectedRoom(null); }} />
      )}

      {/* 게시판 룸들 (community, knowledge, boxoffice) */}
      {selectedRoom && selectedRoom !== "tools" && (
        <>
      {selectedRoom === "boxoffice" ? (
        <BoxOfficeView posts={posts} onOpen={openPost} onPlay={setFsVideo} />
      ) : (
        <>

      {/* 카테고리 탭 - 룸별 카테고리만 (시네마 톤 pill) */}
      <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"nowrap", overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch", marginTop:14 }}>
        {[...(currentRoom?.id === "crew" || currentRoom?.id === "class" ? [] : ["전체"]), ...(currentRoom?.categories || [])].map(c => {
          const isLocked = c === NEWBIE_CAT && !isNewbie && profile?.role !== "admin";
          const active = cat === c;
          const labelMap = { "협업모집":"🤝 협업 모집", "스탭프로필":"🙋 스탭 프로필" };
          return (
            <button key={c} onClick={() => { setCat(c); setPage(1); }}
              style={{ padding:"6px 14px", borderRadius:14,
                border:`1px solid ${active ? "transparent" : CINEMA.border}`,
                background: active ? "linear-gradient(135deg,#5b8def,#7c3aed)" : CINEMA.surface,
                color: active ? "#fff" : (isLocked ? CINEMA.mutedDim : CINEMA.muted),
                fontSize:11, fontWeight: active ? 700 : 500, cursor:"pointer",
                whiteSpace:"nowrap", flexShrink:0,
                display:"flex", alignItems:"center", gap:3,
                boxShadow: active ? "0 0 12px rgba(124,58,237,0.35)" : "none",
                transition:"all 0.15s",
              }}>
              {c === NEWBIE_CAT && "🌱"}{labelMap[c] || c}{isLocked && " 🔒"}
            </button>
          );
        })}
      </div>
      {currentRoom?.id === "crew" && (
        <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:12, letterSpacing:"0.05em" }}>
          🤝 함께할 팀원·스태프를 모집해보세요
        </div>
      )}

      {/* 검색 - 시네마 톤 (좌측 제목/내용 드롭다운 · 우측 아이콘) */}
      <div style={{ display:"flex", alignItems:"center", background:CINEMA.surface,
          border:`1px solid ${CINEMA.border}`, borderRadius:10,
          marginBottom:16, boxSizing:"border-box" }}>
        <div style={{ position:"relative", display:"flex", alignItems:"center", flexShrink:0, borderRight:`1px solid ${CINEMA.border}` }}>
          <select value={searchScope} onChange={e => { setSearchScope(e.target.value); setPage(1); }}
            style={{ appearance:"none", WebkitAppearance:"none", MozAppearance:"none",
              background:"transparent", border:"none", color:CINEMA.muted, fontSize:13,
              fontFamily:"inherit", outline:"none", padding:"10px 34px 10px 12px", cursor:"pointer" }}>
            <option value="title" style={{ background:CINEMA.surface }}>제목</option>
            <option value="content" style={{ background:CINEMA.surface }}>내용</option>
          </select>
          {/* 커스텀 화살표 — 텍스트는 그대로, 화살표만 구분선에서 살짝 떨어뜨림 */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={CINEMA.muted} strokeWidth={2.5}
            style={{ position:"absolute", right:16, pointerEvents:"none" }}>
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ flex:1, minWidth:0, background:"transparent", border:"none", color:CINEMA.text,
            padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
        <Search size={18} color={CINEMA.muted} strokeWidth={2} style={{ flexShrink:0, marginRight:12 }} />
      </div>

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
          <div style={{ position:"relative", width:"100%", aspectRatio:"1891 / 746",
              backgroundImage:"url(/boxoffice-banner.png)", backgroundSize:"100% 100%",
              backgroundRepeat:"no-repeat", borderRadius:12, marginBottom:16 }}>
            {/* 빈 필름릴 무대 위에 인기글 3줄을 얹음 (상단 26%는 박힌 타이틀 자리) */}
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                justifyContent:"flex-end", padding:"12% 6% 4%", boxSizing:"border-box" }}>
              {top3.map((p, i) => (
                <div key={p.id} onClick={() => openPost(p)}
                  style={{ display:"flex", alignItems:"center", gap:8, flex:1, minHeight:0,
                    borderTop: i>0 ? "1px solid rgba(255,255,255,0.08)" : "none", cursor:"pointer" }}>
                  <span style={{ fontSize:14, fontWeight:900, color:["#fbbf24","#d6d3cc","#cd7c3a"][i], minWidth:18, fontFamily:"'Courier New', monospace", textShadow:"0 1px 3px rgba(0,0,0,0.85)" }}>
                    {["01","02","03"][i]}
                  </span>
                  <span style={{ fontSize:10, background:CINEMA.goldBg, border:`1px solid ${CINEMA.gold}60`, borderRadius:4, padding:"1px 6px", color:CINEMA.gold, flexShrink:0, fontWeight:600 }}>
                    {p.category}
                  </span>
                  <span style={{ fontSize:12, fontWeight:600, color:CINEMA.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textShadow:"0 1px 3px rgba(0,0,0,0.85)" }}>{p.title}</span>
                  <div style={{ display:"flex", gap:8, fontSize:10, color:CINEMA.muted, flexShrink:0, textShadow:"0 1px 3px rgba(0,0,0,0.85)" }}>
                    <span>👁 {p.views||0}</span>
                    <span style={{ color: CINEMA.redBright }}>♥ {p.likes||0}</span>
                    <span>💬 {postComments(p.id).length}</span>
                  </div>
                </div>
              ))}
            </div>
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
      {cat === "클래스" ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {filtered.map(p => {
            const firstYt = getYouTubeId(p.lessons?.[0]?.url || "");
            return (
              <div key={p.id} onClick={() => openPost(p)}
                style={{ background:CINEMA.surfaceAlt, borderRadius:9, overflow:"hidden", cursor:"pointer", border:`1px solid ${CINEMA.border}` }}>
                <div style={{ aspectRatio:"16/9", background:CINEMA.surface, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                  {firstYt
                    ? <YtThumb id={firstYt} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <span style={{ fontSize:24, color:CINEMA.mutedDim }}>🎓</span>}
                  <span style={{ position:"absolute", bottom:5, right:6, background:"rgba(99,102,241,0.92)", color:"#fff", fontSize:9.5, fontWeight:700, padding:"2px 7px", borderRadius:8 }}>{(p.lessons||[]).length}강</span>
                </div>
                <div style={{ padding:"8px 9px" }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:CINEMA.text, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                  <div style={{ fontSize:10, color:"#818cf8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.classField || "강좌"}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : cat === "스탭프로필" ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px, 1fr))", gap:8 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => openPost(p)}
              style={{ background:CINEMA.surfaceAlt, borderRadius:8, overflow:"hidden", cursor:"pointer", border:`1px solid ${CINEMA.border}` }}>
              <div style={{ aspectRatio:"1/1", background:CINEMA.surface, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {p.profileImage
                  ? <img loading="lazy" decoding="async" src={p.profileImage} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ fontSize:24, color:CINEMA.mutedDim }}>🙋</span>}
              </div>
              <div style={{ padding:"7px 8px" }}>
                <div style={{ fontSize:12, fontWeight:600, color:CINEMA.text, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.authorName || p.title}</div>
                <div style={{ fontSize:9.5, color:"#f97316", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{(p.staffRoles||[]).join(" · ") || "분야 미지정"}</div>
                <div style={{ fontSize:9.5, color:CINEMA.mutedDim, marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {p.staffStudentId ? p.staffStudentId.slice(0,2)+"학번" : (p.staffDept || "")}
                  {p.staffMajor ? " · " + p.staffMajor : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.map(p => {
        const pComments = postComments(p.id);
        const isLecture = p.category === LECTURE_CAT;
        const avgRating = isLecture && pComments.length > 0
          ? (pComments.reduce((s,c) => s+(c.rating||0), 0) / pComments.length).toFixed(1)
          : null;
        // 관리자 실명 게시 기능 제거됨 — 메모지 강조 비활성
        const isMemo = false;

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
                <div style={{ fontSize:12, color:CINEMA.muted, marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{(p.content || "").split("\n")[0]}</div>
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
                {ytId && <YtThumb id={ytId} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />}
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
                  {(p.positions||[]).slice(0,3).map((v, i) => (
                    <span key={i} style={{ background:"rgba(249,115,22,0.12)", color:"#f97316", fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:3 }}>{posLabel(v)}</span>
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

        // ===== com.png: 카드형 리스트 =====
        const accent = catAccent(p.category);
        const thumb = p.images?.[0];
        return (
          <div key={p.id} onClick={() => openPost(p)}
            style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:14, padding:14, marginBottom:11, cursor:"pointer" }}>
            <div style={{ display:"flex", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ display:"inline-block", background:accent+"28", color:accent, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:5, marginBottom:8 }}>
                  {p.category}
                </span>
                {p.category === "공모전" && p.deadline && (() => {
                  const dday = getDday(p.deadline);
                  const closed = dday !== null && dday < 0;
                  return (
                    <span style={{ display:"inline-block", background: closed ? "#444" : "#fb923c", color: closed ? "#fff" : "#0a0a0a", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:5, marginBottom:8, marginLeft:5 }}>
                      {closed ? "마감" : dday === 0 ? "D-DAY" : `D-${dday}`}
                    </span>
                  );
                })()}
                <div style={{ fontSize:15.5, fontWeight:800, color:CINEMA.text, lineHeight:1.3, marginBottom:6, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                  {isLecture ? p.lectureName : p.title}
                </div>
                {isLecture ? (
                  <div style={{ fontSize:12, color:CINEMA.muted }}>
                    👨‍🏫 {p.professor}
                    {avgRating && <span style={{ marginLeft:10, color:CINEMA.gold, fontWeight:700 }}>★ {avgRating}</span>}
                  </div>
                ) : p.content ? (
                  <div style={{ fontSize:12.5, color:CINEMA.muted, lineHeight:1.45, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                    {p.content}
                  </div>
                ) : null}
              </div>
              {thumb && (
                <div style={{ position:"relative", width:82, height:82, flexShrink:0, borderRadius:10, overflow:"hidden", background:"#1a1a1f" }}>
                  <img loading="lazy" decoding="async" src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  {p.images.length > 1 && (
                    <span style={{ position:"absolute", right:5, bottom:5, background:"rgba(0,0,0,0.7)", color:"#fff", fontSize:9, padding:"1px 5px", borderRadius:4 }}>📷 {p.images.length}</span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", marginTop:11 }}>
              <span style={{ fontSize:11, color:CINEMA.mutedDim }}>{formatDate(p.createdAt)}</span>
              <span style={{ marginLeft:"auto", display:"flex", gap:11, fontSize:11, color:CINEMA.muted, alignItems:"center" }}>
                <span>👁 {p.views||0}</span>
                {!isLecture && <span style={{ color:CINEMA.redBright }}>♥ {p.likes||0}</span>}
                <span>💬 {pComments.length}</span>
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
        </>
      )}
        </>
      )} {/* /게시판 룸 조건부 끝 */}

      {/* 게시글 상세 모달 - 시네마 톤 */}
      {/* 🚫 차단 관리 모달 */}
      {showBlockList && (
        <Modal onClose={() => setShowBlockList(false)} width={420} cinema>
          <div style={{ fontSize:16, fontWeight:800, color:CINEMA.text, marginBottom:4 }}>차단한 사용자</div>
          <div style={{ fontSize:12, color:CINEMA.mutedDim, marginBottom:16 }}>차단을 해제하면 이 사용자의 글과 댓글이 다시 보여요.</div>
          {blockedUsers.length === 0 ? (
            <div style={{ textAlign:"center", color:CINEMA.mutedDim, fontSize:13, padding:"24px 0" }}>차단한 사용자가 없어요.</div>
          ) : (
            blockedUsers.map(b => (
              <div key={b.uid} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 4px", borderBottom:`1px solid ${CINEMA.border}` }}>
                <span style={{ fontSize:13, color:CINEMA.text }}>{b.name || "익명 사용자"}</span>
                <button onClick={() => unblockUser(b.uid)}
                  style={{ background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:8, color:CINEMA.text, fontSize:12, fontWeight:700, cursor:"pointer", padding:"5px 12px" }}>
                  차단 해제
                </button>
              </div>
            ))
          )}
        </Modal>
      )}

      {selPost && (
        <Modal onClose={() => setSelPost(null)} width={600} cinema>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <span style={{ background:postAccent(selPost.category).gradient, color:"#fff", borderRadius:8, padding:"6px 15px", fontSize:13, fontWeight:700, letterSpacing:"0.02em" }}>
              {selPost.category}
            </span>
            <div style={{ display:"flex", gap:6 }}>
              {canEditDelete(selPost) && (
                <>
                  <Btn onClick={() => {
                    const base = { title:selPost.title||"", content:selPost.content||"", ytUrl:"", oneLiner:"", genres:[], genreInput:"", runtime:"", prodDate:"", credits:"", positions:[], positionInput:"", positionSelect:"", positionCount:"", crewLogline:"", crewDirector:"", crewSchedule:"", crewPlace:"", crewPay:"", crewGenre:"", deadline:"", profileImage:"", staffRoles:[], staffRoleSelect:"", staffRoleInput:"", staffMajor:"", staffContact:"", classDesc:"", classField:"", channelUrl:"", lessons:[], lessonTitle:"", lessonUrl:"", lessonDuration:"" };
                    setEditForm(
                      selPost.category === "작품공유"
                        ? { ...base, ytUrl:selPost.ytUrl||"", oneLiner:selPost.oneLiner||"", genres:selPost.genres||[], runtime:selPost.runtime||"", prodDate:selPost.prodDate||"", credits:selPost.credits||"" }
                      : selPost.category === "협업모집"
                        ? { ...base, positions:selPost.positions||[], crewDirector:selPost.crewDirector||"", crewLogline:selPost.crewLogline||"", crewSchedule:selPost.crewSchedule||"", crewPlace:selPost.crewPlace||"", crewPay:selPost.crewPay||"", crewGenre:selPost.crewGenre||"", deadline:selPost.deadline||"" }
                      : selPost.category === "스탭프로필"
                        ? { ...base, profileImage:selPost.profileImage||"", staffRoles:selPost.staffRoles||[], staffMajor:selPost.staffMajor||"", staffContact:selPost.staffContact||"" }
                      : selPost.category === "클래스"
                        ? { ...base, classField:selPost.classField||"", classDesc:selPost.classDesc||"", channelUrl:selPost.channelUrl||"", lessons:selPost.lessons||[] }
                        : base
                    );
                    setShowEdit(true);
                  }} color={C.green} small>수정</Btn>
                  <Btn onClick={() => deleteMyPost(selPost.id)} color={C.red} small outline>삭제</Btn>
                </>
              )}
              {isSuper && <Btn onClick={() => adminDeletePost(selPost.id)} color={C.red} small>관리자삭제</Btn>}
              {selPost.authorId !== profile?.uid && (
                <div style={{ position:"relative" }}>
                  <button onClick={() => setPostMenu(v => !v)} aria-label="더보기"
                    style={{ background:"none", border:"none", color:CINEMA.muted, cursor:"pointer", padding:"4px 4px", display:"flex", alignItems:"center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
                    </svg>
                  </button>
                  {postMenu && (
                    <>
                      <div onClick={() => setPostMenu(false)} style={{ position:"fixed", inset:0, zIndex:10 }} />
                      <div style={{ position:"absolute", top:32, right:0, zIndex:11, background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:10, overflow:"hidden", minWidth:108, boxShadow:"0 6px 20px rgba(0,0,0,0.5)" }}>
                        <button onClick={() => { reportItem("post", selPost); setPostMenu(false); }}
                          style={{ display:"block", width:"100%", textAlign:"left", background:"none", border:"none", color:CINEMA.text, fontSize:12.5, cursor:"pointer", padding:"10px 14px", fontFamily:"inherit" }}>신고</button>
                        <button onClick={() => { blockUser(selPost.authorId, displayName(selPost)); setPostMenu(false); }}
                          style={{ display:"block", width:"100%", textAlign:"left", background:"none", border:"none", color:CINEMA.text, fontSize:12.5, cursor:"pointer", padding:"10px 14px", borderTop:`1px solid ${CINEMA.border}`, fontFamily:"inherit" }}>차단</button>
                      </div>
                    </>
                  )}
                </div>
              )}
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
                  <YtThumb id={getYouTubeId(selPost.ytUrl)} alt="작품 썸네일"
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
            const isAuthor = selPost.authorId === profile?.uid;
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
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {(selPost.positions||[]).map((v, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ background: v.closed ? "rgba(255,255,255,0.05)" : CINEMA.surface, border:`1px solid ${v.closed ? CINEMA.border : "#f97316"}`, color: v.closed ? CINEMA.mutedDim : CINEMA.text, fontSize:12, fontWeight:500, padding:"5px 11px", borderRadius:14, textDecoration: v.closed ? "line-through" : "none" }}>{posLabel(v)}</span>
                          {v.closed && <span style={{ fontSize:10, color:CINEMA.muted, fontWeight:700 }}>마감</span>}
                          {isAuthor && (
                            <button onClick={() => togglePositionClosed(i)}
                              style={{ marginLeft:"auto", background:"transparent", border:`1px solid ${CINEMA.border}`, color: v.closed ? "#f97316" : CINEMA.muted, borderRadius:8, padding:"3px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                              {v.closed ? "재개" : "마감"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(selPost.crewDirector || selPost.crewSchedule || selPost.crewPlace || selPost.crewPay || selPost.crewGenre) && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
                    {selPost.crewDirector && (
                      <div style={{ background:CINEMA.surfaceAlt, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:3 }}>🎬 감독 / 연출</div>
                        <div style={{ fontSize:12, color:CINEMA.text, fontWeight:500 }}>{selPost.crewDirector}</div>
                      </div>
                    )}
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
                        <div style={{ fontSize:10, color:CINEMA.mutedDim, marginBottom:3 }}>🏷️ 장르</div>
                        <div style={{ fontSize:12, color:CINEMA.text, fontWeight:500 }}>{selPost.crewGenre}</div>
                      </div>
                    )}
                  </div>
                )}
                {selPost.content && <div style={{ fontSize:14, color:CINEMA.text, lineHeight:1.8, marginBottom:16, whiteSpace:"pre-wrap" }}>{selPost.content}</div>}
                {(() => {
                  const apps = selPost.applicants || [];
                  const mine = apps.find(a => a.uid === profile?.uid);
                  const openRoles = (selPost.positions || []).filter(p => !p.closed).map(posLabel);
                  if (isAuthor) {
                    return (
                      <div style={{ background:CINEMA.surfaceAlt, borderRadius:8, padding:"12px 14px", marginBottom:4 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"#f97316", marginBottom: apps.length ? 10 : 0, fontFamily:"'Courier New', monospace", letterSpacing:"0.1em" }}>📋 지원자 {apps.length}명</div>
                        {apps.length > 0 ? (
                          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                            {apps.map((a, i) => (
                              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                <span style={{ fontSize:13, fontWeight:600, color:CINEMA.text }}>{a.name || "이름없음"}</span>
                                {a.position && <span style={{ background:"rgba(249,115,22,0.14)", color:"#f97316", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10 }}>{a.position}</span>}
                                <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                                  <button onClick={() => setApplicantStatus(a.uid, a.status === "accepted" ? "pending" : "accepted")}
                                    style={{ border:"none", borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer",
                                      background: a.status === "accepted" ? "#16a34a" : "rgba(22,163,74,0.15)",
                                      color: a.status === "accepted" ? "#fff" : "#16a34a" }}>
                                    {a.status === "accepted" ? "✓ 수락됨" : "수락"}
                                  </button>
                                  <button onClick={() => setApplicantStatus(a.uid, a.status === "rejected" ? "pending" : "rejected")}
                                    style={{ border:"none", borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer",
                                      background: a.status === "rejected" ? CINEMA.red : "rgba(220,38,38,0.12)",
                                      color: a.status === "rejected" ? "#fff" : CINEMA.redBright }}>
                                    {a.status === "rejected" ? "거절됨" : "거절"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : <div style={{ fontSize:12, color:CINEMA.muted }}>아직 지원자가 없어요</div>}
                      </div>
                    );
                  }
                  if (mine) {
                    const st = mine.status;
                    return (
                      <div style={{ background:CINEMA.surface, border:`1px solid ${st === "accepted" ? "#16a34a" : st === "rejected" ? CINEMA.red : CINEMA.border}`, borderRadius:8, padding:"11px 14px", marginBottom:4 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:13, fontWeight:700, flex:1, color: st === "accepted" ? "#16a34a" : st === "rejected" ? CINEMA.redBright : CINEMA.text }}>
                            {st === "accepted" ? `🎉 수락되었어요! (${mine.position||"-"})`
                              : st === "rejected" ? "아쉽지만 이번엔 함께하지 못하게 되었어요"
                              : `✓ ${mine.position ? `'${mine.position}' 포지션으로 ` : ""}지원 완료 · 대기 중`}
                          </span>
                          {st !== "accepted" && st !== "rejected" && (
                            <button onClick={cancelApply} style={{ background:"transparent", border:`1px solid ${CINEMA.border}`, color:CINEMA.muted, borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>취소하기</button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (closed) {
                    return <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:8, padding:"11px 12px", fontSize:13, color:CINEMA.muted, textAlign:"center", fontWeight:600, marginBottom:4 }}>🚫 모집이 마감되었어요</div>;
                  }
                  if (openRoles.length === 0) {
                    return <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:8, padding:"11px 12px", fontSize:13, color:CINEMA.muted, textAlign:"center", fontWeight:600, marginBottom:4 }}>🚫 모든 포지션이 마감되었어요</div>;
                  }
                  return (
                    <div style={{ display:"flex", gap:8, marginBottom:4 }}>
                      <select value={applyPosition} onChange={e => setApplyPosition(e.target.value)}
                        style={{ flex:1, background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:8, color: applyPosition ? CINEMA.text : CINEMA.muted, padding:"11px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark", cursor:"pointer" }}>
                        <option value="">지원할 포지션 선택...</option>
                        {openRoles.map((r, i) => <option key={i} value={r}>{r}</option>)}
                      </select>
                      <button onClick={() => applyToCrew(applyPosition)} disabled={!applyPosition}
                        style={{ border:"none", borderRadius:8, padding:"0 20px", fontSize:14, fontWeight:700, cursor: applyPosition ? "pointer" : "not-allowed", whiteSpace:"nowrap",
                          background: applyPosition ? "#f97316" : CINEMA.surface,
                          color: applyPosition ? "#0a0a0a" : CINEMA.mutedDim }}>
                        📩 지원
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })() : selPost.category === "스탭프로필" ? (
            <div>
              {selPost.profileImage && (
                <div style={{ width:"100%", maxWidth:260, aspectRatio:"1/1", borderRadius:12, overflow:"hidden", margin:"0 auto 16px", background:CINEMA.surface }}>
                  <img src={selPost.profileImage} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
              )}
              <div style={{ fontSize:22, fontWeight:800, color:CINEMA.text, marginBottom:6, textAlign:"center" }}>{selPost.authorName || selPost.title}</div>
              <div style={{ fontSize:12, color:CINEMA.muted, marginBottom:16, fontFamily:"'Courier New', monospace", textAlign:"center" }}>
                {selPost.staffDept || selPost.dept}
                {selPost.staffStudentId && <> · {selPost.staffStudentId.slice(0,2)}학번</>}
                {selPost.staffMajor && <> · {selPost.staffMajor}</>}
              </div>
              {(selPost.staffRoles || []).length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:"#f97316", letterSpacing:"0.2em", fontWeight:700, marginBottom:8, textAlign:"center" }}>SPECIALTY</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
                    {(selPost.staffRoles || []).map((v, i) => (
                      <span key={i} style={{ background:CINEMA.surface, border:"1px solid #f97316", color:CINEMA.text, fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:14 }}>{v}</span>
                    ))}
                  </div>
                </div>
              )}
              {selPost.staffContact && (
                <div style={{ background:CINEMA.surfaceAlt, borderRadius:8, padding:"11px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>📩</span>
                  <span style={{ fontSize:13, color:CINEMA.text, fontWeight:600, wordBreak:"break-all" }}>{selPost.staffContact}</span>
                </div>
              )}
              {selPost.content && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:"#f97316", letterSpacing:"0.2em", fontWeight:700, marginBottom:8 }}>ABOUT</div>
                  <div style={{ fontSize:14, color:CINEMA.text, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{selPost.content}</div>
                </div>
              )}
            </div>
          ) : selPost.category === "클래스" ? (
            <div>
              {(() => {
                const firstYt = getYouTubeId(selPost.lessons?.[0]?.url || "");
                return (
                  <div onClick={() => firstYt && setFsVideo(firstYt)}
                    style={{ width:"100%", aspectRatio:"16/9", borderRadius:12, overflow:"hidden", marginBottom:14, background:CINEMA.surface, position:"relative", cursor: firstYt ? "pointer" : "default" }}>
                    {firstYt
                      ? <YtThumb id={firstYt} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, color:CINEMA.mutedDim }}>🎓</div>}
                    {firstYt && (
                      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <div style={{ width:54, height:54, borderRadius:"50%", background:"rgba(99,102,241,0.92)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:22 }}>▶</div>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div style={{ fontSize:20, fontWeight:800, color:CINEMA.text, marginBottom:6, lineHeight:1.3 }}>{selPost.title}</div>
              <div style={{ display:"flex", gap:10, fontSize:11, color:CINEMA.muted, marginBottom:14, fontFamily:"'Courier New', monospace", flexWrap:"wrap" }}>
                {selPost.classField && <span style={{ color:"#818cf8" }}>{selPost.classField}</span>}
                <span>총 {(selPost.lessons||[]).length}강</span>
                <span>·</span>
                <span>👁 {selPost.views||0}</span>
              </div>
              {selPost.classDesc && <div style={{ fontSize:13.5, color:CINEMA.text, lineHeight:1.8, marginBottom:18, whiteSpace:"pre-wrap" }}>{selPost.classDesc}</div>}
              {selPost.channelUrl && (
                <button onClick={() => window.open(selPost.channelUrl, "_blank", "noopener,noreferrer")}
                  style={{ width:"100%", marginBottom:18, background:"#FF0000", border:"none", borderRadius:10, color:"#fff", padding:"12px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>▶</span> 유튜브 채널 방문 · 구독
                </button>
              )}
              <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:"#6366f1", letterSpacing:"0.2em", fontWeight:700, marginBottom:10 }}>CURRICULUM</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {(selPost.lessons || []).map((ls, i) => {
                  const yt = getYouTubeId(ls.url || "");
                  return (
                    <div key={i} onClick={() => yt && setFsVideo(yt)}
                      style={{ display:"flex", alignItems:"center", gap:10, background:CINEMA.surface, borderRadius:8, padding:"10px 12px", cursor: yt ? "pointer" : "default", border:`1px solid ${CINEMA.border}` }}>
                      <span style={{ fontSize:13, color:"#818cf8", fontWeight:700, minWidth:18 }}>{i+1}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:CINEMA.text, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ls.title}</div>
                      </div>
                      {ls.duration && <span style={{ fontSize:10.5, color:CINEMA.muted, fontFamily:"'Courier New', monospace" }}>{ls.duration}</span>}
                      <span style={{ fontSize:14, color:"#6366f1" }}>▶</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:CINEMA.text, marginBottom:10, lineHeight:1.3 }}>{selPost.title}</div>
              <div style={{ display:"flex", gap:9, fontSize:13, color:CINEMA.muted, marginBottom:20 }}>
                <span style={{ color: selPost.useRealName ? CINEMA.gold : CINEMA.muted }}>
                  {selPost.useRealName ? "🏛️ " : ""}{displayName(selPost)}
                </span>
                <span>·</span>
                <span>{formatDate(selPost.createdAt)}</span>
                <span>·</span>
                <span>조회 {selPost.views||0}</span>
              </div>
              {/* 공모전: 접수 기간 + 홈페이지 링크 */}
              {selPost.category === "공모전" && (selPost.contestStart || selPost.deadline || selPost.contestUrl) && (
                <div style={{ marginBottom: selPost.images?.length>0?12:20 }}>
                  {(selPost.contestStart || selPost.deadline) && (() => {
                    const dday = getDday(selPost.deadline);
                    const closed = dday !== null && dday < 0;
                    return (
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom: selPost.contestUrl ? 12 : 0 }}>
                        {selPost.deadline && (
                          <span style={{ background: closed ? "#444" : "#fb923c", color: closed ? "#fff" : "#0a0a0a", fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:5 }}>
                            {closed ? "마감" : dday === 0 ? "D-DAY" : `D-${dday}`}
                          </span>
                        )}
                        <span style={{ fontSize:13, color:CINEMA.text, fontWeight:600 }}>
                          📅 {(selPost.contestStart || "").split("-").join(".")} ~ {(selPost.deadline || "").split("-").join(".")}
                        </span>
                      </div>
                    );
                  })()}
                  {selPost.contestUrl && (
                    <button onClick={() => window.open(selPost.contestUrl, "_blank", "noopener,noreferrer")}
                      style={{ width:"100%", background:"linear-gradient(135deg,#fb923c,#f97316)", border:"none", borderRadius:10, color:"#0a0a0a", fontSize:14, fontWeight:800, padding:"12px", cursor:"pointer" }}>
                      🔗 공모전 홈페이지 바로가기
                    </button>
                  )}
                </div>
              )}
              {selPost.content && <div style={{ fontSize:15, color:CINEMA.text, lineHeight:1.8, marginBottom: selPost.images?.length>0?12:20, whiteSpace:"pre-wrap" }}>{selPost.content}</div>}
            </div>
          )}
          {selPost.images?.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8, marginBottom:20, paddingBottom:20, borderBottom:`1px solid ${CINEMA.border}` }}>
              {selPost.images.map((url, i) => (
                <img loading="lazy" decoding="async" key={i} src={url} alt={`첨부${i+1}`} onClick={() => setSelImage(url)}
                  style={{ width:"100%", height:180, borderRadius:8, objectFit:"cover", cursor:"pointer", border:`1px solid ${CINEMA.border}`, display:"block" }} />
              ))}
            </div>
          )}

          {/* 리액션 알약 (👍 추천 | 💬 댓글수 | 👎 비추) - 작품공유·협업모집·스탭·클래스 제외 */}
          {selPost.category !== "작품공유" && selPost.category !== "협업모집" && selPost.category !== "스탭프로필" && selPost.category !== "클래스" && (() => {
            const liked = (selPost.likedBy||[]).includes(profile?.uid);
            const disliked = (selPost.dislikedBy||[]).includes(profile?.uid);
            const acc = postAccent(selPost.category);
            const seg = { display:"flex", alignItems:"center", gap:8, background:"none", border:"none", padding:"11px 24px", cursor:"pointer", fontSize:14 };
            const divider = <div style={{ width:1, background:"rgba(255,255,255,0.09)", margin:"9px 0" }} />;
            return (
              <div style={{ display:"flex", justifyContent:"center", margin:"22px 0 18px" }}>
                <div style={{ display:"flex", alignItems:"stretch", background:CINEMA.surface, border:`1px solid ${liked ? acc.solid : acc.border}`, borderRadius:26, boxShadow: liked ? `0 0 16px ${acc.glow}` : "none", overflow:"hidden" }}>
                  <button onClick={() => toggleLike("post", selPost)} style={{ ...seg, color: liked ? acc.bright : CINEMA.muted, fontWeight:700 }}>
                    <span style={{ fontSize:15, filter: liked ? "none" : "grayscale(1) opacity(0.6)" }}>👍</span> {selPost.likes||0}
                  </button>
                  {divider}
                  <div style={{ ...seg, cursor:"default", color:CINEMA.muted, fontWeight:600 }}>
                    <span style={{ fontSize:14, filter:"grayscale(1) opacity(0.6)" }}>💬</span> {postComments(selPost.id).length}
                  </div>
                  {divider}
                  <button onClick={() => toggleDislike("post", selPost)} style={{ ...seg, color: disliked ? CINEMA.text : CINEMA.mutedDim, fontWeight:600 }}>
                    <span style={{ fontSize:14, filter: disliked ? "none" : "grayscale(1) opacity(0.6)" }}>👎</span> {selPost.dislikes||0}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 댓글 영역 - 작품공유 제외 */}
          {selPost.category !== "작품공유" && selPost.category !== "스탭프로필" && selPost.category !== "클래스" && (<>
          {/* 댓글 헤더 */}
          <div style={{ borderTop:`1px solid ${CINEMA.border}`, paddingTop:18, marginBottom:14 }}>
            <span style={{ fontSize:15, fontWeight:800, color:CINEMA.text }}>
              댓글 <span style={{ color:postAccent(selPost.category).bright }}>{postComments(selPost.id).length}</span>
            </span>
          </div>
          {postComments(selPost.id).map(c => {
            const isMemoComment = c.useRealName && (c.adminRoleAtWrite === "super" || c.adminRoleAtWrite === "assistant");
            const cLiked = (c.likedBy||[]).includes(profile?.uid);
            const cDisliked = (c.dislikedBy||[]).includes(profile?.uid);
            const acc = postAccent(selPost.category);
            const canMenu = c.authorId !== profile?.uid || isSuper;
            const menuBtn = { display:"block", width:"100%", textAlign:"left", background:"none", border:"none", fontSize:12.5, cursor:"pointer", padding:"10px 14px", fontFamily:"inherit" };
            return (
              <div key={c.id} style={{
                position:"relative",
                background: isMemoComment ? CINEMA.surfaceAlt : CINEMA.surface,
                border: `1px ${isMemoComment ? "dashed "+CINEMA.gold : "solid "+CINEMA.border}`,
                borderRadius:12, padding:"12px 14px", marginBottom:10,
                display:"flex", gap:10, alignItems:"center",
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:5 }}>
                    <span style={{
                      fontSize:13, fontWeight:700,
                      color: isMemoComment ? CINEMA.gold : CINEMA.text,
                      fontFamily: isMemoComment ? "'Courier New', monospace" : "inherit",
                    }}>
                      {isMemoComment ? "🏛️ " : ""}{displayCommentName(c, selPost.category)}
                    </span>
                    <span style={{ fontSize:13, color:CINEMA.mutedDim }}>{formatDate(c.createdAt)}</span>
                  </div>
                  {selPost.category === LECTURE_CAT && c.rating > 0 && (
                    <div style={{ fontSize:12, color:CINEMA.gold, marginBottom:3 }}>
                      {"★".repeat(c.rating)}{"☆".repeat(5-c.rating)} <span style={{ fontSize:10, color:CINEMA.mutedDim, marginLeft:4 }}>({c.rating}/5)</span>
                    </div>
                  )}
                  <div style={{ fontSize:13.5, color:CINEMA.text, lineHeight:1.55, wordBreak:"break-word", whiteSpace:"pre-wrap" }}>{c.content}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:13, flexShrink:0 }}>
                  <button onClick={() => toggleLike("comment", c)}
                    style={{ background:"none", border:"none", fontSize:12,
                      color: cLiked ? acc.bright : CINEMA.mutedDim, cursor:"pointer", fontWeight:600, padding:0 }}>
                    <span style={{ filter: cLiked ? "none" : "grayscale(1) opacity(0.6)" }}>👍</span> {c.likes||0}
                  </button>
                  <button onClick={() => toggleDislike("comment", c)}
                    style={{ background:"none", border:"none", fontSize:12,
                      color: cDisliked ? CINEMA.text : CINEMA.mutedDim, cursor:"pointer", fontWeight:500, padding:0 }}>
                    <span style={{ filter: cDisliked ? "none" : "grayscale(1) opacity(0.6)" }}>👎</span> {c.dislikes||0}
                  </button>
                  {canMenu && (
                    <button onClick={() => setCmtMenu(cmtMenu === c.id ? null : c.id)}
                      style={{ background:"none", border:"none", fontSize:16, color:CINEMA.mutedDim, cursor:"pointer", padding:"0 2px", lineHeight:1 }}>
                      ⋮
                    </button>
                  )}
                </div>
                {cmtMenu === c.id && (
                  <>
                    <div onClick={() => setCmtMenu(null)} style={{ position:"fixed", inset:0, zIndex:10 }} />
                    <div style={{ position:"absolute", top:40, right:12, zIndex:11, background:CINEMA.surface, border:`1px solid ${CINEMA.border}`, borderRadius:10, overflow:"hidden", minWidth:108, boxShadow:"0 6px 20px rgba(0,0,0,0.5)" }}>
                      {c.authorId !== profile?.uid && (<>
                        <button onClick={() => { reportItem("comment", c); setCmtMenu(null); }} style={{ ...menuBtn, color:CINEMA.text }}>신고</button>
                        <button onClick={() => { blockUser(c.authorId, displayCommentName(c, selPost.category)); setCmtMenu(null); }} style={{ ...menuBtn, color:CINEMA.text, borderTop:`1px solid ${CINEMA.border}` }}>차단</button>
                      </>)}
                      {isSuper && (
                        <button onClick={() => { adminDeleteComment(c.id); setCmtMenu(null); }} style={{ ...menuBtn, color:CINEMA.redBright, borderTop: c.authorId !== profile?.uid ? `1px solid ${CINEMA.border}` : "none" }}>삭제</button>
                      )}
                    </div>
                  </>
                )}
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
          <div style={{ background:CINEMA.surface, border:`1px solid ${postAccent(selPost.category).border}`, borderRadius:12, padding:"8px 8px 10px 14px", marginTop:14 }}>
            {/* 관리자(슈퍼/조교) 실명 체크박스 — 익명 게시판 + 강의 아닐 때만 */}
            {canUseRealName && !REAL_CATS.includes(selPost.category) && selPost.category !== LECTURE_CAT && (
              <label style={{ display:"flex", alignItems:"center", gap:6, margin:"2px 0 8px", padding:"5px 8px", background:CINEMA.surfaceAlt, borderRadius:6, cursor:"pointer", border:`1px solid ${CINEMA.gold}` }}>
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
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <input placeholder={selPost.category===LECTURE_CAT?"수강 후기를 남겨주세요...":"댓글을 입력하세요..."} value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(selPost.id); }}}
                style={{ flex:1, minWidth:0, background:"none", border:"none", color:CINEMA.text, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              <button onClick={() => submitComment(selPost.id)} disabled={submitting || !commentText.trim()}
                style={{ flexShrink:0, background:postAccent(selPost.category).gradient, border:"none", borderRadius:9, color:"#fff", fontSize:14, fontWeight:700, padding:"11px 22px", cursor:"pointer", opacity:(submitting || !commentText.trim())?0.5:1 }}>
                등록
              </button>
            </div>
          </div>
          </>)}
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
              <Inp label="프로젝트 제목 *" placeholder="예: 단편영화 「물고기는 잠들지 않는다」 크루 모집" value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} />
              <Inp label="감독 / 연출" placeholder="예: 홍길동" value={editForm.crewDirector} onChange={e => setEditForm(p=>({...p,crewDirector:e.target.value}))} />
              <Inp label="한 줄 소개" placeholder="작품을 한 문장으로 (로그라인)" value={editForm.crewLogline} onChange={e => setEditForm(p=>({...p,crewLogline:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>모집 포지션 * <span style={{ color:C.muted, fontWeight:400 }}>(최대 8개)</span></div>
                <select value={editForm.positionSelect} onChange={e => pickPositionEdit(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color: editForm.positionSelect ? C.text : C.muted, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark", cursor:"pointer" }}>
                  <option value="">＋ 포지션 선택...</option>
                  {CREW_POSITIONS.map(pos => (
                    <option key={pos} value={pos} disabled={pos !== CREW_ETC && editForm.positions.some(x => x.role === pos)}>{pos}</option>
                  ))}
                </select>
                {editForm.positionSelect && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    {editForm.positionSelect === CREW_ETC && (
                      <input value={editForm.positionInput} placeholder="역할명 (예: 스틸 촬영)" autoFocus
                        onChange={e => setEditForm(p=>({...p,positionInput:e.target.value}))}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPositionEdit(); } }}
                        style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    )}
                    <input type="number" min="1" value={editForm.positionCount} placeholder="인원"
                      onChange={e => setEditForm(p=>({...p,positionCount:e.target.value}))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPositionEdit(); } }}
                      style={{ width:80, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
                    <button type="button" onClick={addPositionEdit}
                      style={{ background:"#f97316", border:"none", borderRadius:10, color:"#0a0a0a", padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                  </div>
                )}
                {editForm.positions.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {editForm.positions.map((v, i) => (
                      <span key={i} onClick={() => setEditForm(p=>({...p, positions:p.positions.filter((_,j)=>j!==i)}))}
                        style={{ background:"rgba(249,115,22,0.14)", color:"#f97316", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {posLabel(v)} ✕
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
          ) : selPost.category === "스탭프로필" ? (
            <div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>대표 이미지 <span style={{ color:C.muted, fontWeight:400 }}>(본인 사진)</span></div>
                {editForm.profileImage ? (
                  <div style={{ position:"relative", width:120, height:120, borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}` }}>
                    <img src={editForm.profileImage} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    <button onClick={() => setEditForm(p=>({...p, profileImage:""}))}
                      style={{ position:"absolute", top:4, right:4, background:C.red, color:"#fff", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:12, fontWeight:700 }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => staffImgRef.current?.click()} disabled={imgUploading}
                    style={{ width:120, height:120, background:C.bg, border:`1.5px dashed ${C.border}`, borderRadius:10, color:C.muted, cursor:"pointer", fontSize:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
                    {imgUploading ? "⏳" : <><span style={{ fontSize:24 }}>📷</span><span>사진 추가</span></>}
                  </button>
                )}
                <input ref={staffImgRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setImgUploading(true);
                    try { const url = await uploadImage(f); setEditForm(p=>({...p, profileImage:url})); }
                    catch { alert("이미지 업로드 실패"); }
                    finally { setImgUploading(false); e.target.value=""; }
                  }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>담당 분야 * <span style={{ color:C.muted, fontWeight:400 }}>(최대 8개)</span></div>
                <select value={editForm.staffRoleSelect} onChange={e => pickStaffRoleEdit(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color: editForm.staffRoleSelect ? C.text : C.muted, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark", cursor:"pointer" }}>
                  <option value="">＋ 분야 선택...</option>
                  {CREW_POSITIONS.map(pos => (
                    <option key={pos} value={pos} disabled={pos !== CREW_ETC && editForm.staffRoles.includes(pos)}>{pos}</option>
                  ))}
                </select>
                {editForm.staffRoleSelect === CREW_ETC && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <input value={editForm.staffRoleInput} placeholder="분야 직접 입력" autoFocus
                      onChange={e => setEditForm(p=>({...p,staffRoleInput:e.target.value}))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStaffRoleCustomEdit(); } }}
                      style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    <button type="button" onClick={addStaffRoleCustomEdit}
                      style={{ background:"#f97316", border:"none", borderRadius:10, color:"#0a0a0a", padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                  </div>
                )}
                {editForm.staffRoles.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {editForm.staffRoles.map((v, i) => (
                      <span key={i} onClick={() => setEditForm(p=>({...p, staffRoles:p.staffRoles.filter((_,j)=>j!==i)}))}
                        style={{ background:"rgba(249,115,22,0.14)", color:"#f97316", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {v} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Inp label="학과" placeholder="예: 영화영상학과" value={editForm.staffMajor} onChange={e => setEditForm(p=>({...p,staffMajor:e.target.value}))} />
              <Inp label="연락처" placeholder="예: 인스타 @id · 010-0000-0000" value={editForm.staffContact} onChange={e => setEditForm(p=>({...p,staffContact:e.target.value}))} />
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>자기소개 / 경력</div>
                <textarea placeholder="참여작, 보유 장비·기술, 어필 포인트 등" value={editForm.content} onChange={e => setEditForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:120, boxSizing:"border-box" }} />
              </div>
            </div>
          ) : selPost.category === "클래스" ? (
            <div>
              <Inp label="강좌명 *" value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} />
              <Inp label="분야 / 부제" value={editForm.classField} onChange={e => setEditForm(p=>({...p,classField:e.target.value}))} />
              <Inp label="유튜브 채널 링크" placeholder="https://youtube.com/@채널명" value={editForm.channelUrl} onChange={e => setEditForm(p=>({...p,channelUrl:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>강좌 소개 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
                <textarea value={editForm.classDesc} onChange={e => setEditForm(p=>({...p,classDesc:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>강의 영상 * <span style={{ color:C.muted, fontWeight:400 }}>({editForm.lessons.length}강)</span></div>
                {editForm.lessons.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                    {editForm.lessons.map((ls, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px" }}>
                        <span style={{ fontSize:12, color:"#6366f1", fontWeight:700, minWidth:16 }}>{i+1}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:C.text, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ls.title}</div>
                        </div>
                        {ls.duration && <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace" }}>{ls.duration}</span>}
                        <button onClick={() => removeLessonEdit(i)} style={{ background:"transparent", border:"none", color:C.red, cursor:"pointer", fontSize:13, fontWeight:700 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background:C.bg, border:`1.5px dashed ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
                  <input value={editForm.lessonTitle} placeholder="영상 제목"
                    onChange={e => setEditForm(p=>({...p,lessonTitle:e.target.value}))}
                    style={{ width:"100%", background:"none", border:"none", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:7 }} />
                  <div style={{ display:"flex", gap:6 }}>
                    <input value={editForm.lessonUrl} placeholder="유튜브 링크"
                      onChange={e => setEditForm(p=>({...p,lessonUrl:e.target.value}))}
                      style={{ flex:1, minWidth:0, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 10px", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    <input value={editForm.lessonDuration} placeholder="12:34"
                      onChange={e => setEditForm(p=>({...p,lessonDuration:e.target.value}))}
                      style={{ width:62, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 8px", fontSize:12, fontFamily:"monospace", outline:"none", boxSizing:"border-box", textAlign:"center" }} />
                  </div>
                  <button type="button" onClick={addLessonEdit}
                    style={{ width:"100%", marginTop:8, background:"#6366f1", border:"none", borderRadius:8, color:"#fff", padding:"9px", fontSize:13, fontWeight:700, cursor:"pointer" }}>＋ 영상 추가</button>
                </div>
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
              : selPost.category === "스탭프로필"
              ? editForm.staffRoles.length === 0
              : selPost.category === "클래스"
              ? !editForm.title.trim() || editForm.lessons.length === 0
              : !editForm.title.trim() || !editForm.content.trim()}>수정 완료</Btn>
          </div>
        </Modal>
      )}

      {/* 글쓰기 모달 */}
      {showWrite && (
        <Modal onClose={() => setShowWrite(false)} width={540} cinema>
          <div style={{ marginBottom:20 }}>
            <span style={{ fontSize:23, fontWeight:800, color:CINEMA.text }}>새 글 작성</span>
          </div>

          {/* 카테고리 선택 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:CINEMA.muted, marginBottom:10 }}>카테고리</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {(currentRoom?.categories || []).map(c => {
                const isLocked = c === NEWBIE_CAT && !isNewbie && profile?.role !== "admin";
                const active = writeForm.category === c;
                return (
                  <button key={c} onClick={() => !isLocked && setWriteForm(p=>({...p, category:c}))}
                    style={{
                      padding:"10px 22px", borderRadius:12,
                      border:`1.5px solid ${active ? "transparent" : CINEMA.border}`,
                      background: active ? "linear-gradient(135deg,#5b8def,#7c3aed)" : "transparent",
                      color: active ? "#fff" : (isLocked ? CINEMA.mutedDim : CINEMA.muted),
                      fontSize:14, fontWeight:700,
                      boxShadow: active ? "0 0 14px rgba(124,58,237,0.35)" : "none",
                      cursor: isLocked ? "not-allowed" : "pointer",
                      transition:"all 0.15s",
                    }}>
                    {c === NEWBIE_CAT && "🌱"}{c}{isLocked && " 🔒"}
                  </button>
                );
              })}
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
              <Inp label="프로젝트 제목 *" placeholder="예: 단편영화 「물고기는 잠들지 않는다」 크루 모집" value={writeForm.title} onChange={e => setWriteForm(p=>({...p,title:e.target.value}))} />
              <Inp label="감독 / 연출" placeholder="예: 홍길동" value={writeForm.crewDirector} onChange={e => setWriteForm(p=>({...p,crewDirector:e.target.value}))} />
              <Inp label="한 줄 소개" placeholder="작품을 한 문장으로 (로그라인)" value={writeForm.crewLogline} onChange={e => setWriteForm(p=>({...p,crewLogline:e.target.value}))} />
              {/* 모집 포지션 (드롭다운 + 인원) */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>모집 포지션 * <span style={{ color:C.muted, fontWeight:400 }}>(최대 8개)</span></div>
                <select value={writeForm.positionSelect} onChange={e => pickPosition(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color: writeForm.positionSelect ? C.text : C.muted, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark", cursor:"pointer" }}>
                  <option value="">＋ 포지션 선택...</option>
                  {CREW_POSITIONS.map(pos => (
                    <option key={pos} value={pos} disabled={pos !== CREW_ETC && writeForm.positions.some(x => x.role === pos)}>{pos}</option>
                  ))}
                </select>
                {writeForm.positionSelect && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    {writeForm.positionSelect === CREW_ETC && (
                      <input value={writeForm.positionInput} placeholder="역할명 (예: 스틸 촬영)" autoFocus
                        onChange={e => setWriteForm(p=>({...p,positionInput:e.target.value}))}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPosition(); } }}
                        style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    )}
                    <input type="number" min="1" value={writeForm.positionCount} placeholder="인원"
                      onChange={e => setWriteForm(p=>({...p,positionCount:e.target.value}))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPosition(); } }}
                      style={{ width:80, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
                    <button type="button" onClick={addPosition}
                      style={{ background:"#f97316", border:"none", borderRadius:10, color:"#0a0a0a", padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                  </div>
                )}
                {writeForm.positions.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {writeForm.positions.map((v, i) => (
                      <span key={i} onClick={() => setWriteForm(p=>({...p, positions:p.positions.filter((_,j)=>j!==i)}))}
                        style={{ background:"rgba(249,115,22,0.14)", color:"#f97316", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {posLabel(v)} ✕
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
                📩 지원은 '지원하기' 버튼으로 받아요. 지원자 명단은 작성자에게만 보입니다.
              </div>
            </div>
          ) : writeForm.category === "스탭프로필" ? (
            <div>
              {/* 대표 이미지 (본인 사진) */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>대표 이미지 <span style={{ color:C.muted, fontWeight:400 }}>(본인 사진)</span></div>
                {writeForm.profileImage ? (
                  <div style={{ position:"relative", width:120, height:120, borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}` }}>
                    <img src={writeForm.profileImage} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    <button onClick={() => setWriteForm(p=>({...p, profileImage:""}))}
                      style={{ position:"absolute", top:4, right:4, background:C.red, color:"#fff", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:12, fontWeight:700 }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => staffImgRef.current?.click()} disabled={imgUploading}
                    style={{ width:120, height:120, background:C.bg, border:`1.5px dashed ${C.border}`, borderRadius:10, color:C.muted, cursor:"pointer", fontSize:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
                    {imgUploading ? "⏳" : <><span style={{ fontSize:24 }}>📷</span><span>사진 추가</span></>}
                  </button>
                )}
                <input ref={staffImgRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setImgUploading(true);
                    try { const url = await uploadImage(f); setWriteForm(p=>({...p, profileImage:url})); }
                    catch { alert("이미지 업로드 실패"); }
                    finally { setImgUploading(false); e.target.value=""; }
                  }} />
              </div>
              {/* 이름·학번·계열 자동 */}
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, color:C.muted }}>
                <span style={{ color:C.text, fontWeight:700 }}>{profile?.name || "이름"}</span>
                <span style={{ margin:"0 6px" }}>·</span>{profile?.dept || "계열"}
                {profile?.studentId && <><span style={{ margin:"0 6px" }}>·</span>{profile.studentId.slice(0,2)}학번</>}
                <span style={{ display:"block", fontSize:10, color:C.mutedDim, marginTop:3 }}>※ 이름·학번·계열은 자동으로 표시돼요</span>
              </div>
              {/* 담당 분야 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>담당 분야 * <span style={{ color:C.muted, fontWeight:400 }}>(최대 8개)</span></div>
                <select value={writeForm.staffRoleSelect} onChange={e => pickStaffRole(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color: writeForm.staffRoleSelect ? C.text : C.muted, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark", cursor:"pointer" }}>
                  <option value="">＋ 분야 선택...</option>
                  {CREW_POSITIONS.map(pos => (
                    <option key={pos} value={pos} disabled={pos !== CREW_ETC && writeForm.staffRoles.includes(pos)}>{pos}</option>
                  ))}
                </select>
                {writeForm.staffRoleSelect === CREW_ETC && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <input value={writeForm.staffRoleInput} placeholder="분야 직접 입력" autoFocus
                      onChange={e => setWriteForm(p=>({...p,staffRoleInput:e.target.value}))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStaffRoleCustom(); } }}
                      style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    <button type="button" onClick={addStaffRoleCustom}
                      style={{ background:"#f97316", border:"none", borderRadius:10, color:"#0a0a0a", padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                  </div>
                )}
                {writeForm.staffRoles.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                    {writeForm.staffRoles.map((v, i) => (
                      <span key={i} onClick={() => setWriteForm(p=>({...p, staffRoles:p.staffRoles.filter((_,j)=>j!==i)}))}
                        style={{ background:"rgba(249,115,22,0.14)", color:"#f97316", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:12, cursor:"pointer" }}>
                        {v} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Inp label="학과" placeholder="예: 영화영상학과" value={writeForm.staffMajor} onChange={e => setWriteForm(p=>({...p,staffMajor:e.target.value}))} />
              <Inp label="연락처" placeholder="예: 인스타 @id · 010-0000-0000" value={writeForm.staffContact} onChange={e => setWriteForm(p=>({...p,staffContact:e.target.value}))} />
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>자기소개 / 경력</div>
                <textarea placeholder="참여작, 보유 장비·기술, 어필 포인트 등" value={writeForm.content} onChange={e => setWriteForm(p=>({...p,content:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:120, boxSizing:"border-box" }} />
              </div>
            </div>
          ) : writeForm.category === "클래스" ? (
            <div>
              <Inp label="강좌명 *" placeholder="예: 촬영 기초" value={writeForm.title} onChange={e => setWriteForm(p=>({...p,title:e.target.value}))} />
              <Inp label="분야 / 부제" placeholder="예: 카메라 · 구도 · 노출" value={writeForm.classField} onChange={e => setWriteForm(p=>({...p,classField:e.target.value}))} />
              <Inp label="유튜브 채널 링크" placeholder="예: https://youtube.com/@채널명 (구독 버튼용)" value={writeForm.channelUrl} onChange={e => setWriteForm(p=>({...p,channelUrl:e.target.value}))} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>강좌 소개 <span style={{ color:C.muted, fontWeight:400 }}>(선택)</span></div>
                <textarea placeholder="이 강좌에서 배우는 내용" value={writeForm.classDesc} onChange={e => setWriteForm(p=>({...p,classDesc:e.target.value}))}
                  style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" }} />
              </div>
              {/* 영상(차시) 목록 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>강의 영상 * <span style={{ color:C.muted, fontWeight:400 }}>({writeForm.lessons.length}강)</span></div>
                {writeForm.lessons.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                    {writeForm.lessons.map((ls, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px" }}>
                        <span style={{ fontSize:12, color:"#6366f1", fontWeight:700, minWidth:16 }}>{i+1}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:C.text, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ls.title}</div>
                        </div>
                        {ls.duration && <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace" }}>{ls.duration}</span>}
                        <button onClick={() => removeLesson(i)} style={{ background:"transparent", border:"none", color:C.red, cursor:"pointer", fontSize:13, fontWeight:700 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background:C.bg, border:`1.5px dashed ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
                  <input value={writeForm.lessonTitle} placeholder="영상 제목 (예: 1강 카메라 기본 조작)"
                    onChange={e => setWriteForm(p=>({...p,lessonTitle:e.target.value}))}
                    style={{ width:"100%", background:"none", border:"none", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:7 }} />
                  <div style={{ display:"flex", gap:6 }}>
                    <input value={writeForm.lessonUrl} placeholder="유튜브 링크"
                      onChange={e => setWriteForm(p=>({...p,lessonUrl:e.target.value}))}
                      style={{ flex:1, minWidth:0, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 10px", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    <input value={writeForm.lessonDuration} placeholder="12:34"
                      onChange={e => setWriteForm(p=>({...p,lessonDuration:e.target.value}))}
                      style={{ width:62, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 8px", fontSize:12, fontFamily:"monospace", outline:"none", boxSizing:"border-box", textAlign:"center" }} />
                  </div>
                  <button type="button" onClick={addLesson}
                    style={{ width:"100%", marginTop:8, background:"#6366f1", border:"none", borderRadius:8, color:"#fff", padding:"9px", fontSize:13, fontWeight:700, cursor:"pointer" }}>＋ 영상 추가</button>
                </div>
              </div>
            </div>
          ) : writeForm.category === "공모전" ? (
            <div>
              <Inp label="제목 *" placeholder="예: 제5회 ○○ 단편영화 공모전" value={writeForm.title} onChange={e => setWriteForm(p=>({...p,title:e.target.value}))} />
              {/* 접수 기간 */}
              <div style={{ display:"flex", gap:10, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>시작일자 *</div>
                  <input type="date" value={writeForm.contestStart} onChange={e => setWriteForm(p=>({...p,contestStart:e.target.value}))}
                    style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>종료일자 *</div>
                  <input type="date" value={writeForm.deadline} min={writeForm.contestStart || undefined} onChange={e => setWriteForm(p=>({...p,deadline:e.target.value}))}
                    style={{ display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
                </div>
              </div>
              {writeForm.deadline && getDday(writeForm.deadline) !== null && (
                <div style={{ fontSize:11, color: getDday(writeForm.deadline) < 0 ? C.red : C.muted, marginBottom:12 }}>
                  {getDday(writeForm.deadline) < 0 ? "이미 지난 날짜예요 (마감으로 표시됩니다)" : getDday(writeForm.deadline) === 0 ? "오늘 마감 (D-DAY)" : `마감까지 D-${getDday(writeForm.deadline)}`}
                </div>
              )}
              <div style={{ marginBottom:4 }} />
              <Inp label="공모전 링크" placeholder="https://... (공모전 홈페이지)" value={writeForm.contestUrl} onChange={e => setWriteForm(p=>({...p,contestUrl:e.target.value}))} />
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
          {writeForm.category !== LECTURE_CAT && writeForm.category !== "작품공유" && writeForm.category !== "협업모집" && writeForm.category !== "스탭프로필" && writeForm.category !== "클래스" && <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4 }}>
              이미지 첨부{writeForm.category === "공모전" ? " *" : ""}{" "}
              <span style={{ color:C.muted, fontWeight:400 }}>{writeForm.category === "공모전" ? "(1장 이상 필수 · 최대 3장)" : "(최대 3장)"}</span>
            </div>
            {writeForm.images.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:8 }}>
                {writeForm.images.map((url, i) => (
                  <div key={i} style={{ position:"relative", paddingTop:"75%", borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}`, background:C.bg }}>
                    <img loading="lazy" decoding="async" src={url} alt={`첨부${i+1}`} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
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

          <div style={{ fontSize:12, color:CINEMA.mutedDim, marginBottom:16, paddingLeft:2, lineHeight:1.5 }}>
            {writeForm.category === LECTURE_CAT
              ? "⚠️ 익명으로 게시되며, 학생들이 댓글로 후기를 남길 수 있어요."
              : writeForm.category === "작품공유"
              ? "🎬 게시 후에도 작품 정보를 수정할 수 있어요."
              : writeForm.category === "협업모집"
              ? "🤝 실명으로 게시되며, 게시 후에도 모집 내용을 수정할 수 있어요."
              : writeForm.category === "스탭프로필"
              ? "🙋 실명으로 등록되며, 게시 후에도 프로필을 수정할 수 있어요."
              : writeForm.category === "클래스"
              ? "🎓 조교·관리자만 등록할 수 있어요. 등록 후에도 수정할 수 있어요."
              : REAL_CATS.includes(writeForm.category)
              ? "⚠️ 실명으로 게시되며, 게시 후 수정·삭제가 불가합니다."
              : "⚠️ 익명으로 게시되며, 게시 후 수정·삭제가 불가합니다."}
          </div>
          {(() => {
            const disabled = submitting ||
              (writeForm.category === LECTURE_CAT
                ? !writeForm.lectureName.trim() || !writeForm.professor.trim()
                : writeForm.category === "작품공유"
                ? !writeForm.title.trim() || !getYouTubeId(writeForm.ytUrl)
                : writeForm.category === "협업모집"
                ? !writeForm.title.trim() || writeForm.positions.length === 0
                : writeForm.category === "스탭프로필"
                ? writeForm.staffRoles.length === 0
                : writeForm.category === "클래스"
                ? !writeForm.title.trim() || writeForm.lessons.length === 0
                : writeForm.category === "공모전"
                ? !writeForm.title.trim() || !writeForm.contestStart || !writeForm.deadline || writeForm.images.length === 0
                : !writeForm.title.trim() || !writeForm.content.trim());
            return (
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowWrite(false)}
                  style={{ flex:1, background:"transparent", border:`1.5px solid ${CINEMA.border}`, borderRadius:12, color:CINEMA.muted, fontSize:15, fontWeight:700, padding:"13px", cursor:"pointer", fontFamily:"inherit" }}>
                  취소
                </button>
                <button onClick={submitPost} disabled={disabled}
                  style={{ flex:1, background:"linear-gradient(135deg,#5b8def,#7c3aed)", border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:700, padding:"13px", cursor: disabled?"not-allowed":"pointer", boxShadow: disabled?"none":"0 0 16px rgba(124,58,237,0.35)", opacity: disabled?0.5:1, fontFamily:"inherit" }}>
                  {submitting ? "게시 중..." : "게시하기"}
                </button>
              </div>
            );
          })()}
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

        {/* 🎬 글쓰기 FAB - 게시판 룸에서만 표시, 룸 컬러 사용 (클래스는 조교·관리자만) */}
        {selectedRoom && selectedRoom !== "tools" && !(selectedRoom === "class" && !canUseRealName) && (
        <button
          onClick={() => {
            const defaultCat = (currentRoom?.categories?.includes(cat) ? cat : currentRoom?.categories?.[0]) || "자유";
            setWriteForm(p => ({ ...p, category: defaultCat }));
            setShowWrite(true);
          }}
          aria-label="글쓰기"
          style={{
            position:"fixed", bottom: navH + 16, right:18,
            width:60, height:60, borderRadius:18,
            background: "linear-gradient(135deg,#5b8def,#7c3aed)", border:"none",
            color:"#fff", fontSize:26, fontWeight:900,
            boxShadow:"0 6px 20px rgba(124,58,237,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
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

/** 🎥 박스오피스 — 넷플릭스 스타일 작품 브라우징 (블루 리디자인) */
const BO_BLUE = "#3b82f6";
const boIsNew = p => p.createdAt?.seconds && (Date.now()/1000 - p.createdAt.seconds) < 7*86400;

function WorkCard({ p, rank, onOpen, showNew }) {
  const ytId = getYouTubeId(p.ytUrl);
  return (
    <div onClick={() => onOpen(p)} style={{ flex:"0 0 150px", cursor:"pointer", minWidth:0 }}>
      <div style={{ position:"relative", aspectRatio:"16/9", background:"#10152a", borderRadius:10, overflow:"hidden", marginBottom:6, border:"1px solid rgba(59,130,246,0.35)", boxShadow:"0 0 12px rgba(59,130,246,0.12)" }}>
        <YtThumb id={ytId} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        {rank != null && (
          <span style={{ position:"absolute", left:7, bottom:1, fontSize:40, fontWeight:800, lineHeight:1, color:"#fff", textShadow:"0 2px 10px rgba(0,0,0,0.85)", fontFamily:"'Courier New', monospace" }}>{rank}</span>
        )}
        {showNew && boIsNew(p) && (
          <span style={{ position:"absolute", top:5, left:5, background:"#ef4444", color:"#fff", fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:4, letterSpacing:"0.05em" }}>NEW</span>
        )}
        {p.runtime && <span style={{ position:"absolute", bottom:4, right:4, background:"rgba(0,0,0,0.8)", color:"#fff", fontSize:9, padding:"1px 5px", borderRadius:3 }}>{p.runtime}</span>}
      </div>
      <div style={{ fontSize:12, fontWeight:500, color:"#fafaf9", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div>
    </div>
  );
}

function CarouselRow({ title, badge, items, onOpen, ranked, showNew, onAll }) {
  const ref = useRef(null);
  if (!items.length) return null;
  return (
    <div style={{ marginBottom:4 }}>
      <div style={{ padding:"16px 12px 8px", display:"flex", alignItems:"center", gap:7 }}>
        <span style={{ fontSize:14.5, fontWeight:700, color:"#fafaf9" }}>{title}</span>
        {badge && <span style={{ fontSize:13.5, fontWeight:800, color:"#7e9dff", letterSpacing:"0.02em" }}>TOP 10</span>}
        {onAll && (
          <span onClick={onAll} style={{ marginLeft:"auto", fontSize:11, color:"#8a8fa3", cursor:"pointer" }}>전체 보기 ›</span>
        )}
      </div>
      <div style={{ position:"relative" }}>
        <div ref={ref} className="bo-car" style={{ display:"flex", gap:8, overflowX:"auto", padding:"0 12px 12px" }}>
          {items.map((p, i) => <WorkCard key={p.id} p={p} rank={ranked ? i+1 : null} onOpen={onOpen} showNew={showNew} />)}
        </div>
        {items.length > 2 && (
          <div onClick={() => ref.current?.scrollBy({ left:-300, behavior:"smooth" })} className="bo-arrow"
            style={{ position:"absolute", top:0, left:0, width:34, height:84, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", borderTopRightRadius:7, borderBottomRightRadius:7, zIndex:1 }}>
            <span style={{ color:"#fff", fontSize:24, fontWeight:300 }}>‹</span>
          </div>
        )}
        {items.length > 2 && (
          <div onClick={() => ref.current?.scrollBy({ left:300, behavior:"smooth" })} className="bo-arrow"
            style={{ position:"absolute", top:0, right:0, width:34, height:84, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", borderTopLeftRadius:7, borderBottomLeftRadius:7, zIndex:1 }}>
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
  const heroItems = byDate.slice(0, 5);   // 최신 5개 자동 슬라이드
  const [heroIdx, setHeroIdx] = useState(0);
  const [allView, setAllView] = useState(null);   // { title, items, ranked, showNew } — 섹션 전체 보기
  useEffect(() => {
    if (heroItems.length <= 1) return;
    const t = setInterval(() => setHeroIdx(i => (i + 1) % heroItems.length), 5000);
    return () => clearInterval(t);
  }, [heroItems.length]);

  // 장르별 행 (작품이 2개 이상인 장르만)
  const genreMap = {};
  works.forEach(p => (p.genres||[]).forEach(g => { (genreMap[g] = genreMap[g] || []).push(p); }));
  const genreRows = Object.entries(genreMap).filter(([,arr]) => arr.length >= 2);

  if (works.length === 0) {
    return (
      <div style={{ background:"linear-gradient(180deg,#0c1124 0%,#0a0a12 100%)", borderRadius:10, margin:"14px 0 0", padding:"60px 20px", textAlign:"center", color:"#71706b" }}>
        <div style={{ fontSize:48, opacity:0.3, marginBottom:12 }}>🎬</div>
        <div style={{ fontSize:13, fontFamily:"'Courier New', monospace", letterSpacing:"0.15em", marginBottom:6 }}>NO FILMS YET</div>
        <div style={{ fontSize:12 }}>첫 작품을 올려보세요</div>
      </div>
    );
  }

  // 전체 보기 — 그리드 목록
  if (allView) {
    return (
      <div style={{ background:"linear-gradient(180deg,#0c1124 0%,#0a0a12 100%)", borderRadius:10, margin:"14px 0 0", padding:"14px 12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span onClick={() => setAllView(null)} style={{ color:"#fafaf9", fontSize:20, lineHeight:1, cursor:"pointer", padding:"0 4px" }}>‹</span>
          <span style={{ fontSize:15, fontWeight:700, color:"#fafaf9" }}>{allView.title}</span>
          <span style={{ fontSize:11, color:"#8a8fa3" }}>{allView.items.length}편</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10 }}>
          {allView.items.map((p, i) => (
            <WorkCard key={p.id} p={p} rank={allView.ranked ? i+1 : null} onOpen={onOpen} showNew={allView.showNew} />
          ))}
        </div>
      </div>
    );
  }

  const hero = heroItems[heroIdx] || byDate[0];
  const heroYt = getYouTubeId(hero.ytUrl);
  return (
    <div style={{ background:"linear-gradient(180deg,#0c1124 0%,#0a0a12 100%)", borderRadius:10, overflow:"hidden", margin:"14px 0 0", paddingBottom:14 }}>
      <style>{`.bo-car::-webkit-scrollbar{display:none}.bo-car{scrollbar-width:none;-ms-overflow-style:none;scroll-behavior:smooth}.bo-arrow{transition:background 0.15s}.bo-arrow:active{background:rgba(0,0,0,0.78)}@keyframes boFade{from{opacity:.35}to{opacity:1}}`}</style>

      {/* 히어로 — 최신작 자동 슬라이드, 이미지가 배경으로 페이드 */}
      <div onClick={() => onOpen(hero)} style={{ cursor:"pointer" }}>
        <div key={heroIdx} style={{ animation:"boFade .6s ease" }}>
          <div style={{ position:"relative", aspectRatio:"16/10", background:"#10152a" }}>
            {heroYt && <YtThumb id={heroYt} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(12,17,36,0) 35%, rgba(12,17,36,0.6) 72%, #0c1124 100%)" }} />
          </div>
          <div style={{ position:"relative", marginTop:-54, padding:"0 14px", zIndex:1 }}>
            <div style={{ fontFamily:"'Courier New', monospace", fontSize:9, color:"#a78bfa", letterSpacing:"0.25em", fontWeight:700, marginBottom:6 }}>FEATURED</div>
            <div style={{ fontSize:22, fontWeight:700, color:"#fafaf9", marginBottom:5, lineHeight:1.2 }}>{hero.title}</div>
            <div style={{ fontSize:11, color:"#a8adc4", marginBottom:6 }}>
              {[(hero.genres||[]).join(" · "), hero.runtime, hero.prodDate].filter(Boolean).join(" · ")}
            </div>
            {hero.oneLiner && (
              <div style={{ fontSize:11.5, color:"#c6cadb", marginBottom:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{hero.oneLiner}</div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop: hero.oneLiner ? 0 : 12 }}>
              <button onClick={(e) => { e.stopPropagation(); onPlay(heroYt); }}
                style={{ background:"linear-gradient(90deg,#3b82f6,#7c3aed)", color:"#fff", fontSize:13, fontWeight:700, padding:"10px 26px", borderRadius:12, border:"none", cursor:"pointer", boxShadow:"0 4px 16px rgba(88,101,242,0.35)" }}>▶ 재생하기</button>
              <button onClick={(e) => { e.stopPropagation(); onOpen(hero); }}
                style={{ width:38, height:38, borderRadius:"50%", background:"rgba(255,255,255,0.12)", color:"#fafaf9", fontSize:15, border:"1px solid rgba(255,255,255,0.18)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>ⓘ</button>
            </div>
          </div>
        </div>
      </div>
      {/* 슬라이드 점 인디케이터 — 히어로 아래 중앙 */}
      {heroItems.length > 1 && (
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:14 }}>
          {heroItems.map((_, i) => (
            <span key={i} onClick={() => setHeroIdx(i)}
              style={{ width: i===heroIdx ? 18 : 6, height:6, borderRadius:3, background: i===heroIdx ? BO_BLUE : "rgba(255,255,255,0.25)", transition:"all .25s", cursor:"pointer" }} />
          ))}
        </div>
      )}

      <CarouselRow title="최신작" items={byDate} onOpen={onOpen} showNew onAll={() => setAllView({ title:"최신작", items:byDate, showNew:true })} />
      <CarouselRow title="인기작" badge items={byViews} onOpen={onOpen} ranked onAll={() => setAllView({ title:"인기작 TOP 10", items:byViews, ranked:true })} />
      {genreRows.map(([g, arr]) => (
        <CarouselRow key={g} title={g} items={arr} onOpen={onOpen} onAll={() => setAllView({ title:g, items:arr })} />
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
      <YtThumb id={id} alt="작품 썸네일"
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
