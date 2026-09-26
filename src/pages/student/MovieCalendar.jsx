import { useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useCollection, addItem, deleteItem } from "../../hooks/useFirestore";
import { Modal } from "../../components/UI";
import {
  Plus, ChevronLeft, ChevronRight, ChevronDown, X, Search,
  Trash2, Film, Tv, BookOpen, Loader2, Users, Sparkles,
} from "lucide-react";

// ── 무비캘린더 전용 컬러(다크 + 핑크 액센트로 기능 정체성) ──
const M = {
  bg: "#0B0B0E",
  card: "#16161C",
  soft: "#1E1E26",
  border: "rgba(255,255,255,0.08)",
  text: "#ECECEE",
  sub: "#8A8A92",
  faint: "#5A5A63",
  pink: "#F472B6",
  pinkSoft: "rgba(244,114,182,0.16)",
};

const KINDS = [
  { key: "movie", label: "영화",   icon: Film,     color: "#60A5FA" },
  { key: "tv",    label: "시리즈", icon: Tv,       color: "#A78BFA" },
  { key: "book",  label: "책",     icon: BookOpen, color: "#34D399" },
];
const KIND_MAP = Object.fromEntries(KINDS.map(k => [k.key, k]));
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const todayStr = () => { const t = new Date(); return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()); };

