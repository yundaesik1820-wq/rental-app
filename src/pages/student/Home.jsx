import { useState } from "react";
import { C, NOTICE_CAT } from "../../theme";
import { Card, Badge, SectionTitle, Modal, Btn, Avatar } from "../../components/UI";
import { useCollection, addItem, deleteItem } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth.jsx";

export default function StudentHome() {
  const { profile } = useAuth();
  const { data: allRequests } = useCollection("rentalRequests", "createdAt");
  const { data: notices }     = useCollection("notices", "createdAt");
  const { data: comments }    = useCollection("noticeComments", "createdAt");

  const [selectedNotice,  setSelectedNotice]  = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [commentText,     setCommentText]     = useState("");
  const [submitting,      setSubmitting]      = useState(false);

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
      authorRole: profile?.role || "student",
      content:    commentText.trim(),
    });
    setCommentText("");
    setSubmitting(false);
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    await deleteItem("noticeComments", commentId);
  };

  // 상태별 색
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
      <div style={{ background: `linear-gradient(135deg,#2D4A9B,${C.teal})`, borderRadius: 20, padding: "28px 28px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
          {profile?.role === "professor" ? "교수" : `${profile?.dept} · ${profile?.studentId ? profile.studentId.slice(0,2)+"학번" : ""}`}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>
          {profile?.role === "professor"
            ? `${profile?.name} 교수님 안녕하세요 👋`
            : `안녕하세요, ${profile?.name}님 👋`}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          {[["현재 대여중", myRentals.length, "#93C5FD"], ["예약 현황", myRes.length, "#6EE7B7"]].map(([l, v, col]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: col }}>{v}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* 대여 / 예약 */}
        <div>
          <SectionTitle>📋 현재 대여 중</SectionTitle>
          {myRentals.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>대여 중인 장비가 없습니다</div>}
          {myRentals.map(r => (
            <Card key={r.id} onClick={() => setSelectedRequest(r)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{getEquipLabel(r)}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>반납예정: {r.endDate} {r.endTime}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>목적: {r.purpose}</div>
                </div>
                <Badge label={r.status} />
              </div>
            </Card>
          ))}

          <SectionTitle>📅 예약 현황</SectionTitle>
          {myRes.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>예약 내역이 없습니다</div>}
          {myRes.slice(0, 3).map(r => (
            <Card key={r.id} onClick={() => setSelectedRequest(r)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{getEquipLabel(r)}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{r.startDate} ~ {r.endDate}</div>
                </div>
                <Badge label={r.status} />
              </div>
            </Card>
          ))}
        </div>

        {/* 공지사항 */}
        <div>
          <SectionTitle>📌 공지사항</SectionTitle>
          {recentNotices.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>공지사항이 없습니다</div>}
          {recentNotices.map(n => {
            const cat = NOTICE_CAT[n.category] || { bg: C.bg, col: C.muted };
            const cmtCount = comments.filter(c => c.noticeId === n.id).length;
            return (
              <Card key={n.id} onClick={() => { setSelectedNotice(n); setCommentText(""); }} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n.category}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{n.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{n.date}</span>
                      {cmtCount > 0 && <span style={{ fontSize: 11, color: C.blue, fontWeight: 600 }}>💬 {cmtCount}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── 공지 상세 모달 ── */}
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

            {/* 댓글 */}
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
                            {c.authorRole === "admin" && (
                              <span style={{ background: C.navy, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>관리자</span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.muted }}>{formatTime(c.createdAt)}</span>
                            {canDelete && (
                              <button onClick={() => deleteComment(c.id)}
                                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* 댓글 입력 */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <Avatar name={profile?.name || "?"} size={34} />
                <div style={{ flex: 1 }}>
                  <textarea
                    placeholder="댓글을 입력하세요..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                    style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", minHeight: 60, boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Enter 등록 · Shift+Enter 줄바꿈</div>
                </div>
                <Btn onClick={submitComment} color={C.teal} disabled={submitting || !commentText.trim()}>
                  {submitting ? "..." : "등록"}
                </Btn>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <Btn onClick={() => setSelectedNotice(null)} color={C.navy} full>닫기</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* ── 예약/대여 상세 모달 ── */}
      {selectedRequest && (() => {
        const r = selectedRequest;
        const ss = statusStyle(r.status);
        return (
          <Modal onClose={() => setSelectedRequest(null)} width={500}>
            {/* 상태 배지 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>📋 신청 상세</div>
              <span style={{ background: ss.bg, color: ss.col, borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 700 }}>{r.status}</span>
            </div>

            {/* 장비 목록 */}
            <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>🔧 신청 장비</div>
              {(r.items || []).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < (r.items.length - 1) ? `1px solid ${C.border}` : "none" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.modelName || item.equipName}</span>
                    {item.isSet && <span style={{ marginLeft: 6, background: C.orangeLight, color: C.orange, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>세트</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{item.quantity}개</span>
                </div>
              ))}
              {(!r.items || r.items.length === 0) && (
                <div style={{ fontSize: 13, color: C.muted }}>{r.equipName || "-"}</div>
              )}
            </div>

            {/* 기간 */}
            <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>📅 대여 기간</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>대여 시작</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.startDate}</div>
                  <div style={{ fontSize: 12, color: C.blue }}>{r.startTime}</div>
                </div>
                <div style={{ fontSize: 20, color: C.muted }}>→</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>반납</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.endDate}</div>
                  <div style={{ fontSize: 12, color: C.blue }}>{r.endTime}</div>
                </div>
              </div>
            </div>

            {/* 상세 정보 */}
            <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>📝 신청 정보</div>
              {[
                ["사용 목적", r.purpose],
                ["사용 장소", `${r.locationType || ""} ${r.location || ""}`.trim()],
                ["세부 내용", r.purposeDetail],
                r.courseName  && ["수업명", r.courseName],
                r.professorName && ["담당교수", r.professorName],
                r.club        && ["동아리", r.club],
                r.eventName   && ["행사명", r.eventName],
              ].filter(Boolean).map(([k, v]) => v ? (
                <div key={k} style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 72, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v}</span>
                </div>
              ) : null)}
            </div>

            {/* 거절 사유 */}
            {r.reason && (
              <div style={{ background: C.redLight, borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: `1px solid ${C.red}30` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 }}>거절 사유</div>
                <div style={{ fontSize: 13, color: C.red }}>{r.reason}</div>
              </div>
            )}

            <Btn onClick={() => setSelectedRequest(null)} color={C.navy} full>닫기</Btn>
          </Modal>
        );
      })()}
    </div>
  );
}
