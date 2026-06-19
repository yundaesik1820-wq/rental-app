import { useState, useRef, useEffect } from "react";
import { storage } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useCollection, addItem, updateItem, deleteItem } from "../hooks/useFirestore";
import { useAuth } from "../hooks/useAuth.jsx";

/* ───────────── 팔레트 (시네마 다크 + 디스패치 레드) ───────────── */
const RED = "#ED1B2F", GOLD = "#fbbf24";
const OVERLAY_BG = "#0A0A0A";
const SURFACE = "#161616", SURF2 = "#1f1f1f", BORDER = "#2a2a2a", LINE = "#262626";
const TEXT = "#fafaf9", SUB = "#D9DEE8", MUTED = "#a8a29e", DIM = "#71706b";

/* 태그 정의 */
const TAGS = [
  { key: "단독",   color: RED,        solid: true },
  { key: "포착",   color: "#f472b6" },
  { key: "현장",   color: "#60a5fa" },
  { key: "인터뷰", color: "#4ade80" },
  { key: "공지",   color: "#cbd5e1" },
];
const tagStyle = (key) => {
  const t = TAGS.find(x => x.key === key) || TAGS[0];
  return t.solid
    ? { background: t.color, color: "#fff" }
    : { background: t.color + "29", color: t.color };
};

/* 텍스트 색상 팔레트 */
const TEXT_COLORS = ["#fafaf9", RED, GOLD, "#60a5fa", "#4ade80", "#a8a29e"];