export default function MovieCalendar({ viewUid = null, viewName = null }) {
  const { profile } = useAuth();
  // 보고 있는 대상(내 캘린더 / 친구 캘린더). 화면 안에서 친구로 전환 가능.
  const [friendSel, setFriendSel] = useState(viewUid ? { uid: viewUid, name: viewName } : null);
  const uid = friendSel?.uid || profile?.uid;
  const readOnly = !!friendSel && friendSel.uid !== profile?.uid;

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1~12
  const [filter, setFilter] = useState("all"); // all | movie | tv | book
  const [showMonthPick, setShowMonthPick] = useState(false);
  const [showFriendPick, setShowFriendPick] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(todayStr());
  const [dayOpen, setDayOpen] = useState(null); // 선택한 날짜(YYYY-MM-DD)

  // 내 친구 목록 (양방향) — 친구 캘린더 전환용
  const { data: friends } = useCollection("friends", "createdAt");
  const myFriends = useMemo(() => (
    friends
      .filter(f => f.userId === profile?.uid || f.friendId === profile?.uid)
      .map(f => { const mine = f.userId === profile?.uid; return { uid: mine ? f.friendId : f.userId, name: mine ? f.friendName : f.userName }; })
      .filter(f => f.uid)
  ), [friends, profile?.uid]);

  // 내(또는 친구) 기록 — where 단독(인덱스 불필요), 월/타입 필터는 클라에서
  const { data: logs } = useCollection("mediaLogs", null, {
    where: [["userId", "==", uid || "__none__"]],
    enabled: !!uid,
  });

  const monthPrefix = `${year}-${pad2(month)}`;
  const monthLogs = useMemo(
    () => logs.filter(l => (l.date || "").startsWith(monthPrefix)),
    [logs, monthPrefix]
  );
  const shown = filter === "all" ? monthLogs : monthLogs.filter(l => l.type === filter);

  // 날짜별 그룹
  const byDay = useMemo(() => {
    const map = {};
    for (const l of shown) {
      const d = parseInt((l.date || "").slice(8, 10), 10);
      if (!d) continue;
      (map[d] = map[d] || []).push(l);
    }
    return map;
  }, [shown]);

  // 월 통계
  const stat = useMemo(() => {
    const s = { movie: 0, tv: 0, book: 0 };
    for (const l of monthLogs) if (s[l.type] != null) s[l.type]++;
    return s;
  }, [monthLogs]);

  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const goPrev = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const goNext = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };

  const openAddFor = (dateStr) => { setAddDate(dateStr); setDayOpen(null); setAddOpen(true); };
  const handleDelete = async (id) => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    await deleteItem("mediaLogs", id);
  };

  return (
    <div style={{ color: M.text, fontFamily: "'Pretendard', -apple-system, 'Malgun Gothic', sans-serif", position: "relative", minHeight: "60vh" }}>
      {/* 헤더: 월 이동 + 이번 달 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={goPrev} style={iconBtn}><ChevronLeft size={20} color={M.sub} /></button>
          <button onClick={() => setShowMonthPick(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "4px 6px", fontFamily: "inherit" }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: M.text }}>{year}년 {month}월</span>
            <ChevronDown size={17} color={M.sub} />
          </button>
          <button onClick={goNext} style={iconBtn}><ChevronRight size={20} color={M.sub} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!isThisMonth && (
            <button onClick={goToday}
              style={{ background: "none", border: "none", color: M.pink, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              이번 달
            </button>
          )}
          {readOnly ? (
            <button onClick={() => setFriendSel(null)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: M.pinkSoft, border: `1px solid ${M.pink}44`, borderRadius: 999, color: M.pink, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", padding: "5px 11px" }}>
              내 캘린더
            </button>
          ) : (
            <button onClick={() => setShowFriendPick(true)} title="친구 시네로그"
              style={{ ...iconBtn, width: 34, height: 34, background: M.card, border: `1px solid ${M.border}` }}>
              <Users size={17} color={M.sub} />
            </button>
          )}
        </div>
      </div>

      {/* 친구 캘린더 표시 배너 */}
      {readOnly && (
        <div style={{ background: M.pinkSoft, border: `1px solid ${M.pink}44`, borderRadius: 12, padding: "9px 14px", marginBottom: 12, fontSize: 12.5, color: M.text }}>
          <b style={{ color: M.pink }}>{viewName || "친구"}</b>님의 시네로그
        </div>
      )}

      {/* 월 요약 배너 — 누르면 월별 결산 */}
      <button onClick={() => setShowRecap(true)}
        style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14, background: M.card, border: `1px solid ${M.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${M.pink},#c026d3)`, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 16, fontWeight: 900, color: "#fff" }}>
          {month}
        </div>
        <div style={{ display: "flex", gap: 16, flex: 1 }}>
          {KINDS.map(k => (
            <div key={k.key} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: k.color, lineHeight: 1 }}>{stat[k.key]}</div>
              <div style={{ fontSize: 10.5, color: M.sub, marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, color: M.sub }}>
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>결산</span>
          <ChevronRight size={16} color={M.sub} />
        </div>
      </button>

      {/* 필터칩 */}
      <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
        {[{ key: "all", label: "전체" }, ...KINDS].map(f => {
          const active = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: "6px 15px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${active ? M.text : M.border}`,
                background: active ? M.text : "transparent",
                color: active ? M.bg : M.sub }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {WEEK.map((w, i) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: i === 0 ? "#F87171" : i === 6 ? "#60A5FA" : M.sub }}>{w}</div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const entries = byDay[d] || [];
          const first = entries[0];
          const dateStr = ymd(year, month, d);
          const isToday = isThisMonth && d === now.getDate();
          return (
            <button key={d} onClick={() => setDayOpen(dateStr)}
              style={{ position: "relative", aspectRatio: "3 / 4", borderRadius: 8, overflow: "hidden", cursor: "pointer", padding: 0, fontFamily: "inherit",
                border: isToday ? `1.5px solid ${M.pink}` : `1px solid ${entries.length ? "transparent" : M.border}`,
                background: entries.length ? "#000" : M.card }}>
              {first?.posterUrl ? (
                <img src={first.posterUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : first ? (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: M.soft, padding: 2 }}>
                  <span style={{ fontSize: 9, color: M.text, textAlign: "center", lineHeight: 1.2, wordBreak: "keep-all", overflow: "hidden" }}>{first.title}</span>
                </div>
              ) : null}
              {/* 날짜 숫자 */}
              <span style={{ position: "absolute", top: 2, left: 4, fontSize: 10.5, fontWeight: 700,
                color: entries.length ? "#fff" : (i % 7 === 0 ? "#F87171" : i % 7 === 6 ? "#60A5FA" : M.faint),
                textShadow: entries.length ? "0 1px 3px rgba(0,0,0,0.9)" : "none" }}>{d}</span>
              {/* +N 배지 */}
              {entries.length > 1 && (
                <span style={{ position: "absolute", bottom: 3, right: 3, background: "rgba(0,0,0,0.72)", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 6, padding: "1px 5px" }}>
                  +{entries.length - 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 추가 FAB (본인 캘린더만) */}
      {!readOnly && (
        <button onClick={() => openAddFor(isThisMonth ? todayStr() : ymd(year, month, 1))}
          className="tap-spring"
          style={{ position: "fixed", right: 20, bottom: 88, width: 56, height: 56, borderRadius: "50%", zIndex: 240,
            background: `linear-gradient(135deg,${M.pink},#c026d3)`, border: "none", cursor: "pointer",
            display: "grid", placeItems: "center", boxShadow: "0 6px 20px rgba(244,114,182,0.4)" }}>
          <Plus size={26} color="#fff" strokeWidth={2.6} />
        </button>
      )}

      {/* 월 선택 모달 */}
      {showMonthPick && (
        <Modal onClose={() => setShowMonthPick(false)} width={320}>
          <div style={{ color: M.text }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setYear(year - 1)} style={iconBtn}><ChevronLeft size={20} color={M.sub} /></button>
              <span style={{ fontSize: 17, fontWeight: 900 }}>{year}년</span>
              <button onClick={() => setYear(year + 1)} style={iconBtn}><ChevronRight size={20} color={M.sub} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const active = m === month;
                return (
                  <button key={m} onClick={() => { setMonth(m); setShowMonthPick(false); }}
                    style={{ padding: "12px 0", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                      border: `1px solid ${active ? M.pink : M.border}`,
                      background: active ? M.pinkSoft : "transparent",
                      color: active ? M.pink : M.text }}>
                    {m}월
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* 날짜 상세 모달 */}
      {dayOpen && (() => {
        const d = parseInt(dayOpen.slice(8, 10), 10);
        const entries = (byDay[d] || []);
        const [yy, mm, dd] = dayOpen.split("-");
        return (
          <Modal onClose={() => setDayOpen(null)} width={380}>
            <div style={{ color: M.text }}>
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 14 }}>{parseInt(mm)}월 {parseInt(dd)}일</div>
              {entries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: M.sub, fontSize: 13 }}>이 날 기록이 없어요.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  {entries.map(e => {
                    const k = KIND_MAP[e.type] || KINDS[0];
                    return (
                      <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "center", background: M.card, borderRadius: 12, padding: 10 }}>
                        {e.posterUrl
                          ? <img src={e.posterUrl} alt="" style={{ width: 44, height: 62, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "#000" }} />
                          : <div style={{ width: 44, height: 62, borderRadius: 6, background: M.soft, display: "grid", placeItems: "center", flexShrink: 0 }}><k.icon size={18} color={k.color} /></div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: M.text, wordBreak: "break-word" }}>{e.title}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: k.color, background: `${k.color}22`, borderRadius: 5, padding: "1px 7px" }}>{k.label}</span>
                            {e.year && <span style={{ fontSize: 11, color: M.sub }}>{e.year}</span>}
                          </div>
                        </div>
                        {!readOnly && (
                          <button onClick={() => handleDelete(e.id)} style={{ ...iconBtn, flexShrink: 0 }}><Trash2 size={16} color={M.faint} /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {!readOnly && (
                <button onClick={() => openAddFor(dayOpen)}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: `1px dashed ${M.pink}66`, background: M.pinkSoft, color: M.pink, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Plus size={16} /> 이 날에 기록 추가
                </button>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* 친구 선택 모달 */}
      {showFriendPick && (
        <Modal onClose={() => setShowFriendPick(false)} width={340}>
          <div style={{ color: M.text }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 14 }}>친구 시네로그</div>
            {myFriends.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: M.sub, fontSize: 13, lineHeight: 1.7 }}>
                아직 친구가 없어요.<br />더보기 › 친구관리에서 추가해봐요.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {myFriends.map(f => (
                  <button key={f.uid} onClick={() => { setFriendSel(f); setShowFriendPick(false); setFilter("all"); }}
                    style={{ display: "flex", alignItems: "center", gap: 12, background: M.card, border: `1px solid ${M.border}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <span style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,${M.pink},#c026d3)`, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>{(f.name || "?").slice(0, 1)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: M.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <ChevronRight size={16} color={M.faint} style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 월별 결산 모달 */}
      {showRecap && (
        <Modal onClose={() => setShowRecap(false)} width={420}>
          <div style={{ color: M.text }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Sparkles size={18} color={M.pink} />
              <div style={{ fontSize: 17, fontWeight: 900 }}>{year}년 {month}월 결산</div>
            </div>
            <div style={{ fontSize: 12, color: M.sub, marginBottom: 16 }}>
              {readOnly ? `${friendSel?.name}님이 ` : ""}이 달에 {monthLogs.length}편 기록했어요{monthLogs.length ? " 🎬" : ""}
            </div>
            {monthLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: M.sub, fontSize: 13 }}>이 달 기록이 없어요.</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {KINDS.map(k => (
                    <div key={k.key} style={{ flex: 1, background: M.card, border: `1px solid ${M.border}`, borderRadius: 12, padding: "12px 0", textAlign: "center" }}>
                      <k.icon size={16} color={k.color} style={{ marginBottom: 4 }} />
                      <div style={{ fontSize: 18, fontWeight: 900, color: k.color, lineHeight: 1 }}>{stat[k.key]}</div>
                      <div style={{ fontSize: 10.5, color: M.sub, marginTop: 3 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, maxHeight: 380, overflowY: "auto" }}>
                  {[...monthLogs].sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(l => (
                    <div key={l.id} style={{ aspectRatio: "3 / 4", borderRadius: 8, overflow: "hidden", background: M.soft, position: "relative", display: "grid", placeItems: "center" }}>
                      {l.posterUrl
                        ? <img src={l.posterUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 9, color: M.sub, padding: 3, textAlign: "center" }}>{l.title}</span>}
                      <span style={{ position: "absolute", top: 3, left: 4, fontSize: 9, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{parseInt((l.date || "").slice(8, 10), 10)}일</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* 추가 모달 */}
      {addOpen && (
        <AddModal
          uid={uid}
          initialDate={addDate}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

const iconBtn = { display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "transparent", border: "none", cursor: "pointer", padding: 0 };

// ── 기록 추가 모달 (타입 선택 → 검색 → 선택 → 날짜 지정 → 저장) ──
function AddModal({ uid, initialDate, onClose }) {
  const [kind, setKind] = useState("movie");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState(null); // 선택한 결과
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);

  const doSearch = async () => {
    const query = q.trim();
    if (!query) return;
    setSearching(true); setErr(""); setResults([]);
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const fn = httpsCallable(getFunctions(undefined, "us-central1"), "searchMedia");
      const { data } = await fn({ query, kind });
      const list = (data?.results || []).filter(r => r.title);
      setResults(list);
      if (list.length === 0) setErr("검색 결과가 없어요.");
    } catch (e) {
      console.error(e);
      setErr(e?.message || "검색에 실패했어요.");
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!picked || !date || saving) return;
    setSaving(true);
    try {
      await addItem("mediaLogs", {
        userId: uid,
        date,
        type: kind,
        title: picked.title,
        posterUrl: picked.posterUrl || "",
        sourceId: picked.sourceId || "",
        year: picked.year || "",
      });
      onClose();
    } catch (e) {
      console.error(e);
      setErr("저장에 실패했어요.");
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ color: M.text }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 14 }}>기록 추가</div>

        {/* 타입 토글 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {KINDS.map(k => {
            const active = kind === k.key;
            return (
              <button key={k.key} onClick={() => { setKind(k.key); setResults([]); setPicked(null); setErr(""); }}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${active ? k.color : M.border}`,
                  background: active ? `${k.color}1f` : "transparent",
                  color: active ? k.color : M.sub }}>
                <k.icon size={15} /> {k.label}
              </button>
            );
          })}
        </div>

        {!picked ? (
          <>
            {/* 검색창 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } }}
                placeholder={`${KIND_MAP[kind].label} 제목 검색`}
                style={{ flex: 1, background: M.bg, border: `1px solid ${M.border}`, borderRadius: 10, color: M.text, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", minWidth: 0 }} />
              <button onClick={doSearch} disabled={searching}
                style={{ width: 46, borderRadius: 10, border: "none", background: `linear-gradient(135deg,${M.pink},#c026d3)`, color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
                {searching ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={18} />}
              </button>
            </div>

            {err && <div style={{ fontSize: 12, color: "#F87171", marginBottom: 10 }}>{err}</div>}

            {/* 결과 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, maxHeight: 340, overflowY: "auto" }}>
              {results.map((r, i) => (
                <button key={`${r.sourceId}-${i}`} onClick={() => { setPicked(r); setErr(""); }}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ aspectRatio: "3 / 4", borderRadius: 8, overflow: "hidden", background: M.soft, marginBottom: 5, display: "grid", placeItems: "center" }}>
                    {r.posterUrl
                      ? <img src={r.posterUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 10, color: M.sub, padding: 4, textAlign: "center" }}>{r.title}</span>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: M.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r.title}</div>
                  {r.year && <div style={{ fontSize: 10, color: M.sub, marginTop: 1 }}>{r.year}</div>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* 선택 확인 + 날짜 */}
            <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 84, aspectRatio: "3 / 4", borderRadius: 10, overflow: "hidden", background: M.soft, flexShrink: 0, display: "grid", placeItems: "center" }}>
                {picked.posterUrl
                  ? <img src={picked.posterUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 11, color: M.sub, padding: 6, textAlign: "center" }}>{picked.title}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: M.text, wordBreak: "break-word" }}>{picked.title}</div>
                {picked.year && <div style={{ fontSize: 12, color: M.sub, marginTop: 3 }}>{picked.year}</div>}
                {picked.subtitle && <div style={{ fontSize: 11.5, color: M.sub, marginTop: 3, wordBreak: "break-word" }}>{picked.subtitle}</div>}
                <button onClick={() => setPicked(null)}
                  style={{ marginTop: 8, background: "none", border: `1px solid ${M.border}`, borderRadius: 8, color: M.sub, fontSize: 11.5, fontWeight: 700, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                  다시 선택
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: M.sub, marginBottom: 6 }}>본 날짜</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width: "100%", background: M.bg, border: `1px solid ${M.border}`, borderRadius: 10, color: M.text, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
            </div>

            {err && <div style={{ fontSize: 12, color: "#F87171", marginBottom: 10 }}>{err}</div>}

            <button onClick={save} disabled={saving}
              style={{ width: "100%", padding: "12px 0", borderRadius: 11, border: "none", background: `linear-gradient(135deg,${M.pink},#c026d3)`, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
              {saving ? "저장 중..." : "기록 저장"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
