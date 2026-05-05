const functions = require("firebase-functions");
const admin     = require("firebase-admin");

admin.initializeApp();

// ── 비밀번호 초기화 ────────────────────────────────────────
exports.resetStudentPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  const callerDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin")
    throw new functions.https.HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
  const { studentId, requestId } = data;
  if (!studentId) throw new functions.https.HttpsError("invalid-argument", "학번이 필요합니다.");
  const email = `${studentId}@kbas.ac.kr`;
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: "123456" });
    if (requestId) {
      await admin.firestore().collection("pwResetRequests").doc(requestId)
        .update({ status: "done", doneAt: new Date().toISOString() });
    }
    return { success: true, message: `${studentId} 비밀번호가 123456으로 초기화됐습니다.` };
  } catch (e) {
    throw new functions.https.HttpsError("not-found", "해당 학번의 계정을 찾을 수 없습니다: " + e.message);
  }
});

// ── FCM 알림 전송 헬퍼 ────────────────────────────────────
async function sendFCM(userId, title, body) {
  try {
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const token   = userDoc.data()?.fcmToken;
    console.log(`FCM 전송 시도 - userId: ${userId}, token: ${token ? token.slice(0,20)+"..." : "없음"}`);
    if (!token) { console.log("토큰 없음 - 전송 취소"); return; }
    // notification 필드 제거 → iOS 자동 표시 방지
    // 서비스워커가 data를 받아 직접 표시 (중복 방지)
    const result = await admin.messaging().send({
      token,
      data: { title, body },
      webpush: {
        fcm_options: { link: "https://rental-app-delta-kohl.vercel.app" },
      },
    });
    console.log("FCM 전송 성공:", result);
  } catch (e) {
    console.error("FCM 전송 실패:", e.code, e.message);
  }
}

// ── 대여 상태 변경 알림 ────────────────────────────────────
exports.onRentalStatusChange = functions.firestore
  .document("rentalRequests/{reqId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (before.status === after.status) return;

    // 중복 알림 방지 - 별도 컬렉션으로 원자적 처리
    const dedupId  = `${change.after.id}_${after.status}`;
    const dedupRef = admin.firestore().collection("fcmSent").doc(dedupId);

    const alreadySent = await admin.firestore().runTransaction(async (tx) => {
      const doc = await tx.get(dedupRef);
      if (doc.exists) return true;
      tx.set(dedupRef, { sentAt: admin.firestore.FieldValue.serverTimestamp() });
      return false;
    });

    if (alreadySent) return;
    const usersSnap = await admin.firestore().collection("users")
      .where("studentId", "==", after.studentId)
      .where("status", "==", "approved")
      .limit(1).get();
    if (usersSnap.empty) return;
    const uid  = usersSnap.docs[0].id;
    const name = after.studentName || usersSnap.docs[0].data().name || "학생";
    console.log(`대여 알림 대상 - studentId: ${after.studentId}, uid: ${uid}`);
    const messages = {
      "승인됨":   { title: "✅ 대여 승인됨",   body: `${name}님의 대여가 승인됐어요! 신청하신 날짜에 맞춰 방문해주세요.` },
      "거절됨":   { title: "❌ 대여 거절됨",   body: `${name}님의 대여가 거절됐어요. 앱에 접속해 사유를 확인해주세요.` },
      "반납완료": { title: "✅ 반납 완료",      body: `${name}님의 반납이 확인됐어요.` },
      "보류":     { title: "⏸ 보류 처리됨",    body: `${name}님의 대여가 보류됐어요. 앱에 접속해 사유를 확인해주세요.` },
      "연체":     { title: "⚠️ 반납 연체 중",   body: `${name}님의 반납이 지연되고 있어요!` },
    };
    const msg = messages[after.status];
    if (msg) await sendFCM(uid, msg.title, msg.body);
  });

// ── 시설 대여 상태 변경 알림 ──────────────────────────────
exports.onFacilityStatusChange = functions.firestore
  .document("facilityRequests/{reqId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (before.status === after.status) return;
    const usersSnap = await admin.firestore().collection("users")
      .where("studentId", "==", after.studentId)
      .where("status", "==", "approved")
      .limit(1).get();
    if (usersSnap.empty) return;
    const uid      = usersSnap.docs[0].id;
    const name2    = after.studentName || usersSnap.docs[0].data().name || "학생";
    const facility = after.facilityName || "시설";
    const messages = {
      "승인됨":   { title: "✅ 시설 대여 승인됨", body: `${name2}님의 ${facility} 대여가 승인됐어요!` },
      "거절됨":   { title: "❌ 시설 대여 거절됨", body: `${name2}님의 ${facility} 대여가 거절됐어요.` },
      "반납완료": { title: "✅ 시설 반납 완료",    body: `${name2}님의 ${facility} 반납이 확인됐어요.` },
    };
    const msg = messages[after.status];
    if (msg) await sendFCM(uid, msg.title, msg.body);
  });

// ── 새 공지사항 알림 ──────────────────────────────────────
exports.onNewNotice = functions.firestore
  .document("notices/{noticeId}")
  .onCreate(async (snap) => {
    const notice = snap.data();
    // sendAlert가 false면 알림 전송 안 함
    if (notice.sendAlert === false) return;
    const usersSnap = await admin.firestore().collection("users")
      .where("status", "==", "approved").where("role", "==", "student").get();
    const sends = usersSnap.docs
      .filter(d => d.data().fcmToken)
      .map(d => sendFCM(d.id, `📌 공지사항: ${notice.title}`, ""));
    await Promise.allSettled(sends);
  });

// ── 에브리타임 댓글 알림 ──────────────────────────────────
exports.onCommunityComment = functions.firestore
  .document("communityComments/{commentId}")
  .onCreate(async (snap) => {
    const comment = snap.data();
    if (!comment.postId) return;

    // 게시글 조회
    const postDoc = await admin.firestore()
      .collection("communityPosts").doc(comment.postId).get();
    if (!postDoc.exists) return;

    const post = postDoc.data();
    const postAuthorId = post.authorId;

    // 본인 댓글은 알림 없음
    if (!postAuthorId || postAuthorId === comment.authorId) return;

    // 게시글 작성자 uid로 FCM 전송
    const categoryNames = {
      "자유": "자유게시판", "질문": "질문게시판", "강의": "강의게시판",
      "정보": "정보게시판", "취업": "취업게시판", "장터": "장터게시판", "새내기": "새내기게시판"
    };
    const catName = categoryNames[post.category] || "에브리타임";
    const postTitle = post.lectureName || post.title || "게시글";
    // 익명 게시판은 작성자 이름 숨김
    const anonCategories = ["자유", "질문", "강의", "새내기"];
    const isAnon = anonCategories.includes(post.category);
    const commenterDisplay = isAnon ? "익명의 누군가" : (comment.authorName || "누군가");

    await sendFCM(
      postAuthorId,
      `💬 ${catName} 새 댓글`,
      `"${postTitle.slice(0, 20)}${postTitle.length > 20 ? "..." : ""}"에 ${commenterDisplay}가 댓글을 달았어요!`
    );
  });
