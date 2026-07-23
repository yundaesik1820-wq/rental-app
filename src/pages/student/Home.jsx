import { useState, useEffect } from "react";
import { C as BASE, NOTICE_CAT } from "../../theme";
import { REQUIRE_RETURN_PHOTOS } from "../../config";
import { Card, Badge, SectionTitle, Modal, Btn, Inp, Avatar } from "../../components/UI";
import { useCollection, addItem, deleteItem, updateItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { doc, setDoc, getDoc, query, where, getDocs, updateDoc, onSnapshot, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, auth as firebaseAuth } from "../../firebase";
import { LogOut, RefreshCw, CalendarPlus, ClipboardList, ShieldCheck, ChevronRight, CalendarDays, PlusCircle, Bot, Camera, Image as ImageIcon } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { PetHomeCard, PetOverlay } from "../../components/PetGame.jsx";

// ── 홈 전용 슬레이트 톤 (다크 유지, 포인트색만 다듬음) ──
// 배경·텍스트는 기존 다크 그대로 두고, 포인트(navy 등)만 슬레이트로 바꾼다.
const C = {
  ...BASE,
  navy: "#5b6191", // 메인 포인트 → 슬레이트 인디고
  blue: "#5b6191",
  teal: "#6aa890", // 보조 → 세이지
};

// ── 홈 전용 컬러(목업) — 홈만 파랑/보라, 나머지 화면은 흑백 유지 ──
const HOME_GRAD  = "linear-gradient(140deg,#0f1636 0%,#182655 52%,#243676 100%)";
const HOME_NAME  = "#8ea2ff"; // 이름 하이라이트

const DAYS   = ["월", "화", "수", "목", "금"];
// 시간표 다크 톤 (tlrksvy.png)
const TT = { bg: "#0d1428", border: "#1c2947", line: "#17223d", day: "#93a0bd", hour: "#5c6784", sub: "#8a93a8" };
const HOURS  = Array.from({ length: 14 }, (_, i) => i + 9); // 9~22
const SLOT_H = 28; // px per hour
const COLORS = [
  "#E57373","#64B5F6","#81C784","#FFB74D","#BA68C8",
  "#4DB6AC","#F06292","#4FC3F7","#AED581","#FF8A65",
];

const timeToFrac = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
};

