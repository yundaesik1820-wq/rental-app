import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { C } from "../../theme";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useCollection, addItem, updateItem, deleteItem } from "../../hooks/useFirestore";
import { Empty, Btn, Avatar } from "../../components/UI";

// 친구관리 콘트롤타워 — 친구 추가 / 받은 요청 수락·거절 / 내 친구 목록
// friends·friendRequests 데이터 모델은 기존 그대로 재사용 (Home.jsx / PetGame.jsx 로직 추출)
export default function FriendManager({ photoMap }) {
  const { profile } = useAuth();
  const { data: friends }        = useCollection("friends");
  const { data: friendRequests } = useCollection("friendRequests");

  const [addSid, setAddSid]   = useState("");
  const [addMsg, setAddMsg]   = useState(null);   // { ok, m }
  const [addLoading, setAddLoading] = useState(false);
  const [search, setSearch]   = useState("");
  const [busyId, setBusyId]   = useState(null);   // 처리 중인 요청/친구 id

  const uid = profile?.uid;

  // 파생 (Home.jsx 575-587 동일)
  const myFriends = friends.filter(f => f.userId === uid || f.friendId === uid);
  const receivedRequests = friendRequests.filter(r => r.toId === uid && r.status === "pending");
  const sentRequests     = friendRequests.filter(r => r.fromId === uid && r.status === "pending");

  // 학번으로 친구 추가 (PetGame.jsx addByStudentId 재사용)
  const addByStudentId = async () => {
    const sid = addSid.trim();
    setAddMsg(null);
    if (sid.length < 8) { setAddMsg({ ok:false, m:"학번을 정확히 입력해주세요 (8자리)" }); return; }
    if (sid === profile?.studentId) { setAddMsg({ ok:false, m:"본인에게는 신청할 수 없어요" }); return; }
    setAddLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("studentId", "==", sid), where("role", "==", "student")));
      if (snap.empty) { setAddMsg({ ok:false, m:"해당 학번의 학생을 찾을 수 없어요" }); setAddLoading(false); return; }
      const t = snap.docs[0];
      const td = t.data();
      const alreadyFriend = myFriends.some(f =>
        (f.userId === uid && f.friendId === t.id) ||
        (f.friendId === uid && f.userId === t.id)
      );
      if (alreadyFriend) { setAddMsg({ ok:false, m:"이미 친구예요!" }); setAddLoading(false); return; }
      const alreadySent = sentRequests.some(r => r.toId === t.id);
      if (alreadySent) { setAddMsg({ ok:false, m:"이미 신청을 보냈어요" }); setAddLoading(false); return; }
      // 상대가 이미 나에게 보낸 요청이 있는지
      const incoming = receivedRequests.some(r => r.fromId === t.id);
      if (incoming) { setAddMsg({ ok:false, m:`${td.name}님이 이미 신청을 보냈어요. 받은 요청에서 수락하세요` }); setAddLoading(false); return; }
      await addItem("friendRequests", {
        fromId: uid, fromName: profile?.name, fromStudentId: profile?.studentId,
        toId: t.id, toName: td.name, toStudentId: td.studentId,
        status: "pending",
      });
      setAddMsg({ ok:true, m:`${td.name}님께 친구 신청을 보냈어요!` });
      setAddSid("");
    } catch (e) {
      setAddMsg({ ok:false, m:"오류가 발생했어요" });
    }
    setAddLoading(false);
  };

  // 수락 (Home.jsx acceptFriend 재사용) — friends 문서 생성
  const acceptFriend = async (req) => {
    setBusyId(req.id);
    try {
      await updateItem("friendRequests", req.id, { status: "accepted" });
      await addItem("friends", {
        userId: req.fromId, userName: req.fromName, userStudentId: req.fromStudentId,
        friendId: req.toId, friendName: req.toName, friendStudentId: req.toStudentId,
      });
    } catch (e) {}
    setBusyId(null);
  };

  // 거절 (Home.jsx rejectFriend 재사용)
  const rejectFriend = async (req) => {
    setBusyId(req.id);
    try { await updateItem("friendRequests", req.id, { status: "rejected" }); } catch (e) {}
    setBusyId(null);
  };

  // 친구 삭제 (Home.jsx deleteFriend 재사용)
  const deleteFriend = async (f) => {
    if (!window.confirm("친구를 삭제할까요?")) return;
    setBusyId(f.id);
    try { await deleteItem("friends", f.id); } catch (e) {}
    setBusyId(null);
  };

  // 친구 목록 표시용 정규화 + 검색
  const friendList = myFriends
    .map(f => {
      const isMine = f.userId === uid;
      return { ...f, _fid: isMine ? f.friendId : f.userId, _name: isMine ? f.friendName : f.userName, _sid: isMine ? f.friendStudentId : f.userStudentId };
    })
    .filter(f => !search || f._name?.includes(search) || f._sid?.includes(search.trim()))
    .sort((a, b) => (a._name || "").localeCompare(b._name || "", "ko"));

  const inputStyle = {
    flex:1, minWidth:0, background:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10,
    color:C.text, padding:"10px 14px", fontSize:14, fontFamily:"inherit", outline:"none",
  };

  return (
    <div>
      {/* 친구 추가 */}
      <div style={{ marginBottom:8, fontSize:14, fontWeight:800, color:C.text }}>친구 추가</div>
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <input
          value={addSid}
          onChange={e => setAddSid(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={e => { if (e.key === "Enter") addByStudentId(); }}
          placeholder="상대방 학번 8자리"
          inputMode="numeric"
          maxLength={8}
          style={inputStyle}
        />
        <Btn onClick={addByStudentId} disabled={addLoading} color={C.teal} text="#fff">
          {addLoading ? "..." : "신청"}
        </Btn>
      </div>
      {addMsg && (
        <div style={{ fontSize:12, fontWeight:600, marginBottom:16, color: addMsg.ok ? C.teal : C.red }}>
          {addMsg.m}
        </div>
      )}
      {!addMsg && <div style={{ height:16 }} />}

      {/* 받은 요청 */}
      <div style={{ marginBottom:8, fontSize:14, fontWeight:800, color:C.text, display:"flex", alignItems:"center", gap:6 }}>
        받은 요청
        {receivedRequests.length > 0 && (
          <span style={{ background:C.red, color:"#fff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:800 }}>
            {receivedRequests.length}
          </span>
        )}
      </div>
      {receivedRequests.length === 0 ? (
        <div style={{ fontSize:12, color:C.muted, padding:"6px 0 16px" }}>받은 친구 요청이 없어요</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
          {receivedRequests.map(r => (
            <div key={r.id} style={{ display:"flex", alignItems:"center", gap:8, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
              <Avatar name={r.fromName || "?"} size={34} src={photoMap?.[r.fromId]} />
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{r.fromName}</span>
                <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{r.fromStudentId}</span>
              </div>
              <button onClick={() => acceptFriend(r)} disabled={busyId === r.id}
                style={{ background:C.teal, color:"#fff", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, opacity:busyId===r.id?0.6:1 }}>
                수락
              </button>
              <button onClick={() => rejectFriend(r)} disabled={busyId === r.id}
                style={{ background:C.bg, color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, opacity:busyId===r.id?0.6:1 }}>
                거절
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 내 친구 목록 */}
      <div style={{ marginBottom:8, fontSize:14, fontWeight:800, color:C.text }}>
        내 친구 <span style={{ color:C.muted, fontWeight:600 }}>({myFriends.length})</span>
      </div>
      {myFriends.length > 0 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 또는 학번 검색"
          style={{ ...inputStyle, width:"100%", flex:"none", marginBottom:10, fontSize:13, padding:"8px 12px" }} />
      )}
      {myFriends.length === 0 ? (
        <Empty icon="🫂" text="아직 친구가 없어요. 학번으로 친구를 추가해보세요!" />
      ) : friendList.length === 0 ? (
        <div style={{ textAlign:"center", padding:"16px 0", color:C.muted, fontSize:12 }}>검색 결과가 없어요</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {friendList.map(f => (
            <div key={f.id} style={{ display:"flex", alignItems:"center", gap:8, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
              <Avatar name={f._name || "?"} size={34} src={photoMap?.[f._fid]} />
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{f._name}</span>
                <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{f._sid}</span>
              </div>
              <button onClick={() => deleteFriend(f)} disabled={busyId === f.id}
                style={{ background:C.bg, color:C.red, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, opacity:busyId===f.id?0.6:1 }}>
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
