import { useState, useEffect } from "react";
import { C, NOTICE_CAT } from "../../theme";
import { Card, Badge, SectionTitle, Modal, Btn, Inp, Avatar } from "../../components/UI";
import { useCollection, addItem, deleteItem, updateItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { LogOut } from "lucide-react";

const DAYS   = ["월", "화", "수", "목", "금", "토", "일"];
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
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}` }}>
      {/* 헤더 */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
        <div style={{ width: 36, flexShrink: 0 }} />
        {DAYS.map(d => (
          <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 700, color: C.navy, padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* 그리드 바디 */}
      <div style={{ position: "relative", display: "flex" }}>
        {/* 시간 라벨 */}
        <div style={{ width: 36, flexShrink: 0 }}>
          {HOURS.map(h => (
            <div key={h} style={{ height: SLOT_H, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 2 }}>
              <span style={{ fontSize: 9, color: C.muted, lineHeight: 1 }}>{h}</span>
            </div>
          ))}
        </div>

        {/* 열 (월~금) */}
        {DAYS.map((day, di) => (
          <div key={day} style={{ flex: 1, position: "relative", borderLeft: `1px solid ${C.border}` }}>
            {/* 시간 구분선 */}
            {HOURS.map(h => (
              <div key={h} style={{ height: SLOT_H, borderBottom: `1px solid ${C.border}` }} />
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
      <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 18 }}>
        {initial ? "수업 수정" : "수업 추가"}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>요일 *</div>
        <div style={{ display: "flex", gap: 6 }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => f("day", d)}
              style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1.5px solid ${form.day === d ? C.navy : C.border}`, background: form.day === d ? C.navy : C.bg, color: form.day === d ? "#fff" : C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
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
        const selStyle = { display:"block", width:"100%", background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer" };
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

      <div style={{ display: "flex", gap: 8 }}>
        {initial && <Btn onClick={onDelete} color={C.red} outline>삭제</Btn>}
        <Btn onClick={onClose} color={C.muted} outline full>취소</Btn>
        <Btn onClick={() => onSave(form)} color={C.navy} full disabled={!form.name || !form.location || !form.startTime || !form.endTime}>
          저장
        </Btn>
      </div>
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

function GpaCalculator() {
  const [open, setOpen]  = useState(false);
  const [rows, setRows]  = useState([{ name:"", credit:"3", grade:"A+" }]);

  const addRow = () => setRows(p => [...p, { name:"", credit:"3", grade:"A+" }]);
  const delRow = (i) => setRows(p => p.filter((_,j)=>j!==i));
  const setRow = (i,k,v) => setRows(p => p.map((r,j)=>j===i?{...r,[k]:v}:r));

  const totalCredit = rows.reduce((s,r) => s+(parseFloat(r.credit)||0), 0);
  const totalPoint  = rows.reduce((s,r) => s+(parseFloat(r.credit)||0)*(GRADE_MAP[r.grade]??0), 0);
  const gpa = totalCredit > 0 ? (totalPoint/totalCredit).toFixed(2) : "0.00";
  const gpaColor = gpa>=4.0?C.teal:gpa>=3.0?C.blue:gpa>=2.0?C.yellow:C.red;

  return (
    <div style={{ marginBottom:16 }}>
      <button onClick={() => setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:open?"12px 12px 0 0":"12px", padding:"10px 16px", cursor:"pointer", fontFamily:"inherit" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>🎓</span>
          <span style={{ fontSize:13, fontWeight:700, color:C.text }}>학점 계산기</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {!open && totalCredit>0 && <span style={{ fontSize:12, fontWeight:800, color:gpaColor }}>{gpa} / 4.5</span>}
          <span style={{ fontSize:12, color:C.muted }}>{open?"▲":"▼"}</span>
        </div>
      </button>
      {open && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, background:C.bg, borderRadius:10, padding:"10px 14px" }}>
            <div>
              <div style={{ fontSize:11, color:C.muted }}>평점 평균 (4.5 기준)</div>
              <div style={{ fontSize:22, fontWeight:900, color:gpaColor }}>{gpa}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, color:C.muted }}>총 이수학점</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{totalCredit}학점</div>
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
                style={{ width:24, height:28, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14, flexShrink:0 }}>✕</button>
            </div>
          ))}
          <button onClick={addRow}
            style={{ width:"100%", background:"none", border:`1px dashed ${C.border}`, borderRadius:8, padding:"6px 0", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit", marginTop:4 }}>
            + 과목 추가
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentHome() {
  const { profile, logout } = useAuth();
  const { data: allRequests }       = useCollection("rentalRequests",    "createdAt");
  const { data: notices }           = useCollection("notices",           "createdAt");
  const { data: comments }          = useCollection("noticeComments",    "createdAt");
  const { data: communityPosts }    = useCollection("communityPosts",    "createdAt");
  const { data: communityComments } = useCollection("communityComments", "createdAt");
  const { data: licenseSchedules }  = useCollection("licenseSchedules",  "date");

  const [selectedNotice,  setSelectedNotice]  = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selPost, setSelPost] = useState(null);
  const [commentText,     setCommentText]     = useState("");
  const [submitting,      setSubmitting]      = useState(false);

  // 시간표
  const [classes,       setClasses]       = useState([]);
  const [showTimetable, setShowTimetable] = useState(false); // 편집 모달
  const [showRentory,   setShowRentory]   = useState(false); // 렌토리 소개 모달
  const [showFriendTab, setShowFriendTab] = useState(false); // 친구 시간표 탭
  const [friendId,      setFriendId]      = useState("");    // 검색 학번
  const [friendData,    setFriendData]    = useState(null);  // { name, classes }
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendErr,     setFriendErr]     = useState("");
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
    const hiddenDate = localStorage.getItem(hiddenKey);
    const today = new Date().toISOString().slice(0, 10);
    if (hiddenDate !== today) setPopupNotice(latest);
  }, [notices]);
  const [editClass,     setEditClass]     = useState(null);  // null=추가, obj=수정
  const [showClassForm, setShowClassForm] = useState(false);

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

  const myId = profile?.studentId || profile?.email || "";
  const myRentals = allRequests.filter(r =>
    (r.studentId === myId || r.studentId === profile?.uid) &&
    (r.status === "대여중" || r.status === "연체")
  );
  const myRes = allRequests.filter(r =>
    (r.studentId === myId || r.studentId === profile?.uid) &&
    (r.status === "승인대기" || r.status === "승인됨")
  );

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

  // 친구 시간표 검색
  const searchFriend = async () => {
    if (!friendId.trim()) return;
    setFriendLoading(true);
    setFriendErr("");
    setFriendData(null);
    try {
      // users에서 학번으로 검색
      const { collection, query, where, getDocs, doc, getDoc } = await import("firebase/firestore");
      const q = query(collection(db, "users"), where("studentId", "==", friendId.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setFriendErr("해당 학번의 학생을 찾을 수 없어요"); setFriendLoading(false); return; }
      const user = snap.docs[0].data();
      if (user.timetablePublic === false) { setFriendErr(`${user.name}님은 시간표를 비공개로 설정했어요`); setFriendLoading(false); return; }
      // timetables에서 시간표 조회
      const ttSnap = await getDoc(doc(db, "timetables", snap.docs[0].id));
      const classes = ttSnap.exists() ? (ttSnap.data().classes || []) : [];
      setFriendData({ name: user.name, dept: user.dept, classes });
    } catch(e) {
      setFriendErr("검색 중 오류가 발생했어요");
    }
    setFriendLoading(false);
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
    <div>
      {/* Welcome banner */}
      <div style={{ background: `linear-gradient(135deg,#2D4A9B,${C.teal})`, borderRadius: 20, padding: "20px 20px 12px", marginBottom: 20, position: "relative" }}>
        {/* 로그아웃 버튼 - 배너 우측 상단 */}
        <button onClick={logout} style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:8, padding:"6px 10px", color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          <LogOut size={14} /> 로그아웃
        </button>
        {/* 학번/계열만 표시 */}
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight:600, marginBottom: 14 }}>
          {profile?.role === "professor" ? "교수" : `${profile?.dept} · ${profile?.studentId ? profile.studentId.slice(0,2)+"학번" : ""}`}
        </div>

        {/* 마스코트 + 말풍선 */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <img src="/mascot/hi.png" alt="렌토리" style={{ width:96, height:96, objectFit:"contain", flexShrink:0, filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }} />
          <div style={{ position:"relative", background:"#fff", borderRadius:14, padding:"10px 14px", flex:1, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>
            <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"8px solid transparent", borderBottom:"8px solid transparent", borderRight:"10px solid #fff" }}></div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1B2B6B", marginBottom:3, lineHeight:1.4 }}>
              난 장비대여실 마스코트 렌토리야!
            </div>
            <div style={{ fontSize:12, color:"#475569", lineHeight:1.4 }}>
              오늘도 잘 부탁해, {profile?.name}님!
            </div>
          </div>
        </div>

        {/* 친해지기 버튼 + Designed by - 한 행 */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={() => setShowRentory(true)}
            style={{ background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:14, padding:"4px 10px", fontSize:10, color:"#fff", fontWeight:600, cursor:"pointer", backdropFilter:"blur(8px)" }}>
            렌토리랑 친해져보기 ♡
          </button>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontStyle:"italic" }}>
            Designed &amp; Developed by 윤대식
          </span>
        </div>
      </div>

      {/* 공지 팝업 모달 */}
      {popupNotice && (
        <Modal onClose={() => setPopupNotice(null)} width={440}>
          <div style={{ marginBottom:6 }}>
            <span style={{ background:C.blueLight, color:C.navy, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{popupNotice.category || "공지"}</span>
          </div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:12 }}>{popupNotice.title}</div>
          <div style={{ fontSize:13, color:C.text, lineHeight:1.7, whiteSpace:"pre-wrap", background:C.bg, borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
            {popupNotice.content}
          </div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:14 }}>{popupNotice.date} · {popupNotice.author}</div>

          {/* 댓글 목록 */}
          {(() => {
            const popupComments = comments.filter(c => c.noticeId === popupNotice.id);
            return popupComments.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>댓글 {popupComments.length}</div>
                <div style={{ maxHeight:140, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
                  {popupComments.map(c => (
                    <div key={c.id} style={{ background:C.bg, borderRadius:8, padding:"8px 12px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:C.text }}>{c.authorName}</span>
                        <span style={{ fontSize:10, color:C.muted }}>{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString("ko") : ""}</span>
                      </div>
                      <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 댓글 입력 */}
          <div style={{ display:"flex", gap:6, marginBottom:14 }}>
            <input value={popupComment} onChange={e => setPopupComment(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitPopupComment(); }}}
              placeholder="댓글을 입력하세요..."
              style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, padding:"8px 12px", fontSize:12, fontFamily:"inherit", outline:"none" }} />
            <button onClick={submitPopupComment} disabled={popupSubmitting || !popupComment.trim()}
              style={{ background:C.navy, color:"#fff", border:"none", borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer", opacity: popupComment.trim() ? 1 : 0.5 }}>
              {popupSubmitting ? "..." : "등록"}
            </button>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => {
              localStorage.setItem(`popup_hidden_${popupNotice.id}`, new Date().toISOString().slice(0,10));
              setPopupNotice(null);
            }} style={{ flex:1, background:"none", border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 0", fontSize:13, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
              오늘 하루 안보기
            </button>
            <button onClick={() => setPopupNotice(null)}
              style={{ flex:1, background:C.navy, border:"none", borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit" }}>
              닫기
            </button>
          </div>
        </Modal>
      )}

      {/* 렌토리 소개 모달 */}
      {showRentory && (
        <Modal onClose={() => setShowRentory(false)} width={420}>
          <div style={{ textAlign:"center", padding:"4px" }}>
            <img src="/mascot/hi.png" alt="렌토리" style={{ width:120, height:120, objectFit:"contain", marginBottom:8 }} />
            <div style={{ fontSize:18, fontWeight:900, color:C.text, marginBottom:14 }}>렌토리를 소개합니다!</div>
            <div style={{ fontSize:13, color:C.text, lineHeight:1.7, textAlign:"left", background:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
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
              style={{ background:`linear-gradient(135deg, ${C.teal}, ${C.navy})`, color:"#fff", border:"none", borderRadius:10, padding:"11px 24px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%" }}>
              좋아, 친해질래 ♡
            </button>
          </div>
        </Modal>
      )}

      {/* 시간표 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionTitle>📅 내 시간표</SectionTitle>
          <Btn onClick={() => { setShowClassForm(true); setEditClass(null); }} color={C.navy} small>+ 수업 추가</Btn>
        </div>
        {classes.length === 0 ? (
          <div style={{ background: C.surface, borderRadius: 14, border: `1.5px dashed ${C.border}`, padding: "16px 0", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>시간표가 없어요</div>
            <Btn onClick={() => { setShowClassForm(true); setEditClass(null); }} color={C.navy} small>수업 추가하기</Btn>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 320 }}>
              <Timetable
                classes={classes}
                onEdit={(cls) => { setEditClass(cls); setShowClassForm(true); }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 친구 시간표 보기 */}
      <div style={{ marginBottom:16 }}>
        <button onClick={() => { setShowFriendTab(o=>!o); setFriendData(null); setFriendErr(""); setFriendId(""); }}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 16px", cursor:"pointer", fontFamily:"inherit" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>🗓️</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.text }}>친구 시간표 보기</span>
          </div>
          <span style={{ fontSize:12, color:C.muted }}>{showFriendTab ? "▲" : "▼"}</span>
        </button>

        {showFriendTab && (
          <div style={{ background:C.surface, borderRadius:"0 0 12px 12px", border:`1px solid ${C.border}`, borderTop:"none", padding:"14px 16px" }}>
            {/* 검색창 */}
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input
                value={friendId} onChange={e => setFriendId(e.target.value)}
                onKeyDown={e => e.key==="Enter" && searchFriend()}
                placeholder="학번 입력"
                style={{ flex:1, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}
              />
              <button onClick={searchFriend} disabled={friendLoading}
                style={{ background:C.navy, color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                {friendLoading ? "..." : "검색"}
              </button>
            </div>

            {/* 에러 */}
            {friendErr && (
              <div style={{ background:C.redLight, color:C.red, borderRadius:8, padding:"8px 12px", fontSize:12, marginBottom:10 }}>
                {friendErr}
              </div>
            )}

            {/* 결과 */}
            {friendData && (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{friendData.name}</span>
                  <span style={{ fontSize:11, color:C.muted }}>{friendData.dept}</span>
                </div>
                {friendData.classes.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"20px 0", color:C.muted, fontSize:13 }}>등록된 시간표가 없어요</div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <div style={{ minWidth:320 }}>
                      <Timetable classes={friendData.classes} onEdit={null} readOnly />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 학점 계산기 */}
      <GpaCalculator />

      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

        {/* 공지사항 */}
        <section>
          <SectionTitle>📌 공지사항</SectionTitle>
          {recentNotices.length === 0 && <div style={{ fontSize:13, color:C.muted, padding:"10px 0" }}>공지사항이 없습니다</div>}
          {recentNotices.map(n => {
            const cat = NOTICE_CAT[n.category] || { bg:C.bg, col:C.muted };
            const cmtCount = comments.filter(c => c.noticeId === n.id).length;
            return (
              <Card key={n.id} onClick={() => { setSelectedNotice(n); setCommentText(""); }} style={{ cursor:"pointer", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <span style={{ background:cat.bg, color:cat.col, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:700, flexShrink:0 }}>{n.category}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.title}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
                      <span style={{ fontSize:11, color:C.muted }}>{n.date}</span>
                      {cmtCount > 0 && <span style={{ fontSize:11, color:C.blue, fontWeight:600 }}>💬 {cmtCount}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        {/* 라이센스 수업 */}
        {(() => {
          const today = new Date().toISOString().slice(0,10);
          const upcoming = licenseSchedules
            .filter(s => s.date >= today && s.status !== "완료")
            .sort((a,b) => a.date > b.date ? 1 : -1)
            .slice(0, 3);
          if (upcoming.length === 0) return null;
          return (
            <section>
              <SectionTitle>🎖️ 라이센스 신청 가능한 수업</SectionTitle>
              {upcoming.map(s => (
                <Card key={s.id} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.title || s.equipName}</div>
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

        {/* 에브리타임 최신글 */}
        {profile?.role !== "professor" && (() => {
          const currentYear = new Date().getFullYear();
          const newbiePrefix = String(currentYear).slice(2);
          const isNewbie = (profile?.studentId || "").startsWith(newbiePrefix);
          const recent5 = [...communityPosts]
            .filter(p => p.category !== "새내기" || isNewbie) // 새내기 글은 새내기만
            .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
            .slice(0, 5);
          if (recent5.length === 0) return null;
          return (
            <section>
              <SectionTitle>🔥 에브리타임 최신글</SectionTitle>
              {recent5.map(p => (
                <Card key={p.id} onClick={() => setSelPost(p)} style={{ marginBottom:8, cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                        <span style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:"1px 6px", fontSize:10, color:C.muted, flexShrink:0 }}>{p.category}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, fontSize:11, color:C.muted }}>
                        <span>👍 {p.likes||0}</span>
                        <span>💬 {communityComments.filter(c=>c.postId===p.id).length}</span>
                        <span>👁 {p.views||0}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </section>
          );
        })()}

        {/* 예약현황 */}
        <section>
          <SectionTitle>📋 예약 현황</SectionTitle>
          {myRentals.length > 0 && (
            <>
              <div style={{ fontSize:12, color:C.muted, marginBottom:6, fontWeight:600 }}>대여중</div>
              {myRentals.map(r => (
                <Card key={r.id} onClick={() => setSelectedRequest(r)} style={{ cursor:"pointer", marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{getEquipLabel(r)}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>반납예정: {r.endDate} {r.endTime}</div>
                    </div>
                    <Badge label={r.status} />
                  </div>
                </Card>
              ))}
            </>
          )}
          {myRes.length > 0 ? (
            <>
              {myRentals.length > 0 && <div style={{ fontSize:12, color:C.muted, marginTop:8, marginBottom:6, fontWeight:600 }}>예약됨</div>}
              {myRes.slice(0, 3).map(r => (
                <Card key={r.id} onClick={() => setSelectedRequest(r)} style={{ cursor:"pointer", marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{getEquipLabel(r)}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{r.startDate} ~ {r.endDate}</div>
                    </div>
                    <Badge label={r.status} />
                  </div>
                </Card>
              ))}
            </>
          ) : myRentals.length === 0 && (
            <div style={{ fontSize:13, color:C.muted, padding:"10px 0" }}>예약 내역이 없습니다</div>
          )}
        </section>
      </div>

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
            <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, marginBottom: 8, lineHeight: 1.4 }}>{selectedNotice.title}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{selectedNotice.date} · {selectedNotice.author}</div>
            <div style={{ fontSize: 15, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 28 }}>{selectedNotice.content}</div>
            <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 16 }}>💬 댓글 {detailComments.length}</div>
              {detailComments.length === 0 && (
                <div style={{ textAlign: "center", padding: "16px 0", color: C.muted, fontSize: 13 }}>첫 댓글을 남겨보세요!</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {detailComments.map(c => {
                  const canDelete = c.authorId === profile?.uid;
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
                          {canDelete && (
                            <button onClick={() => deleteComment(c.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer" }}>삭제</button>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{c.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }}}
                  placeholder="댓글 입력 후 Enter"
                  style={{ flex: 1, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "9px 14px", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                <Btn onClick={submitComment} color={C.navy} disabled={submitting || !commentText.trim()}>등록</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* 에브리타임 글 상세 모달 */}
      {selPost && (
        <Modal onClose={() => setSelPost(null)} width={520}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ background:
              selPost.category==="저격" ? C.redLight :
              selPost.category==="새내기" ? C.purpleLight :
              selPost.category==="질문" ? C.orangeLight :
              selPost.category==="정보" ? C.greenLight : C.blueLight,
              color:
              selPost.category==="저격" ? C.red :
              selPost.category==="새내기" ? C.purple :
              selPost.category==="질문" ? C.orange :
              selPost.category==="정보" ? C.green : C.blue,
              borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
              {selPost.category}
            </span>
          </div>
          <div style={{ fontSize:17, fontWeight:800, color:C.navy, marginBottom:8 }}>{selPost.title}</div>
          <div style={{ display:"flex", gap:10, fontSize:12, color:C.muted, marginBottom:16 }}>
            <span>익명</span>
            <span>👁 {selPost.views||0}</span>
            <span>👍 {selPost.likes||0}</span>
            <span>💬 {communityComments.filter(c=>c.postId===selPost.id).length}</span>
          </div>
          <div style={{ fontSize:14, color:C.text, lineHeight:1.8, whiteSpace:"pre-wrap", marginBottom: selPost.images?.length>0?12:0 }}>
            {selPost.content}
          </div>
          {selPost.images?.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:8, marginTop:12 }}>
              {selPost.images.map((url,i) => (
                <img key={i} src={url} alt="" onClick={() => window.open(url,"_blank")}
                  style={{ width:"100%", borderRadius:8, objectFit:"cover", cursor:"pointer", border:`1px solid ${C.border}` }} />
              ))}
            </div>
          )}
          <div style={{ marginTop:16 }}>
            <Btn onClick={() => setSelPost(null)} color={C.muted} outline full>닫기</Btn>
          </div>
        </Modal>
      )}

      {/* 대여 상세 모달 */}
      {selectedRequest && (
        <Modal onClose={() => setSelectedRequest(null)} width={480}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginBottom: 16 }}>{getEquipLabel(selectedRequest)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
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
    </div>
  );
}
