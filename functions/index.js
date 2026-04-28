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
    if (!token) return;
    await admin.messaging().send({
      token,
      notification: { title, body },
      webpush: {
        notification: {
          icon:  "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
        },
      },
    });
  } catch (e) {
    console.log("FCM 전송 실패:", e.message);
  }
}

// ── 대여 상태 변경 알림 ────────────────────────────────────
exports.onRentalStatusChange = functions.firestore
  .document("rentalRequests/{reqId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (before.status === after.status) return;
    const usersSnap = await admin.firestore().collection("users")
      .where("studentId", "==", after.studentId).limit(1).get();
    if (usersSnap.empty) return;
    const uid   = usersSnap.docs[0].id;
    const equip = after.items?.[0]?.modelName || after.equipName || "장비";
    const messages = {
      "승인됨":   { title: "✅ 대여 승인됨",   body: `${equip} 대여가 승인됐어요!` },
      "거절됨":   { title: "❌ 대여 거절됨",   body: `${equip} 대여가 거절됐어요.` },
      "대여중":   { title: "📦 대여 시작",     body: `${equip} 대여가 시작됐어요.` },
      "반납완료": { title: "✅ 반납 완료",      body: `${equip} 반납이 확인됐어요.` },
      "보류":     { title: "⏸ 보류 처리됨",    body: `${equip} 대여가 보류됐어요.` },
      "연체":     { title: "⚠️ 반납 연체 중",   body: `${equip} 반납이 지연되고 있어요!` },
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
      .where("studentId", "==", after.studentId).limit(1).get();
    if (usersSnap.empty) return;
    const uid      = usersSnap.docs[0].id;
    const facility = after.facilityName || "시설";
    const messages = {
      "승인됨":   { title: "✅ 시설 대여 승인됨", body: `${facility} 대여가 승인됐어요!` },
      "거절됨":   { title: "❌ 시설 대여 거절됨", body: `${facility} 대여가 거절됐어요.` },
      "반납완료": { title: "✅ 시설 반납 완료",    body: `${facility} 반납이 확인됐어요.` },
    };
    const msg = messages[after.status];
    if (msg) await sendFCM(uid, msg.title, msg.body);
  });

// ── 새 공지사항 알림 ──────────────────────────────────────
exports.onNewNotice = functions.firestore
  .document("notices/{noticeId}")
  .onCreate(async (snap) => {
    const notice    = snap.data();
    const usersSnap = await admin.firestore().collection("users")
      .where("status", "==", "approved").where("role", "==", "student").get();
    const sends = usersSnap.docs
      .filter(d => d.data().fcmToken)
      .map(d => sendFCM(d.id, `📌 새 공지: ${notice.title}`, notice.content?.slice(0, 60) || ""));
    await Promise.allSettled(sends);
  });