/* 유튜브 URL → embed id */
function ytId(url) {
  if (!url) return "";
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

let _bid = 0;
const newBlock = (type) => {
  _bid += 1;
  const id = `b${Date.now()}_${_bid}`;
  if (type === "image")   return { id, type, url: "", caption: "", uploading: false, progress: 0 };
  if (type === "video")   return { id, type, url: "", embedId: "" };
  if (type === "divider") return { id, type };
  return { id, type: "text", text: "", style: type === "heading" ? "heading" : type === "quote" ? "quote" : "body", align: "left", color: "" };
};

/* ════════════════════════ 메인 ════════════════════════ */
export default function ScenePatch() {
  const { user, profile } = useAuth();
  const { data: articles, loading } = useCollection("scenepatchArticles");

  const adminRole = profile?.adminRole || "super"; // App.jsx와 동일: 미설정 관리자는 super 취급
  const isAdminWriter = profile?.role === "admin" &&
    (adminRole === "super" || adminRole === "assistant");
  const isReporter = profile?.reporterStatus === "approved"; // 2단계에서 연결
  const canWrite = isAdminWriter || isReporter;

  const [view, setView]       = useState("feed"); // feed | editor | article
  const [current, setCurrent] = useState(null);   // 보고있는 기사
  const [filter, setFilter]   = useState("전체");

  const openArticle = (a) => {
    setCurrent(a);
    setView("article");
    // 조회수 +1 (비원자적, 단순 증가)
    updateItem("scenepatchArticles", a.id, { views: (a.views || 0) + 1 }).catch(() => {});
  };

  const shown = filter === "전체" ? articles : articles.filter(a => a.tag === filter);
  const HERO_MAX = 5; // 히어로 슬라이드 개수 (최신 N개)
  const heroSlides = shown.slice(0, Math.min(HERO_MAX, shown.length));
  // "오늘의 씬"엔 항상 전체 기사를 최신순으로 (히어로는 그 중 상단 N개를 헤드라인 슬라이드로 강조).
  // → 기사가 적어도 밑 목록이 비지 않음. 뉴스앱처럼 상단 슬라이드와 일부 겹침.
  const rest = shown;

  return (
    <div style={{ paddingTop: 6 }}>
      {/* 마스트헤드 */}
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.04em", color: TEXT, lineHeight: 1 }}>
          SCENE<span style={{ color: RED }}>PATCH</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, fontSize: 11, color: MUTED, fontWeight: 600 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: RED, fontWeight: 800 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: RED, display: "inline-block" }} />씬스패치
          </span>
          <span>·</span><span>영상계열 단독</span>
        </div>
        <div style={{ height: 3, background: RED, marginTop: 10 }} />
      </div>

      {/* 관리자: 기자단 신청 관리 */}
      {isAdminWriter && <ReporterAdminButton />}

      {/* 태그 필터 */}
      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 12 }}>
        {["전체", ...TAGS.map(t => t.key)].map(t => {
          const on = filter === t;
          return (
            <span key={t} onClick={() => setFilter(t)}
              style={{
                flex: "0 0 auto", fontSize: 12, fontWeight: 700, padding: "6px 13px", borderRadius: 18, cursor: "pointer",
                color: on ? "#fff" : MUTED, background: on ? RED : "#1a1a1a", border: `1px solid ${on ? RED : BORDER}`,
              }}>{t}</span>
          );
        })}
      </div>

      {/* 본문 */}
      {loading ? (
        <div style={{ textAlign: "center", color: DIM, fontSize: 13, padding: "40px 0" }}>불러오는 중…</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", color: DIM, fontSize: 13, padding: "44px 16px", lineHeight: 1.7 }}>
          <div style={{ fontSize: 30, marginBottom: 10, opacity: .5 }}>📡</div>
          아직 등록된 기사가 없어요.
          {canWrite && <div style={{ marginTop: 4 }}>우하단 버튼으로 첫 기사를 써보세요.</div>}
        </div>
      ) : (
        <>
          {/* 히어로 슬라이드 */}
          {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} onOpen={openArticle} />}

          {/* 섹션 라벨 */}
          {rest.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0 2px" }}>
              <span style={{ width: 3, height: 13, background: RED, borderRadius: 2 }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: MUTED, letterSpacing: "0.06em" }}>오늘의 씬</span>
            </div>
          )}

          {/* 나머지 카드 */}
          {rest.map((a, i) => (
            <div key={a.id} onClick={() => openArticle(a)}
              style={{ display: "flex", gap: 13, padding: "15px 0", borderBottom: i < rest.length - 1 ? `1px solid ${LINE}` : "none", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 6, ...tagStyle(a.tag) }}>{a.tag}</span>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT, lineHeight: 1.4, marginTop: 9, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{a.title}</div>
                <Meta a={a} />
              </div>
              <div style={{ flex: "0 0 78px", height: 78, borderRadius: 11, background: SURF2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {a.thumbnail
                  ? <img src={a.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 20, opacity: .5 }}>📰</span>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 글쓰기 FAB (작성 권한자만) */}
      {canWrite && view === "feed" && (
        <button onClick={() => setView("editor")}
          style={{
            position: "fixed", right: 18, bottom: "calc(20px + env(safe-area-inset-bottom, 0px))", zIndex: 6000,
            width: 60, height: 60, borderRadius: 18,
            background: RED, color: "#fff", border: "none", fontSize: 26, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 6px 20px rgba(237,27,47,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="기사 작성">✏</button>
      )}

      {/* 에디터 (전체화면 오버레이) */}
      {view === "editor" && (
        <Editor
          author={{ uid: user?.uid, name: profile?.name || "기자", role: profile?.adminRole || profile?.role || "reporter" }}
          onClose={() => setView("feed")}
        />
      )}

      {/* 기사 상세 (전체화면 오버레이) */}
      {view === "article" && current && (
        <Article
          article={current}
          canManage={isAdminWriter || current.authorUid === user?.uid}
          onClose={() => { setView("feed"); setCurrent(null); }}
        />
      )}
    </div>
  );
}

/* ───────────── 히어로 캐러셀 (슬라이드) ───────────── */
function HeroCarousel({ slides, onOpen }) {
  const [idx, setIdx] = useState(0);
  const n = slides.length;
  const touchX = useRef(null);

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % n), 4500);
    return () => clearInterval(t);
  }, [n]);
  useEffect(() => { if (idx >= n) setIdx(0); }, [n, idx]);

  const onStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40 && n > 1) setIdx(i => (i + (dx < 0 ? 1 : -1) + n) % n);
    touchX.current = null;
  };

  const fmtDate = (a) => {
    const d = a.createdAt?.toDate ? a.createdAt.toDate() : null;
    return d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}` : "방금";
  };

  return (
    <div style={{ position: "relative", marginBottom: 14, borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER}` }}
      onTouchStart={onStart} onTouchEnd={onEnd}>
      <div style={{ display: "flex", transform: `translateX(-${idx * 100}%)`, transition: "transform 0.4s ease" }}>
        {slides.map(a => (
          <div key={a.id} onClick={() => onOpen(a)}
            style={{ flex: "0 0 100%", position: "relative", height: 210, cursor: "pointer", background: SURF2 }}>
            {a.thumbnail
              ? <img src={a.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, opacity: .3 }}>🎞️</div>}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 52%, rgba(0,0,0,0) 100%)" }} />
            <span style={{ position: "absolute", top: 12, left: 12, fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 5, ...tagStyle(a.tag) }}>{a.tag}</span>
            <div style={{ position: "absolute", left: 14, right: 14, bottom: 26 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", lineHeight: 1.32,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</div>
              <div style={{ display: "flex", gap: 7, marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.82)", fontWeight: 600, flexWrap: "wrap" }}>
                <span>{a.byline?.trim() || `${a.authorName || "작성자"} 기자`}</span><span>·</span>
                <span>{fmtDate(a)}</span><span>·</span>
                <span>👁 {a.views || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {n > 1 && (
        <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
          {slides.map((_, i) => (
            <span key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? RED : "rgba(255,255,255,0.45)", transition: "all .3s", cursor: "pointer" }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── 메타 (날짜·조회·댓글) ───────────── */
function Meta({ a, hot }) {
  const d = a.createdAt?.toDate ? a.createdAt.toDate() : null;
  const ds = d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}` : "방금";
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 9, fontSize: 11, color: DIM, fontWeight: 600, flexWrap: "wrap" }}>
      {hot && <><span style={{ color: GOLD, fontWeight: 800 }}>HOT</span><span>·</span></>}
      <span>{a.byline?.trim() || `${a.authorName || "작성자"} 기자`}</span><span>·</span>
      <span>{ds}</span><span>·</span>
      <span>👁 {a.views || 0}</span>
    </div>
  );
}

/* ════════════════════════ 에디터 ════════════════════════ */
function Editor({ author, onClose }) {
  const [tag, setTag]       = useState("단독");
  const [title, setTitle]   = useState("");
  const [blocks, setBlocks] = useState([newBlock("text")]);
  const [focusedId, setFocusedId] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [byline, setByline] = useState("");
  const [isRecruit, setIsRecruit] = useState(false);
  const fileRef = useRef(null);

  const patch  = (id, p) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...p } : b));
  const remove = (id)    => setBlocks(bs => (bs.length > 1 ? bs.filter(b => b.id !== id) : bs));
  const move   = (id, dir) => setBlocks(bs => {
    const i = bs.findIndex(b => b.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= bs.length) return bs;
    const c = [...bs]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const add = (type) => setBlocks(bs => [...bs, newBlock(type)]);

  const focused = blocks.find(b => b.id === focusedId && b.type === "text");

  /* 사진 업로드 */
  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const blk = newBlock("image");
    blk.uploading = true;
    setBlocks(bs => [...bs, blk]);
    const sref = ref(storage, `scenepatch/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sref, file);
    task.on("state_changed",
      (s) => patch(blk.id, { progress: Math.round((s.bytesTransferred / s.totalBytes) * 100) }),
      ()  => patch(blk.id, { uploading: false }),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        patch(blk.id, { url, uploading: false, progress: 100 });
      }
    );
  };

  const addVideo = () => {
    const url = window.prompt("유튜브 영상 주소를 붙여넣어 주세요");
    const id = ytId(url || "");
    if (!id) { if (url) window.alert("유튜브 주소를 인식하지 못했어요."); return; }
    setBlocks(bs => [...bs, { ...newBlock("video"), url, embedId: id }]);
  };

  const publish = async () => {
    if (!title.trim()) { window.alert("제목을 입력해 주세요."); return; }
    const clean = blocks.filter(b =>
      (b.type === "text" && b.text.trim()) ||
      (b.type === "image" && b.url) ||
      (b.type === "video" && b.embedId) ||
      b.type === "divider"
    );
    if (clean.length === 0) { window.alert("내용을 입력해 주세요."); return; }
    if (blocks.some(b => b.type === "image" && b.uploading)) { window.alert("사진 업로드가 끝날 때까지 기다려 주세요."); return; }
    const thumbnail = clean.find(b => b.type === "image" && b.url)?.url || "";
    setPublishing(true);
    try {
      await addItem("scenepatchArticles", {
        tag, title: title.trim(), blocks: clean, thumbnail, byline: byline.trim(), isRecruit,
        authorUid: author.uid || "", authorName: author.name, authorRole: author.role, views: 0,
      });
      onClose();
    } catch (err) {
      console.warn("발행 실패:", err);
      window.alert("발행에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setPublishing(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: OVERLAY_BG, display: "flex", flexDirection: "column" }}>
      {/* 상단바 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top,0px) + 10px) 16px 12px", borderBottom: `1px solid ${LINE}`, flex: "0 0 auto" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }} aria-label="닫기">✕</button>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: TEXT }}>
          <span style={{ color: RED, fontWeight: 900, letterSpacing: "0.04em" }}>SCENEPATCH</span> 기사 작성
        </span>
        <button onClick={publish} disabled={publishing}
          style={{ background: RED, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, padding: "7px 16px", borderRadius: 8, cursor: "pointer", opacity: publishing ? .6 : 1 }}>
          {publishing ? "발행 중…" : "발행"}
        </button>
      </div>

      {/* 텍스트 서식 바 (텍스트 블록 포커스 시) */}
      {focused && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderBottom: `1px solid ${LINE}`, overflowX: "auto", flex: "0 0 auto", background: "#0E0E0E" }}>
          {[["본문", "body"], ["제목", "heading"], ["인용", "quote"]].map(([lbl, st]) => (
            <button key={st} onClick={() => patch(focused.id, { style: st })}
              style={fmtBtn(focused.style === st)}>{lbl}</button>
          ))}
          <span style={{ width: 1, height: 18, background: BORDER, flex: "0 0 auto" }} />
          {[["좌", "left"], ["중", "center"], ["우", "right"]].map(([lbl, al]) => (
            <button key={al} onClick={() => patch(focused.id, { align: al })}
              style={fmtBtn(focused.align === al)}>{lbl}</button>
          ))}
          <span style={{ width: 1, height: 18, background: BORDER, flex: "0 0 auto" }} />
          {TEXT_COLORS.map(col => (
            <button key={col} onMouseDown={(e) => { e.preventDefault(); patch(focused.id, { color: focused.color === col ? "" : col }); }}
              style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", background: col, border: focused.color === col ? "2px solid #fff" : `1px solid ${BORDER}`, cursor: "pointer", padding: 0 }} aria-label="색상" />
          ))}
        </div>
      )}

      {/* 본문 편집 영역 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
        {/* 태그 */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
          {TAGS.map(t => {
            const on = tag === t.key;
            return (
              <span key={t.key} onClick={() => setTag(t.key)}
                style={{ fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                  color: on ? "#fff" : MUTED, background: on ? RED : SURFACE, border: `1px solid ${on ? RED : BORDER}` }}>{t.key}</span>
            );
          })}
        </div>

        {/* 기자단 모집 공고 토글 */}
        <div onClick={() => setIsRecruit(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", marginBottom: 16, borderRadius: 10,
            background: isRecruit ? "rgba(237,27,47,0.1)" : SURFACE, border: `1px solid ${isRecruit ? RED : BORDER}`, cursor: "pointer" }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center",
            border: `2px solid ${isRecruit ? RED : DIM}`, background: isRecruit ? RED : "transparent", color: "#fff", fontSize: 13 }}>{isRecruit ? "✓" : ""}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>📋 기자단 모집 공고로 등록</div>
            <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>켜면 이 기사 하단에 "기자단 신청하기" 버튼이 생겨요.</div>
          </div>
        </div>

        {/* 제목 */}
        <textarea value={title} onChange={(e) => { setTitle(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          placeholder="제목을 입력하세요"
          rows={1}
          style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", overflow: "hidden",
            color: TEXT, fontSize: 22, fontWeight: 900, lineHeight: 1.35, fontFamily: "inherit", padding: 0,
            borderBottom: `1px solid ${LINE}`, paddingBottom: 14, marginBottom: 16 }} />

        {/* 블록들 */}
        {blocks.map(b => (
          <Block key={b.id} b={b} patch={patch} remove={remove} move={move} setFocusedId={setFocusedId} />
        ))}

        {/* 기자명 (바이라인) */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: DIM, letterSpacing: "0.06em", marginBottom: 8 }}>기자명 (바이라인)</div>
          <input value={byline} onChange={(e) => setByline(e.target.value)}
            placeholder={`${author.name || "기자명"} 기자`}
            style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, outline: "none",
              color: TEXT, fontSize: 14, fontWeight: 700, fontFamily: "inherit", padding: "10px 12px" }} />
          <div style={{ fontSize: 11, color: DIM, marginTop: 6 }}>비워두면 "{author.name || "작성자"} 기자"로 자동 표시돼요.</div>
        </div>
      </div>

      {/* 하단 글감 바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 12px calc(env(safe-area-inset-bottom,0px) + 14px)", borderTop: `1px solid ${LINE}`, background: "#0E0E0E", flex: "0 0 auto" }}>
        <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={handlePhoto} />
        <ToolBtn icon="📷" label="사진"  onClick={() => fileRef.current?.click()} accent />
        <span style={{ width: 1, height: 26, background: BORDER, margin: "0 4px" }} />
        <ToolBtn icon="T"  label="제목"   onClick={() => add("heading")} bold />
        <ToolBtn icon="❝"  label="인용"   onClick={() => add("quote")} />
        <ToolBtn icon="―"  label="구분선" onClick={() => add("divider")} />
        <ToolBtn icon="▶"  label="동영상" onClick={addVideo} />
      </div>
    </div>
  );
}

const fmtBtn = (on) => ({
  flex: "0 0 auto", fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 7, cursor: "pointer",
  color: on ? "#fff" : MUTED, background: on ? RED : "transparent", border: `1px solid ${on ? RED : BORDER}`,
});

function ToolBtn({ icon, label, onClick, accent, bold }) {
  return (
    <button onClick={onClick}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", borderRadius: 10,
        background: "none", border: "none", cursor: "pointer", color: accent ? RED : MUTED }}>
      <span style={{ fontSize: 18, lineHeight: 1, fontWeight: bold ? 900 : 400, fontStyle: bold ? "italic" : "normal" }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

/* ───────────── 개별 블록 (편집용) ───────────── */
function Block({ b, patch, remove, move, setFocusedId }) {
  if (b.type === "divider") {
    return (
      <div style={{ position: "relative", margin: "6px 0 18px" }}>
        <div style={{ height: 1, background: BORDER }} />
        <BlockTools onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} onDel={() => remove(b.id)} />
      </div>
    );
  }
  if (b.type === "image") {
    return (
      <div style={{ position: "relative", marginBottom: 18 }}>
        <div style={{ borderRadius: 12, overflow: "hidden", background: SURF2, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {b.uploading
            ? <div style={{ color: MUTED, fontSize: 13, padding: 30 }}>업로드 중… {b.progress}%</div>
            : b.url
              ? <img src={b.url} alt="" style={{ width: "100%", display: "block" }} />
              : <div style={{ color: DIM, fontSize: 13, padding: 30 }}>이미지를 불러오지 못했어요</div>}
        </div>
        {!b.uploading && (
          <input value={b.caption} onChange={(e) => patch(b.id, { caption: e.target.value })}
            placeholder="사진 설명 (선택)"
            style={{ width: "100%", textAlign: "center", background: "none", border: "none", outline: "none",
              color: MUTED, fontSize: 12.5, fontStyle: "italic", marginTop: 9, fontFamily: "inherit" }} />
        )}
        <BlockTools onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} onDel={() => remove(b.id)} />
      </div>
    );
  }
  if (b.type === "video") {
    return (
      <div style={{ position: "relative", marginBottom: 18 }}>
        <div style={{ borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "16 / 9" }}>
          <iframe src={`https://www.youtube.com/embed/${b.embedId}`} title="video" frameBorder="0" allowFullScreen
            style={{ width: "100%", height: "100%", border: "none" }} />
        </div>
        <BlockTools onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} onDel={() => remove(b.id)} />
      </div>
    );
  }
  // text
  const styleMap = {
    body:    { fontSize: 15, fontWeight: 400, lineHeight: 1.8 },
    heading: { fontSize: 19, fontWeight: 900, lineHeight: 1.45 },
    quote:   { fontSize: 15, fontWeight: 400, lineHeight: 1.8, fontStyle: "italic", borderLeft: `3px solid ${RED}`, paddingLeft: 12 },
  };
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <textarea
        value={b.text}
        onFocus={() => setFocusedId(b.id)}
        onChange={(e) => { patch(b.id, { text: e.target.value }); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
        placeholder="내용을 입력하세요…"
        rows={1}
        style={{
          width: "100%", background: "none", border: "none", outline: "none", resize: "none", overflow: "hidden",
          fontFamily: "inherit", padding: 0, color: b.color || SUB, textAlign: b.align,
          ...styleMap[b.style],
        }} />
    </div>
  );
}

function BlockTools({ onUp, onDown, onDel }) {
  const s = { width: 28, height: 28, borderRadius: 7, background: "rgba(10,10,10,0.82)", border: `1px solid ${BORDER}`, color: "#E5E9F0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 5 }}>
      <button onClick={onUp} style={s} aria-label="위로">↑</button>
      <button onClick={onDown} style={s} aria-label="아래로">↓</button>
      <button onClick={onDel} style={{ ...s, color: "#ff6b6b" }} aria-label="삭제">✕</button>
    </div>
  );
}

/* ════════════════════════ 기사 상세 ════════════════════════ */
function Article({ article, canManage, onClose }) {
  const a = article;
  const d = a.createdAt?.toDate ? a.createdAt.toDate() : null;
  const ds = d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}` : "방금";

  const del = async () => {
    if (!window.confirm("이 기사를 삭제할까요?")) return;
    try { await deleteItem("scenepatchArticles", a.id); onClose(); }
    catch { window.alert("삭제에 실패했어요."); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: OVERLAY_BG, display: "flex", flexDirection: "column" }}>
      {/* 상단바 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top,0px) + 10px) 16px 12px", borderBottom: `1px solid ${LINE}`, flex: "0 0 auto" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} aria-label="뒤로">
          <span style={{ color: RED }}>←</span><span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>SCENEPATCH</span>
        </button>
        {canManage && (
          <button onClick={del} style={{ background: "none", border: "none", color: "#ff6b6b", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>삭제</button>
        )}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 60px" }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 6, ...tagStyle(a.tag) }}>{a.tag}</span>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: TEXT, lineHeight: 1.4, margin: "12px 0 0" }}>{a.title}</h1>
        <div style={{ display: "flex", gap: 8, marginTop: 11, fontSize: 12, color: DIM, fontWeight: 600, flexWrap: "wrap" }}>
          <span>{a.byline?.trim() || `${a.authorName || "작성자"} 기자`}</span><span>·</span><span>{ds}</span><span>·</span><span>👁 {a.views || 0}</span>
        </div>
        <div style={{ height: 1, background: LINE, margin: "16px 0 4px" }} />

        {(a.blocks || []).map((b, i) => <ReadBlock key={i} b={b} />)}

        {a.isRecruit && <ApplySection article={a} />}

        {/* 바이라인 */}
        <div style={{ marginTop: 30, paddingTop: 16, borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT }}>{a.byline?.trim() || `${a.authorName || "작성자"} 기자`}</span>
          <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.04em", color: RED }}>SCENEPATCH</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 개별 블록 (읽기용) ───────────── */
function ReadBlock({ b }) {
  if (b.type === "divider") return <div style={{ height: 1, background: BORDER, margin: "18px 0" }} />;
  if (b.type === "image") {
    return (
      <figure style={{ margin: "18px 0" }}>
        {b.url && <img src={b.url} alt="" style={{ width: "100%", borderRadius: 12, display: "block" }} />}
        {b.caption && <figcaption style={{ textAlign: "center", fontSize: 12.5, color: DIM, fontStyle: "italic", marginTop: 9 }}>{b.caption}</figcaption>}
      </figure>
    );
  }
  if (b.type === "video") {
    return (
      <div style={{ margin: "18px 0", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "16 / 9" }}>
        <iframe src={`https://www.youtube.com/embed/${b.embedId}`} title="video" frameBorder="0" allowFullScreen style={{ width: "100%", height: "100%", border: "none" }} />
      </div>
    );
  }
  const styleMap = {
    body:    { fontSize: 15.5, fontWeight: 400, lineHeight: 1.85, margin: "16px 0" },
    heading: { fontSize: 19, fontWeight: 900, lineHeight: 1.45, margin: "22px 0 12px" },
    quote:   { fontSize: 15.5, fontWeight: 400, lineHeight: 1.85, fontStyle: "italic", borderLeft: `3px solid ${RED}`, paddingLeft: 14, margin: "18px 0" },
  };
  return <p style={{ color: b.color || SUB, textAlign: b.align || "left", whiteSpace: "pre-wrap", ...styleMap[b.style || "body"] }}>{b.text}</p>;
}

/* ════════════════════════ 기자단 신청 (학생) ════════════════════════ */
function ApplySection({ article }) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState(profile?.reporterStatus || "none");
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isStudent = !["admin", "professor", "teacher"].includes(profile?.role);
  const box = { marginTop: 26, padding: "16px 16px", borderRadius: 12, background: "rgba(237,27,47,0.07)", border: "1px solid rgba(237,27,47,0.3)" };
  const btn = { marginTop: 14, width: "100%", background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };

  if (!isStudent) {
    return (
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>📋 기자단 모집 중</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>학생만 신청할 수 있어요.</div>
      </div>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      await addItem("reporterApplications", {
        uid: user?.uid || "",
        name: profile?.name || "",
        studentId: profile?.studentId || "",
        dept: profile?.dept || "",
        reason: reason.trim(),
        status: "pending",
        articleId: article.id || "",
        articleTitle: article.title || "",
      });
      await updateItem("users", user.uid, { reporterStatus: "pending" }).catch(() => {});
      setStatus("pending");
      setShowForm(false);
    } catch (e) {
      console.warn("기자단 신청 실패:", e);
      window.alert("신청에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
    setSubmitting(false);
  };

  if (status === "approved")
    return <div style={box}><div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>✓ 이미 기자단이에요</div></div>;
  if (status === "pending")
    return <div style={box}><div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>📨 신청 완료 — 관리자 검토 중</div></div>;

  return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>📋 씬스패치 기자단 모집</div>
      {status === "rejected" && <div style={{ fontSize: 11.5, color: "#ff6b6b", marginTop: 6 }}>지난 신청은 반려됐어요. 다시 신청할 수 있어요.</div>}
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.6 }}>승인되면 직접 기사를 작성할 수 있어요.</div>
      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={btn}>기자단 신청하기</button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="지원 동기를 간단히 적어주세요 (선택)" rows={3}
            style={{ width: "100%", background: OVERLAY_BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13, padding: "10px 12px", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setShowForm(false)} style={{ ...btn, marginTop: 0, flex: 1, background: "transparent", color: MUTED, border: `1px solid ${BORDER}` }}>취소</button>
            <button onClick={submit} disabled={submitting} style={{ ...btn, marginTop: 0, flex: 2, opacity: submitting ? .6 : 1 }}>{submitting ? "전송 중…" : "신청서 제출"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════ 기자단 신청 관리 (관리자) ════════════════════════ */
function ReporterAdminButton() {
  const { data: apps } = useCollection("reporterApplications");
  const [open, setOpen] = useState(false);
  const pending = apps.filter(a => a.status === "pending");
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>📋 기자단 신청 관리</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pending.length > 0 && <span style={{ background: RED, color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "2px 8px" }}>{pending.length}</span>}
          <span style={{ color: DIM, fontSize: 16 }}>›</span>
        </span>
      </button>
      {open && <ReporterAdminPanel apps={apps} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReporterAdminPanel({ apps, onClose }) {
  const [busy, setBusy] = useState("");
  const act = async (app, decision) => {
    setBusy(app.id);
    try {
      await updateItem("reporterApplications", app.id, { status: decision });
      await updateItem("users", app.uid, { reporterStatus: decision }).catch(() => {});
    } catch (e) {
      console.warn("기자단 처리 실패:", e);
      window.alert("처리에 실패했어요.");
    }
    setBusy("");
  };
  const order = { pending: 0, approved: 1, rejected: 2 };
  const sorted = [...apps].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  const fmt = (a) => {
    const d = a.createdAt?.toDate ? a.createdAt.toDate() : null;
    return d ? `${d.getMonth() + 1}.${d.getDate()}` : "";
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9100, background: OVERLAY_BG, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top,0px) + 10px) 16px 12px", borderBottom: `1px solid ${LINE}` }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>📋 기자단 신청 관리</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }} aria-label="닫기">✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 40px" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: DIM, fontSize: 13, padding: "40px 0" }}>아직 신청자가 없어요.</div>
        ) : sorted.map(app => (
          <div key={app.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{app.name || "이름없음"} <span style={{ fontSize: 12, fontWeight: 600, color: DIM }}>{app.studentId}</span></div>
              <StatusBadge status={app.status} />
            </div>
            {(app.dept || fmt(app)) && <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{app.dept}{app.dept && fmt(app) ? " · " : ""}{fmt(app)}</div>}
            {app.reason && <div style={{ fontSize: 13, color: SUB, marginTop: 9, lineHeight: 1.6, background: OVERLAY_BG, borderRadius: 8, padding: "9px 11px" }}>{app.reason}</div>}
            {app.status === "pending" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => act(app, "rejected")} disabled={busy === app.id}
                  style={{ flex: 1, background: "transparent", color: "#ff6b6b", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>거절</button>
                <button onClick={() => act(app, "approved")} disabled={busy === app.id}
                  style={{ flex: 2, background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: busy === app.id ? .6 : 1 }}>{busy === app.id ? "처리 중…" : "승인"}</button>
              </div>
            ) : (
              <button onClick={() => act(app, app.status === "approved" ? "rejected" : "approved")}
                style={{ marginTop: 10, width: "100%", background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {app.status === "approved" ? "승인 취소 (거절로 변경)" : "다시 승인"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:  { t: "검토 중", c: GOLD,      bg: "rgba(251,191,36,0.15)" },
    approved: { t: "승인됨",  c: "#4ade80", bg: "rgba(74,222,128,0.15)" },
    rejected: { t: "거절됨",  c: "#ff6b6b", bg: "rgba(255,107,107,0.15)" },
  };
  const s = map[status] || map.pending;
  return <span style={{ fontSize: 11, fontWeight: 800, color: s.c, background: s.bg, borderRadius: 6, padding: "3px 9px" }}>{s.t}</span>;
}