// ── 시간표 그리드 컴포넌트 ──
function Timetable({ classes, onEdit, readOnly = false }) {
  const colW = `calc((100% - 36px) / 5)`;

  return (
    <div style={{ background: TT.bg, borderRadius: 14, overflow: "hidden", border: `1px solid ${TT.border}` }}>
      {/* 헤더 */}
      <div style={{ display: "flex", borderBottom: `1px solid ${TT.border}` }}>
        <div style={{ width: 30, flexShrink: 0 }} />
        {DAYS.map(d => (
          <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: TT.day, padding: "6px 0" }}>{d}</div>
        ))}
      </div>

      {/* 그리드 바디 */}
      <div style={{ position: "relative", display: "flex" }}>
        {/* 시간 라벨 */}
        <div style={{ width: 30, flexShrink: 0 }}>
          {HOURS.map(h => (
            <div key={h} style={{ height: SLOT_H, borderBottom: `1px solid ${TT.line}`, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 2 }}>
              <span style={{ fontSize: 9, color: TT.hour, lineHeight: 1 }}>{h}</span>
            </div>
          ))}
        </div>

        {/* 열 (월~금) */}
        {DAYS.map((day, di) => (
          <div key={day} style={{ flex: 1, position: "relative", borderLeft: `1px solid ${TT.line}` }}>
            {/* 시간 구분선 */}
            {HOURS.map(h => (
              <div key={h} style={{ height: SLOT_H, borderBottom: `1px solid ${TT.line}` }} />
            ))}
            {/* 수업 블록 */}
            {classes.filter(c => c.day === day).map((cls, i) => {
              const start = timeToFrac(cls.startTime) - 9;
              const end   = timeToFrac(cls.endTime)   - 9;
              const top   = start * SLOT_H;
              const height = (end - start) * SLOT_H;
              return (
                <div key={i} style={{
                  position: "absolute", left: 2, right: 2,
                  top: top, height: height,
                  background: cls.color || COLORS[i % COLORS.length],
                  borderRadius: 6, overflow: "hidden",
                  padding: "2px 4px", boxSizing: "border-box",
                  cursor: onEdit ? "pointer" : "default",
                }} onClick={onEdit ? () => onEdit(cls) : undefined}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#fff", lineHeight: 1.2, wordBreak: "keep-all" }}>{cls.name}</div>
                  {height > 22 && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.85)", marginTop: 1, lineHeight: 1.2 }}>{cls.location}</div>}
                  {height > 42 && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.75)", lineHeight: 1.2 }}>{cls.professor}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 수업 추가/편집 폼 ──
const EMPTY_CLASS = { day:"월", name:"", location:"", professor:"", startTime:"09:00", endTime:"10:00", color: COLORS[0] };

function ClassForm({ initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_CLASS);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 18 }}>
        {initial ? "수업 수정" : "수업 추가"}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>요일 *</div>
        <div style={{ display: "flex", gap: 6 }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => f("day", d)}
              style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1.5px solid ${form.day === d ? "#4d7cfe" : C.border}`, background: form.day === d ? "linear-gradient(135deg,#4d7cfe,#3b6cf8)" : C.bg, color: form.day === d ? "#fff" : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <Inp label="수업명 *" placeholder="예: 대중예술론" value={form.name} onChange={e => f("name", e.target.value)} />
      <Inp label="강의실 위치 *" placeholder="예: 1관 502호" value={form.location} onChange={e => f("location", e.target.value)} />
      <Inp label="교수님 성함" placeholder="예: 송경희 교수님" value={form.professor} onChange={e => f("professor", e.target.value)} />

      {/* 시작/종료 시간 - 10분 단위 select */}
      {(() => {
        const timeOptions = [];
        for (let h = 9; h <= 22; h++) {
          for (let m = 0; m < 60; m += 10) {
            const hh = String(h).padStart(2,"0");
            const mm = String(m).padStart(2,"0");
            timeOptions.push(`${hh}:${mm}`);
          }
        }
        const selStyle = { display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer" };
        return (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>시작 시간 *</div>
              <select value={form.startTime} onChange={e => f("startTime", e.target.value)} style={selStyle}>
                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>종료 시간 *</div>
              <select value={form.endTime} onChange={e => f("endTime", e.target.value)} style={selStyle}>
                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        );
      })()}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>색상</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {COLORS.map(col => (
            <button key={col} onClick={() => f("color", col)}
              style={{ width: 28, height: 28, borderRadius: "50%", background: col, border: form.color === col ? "3px solid #1E293B" : "3px solid transparent", cursor: "pointer", flexShrink: 0 }} />
          ))}
        </div>
      </div>

      {(() => {
        const canSave = form.name && form.location && form.startTime && form.endTime;
        const base = { padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 800, fontFamily: "inherit", boxSizing: "border-box", cursor: "pointer" };
        return (
          <div style={{ display: "flex", gap: 8 }}>
            {initial && (
              <button onClick={onDelete} style={{ ...base, flex: "0 0 auto", padding: "11px 18px", border: `1.5px solid ${C.red}66`, background: "transparent", color: C.red }}>삭제</button>
            )}
            <button onClick={onClose} style={{ ...base, flex: 1, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted }}>취소</button>
            <button onClick={() => canSave && onSave(form)} disabled={!canSave}
              style={{ ...base, flex: 1, border: "1.5px solid transparent", background: canSave ? "linear-gradient(135deg,#4d7cfe,#3b6cf8)" : C.border, color: "#fff", cursor: canSave ? "pointer" : "default", opacity: canSave ? 1 : 0.55 }}>저장</button>
          </div>
        );
      })()}
    </div>
  );
}


// ── 학점 계산기 ──
const GRADE_MAP = {
  "A+":4.5,"A":4.0,"A-":3.7,
  "B+":3.5,"B":3.0,"B-":2.7,
  "C+":2.5,"C":2.0,"C-":1.7,
  "D+":1.5,"D":1.0,
  "F":0,
};
const GRADES = Object.keys(GRADE_MAP);

function GpaCalculator({ classes = [] }) {
  const [open, setOpen]  = useState(false);
  const [rows, setRows]  = useState([{ name:"", credit:"3", grade:"A+" }]);

  const addRow = () => setRows(p => [...p, { name:"", credit:"3", grade:"A+" }]);
  const delRow = (i) => setRows(p => p.filter((_,j)=>j!==i));
  const setRow = (i,k,v) => setRows(p => p.map((r,j)=>j===i?{...r,[k]:v}:r));

  // 시간표 과목명 가져오기 — 이미 있는 건 빼고 추가(성적 보존)
  const loadFromTimetable = () => {
    const names = [...new Set((classes || []).map(c => c.name).filter(Boolean))];
    if (!names.length) return;
    setRows(prev => {
      const filled = prev.filter(r => r.name.trim());
      const exist  = new Set(filled.map(r => r.name.trim()));
      const adds   = names.filter(n => !exist.has(n)).map(n => ({ name:n, credit:"3", grade:"A+" }));
      const merged = [...filled, ...adds];
      return merged.length ? merged : [{ name:"", credit:"3", grade:"A+" }];
    });
  };
  // 처음 펼칠 때(아직 입력 전) 시간표 과목명 자동 입력
  useEffect(() => {
    if (open && rows.length === 1 && !rows[0].name) loadFromTimetable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalCredit = rows.reduce((s,r) => s+(parseFloat(r.credit)||0), 0);
  const totalPoint  = rows.reduce((s,r) => s+(parseFloat(r.credit)||0)*(GRADE_MAP[r.grade]??0), 0);
  const gpa = totalCredit > 0 ? (totalPoint/totalCredit).toFixed(2) : "0.00";
  const gpaColor = gpa>=4.0?C.teal:gpa>=3.0?C.blue:gpa>=2.0?C.yellow:C.red;

  return (
    <div style={{ marginBottom:12 }}>
      <button onClick={() => setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"linear-gradient(135deg,#141d3d,#101733)", border:"1px solid #23305c", borderRadius:open?"12px 12px 0 0":"12px", padding:"10px 16px", cursor:"pointer", fontFamily:"inherit" }}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <img src="/gpa-icon.png" alt="" style={{ width:38, height:38, borderRadius:11, objectFit:"cover", flexShrink:0, display:"block" }} />
          <div style={{ textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#fff" }}>학점 계산기</div>
            <div style={{ fontSize:10.5, color:"#93a0bd", marginTop:1 }}>본인의 학점을 계산해보세요!</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {!open && totalCredit>0 && <span style={{ fontSize:12, fontWeight:800, color:gpaColor, background:`${gpaColor}1f`, borderRadius:7, padding:"3px 8px" }}>{gpa} / 4.5</span>}
          <span style={{ fontSize:12, color:C.muted }}>{open?"▲":"▼"}</span>
        </div>
      </button>
      {open && (
        <div style={{ background:"linear-gradient(135deg,#141d3d,#101733)", border:"1px solid #23305c", borderTop:"none", borderRadius:"0 0 12px 12px", padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, background:C.bg, borderRadius:10, padding:"10px 14px" }}>
            <div>
              <div style={{ fontSize:11, color:C.muted }}>평점 평균 (4.5 기준)</div>
              <div style={{ fontSize:20, fontWeight:900, color:gpaColor }}>{gpa}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, color:C.muted }}>총 이수학점</div>
              <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{totalCredit}학점</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:4, marginBottom:6 }}>
            <div style={{ flex:3, fontSize:10, color:C.muted, fontWeight:600 }}>과목명</div>
            <div style={{ width:48, fontSize:10, color:C.muted, fontWeight:600, textAlign:"center" }}>학점</div>
            <div style={{ width:72, fontSize:10, color:C.muted, fontWeight:600, textAlign:"center" }}>등급</div>
            <div style={{ width:24 }}/>
          </div>
          {rows.map((r,i) => (
            <div key={i} style={{ display:"flex", gap:4, marginBottom:6, alignItems:"center" }}>
              <input value={r.name} onChange={e=>setRow(i,"name",e.target.value)}
                placeholder={`과목 ${i+1}`}
                style={{ flex:3, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"6px 8px", fontSize:12, fontFamily:"inherit", outline:"none", minWidth:0 }} />
              <select value={r.credit} onChange={e=>setRow(i,"credit",e.target.value)}
                style={{ width:48, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"6px 2px", fontSize:12, fontFamily:"inherit", outline:"none" }}>
                {[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
              <select value={r.grade} onChange={e=>setRow(i,"grade",e.target.value)}
                style={{ width:72, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"6px 2px", fontSize:12, fontFamily:"inherit", outline:"none" }}>
                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={()=>delRow(i)}
                style={{ width:24, height:28, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12, flexShrink:0 }}>✕</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:6, marginTop:4 }}>
            <button onClick={addRow}
              style={{ flex:1, background:"none", border:`1px dashed ${C.border}`, borderRadius:8, padding:"6px 0", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
              + 과목 추가
            </button>
            {classes.length > 0 && (
              <button onClick={loadFromTimetable}
                style={{ flex:1, background:"none", border:`1px solid ${C.teal}66`, borderRadius:8, padding:"6px 0", fontSize:12, color:C.teal, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>
                📅 시간표 불러오기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 친구관리 타일 (펫 카드 옆 반폭) ──
function FriendTile({ count, reqCount, onOpen }) {
  const [iconOk, setIconOk] = useState(true);
  return (
    <button onClick={onOpen}
      style={{ flex:1, minWidth:0, boxSizing:"border-box", position:"relative", textAlign:"left", cursor:"pointer",
        background:"linear-gradient(140deg,#16233a 0%,#1f3c66 100%)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:18, padding:"14px", display:"flex", flexDirection:"column", gap:8, fontFamily:"inherit" }}>
      {reqCount > 0 && (
        <span style={{ position:"absolute", top:10, right:10, minWidth:18, height:18, padding:"0 5px", boxSizing:"border-box",
          background:"#FF5A5A", color:"#fff", borderRadius:9, fontSize:11, fontWeight:800,
          display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>
          {reqCount > 99 ? "99+" : reqCount}
        </span>
      )}
      {iconOk ? (
        <img src="/friend-icon.png" alt="친구관리" onError={() => setIconOk(false)}
          style={{ width:46, height:46, borderRadius:"50%", objectFit:"cover", display:"block", border:"2px solid #0B0B0E", background:"#0B0B0E" }} />
      ) : (
        <div style={{ width:46, height:46, borderRadius:"50%", background:"rgba(255,255,255,0.12)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🫂</div>
      )}
      <div style={{ marginTop:"auto" }}>
        <div style={{ fontSize:14, fontWeight:900, color:"#fff" }}>친구관리</div>
        <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.62)", marginTop:3 }}>
          친구 {count}명{reqCount > 0 ? ` · 요청 ${reqCount}` : ""}
        </div>
      </div>
    </button>
  );
}

export default function StudentHome({ setTab, onOpenFriends, photoMap }) {
  const { profile, logout } = useAuth();
  const [showPet, setShowPet] = useState(false);
  const [petRefresh, setPetRefresh] = useState(0);
  const [showRules, setShowRules] = useState(false); // 대여 규칙 모달
  const [nowTick, setNowTick] = useState(0); // 1분마다 갱신 (다음 수업 카운트다운)
  useEffect(() => { const id = setInterval(() => setNowTick(t => t + 1), 60000); return () => clearInterval(id); }, []);

  // 계정 전환 (학생↔관리자)
  const switchKey = `linked_creds_${profile?.uid}`;
  const savedLinked = (() => {
    try { return JSON.parse(atob(localStorage.getItem(switchKey) || "")); } catch { return null; }
  })();
  const [switchModal2,   setSwitchModal2]   = useState(false);
  const [setupPw2,       setSetupPw2]       = useState("");
  const [switchErr2,     setSwitchErr2]     = useState("");
  const [switchLoading2, setSwitchLoading2] = useState(false);

  const handleSaveCreds2 = async () => {
    if (!setupPw2.trim()) { setSwitchErr2("비밀번호를 입력해주세요"); return; }
    setSwitchLoading2(true); setSwitchErr2("");
    try {
      await signInWithEmailAndPassword(firebaseAuth, profile?.linkedEmail, setupPw2.trim());
      localStorage.setItem(switchKey, btoa(JSON.stringify({ email: profile?.linkedEmail, pw: setupPw2.trim() })));
      setSwitchModal2(false); setSetupPw2("");
    } catch { setSwitchErr2("이메일 또는 비밀번호가 맞지 않아요"); }
    finally { setSwitchLoading2(false); }
  };

  const handleSwitch2 = async () => {
    if (!savedLinked) { setSwitchModal2(true); return; }
    setSwitchLoading2(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, savedLinked.email, savedLinked.pw);
    } catch {
      // 비밀번호 변경됐으면 저장된 정보 삭제 후 다시 입력
      localStorage.removeItem(switchKey);
      setSwitchModal2(true);
    } finally { setSwitchLoading2(false); }
  };
  const { data: allRequests }       = useCollection("rentalRequests",    "createdAt");
  const { data: notices }           = useCollection("notices",           "createdAt");
  // 받은/보낸 신청 완전 분리
  const { data: friendRequests } = useCollection("friendRequests", "createdAt");
  const { data: friends }        = useCollection("friends",        "createdAt");
  const { data: comments }          = useCollection("noticeComments",    "createdAt");
  const { data: communityPosts }    = useCollection("communityPosts",    "createdAt");
  const { data: communityComments } = useCollection("communityComments", "createdAt");
  const { data: licenseSchedules }  = useCollection("licenseSchedules",  "date");

  const [selectedNotice,  setSelectedNotice]  = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [commentText,     setCommentText]     = useState("");
  const [submitting,      setSubmitting]      = useState(false);

  // 시간표
  const [classes,       setClasses]       = useState([]);
  const [showTimetable, setShowTimetable] = useState(false); // 편집 모달
  const [showRentory,   setShowRentory]   = useState(false); // 렌토리 소개 모달
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding_done'));
  const [onboardStep,    setOnboardStep]    = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);  // PWA 설치 프롬프트
  const [showInstall,   setShowInstall]   = useState(false); // 설치 배너 표시
  const [showIosInstall, setShowIosInstall] = useState(() => {
    // iOS Safari이고 standalone 아닌 경우 + 이전에 닫은 적 없으면 표시
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('ios_install_dismissed');
    return isIos && isSafari && !isStandalone && !dismissed;
  });
  const [returnPhotoUploading, setReturnPhotoUploading] = useState(false);
  const [returnPhotoProgress,  setReturnPhotoProgress]  = useState(0);
  const [expandedReturnId,     setExpandedReturnId]     = useState(null); // 펼쳐진 반납준비 항목
  const [showFriendTab,  setShowFriendTab]  = useState(false);
  const [viewFriend,     setViewFriend]     = useState(null); // { id, name, dept, classes }
  const [viewFriendLoading, setViewFriendLoading] = useState(false);
  const [friendSort,     setFriendSort]     = useState("name"); // "name" | "id"
  const [friendSearch,   setFriendSearch]   = useState("");   // 검색어
  const [friendPage,     setFriendPage]     = useState(1);    // 페이지
  const FRIENDS_PER_PAGE = 5;
  const [pinnedFriends,  setPinnedFriends]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("pinnedFriends") || "[]"); } catch { return []; }
  });

  const togglePin = (fid) => {
    setPinnedFriends(prev => {
      const next = prev.includes(fid) ? prev.filter(id => id !== fid) : [...prev, fid];
      localStorage.setItem("pinnedFriends", JSON.stringify(next));
      return next;
    });
  };
  const [popupNotice,   setPopupNotice]   = useState(null);  // 팝업 공지
  const [popupComment,  setPopupComment]  = useState("");    // 팝업 댓글 입력
  const [popupSubmitting, setPopupSubmitting] = useState(false);

  // 팝업 공지 체크 (notices는 위에서 이미 선언됨)
  useEffect(() => {
    if (!notices?.length) return;
    const popups = notices.filter(n => n.popup);
    if (!popups.length) return;
    const latest = popups[popups.length - 1];
    const hiddenKey = `popup_hidden_${latest.id}`;
    // '다시 보지 않기'를 누르면 값이 저장되며, 이후로는 이 공지를 표시하지 않는다.
    if (!localStorage.getItem(hiddenKey)) setPopupNotice(latest);
  }, [notices]);
  const [editClass,     setEditClass]     = useState(null);  // null=추가, obj=수정
  const [showClassForm, setShowClassForm] = useState(false);
  const [importing,     setImporting]     = useState(false); // 사진 인식 중
  const [importPreview, setImportPreview] = useState(null);  // 인식 결과 확인 모달 [{...}]
  const [showTtSource,  setShowTtSource]  = useState(false); // AI 추가 소스 선택(촬영/갤러리) 팝업

  const uid = profile?.uid;

  // 시간표 로드
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "timetables", uid)).then(snap => {
      if (snap.exists()) setClasses(snap.data().classes || []);
    });
  }, [uid]);

  // 시간표 저장
  const saveTimetable = async (newClasses) => {
    if (!uid) return;
    await setDoc(doc(db, "timetables", uid), { classes: newClasses });
    setClasses(newClasses);
  };

  const handleSaveClass = async (form) => {
    let updated;
    if (editClass) {
      updated = classes.map(c => c === editClass ? form : c);
    } else {
      updated = [...classes, form];
    }
    await saveTimetable(updated);
    setShowClassForm(false);
    setEditClass(null);
  };

  const handleDeleteClass = async () => {
    const updated = classes.filter(c => c !== editClass);
    await saveTimetable(updated);
    setShowClassForm(false);
    setEditClass(null);
  };

  // 📷 시간표 사진 → AI 인식 → 확인 모달
  const handleImportImage = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl || "");
      if (!m) throw new Error("이미지 형식 오류");
      const [, mediaType, imageBase64] = m;

      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const fn = httpsCallable(getFunctions(undefined, "us-central1"), "parseTimetableImage");
      const { data } = await fn({ imageBase64, mediaType });
      const got = (data?.classes || []).filter(c => c && c.name && c.day && c.startTime && c.endTime);
      if (got.length === 0) { alert("시간표를 못 읽었어요. 더 선명한 사진으로 다시 시도해 주세요."); return; }
      // 교수명만 들어온 경우 "교수님" 자동 붙이기
      const withProf = (p) => {
        const v = (p || "").trim();
        if (!v) return "";
        return /교수|쌤|선생|강사/.test(v) ? v : `${v} 교수님`;
      };
      // 색상 배정 후 미리보기
      setImportPreview(got.map((c, i) => ({
        day: c.day, name: c.name, location: c.location || "", professor: withProf(c.professor),
        startTime: c.startTime, endTime: c.endTime, color: COLORS[(classes.length + i) % COLORS.length],
      })));
    } catch (e) {
      console.error(e);
      alert("인식에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    await saveTimetable([...classes, ...importPreview]);
    setImportPreview(null);
  };

  const handleClearAll = async () => {
    if (classes.length === 0) return;
    if (!window.confirm("시간표 전체를 삭제할까요?")) return;
    await saveTimetable([]);
  };

  const myId = profile?.studentId || profile?.email || "";
  const myRentals = allRequests.filter(r =>
    (r.studentId === myId || r.studentId === profile?.uid) &&
    (r.status === "대여중" || r.status === "연체")
  );
  const myRes = allRequests.filter(r =>
    (r.studentId === myId || r.studentId === profile?.uid) &&
    (r.status === "승인대기" || r.status === "승인됨")
  );

  // 레벨/신뢰도 카드용 대여 통계 (실제 데이터)
  const myRentalsAll = allRequests.filter(r => r.studentId === myId || r.studentId === profile?.uid);
  const rentedCnt  = myRentalsAll.filter(r => ["대여중", "반납완료", "연체"].includes(r.status)).length; // 실제 대여한 횟수
  const onTimeCnt  = myRentalsAll.filter(r => r.status === "반납완료").length;                          // 정시반납(반납완료)
  const overdueCnt = myRentalsAll.filter(r => r.status === "연체").length;                              // 연체
  // 신뢰도 = 정시반납×120 + 대여×30 − 연체×300 (최소 0). ※ 규칙은 조정 가능
  const trustScore = Math.max(0, onTimeCnt * 120 + rentedCnt * 30 - overdueCnt * 300);
  const petStats = { rented: rentedCnt, onTime: onTimeCnt, overdue: overdueCnt, trust: trustScore };

  // ── 시간표: 오늘 수업 / 다음 수업 (nowTick으로 1분마다 갱신) ──
  const _now = new Date(); void nowTick;
  const _todayLabel = ["일", "월", "화", "수", "목", "금", "토"][_now.getDay()];
  const _nowMin = _now.getHours() * 60 + _now.getMinutes();
  const _toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const todayClasses = DAYS.includes(_todayLabel)
    ? classes.filter(c => c.day === _todayLabel).sort((a, b) => _toMin(a.startTime) - _toMin(b.startTime))
    : [];
  const nextClass = todayClasses.find(c => _toMin(c.endTime) > _nowMin) || null;
  let nextStatus = null;
  if (nextClass) {
    const s = _toMin(nextClass.startTime);
    if (s <= _nowMin) nextStatus = "진행 중";
    else { const d = s - _nowMin; nextStatus = d >= 60 ? `${Math.floor(d / 60)}시간 ${d % 60}분 후 시작` : `${d}분 후 시작`; }
  }

  const pinned = notices.filter(n => n.pinned).slice(0, 3);
  const recentNotices = pinned.length > 0
    ? pinned
    : [...notices].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).slice(0, 3);

  const getEquipLabel = (r) => {
    if (!r.items || r.items.length === 0) return r.equipName || "-";
    const names = r.items.map(i => i.modelName || i.equipName || "").filter(Boolean);
    return names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : names[0] || "-";
  };

  const getNoticeComments = (noticeId) =>
    comments
      .filter(c => c.noticeId === noticeId)
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  const formatTime = (ts) => {
    if (!ts?.seconds) return "";
    const d = new Date(ts.seconds * 1000);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  const submitComment = async () => {
    if (!commentText.trim() || !selectedNotice) return;
    setSubmitting(true);
    await addItem("noticeComments", {
      noticeId:   selectedNotice.id,
      authorId:   profile?.uid || "",
      authorName: profile?.name || "익명",
      authorRole: profile?.role === "admin" ? (profile?.adminRole || "super") : "student",
      content:    commentText.trim(),
    });
    setCommentText("");
    setSubmitting(false);
  };

  // 내 친구 목록 (양방향)
  const myFriends = friends.filter(f =>
    f.userId === profile?.uid || f.friendId === profile?.uid
  );

  // 반납 준비 사진 업로드
  const uploadReturnPhoto = (requestId) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const input = e.target;
    setReturnPhotoUploading(true);
    setReturnPhotoProgress(0);
    try {
      const storageRef = ref(storage, `return_photos/${requestId}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise((resolve, reject) => {
        task.on("state_changed",
          snap => setReturnPhotoProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
          reject,
          resolve
        );
      });
      const url = await getDownloadURL(task.snapshot.ref);
      // Firestore에서 최신 데이터 직접 읽어서 업데이트
      const docSnap = await getDoc(doc(db, "rentalRequests", requestId));
      const current = docSnap.exists() ? (docSnap.data().returnPhotos || []) : [];
      if (current.length >= 3) { alert("사진은 최대 3장까지 업로드할 수 있어요"); return; }
      await updateDoc(doc(db, "rentalRequests", requestId), { returnPhotos: [...current, url] });
      input.value = "";
    } catch(err) {
      alert("업로드 실패: " + err.message);
    } finally {
      setReturnPhotoUploading(false);
      setReturnPhotoProgress(0);
    }
  };

  const deleteReturnPhoto = async (requestId, photos, idx) => {
    const newPhotos = photos.filter((_, i) => i !== idx);
    await updateDoc(doc(db, "rentalRequests", requestId), { returnPhotos: newPhotos });
  };

  // 친구 시간표 보기
  const viewFriendTimetable = async (friendDoc) => {
    setViewFriendLoading(true);
    setViewFriend(null);
    try {
      const isMine = friendDoc.userId === profile?.uid;
      const targetId   = isMine ? friendDoc.friendId   : friendDoc.userId;
      const targetName = isMine ? friendDoc.friendName : friendDoc.userName;
      const ttSnap = await getDoc(doc(db, "timetables", targetId));
      const classes = ttSnap.exists() ? (ttSnap.data().classes || []) : [];
      setViewFriend({ id: targetId, name: targetName, classes });
    } catch(e) { console.error(e); }
    setViewFriendLoading(false);
  };

  const submitPopupComment = async () => {
    if (!popupComment.trim() || !popupNotice) return;
    setPopupSubmitting(true);
    await addItem("noticeComments", {
      noticeId:   popupNotice.id,
      authorId:   profile?.uid || "",
      authorName: profile?.name || "익명",
      authorRole: profile?.role === "admin" ? (profile?.adminRole || "super") : "student",
      content:    popupComment.trim(),
    });
    setPopupComment("");
    setPopupSubmitting(false);
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    await deleteItem("noticeComments", commentId);
  };

  const statusStyle = (status) => {
    const map = {
      "승인대기": { bg: C.yellowLight,  col: C.yellow },
      "승인됨":   { bg: C.greenLight,   col: C.green  },
      "대여중":   { bg: C.blueLight,    col: C.blue   },
      "연체":     { bg: C.redLight,     col: C.red    },
      "반납완료": { bg: "#F8FAFC",      col: C.muted  },
    };
    return map[status] || { bg: C.bg, col: C.muted };
  };

  return (
    <div style={{ fontFamily: "'Pretendard', -apple-system, 'Malgun Gothic', sans-serif" }}>
      {/* PWA 설치 배너 */}
      {showInstall && (
        <div data-hbanner style={{ background:"linear-gradient(135deg,#1B2B6B,#7C3AED)", borderRadius:14, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:26 }}>📲</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#fff", marginBottom:2 }}>앱으로 설치하기</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)" }}>홈 화면에 추가하면 더 빠르게 이용할 수 있어요!</div>
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            <button onClick={async () => {
              if (!installPrompt) return;
              installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              setInstallPrompt(null);
              setShowInstall(false);
            }} style={{ background:"#fff", color:"#1B2B6B", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              설치
            </button>
            <button onClick={() => setShowInstall(false)}
              style={{ background:"rgba(255,255,255,0.2)", color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer" }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* iOS PWA 설치 안내 배너 */}
      {showIosInstall && (
        <div data-hbanner style={{ background:"linear-gradient(135deg,#0F172A,#1B2B6B)", borderRadius:14, padding:"14px 16px", marginBottom:12, border:"1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:20 }}>📲</span>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:"#fff" }}>앱으로 설치하기</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)" }}>홈 화면에서 바로 실행할 수 있어요!</div>
              </div>
            </div>
            <button onClick={() => { setShowIosInstall(false); localStorage.setItem('ios_install_dismissed','1'); }}
              style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:6, padding:"4px 8px", fontSize:12, cursor:"pointer" }}>✕</button>
          </div>
          <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 12px" }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.9)", lineHeight:1.8 }}>
              <div style={{ marginBottom:4 }}>
                <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:4, padding:"1px 6px", marginRight:6, fontSize:11 }}>1</span>
                하단 Safari <span style={{ fontSize:12 }}>⬆️</span> <b style={{ color:"#93C5FD" }}>공유 버튼</b>을 눌러요
              </div>
              <div style={{ marginBottom:4 }}>
                <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:4, padding:"1px 6px", marginRight:6, fontSize:11 }}>2</span>
                스크롤해서 <b style={{ color:"#93C5FD" }}>홈 화면에 추가</b> <span style={{ fontSize:12 }}>➕</span>를 눌러요
              </div>
              <div>
                <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:4, padding:"1px 6px", marginRight:6, fontSize:11 }}>3</span>
                오른쪽 위 <b style={{ color:"#93C5FD" }}>추가</b>를 누르면 완료!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* home-hero.png 이미지 + 버튼 클릭영역(투명) + 스무스 누름 모션 */}
      <style>{`
        .hero-hit{position:absolute;border:none;background:transparent;padding:0;cursor:pointer;
          border-radius:16px;-webkit-tap-highlight-color:transparent;
          transition:transform .16s cubic-bezier(.34,1.4,.5,1), background-color .16s ease, box-shadow .16s ease;}
        .hero-hit:active{transform:scale(0.94);background-color:rgba(255,255,255,0.12);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);}
        .htext{position:absolute;top:20px;left:22px;width:52%;z-index:5;pointer-events:none;line-height:normal;}
        .hgreet{margin:0;font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em;white-space:nowrap;}
        .hgreet .nm{color:#6f8cff;}
        .hsub{margin:7px 0 0;font-size:11px;line-height:1.6;font-weight:500;color:rgba(214,224,252,0.78);letter-spacing:0.02em;}
        .hmini{position:absolute;left:4%;top:54%;transform:translateY(-50%);z-index:6;display:flex;gap:7px;pointer-events:auto;}
        .hmini button{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.14);color:rgba(255,255,255,0.85);cursor:pointer;padding:0;}
      `}</style>
      <div style={{ position: "relative", width: "100%", lineHeight: 0, marginBottom: 12 }}>
        <img src="/home-hero.png" alt="홈" style={{ width: "100%", display: "block" }} />
        <div className="htext">
          <p className="hgreet">안녕하세요, <span className="nm">{profile?.name}</span>님 👋</p>
          <p className="hsub">오늘도 멋진 촬영과 작품을<br/>한예진이 함께 응원할게요!</p>
        </div>
        <div className="hmini">
          <button onClick={logout} title="로그아웃" aria-label="로그아웃">
            <LogOut size={14} />
          </button>
          {profile?.linkedEmail && (
            <button onClick={handleSwitch2} disabled={switchLoading2} title="계정 전환" aria-label="계정 전환" style={{ opacity: switchLoading2 ? 0.6 : 1 }}>
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        {[
          { label: "장비 예약", box: { left: "4.0%",  top: "66.6%", width: "30.2%", height: "26.6%" }, onClick: () => setTab?.("equip") },
          { label: "예약 내역", box: { left: "35.8%", top: "66.6%", width: "28.6%", height: "26.6%" }, onClick: () => setTab?.("calendar") },
          { label: "대여 규칙", box: { left: "66.0%", top: "66.6%", width: "29.9%", height: "26.6%" }, onClick: () => setShowRules(true) },
        ].map((b, i) => (
          <button key={i} className="hero-hit" aria-label={b.label} onClick={b.onClick} style={b.box} />
        ))}
      </div>

      {/* 대여 규칙 모달 */}
      {showRules && (
        <Modal onClose={() => setShowRules(false)} width={380}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#5b8def,#4f6bd8)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <ShieldCheck size={19} color="#fff" strokeWidth={2.2} />
            </div>
            <div style={{ fontSize:15, fontWeight:900, color:C.text }}>대여 이용 규칙</div>
          </div>
          {[
            { t:"대여 시간", d:"평일 당일대여 09:00~17:30 / 주말대여 금 17:30 ~ 월 09:00" },
            { t:"신청 기한", d:"이용일 최소 3일 전까지 신청 (긴급 체크 시 예외)" },
            { t:"라이선스", d:"보유 라이선스 등급(LV0~LV3)에 따라 대여 가능 장비가 달라져요" },
            { t:"반납", d:"제시간에 반납해주세요. 연체 시 이용이 제한될 수 있어요" },
          ].map((r,i) => (
            <div key={i} style={{ display:"flex", gap:10, padding:"10px 0", borderTop: i>0 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ flexShrink:0, width:64, fontSize:12, fontWeight:800, color:C.text }}>{r.t}</div>
              <div style={{ flex:1, fontSize:12, color:C.muted, lineHeight:1.55 }}>{r.d}</div>
            </div>
          ))}
          <button onClick={() => setShowRules(false)}
            style={{ width:"100%", marginTop:14, background:C.navy, color:C.bg, border:"none", borderRadius:10, padding:"11px 0", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
            확인
          </button>
        </Modal>
      )}

      {/* 🐾 펫 + 🫂 친구관리 (한 줄 2박스) */}
      <div style={{ display:"flex", gap:10, marginBottom:6, alignItems:"stretch" }}>
        <PetHomeCard key={petRefresh} uid={profile?.uid} onOpen={() => setShowPet(true)} />
        <FriendTile
          count={myFriends.length}
          reqCount={friendRequests.filter(r => r.toId === profile?.uid && r.status === "pending").length}
          onOpen={() => onOpenFriends?.()}
        />
      </div>

      {showPet && <PetOverlay uid={profile?.uid} onClose={() => { setShowPet(false); setPetRefresh(n => n + 1); }}
        friends={myFriends.map(f => {
          const isMine = f.userId === profile?.uid;
          return { uid: isMine ? f.friendId : f.userId, name: isMine ? f.friendName : f.userName, sid: isMine ? f.friendStudentId : f.userStudentId };
        })} />}

      {/* 공지 팝업 모달 */}
      {popupNotice && (
        <Modal onClose={() => setPopupNotice(null)} width={360}>
          <div style={{ marginBottom:5 }}>
            <span style={{ background:C.blueLight, color:C.navy, borderRadius:6, padding:"2px 7px", fontSize:10, fontWeight:700 }}>{popupNotice.category || "공지"}</span>
          </div>
          <div style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:8 }}>{popupNotice.title}</div>
          <div style={{ fontSize:12, color:C.text, lineHeight:1.6, whiteSpace:"pre-wrap", background:C.bg, borderRadius:8, padding:"10px 12px", marginBottom:8, wordBreak:"break-word" }}>
            {popupNotice.content}
          </div>
          <div style={{ fontSize:10, color:C.muted, marginBottom:10 }}>{popupNotice.date} · {popupNotice.author}</div>

          {/* 댓글 목록 */}
          {(() => {
            const popupComments = comments.filter(c => c.noticeId === popupNotice.id);
            return popupComments.length > 0 && (
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6 }}>댓글 {popupComments.length}</div>
                <div style={{ maxHeight:110, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
                  {popupComments.map(c => (
                    <div key={c.id} style={{ background:C.bg, borderRadius:7, padding:"6px 10px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:C.text }}>{c.authorName}</span>
                        <span style={{ fontSize:9, color:C.muted }}>{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString("ko") : ""}</span>
                      </div>
                      <div style={{ fontSize:11, color:C.text, lineHeight:1.5, wordBreak:"break-word", whiteSpace:"pre-wrap" }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 댓글 입력 - 박스 안에 */}
          <div style={{ background:C.bg, borderRadius:9, padding:"8px 10px", marginBottom:10 }}>
            <input value={popupComment} onChange={e => setPopupComment(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitPopupComment(); }}}
              placeholder="댓글을 입력하세요..."
              style={{ width:"100%", background:"none", border:"none", color:C.text, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:6 }} />
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={submitPopupComment} disabled={popupSubmitting || !popupComment.trim()}
                style={{ background:popupComment.trim()?C.navy:C.border, color:C.bg, border:"none", borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                {popupSubmitting ? "..." : "등록"}
              </button>
            </div>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => {
              localStorage.setItem(`popup_hidden_${popupNotice.id}`, "1");
              setPopupNotice(null);
            }} style={{ flex:1, background:"none", border:`1px solid ${C.border}`, borderRadius:9, padding:"8px 0", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
              다시 보지 않기
            </button>
            <button onClick={() => setPopupNotice(null)}
              style={{ flex:1, background:C.navy, border:"none", borderRadius:9, padding:"8px 0", fontSize:12, fontWeight:700, color: C.bg, cursor:"pointer", fontFamily:"inherit" }}>
              닫기
            </button>
          </div>
        </Modal>
      )}

      {/* 렌토리 소개 모달 */}
      {showRentory && (
        <Modal onClose={() => setShowRentory(false)} width={420}>
          <div style={{ textAlign:"center", padding:"4px" }}>
            <img src="/mascot/baby.png" alt="렌토리" style={{ width:120, height:120, objectFit:"contain", marginBottom:8 }} />
            <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:14 }}>렌토리를 소개합니다!</div>
            <div style={{ fontSize:12, color:C.text, lineHeight:1.7, textAlign:"left", background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
              렌토리는 한국방송예술진흥원 장비대여실에서 태어난 작은 수달이에요.<br/>
              카메라, 렌즈, 조명, 삼각대 사이에서 자라며 장비 이름과 사용법을 자연스럽게 익혔고, 지금은 앱 안에서 여러분의 촬영 준비를 도와주고 있어요.<br/><br/>
              대여 신청부터 장비 확인, 반납 알림까지<br/>
              촬영의 시작과 끝을 함께하는<br/>
              여러분의 공식 장비 도우미랍니다.<br/><br/>
              장비를 깨끗하게 쓰고 제시간에 반납하면 렌토리가 따봉을 날려줘요. 👍<br/>
              하지만 반납이 늦거나 장비를 함부로 다루면 7번 아이언과 함께 나타날지도 몰라요! ⛳<br/><br/>
              <div style={{ fontWeight:700, color:C.teal, textAlign:"center" }}>오늘의 촬영도 렌토리와 함께 준비해볼까요?</div>
            </div>
            <button onClick={() => setShowRentory(false)}
              style={{ background:`linear-gradient(135deg, ${C.teal}, ${C.navy})`, color:"#fff", border:"none", borderRadius:10, padding:"11px 24px", fontSize:12, fontWeight:700, cursor:"pointer", width:"100%" }}>
              좋아요, 친해질래요 ♡
            </button>
          </div>
        </Modal>
      )}

      {/* 시간표 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <SectionTitle>내 시간표</SectionTitle>
          {classes.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginLeft: "auto", marginTop: 12 }}>
              <button onClick={() => { setShowClassForm(true); setEditClass(null); }}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 11, fontWeight: 700, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit" }}>+ 수업 추가</button>
              <button onClick={handleClearAll}
                style={{ background: "none", border: `1px solid ${C.red}55`, borderRadius: 8, color: C.red, fontSize: 11, fontWeight: 700, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit" }}>전체삭제</button>
            </div>
          )}
        </div>
        <input id="tt-import-input" type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; handleImportImage(f); }} />
        <input id="tt-import-camera" type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; handleImportImage(f); }} />
        {classes.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 11, background: "linear-gradient(135deg,#141d3d,#101733)", border: "1px solid #23305c", borderRadius: 16, padding: 14 }}>
            <div style={{ width: 52, height: 52, flexShrink: 0, display: "grid", placeItems: "center", color: "#4a5a9e", opacity: 0.85 }}>
              <CalendarDays size={44} strokeWidth={1.6} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff" }}>아직 시간표가 없어요</div>
              <div style={{ fontSize: 10.5, color: "#8f9ac0", marginTop: 4, lineHeight: 1.4 }}>시간표를 추가하고<br/>다음 수업을 놓치지 마세요!</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0, width: 98 }}>
              <button onClick={() => { setShowClassForm(true); setEditClass(null); }}
                style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 11, padding: "9px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxSizing: "border-box", background: "rgba(70,110,255,0.12)", border: "1px solid rgba(100,140,255,0.32)", color: "#cdd8ff", fontFamily: "inherit" }}>
                <PlusCircle size={15} color="#6f8cff" /> 직접 추가
              </button>
              <button onClick={() => setShowTtSource(true)} disabled={importing}
                style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 11, padding: "9px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxSizing: "border-box", background: "linear-gradient(135deg,#8b5cf6,#6d5cf6)", border: "1px solid transparent", color: "#fff", fontFamily: "inherit", opacity: importing ? 0.7 : 1 }}>
                <Bot size={15} /> {importing ? "인식 중…" : "AI로 추가"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <style>{`
              .tt-next{position:relative;overflow:hidden;background:linear-gradient(135deg,#141d3d,#101733);border:1px solid #23305c;border-radius:16px;padding:12px 15px;margin-bottom:12px;}
              .tt-bblue{display:inline-block;background:rgba(70,110,255,0.18);color:#7ea2ff;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:7px;}
              .tt-bpurple{display:inline-flex;align-items:center;gap:4px;background:rgba(139,92,246,0.2);color:#c4b5fd;font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:8px;position:absolute;top:14px;right:15px;}
              .tt-nname{font-size:18px;font-weight:800;color:#fff;margin:9px 0 5px;letter-spacing:-0.02em;}
              .tt-ntime{font-size:13px;font-weight:700;color:#c8d3ee;margin-bottom:7px;}
              .tt-nmeta{font-size:11.5px;color:#93a0bd;display:flex;gap:12px;flex-wrap:wrap;}
              .tt-nmeta span{display:inline-flex;align-items:center;gap:4px;}
              .tt-thumb{position:absolute;right:15px;bottom:14px;width:86px;height:58px;border-radius:10px;object-fit:cover;border:1px solid #2f3d6e;display:block;}
              .tt-label{font-size:12.5px;font-weight:700;color:#93a0bd;margin:0 2px 6px;}
              .tt-today{background:#0d1428;border:1px solid #1c2947;border-radius:14px;overflow:hidden;margin-bottom:12px;}
              .tt-row{display:flex;align-items:center;gap:10px;padding:10px 13px;border-top:1px solid #17223d;cursor:pointer;-webkit-tap-highlight-color:transparent;}
              .tt-row:first-child{border-top:none;}
              .tt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
              .tt-rbody{flex:1;min-width:0;}
              .tt-rname{font-size:12.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
              .tt-rsub{font-size:10.5px;color:#8a93a8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-0.01em;}
              .tt-chev{color:#5c6784;font-size:15px;flex-shrink:0;}
            `}</style>

            {/* 다음 수업 */}
            {nextClass && (
              <div className="tt-next">
                <span className="tt-bblue">다음 수업</span>
                {nextStatus && <span className="tt-bpurple">🕐 {nextStatus}</span>}
                <div className="tt-nname">{nextClass.name}</div>
                <div className="tt-ntime">{nextClass.startTime} - {nextClass.endTime}</div>
                <div className="tt-nmeta">
                  {nextClass.location && <span>📍 {nextClass.location}</span>}
                  {nextClass.professor && <span>👤 {nextClass.professor}</span>}
                </div>
                <img className="tt-thumb" src="/next-class-thumb.png" alt="" />
              </div>
            )}

            {/* 오늘의 수업 */}
            {todayClasses.length > 0 && (
              <>
                <div className="tt-label">오늘의 수업</div>
                <div className="tt-today">
                  {todayClasses.map((c, i) => (
                    <div key={i} className="tt-row" onClick={() => { setEditClass(c); setShowClassForm(true); }}>
                      <span className="tt-dot" style={{ background: c.color || COLORS[i % COLORS.length] }} />
                      <div className="tt-rbody">
                        <div className="tt-rname">{c.name}</div>
                        <div className="tt-rsub">{c.startTime} - {c.endTime}{c.location ? ` · ${c.location}` : ""}{c.professor ? ` · ${c.professor}` : ""}</div>
                      </div>
                      <span className="tt-chev">›</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 주간 시간표 */}
            <div className="tt-label">주간 시간표</div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 320 }}>
                <Timetable
                  classes={classes}
                  onEdit={(cls) => { setEditClass(cls); setShowClassForm(true); }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 친구 시간표 */}
      <div style={{ marginBottom:12 }}>
        <button onClick={() => { setShowFriendTab(o=>!o); setViewFriend(null); }}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:TT.bg, border:`1px solid ${TT.border}`, borderRadius:showFriendTab?"12px 12px 0 0":"12px", padding:"10px 16px", cursor:"pointer", fontFamily:"inherit" }}>
          <div style={{ display:"flex", alignItems:"center", gap:11 }}>
            <img src="/friends-tt-icon.png" alt="" style={{ width:38, height:38, borderRadius:11, objectFit:"cover", flexShrink:0, display:"block" }} />
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.text }}>친구 시간표</div>
              <div style={{ fontSize:10.5, color:C.muted, marginTop:1 }}>친구들의 수업시간을 함께 확인해보세요!</div>
            </div>
          </div>
          <span style={{ fontSize:12, color:C.muted }}>{showFriendTab?"▲":"▼"}</span>
        </button>

        {showFriendTab && (
          <div style={{ background:TT.bg, border:`1px solid ${TT.border}`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:"14px 16px" }}>

            {/* 친구 추가 안내 */}
            <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginBottom:12 }}>
              친구 추가·요청은 더보기 › 친구관리에서 할 수 있어요
            </div>

            {/* 친구 목록 */}
              <div>
                {myFriends.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"20px 0", color:C.muted, fontSize:12 }}>
                    아직 친구가 없어요<br/>
                    <span style={{ fontSize:11 }}>더보기 › 친구관리에서 학번으로 신청해보세요</span>
                  </div>
                ) : (() => {
                  const sorted = [...myFriends]
                    .map(f => {
                      const isMine = f.userId === profile?.uid;
                      return {
                        ...f,
                        _name: isMine ? f.friendName : f.userName,
                        _sid:  isMine ? f.friendStudentId : f.userStudentId,
                        _pinned: pinnedFriends.includes(f.id),
                      };
                    })
                    .filter(f =>
                      !friendSearch ||
                      f._name?.includes(friendSearch) ||
                      f._sid?.includes(friendSearch)
                    )
                    .sort((a, b) => {
                      if (a._pinned !== b._pinned) return a._pinned ? -1 : 1;
                      if (friendSort === "name") return a._name?.localeCompare(b._name, "ko");
                      return a._sid?.localeCompare(b._sid);
                    });
                  const totalPages = Math.ceil(sorted.length / FRIENDS_PER_PAGE);
                  const paginated  = sorted.slice((friendPage-1)*FRIENDS_PER_PAGE, friendPage*FRIENDS_PER_PAGE);
                  return (
                    <div>
                      {/* 검색 + 정렬 */}
                      <div style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
                        <input value={friendSearch} onChange={e => { setFriendSearch(e.target.value); setFriendPage(1); }}
                          placeholder="이름 또는 학번 검색"
                          style={{ flex:1, minWidth:0, background:TT.line, border:`1.5px solid ${TT.border}`, borderRadius:9, color:C.text, padding:"6px 12px", fontSize:12, fontFamily:"inherit", outline:"none" }} />
                        {[["name","이름순"],["id","학번순"]].map(([v,l]) => (
                          <button key={v} onClick={() => { setFriendSort(v); setFriendPage(1); }}
                            style={{ padding:"5px 10px", borderRadius:7, border:"none", fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0, background:friendSort===v?C.navy:TT.line, color:friendSort===v?C.bg:C.muted }}>
                            {l}
                          </button>
                        ))}
                      </div>

                      {sorted.length === 0 && friendSearch ? (
                        <div style={{ textAlign:"center", padding:"16px 0", color:C.muted, fontSize:12 }}>검색 결과가 없어요</div>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {paginated.map(f => {
                            const fid = f.userId === profile?.uid ? f.friendId : f.userId;
                          const isViewing = viewFriend?.id === fid;
                            return (
                              <div key={f.id}>
                                <div style={{ display:"flex", alignItems:"center", gap:6, background:f._pinned?"rgba(20,184,166,0.14)":TT.line, borderRadius:10, padding:"8px 12px", border:f._pinned?`1px solid ${C.teal}40`:`1px solid ${TT.border}` }}>
                                  <Avatar name={f._name || "?"} size={28} src={photoMap?.[fid]} />
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{f._name}</span>
                                    {f._pinned && <span style={{ fontSize:9, color:C.teal, marginLeft:4 }}>📌</span>}
                                    <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{f._sid}</span>
                                  </div>
                                  <button onClick={() => togglePin(f.id)}
                                    style={{ background:f._pinned?C.teal:TT.line, color:f._pinned?"#fff":C.muted, border:`1px solid ${f._pinned?C.teal:TT.border}`, borderRadius:7, padding:"4px 8px", fontSize:11, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                                    📌
                                  </button>
                                  <button onClick={() => isViewing ? setViewFriend(null) : viewFriendTimetable(f)}
                                    style={{ background:isViewing?C.border:C.blueLight, color:isViewing?C.muted:C.blue, border:"none", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                                    {viewFriendLoading&&!isViewing?"...":isViewing?"접기":"시간표"}
                                  </button>
                                </div>
                                {isViewing && viewFriend && (
                                  <div style={{ marginTop:6, overflowX:"auto" }}>
                                    <div style={{ minWidth:320 }}>
                                      {viewFriend.classes.length === 0
                                        ? <div style={{ textAlign:"center", padding:"16px 0", fontSize:12, color:C.muted }}>등록된 시간표가 없어요</div>
                                        : <Timetable classes={viewFriend.classes} readOnly />
                                      }
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 페이지네이션 */}
                      {totalPages > 1 && (
                        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:6, marginTop:12 }}>
                          <button onClick={() => setFriendPage(p => Math.max(1, p-1))} disabled={friendPage===1}
                            style={{ background:friendPage===1?C.border:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 10px", fontSize:12, cursor:friendPage===1?"default":"pointer", color:friendPage===1?C.muted:C.text }}>
                            ‹
                          </button>
                          {Array.from({length:totalPages}, (_,i) => i+1).map(p => (
                            <button key={p} onClick={() => setFriendPage(p)}
                              style={{ background:friendPage===p?C.navy:C.bg, border:`1px solid ${friendPage===p?C.navy:C.border}`, borderRadius:7, padding:"4px 10px", fontSize:12, cursor:"pointer", color:friendPage===p?"#fff":C.text, fontWeight:friendPage===p?700:400, minWidth:32 }}>
                              {p}
                            </button>
                          ))}
                          <button onClick={() => setFriendPage(p => Math.min(totalPages, p+1))} disabled={friendPage===totalPages}
                            style={{ background:friendPage===totalPages?C.border:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 10px", fontSize:12, cursor:friendPage===totalPages?"default":"pointer", color:friendPage===totalPages?C.muted:C.text }}>
                            ›
                          </button>
                        </div>
                      )}
                      <div style={{ fontSize:10, color:C.muted, textAlign:"center", marginTop:6 }}>
                        전체 {sorted.length}명{friendSearch ? ` (검색: "${friendSearch}")` : ""}
                      </div>
                    </div>
                  );
                })()}
              </div>
          </div>
        )}
      </div>

      {/* 학점 계산기 */}
      <GpaCalculator classes={classes} />

        {/* 라이선스 수업 */}
        {(() => {
          const today = new Date().toISOString().slice(0,10);
          const upcoming = licenseSchedules
            .filter(s => s.date >= today && s.status !== "완료")
            .sort((a,b) => a.date > b.date ? 1 : -1)
            .slice(0, 3);
          if (upcoming.length === 0) return null;
          return (
            <section>
              <SectionTitle>🎖️ 라이선스 신청 가능한 수업</SectionTitle>
              {upcoming.map(s => (
                <Card key={s.id} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{s.title || s.equipName}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{s.date} {s.time} · {s.location}</div>
                      {s.licenseLevel && <div style={{ fontSize:11, color:C.purple, marginTop:2, fontWeight:600 }}>Lv.{s.licenseLevel} 수업</div>}
                    </div>
                    <span style={{ background:C.purpleLight, color:C.purple, borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, flexShrink:0 }}>신청가능</span>
                  </div>
                </Card>
              ))}
            </section>
          );
        })()}

      {/* 수업 추가/수정 모달 */}
      {showClassForm && (
        <Modal onClose={() => { setShowClassForm(false); setEditClass(null); }} width={420}>
          <ClassForm
            initial={editClass}
            onSave={handleSaveClass}
            onDelete={handleDeleteClass}
            onClose={() => { setShowClassForm(false); setEditClass(null); }}
          />
        </Modal>
      )}

      {/* 📷 사진 인식 결과 확인 모달 */}
      {importPreview && (
        <Modal onClose={() => setImportPreview(null)} width={420}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 6 }}>인식된 수업 {importPreview.length}개</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>맞으면 추가하고, 틀린 건 추가 후 수업을 눌러 수정/삭제하면 돼요.</div>
          <div style={{ maxHeight: "45vh", overflowY: "auto", marginBottom: 14 }}>
            {importPreview.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.day} · {c.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{c.startTime}~{c.endTime}{c.location ? ` · ${c.location}` : ""}{c.professor ? ` · ${c.professor}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => setImportPreview(null)} color={C.muted} outline full>취소</Btn>
            <button onClick={confirmImport}
              style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#4d7cfe,#3b6cf8)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {importPreview.length}개 추가
            </button>
          </div>
        </Modal>
      )}

      {/* 시간표 AI 추가 — 촬영 / 갤러리 선택 (홈 톤) */}
      {showTtSource && (
        <Modal onClose={() => setShowTtSource(false)} width={360}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: "linear-gradient(135deg,#8b5cf6,#6d5cf6)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Bot size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: C.text }}>AI로 시간표 추가</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>사진 한 장이면 자동으로 인식해요</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { Ic: Camera, tint: "linear-gradient(135deg,#4d7cfe,#3b6cf8)", t: "시간표 촬영하기", s: "카메라로 바로 찍어요", onClick: () => { setShowTtSource(false); document.getElementById("tt-import-camera")?.click(); } },
              { Ic: ImageIcon, tint: "linear-gradient(135deg,#8b5cf6,#6d5cf6)", t: "갤러리에서 선택", s: "캡쳐한 이미지를 올려요", onClick: () => { setShowTtSource(false); document.getElementById("tt-import-input")?.click(); } },
            ].map((o, i) => (
              <button key={i} onClick={o.onClick}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 13px", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: o.tint, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <o.Ic size={19} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{o.t}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{o.s}</div>
                </div>
                <ChevronRight size={16} color={C.muted} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* 공지 상세 모달 */}
      {selectedNotice && (() => {
        const cat = NOTICE_CAT[selectedNotice.category] || { bg: C.bg, col: C.muted };
        const detailComments = getNoticeComments(selectedNotice.id);
        return (
          <Modal onClose={() => setSelectedNotice(null)} width={560}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{selectedNotice.category}</span>
              {selectedNotice.pinned && <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>📌 고정</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginBottom: 8, lineHeight: 1.4 }}>{selectedNotice.title}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>{selectedNotice.date} · {selectedNotice.author}</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 28 }}>{selectedNotice.content}</div>
            <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 16 }}>💬 댓글 {detailComments.length}</div>
              {detailComments.length === 0 && (
                <div style={{ textAlign: "center", padding: "16px 0", color: C.muted, fontSize: 12 }}>첫 댓글을 남겨보세요!</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {detailComments.map(c => {
                  const canDelete = c.authorId === profile?.uid;
                  return (
                    <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Avatar name={c.authorName || "?"} size={34} src={photoMap?.[c.authorId]} />
                      <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "10px 14px", border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{c.authorName}</span>
                            {["super","teacher","assistant","professor","admin"].includes(c.authorRole) && (
                              <span style={{ background: (c.authorRole === "super" || c.authorRole === "admin") ? C.navy : c.authorRole === "professor" ? C.purple : c.authorRole === "teacher" ? C.blue : C.teal, color: C.bg, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                                {c.authorRole === "professor" ? "교수" : c.authorRole === "teacher" ? "교사" : c.authorRole === "assistant" ? "조교" : "관리자"}
                              </span>
                            )}
                          </div>
                          {canDelete && (
                            <button onClick={() => deleteComment(c.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer" }}>삭제</button>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{c.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 14px" }}>
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }}}
                  placeholder="댓글 입력 후 Enter"
                  style={{ width:"100%", background:"none", border:"none", color:C.text, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:8 }} />
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <Btn onClick={submitComment} color={C.navy} disabled={submitting || !commentText.trim()} small>등록</Btn>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}


      {/* 대여 상세 모달 */}
      {selectedRequest && (
        <Modal onClose={() => setSelectedRequest(null)} width={480}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 16 }}>{getEquipLabel(selectedRequest)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
            {[
              ["상태", selectedRequest.status],
              ["목적", selectedRequest.purpose],
              ["대여일", selectedRequest.startDate],
              ["반납예정", `${selectedRequest.endDate} ${selectedRequest.endTime}`],
            ].map(([label, val]) => (
              <div key={label} style={{ background: C.bg, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{label}</div>
                <div style={{ fontWeight: 700, color: C.text }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn onClick={() => setSelectedRequest(null)} color={C.muted} outline full>닫기</Btn>
          </div>
        </Modal>
      )}

      {/* 온보딩 튜토리얼 */}
      {showOnboarding && (() => {
        const steps = [
    { emoji:"🏠", title:"홈 화면", desc:"시간표, 학점 계산기, 나의 예약현황을 한눈에 볼 수 있어요!" },
    { emoji:"🎬", title:"장비 목록", desc:"대여 가능한 장비를 미리 확인할 수 있어요!" },
    { emoji:"📋", title:"예약 신청", desc:"초보자 가이드와 함께 장비를 골라보거나, 직접 선택할 수 있어요!" },
    { emoji:"📅", title:"대여이력/캘린더", desc:"내 대여 기록과 전체 대여 일정을 캘린더로 확인해요!" },
    { emoji:"💬", title:"에브리타임", desc:"자유·질문·강의 등 다양한 게시판으로 소통해요!" },
    { emoji:"👤", title:"내정보/문의", desc:"내 프로필 설정과 문의를 여기서 할 수 있어요!" },
  ];
        const step  = steps[onboardStep];
        const isLast = onboardStep === steps.length - 1;
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
            <div style={{ background:C.surface, borderRadius:20, padding:28, width:"100%", maxWidth:360, boxShadow:"0 8px 40px rgba(0,0,0,0.4)" }}>
              {/* 진행 표시 */}
              <div style={{ display:"flex", gap:4, marginBottom:20, justifyContent:"center" }}>
                {steps.map((_,i) => (
                  <div key={i} style={{ height:4, flex:1, borderRadius:2, background: i<=onboardStep ? C.teal : C.border, transition:"background 0.3s" }} />
                ))}
              </div>
              {/* 내용 */}
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ fontSize:46, marginBottom:12 }}>{step.emoji}</div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:8 }}>{step.title}</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>{step.desc}</div>
              </div>
              {/* 버튼 */}
              <div style={{ display:"flex", gap:8 }}>
                {onboardStep > 0 && (
                  <button onClick={() => setOnboardStep(s => s-1)}
                    style={{ flex:1, background:"none", border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 0", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
                    ← 이전
                  </button>
                )}
                <button onClick={() => {
                  if (isLast) {
                    localStorage.setItem('onboarding_done','1');
                    setShowOnboarding(false);
                  } else {
                    setOnboardStep(s => s+1);
                  }
                }} style={{ flex:2, background:C.navy, border:"none", borderRadius:10, padding:"11px 0", fontSize:12, fontWeight:700, color: C.bg, cursor:"pointer", fontFamily:"inherit" }}>
                  {isLast ? "시작하기 🚀" : "다음 →"}
                </button>
              </div>
              <button onClick={() => { localStorage.setItem('onboarding_done','1'); setShowOnboarding(false); }}
                style={{ display:"block", width:"100%", marginTop:10, background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", textDecoration:"underline" }}>
                건너뛰기
              </button>
            </div>
          </div>
        );
      })()}

      {/* 계정 전환 모달 */}
      {switchModal2 && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={() => { setSwitchModal2(false); setSwitchErr2(""); }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:C.surface, borderRadius:16, padding:24, width:"100%", maxWidth:360, boxShadow:"0 8px 32px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.text, marginBottom:4 }}>🔄 계정 전환</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>비밀번호를 입력하면 바로 전환돼요</div>
            <div style={{ background:C.bg, borderRadius:9, padding:"9px 12px", marginBottom:12, fontSize:12, color:C.text }}>
              📧 {profile?.linkedEmail}
            </div>
            <div style={{ marginBottom:switchErr2?8:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:4 }}>비밀번호</div>
              <input value={setupPw2} onChange={e => setSetupPw2(e.target.value)} type="password" placeholder="비밀번호 입력" autoFocus
                onKeyDown={e => e.key==="Enter" && handleSaveCreds2()}
                style={{ width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:9, color:C.text, padding:"9px 12px", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            </div>
            {switchErr2 && <div style={{ background:C.redLight, color:C.red, borderRadius:8, padding:"7px 12px", fontSize:12, marginBottom:12 }}>{switchErr2}</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { setSwitchModal2(false); setSetupPw2(""); setSwitchErr2(""); }}
                style={{ flex:1, background:"none", border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 0", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>취소</button>
              <button onClick={handleSaveCreds2} disabled={switchLoading2}
                style={{ flex:2, background:C.navy, border:"none", borderRadius:9, padding:"10px 0", fontSize:12, fontWeight:700, color: C.bg, cursor:"pointer", fontFamily:"inherit", opacity:switchLoading2?0.7:1 }}>
                {switchLoading2?"확인 중...":"계정 전환"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
