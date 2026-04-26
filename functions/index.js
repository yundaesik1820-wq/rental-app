const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// 비밀번호 초기화 함수 (관리자만 호출 가능)
exports.resetStudentPassword = functions.https.onCall(async (data, context) => {
  // 1. 로그인 확인
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  // 2. 관리자 권한 확인
  const callerDoc = await admin.firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
  }

  const { studentId, requestId } = data;
  if (!studentId) {
    throw new functions.https.HttpsError("invalid-argument", "학번이 필요합니다.");
  }

  // 3. 해당 학번의 Firebase Auth 계정 찾기
  const email = `${studentId}@kbas.ac.kr`;
  try {
    const user = await admin.auth().getUserByEmail(email);
    // 4. 비밀번호를 123456으로 변경
    await admin.auth().updateUser(user.uid, { password: "123456" });

    // 5. Firestore 요청 상태 완료 처리
    if (requestId) {
      await admin.firestore()
        .collection("pwResetRequests")
        .doc(requestId)
        .update({ status: "done", doneAt: new Date().toISOString() });
    }

    return { success: true, message: `${studentId} 비밀번호가 123456으로 초기화됐습니다.` };
  } catch (e) {
    throw new functions.https.HttpsError("not-found", "해당 학번의 계정을 찾을 수 없습니다: " + e.message);
  }
});
