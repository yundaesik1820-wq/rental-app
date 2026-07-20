const functions = require("firebase-functions/v1");
const admin     = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

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
// 한 계정이 웹(크롬)+앱을 동시에 써도 모두 수신하도록 플랫폼별 토큰 배열에 각각 발송:
//   웹 토큰      → data-only 페이로드 (서비스워커가 직접 표시 → 중복 방지)
//   네이티브 토큰 → notification 페이로드 (iOS/Android 백그라운드에서 시스템 자동 표시)
// 죽은 토큰은 응답을 보고 배열에서 자동 정리한다.
const LINK = "https://rental-app-delta-kohl.vercel.app";

function isDeadToken(err) {
  const code = err?.code || "";
  return code === "messaging/registration-token-not-registered"
      || code === "messaging/invalid-registration-token"
      || code === "messaging/invalid-argument";
}

// users 문서에 발송 가능한 토큰이 하나라도 있는지 (대상 필터용)
function hasToken(d) {
  return !!(d?.fcmToken
    || (Array.isArray(d?.webTokens)    && d.webTokens.length)
    || (Array.isArray(d?.nativeTokens) && d.nativeTokens.length));
}

async function sendFCM(userId, title, body) {
  try {
    const ref  = admin.firestore().collection("users").doc(userId);
    const data = (await ref.get()).data() || {};

    const webTokens    = Array.isArray(data.webTokens)    ? [...data.webTokens]    : [];
    const nativeTokens = Array.isArray(data.nativeTokens) ? [...data.nativeTokens] : [];
    // 하위호환: 구 단일 fcmToken(플랫폼 미상)은 웹으로 간주 (재로그인 시 새 배열로 이전됨)
    if (data.fcmToken && !webTokens.includes(data.fcmToken) && !nativeTokens.includes(data.fcmToken)) {
      webTokens.push(data.fcmToken);
    }
    if (!webTokens.length && !nativeTokens.length) {
      console.log(`토큰 없음 - 전송 취소 (userId: ${userId})`); return;
    }

    const dead = [];

    if (webTokens.length) {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: webTokens,
        data: { title, body },
        webpush: { fcm_options: { link: LINK } },
      });
      res.responses.forEach((r, i) => { if (!r.success && isDeadToken(r.error)) dead.push(webTokens[i]); });
    }

    if (nativeTokens.length) {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: nativeTokens,
        notification: { title, body },
        android: { priority: "high", notification: { sound: "default" } },
        apns:    { payload: { aps: { sound: "default" } } },
      });
      res.responses.forEach((r, i) => { if (!r.success && isDeadToken(r.error)) dead.push(nativeTokens[i]); });
    }

    console.log(`FCM 전송 - userId: ${userId}, 웹 ${webTokens.length} / 앱 ${nativeTokens.length}, 무효 ${dead.length}`);

    if (dead.length) {
      const update = {
        webTokens:    admin.firestore.FieldValue.arrayRemove(...dead),
        nativeTokens: admin.firestore.FieldValue.arrayRemove(...dead),
      };
      // 구 단일 필드가 죽었으면 함께 제거 (배열엔 없으므로 별도 처리)
      if (data.fcmToken && dead.includes(data.fcmToken)) {
        update.fcmToken = admin.firestore.FieldValue.delete();
      }
      await ref.update(update).catch((e) => console.error("무효 토큰 정리 실패:", e.message));
    }
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
    // 신청 장비명 추출 ("FX3 외 2건" 형태)
    const itemNames = (after.items || [])
      .map(i => i.modelName || i.equipName || "")
      .filter(Boolean);
    const label = itemNames.length > 1
      ? `${itemNames[0]} 외 ${itemNames.length - 1}건`
      : (itemNames[0] || after.equipName || "장비");
    const messages = {
      "승인됨":   { title: "대여가 승인됐어요 🎉",       body: `${name}님, 요청하신 신청건이 승인됐어요. 신청한 시간에 맞춰 방문해주세요!` },
      "거절됨":   { title: "대여가 거절됐어요 😢",       body: `${name}님, 요청하신 신청건이 거절됐어요. 앱에서 사유를 확인해주세요!` },
      "대여중":   { title: "멋진 작품 만드시길 바래요!", body: `${name}님, 즐거운 촬영하시길 바래요. 반납 전에 촬영 중인 사진 업로드! 잊지 않으셨죠?` },
      "반납완료": { title: "반납이 완료됐어요!",         body: `${name}님, 반납이 정상적으로 확인됐어요! 이용해주셔서 감사해요!` },
      "보류":     { title: `${name}님의 신청이 보류중이에요.`, body: "앱에서 자세한 사유를 확인해주세요!" },
      "연체":     { title: "🚨반납시간이 지났어요🚨",     body: `${name}님, 반납이 늦어지고 있어요. 빠르게 반납해주세요!` },
    };
    const msg = messages[after.status];
    if (msg) await sendFCM(uid, msg.title, msg.body);
  });

// ── 대여 신청 접수 알림 (신청 직후) ────────────────────────
exports.onRentalCreate = functions.firestore
  .document("rentalRequests/{reqId}")
  .onCreate(async (snap) => {
    const d = snap.data();
    // 학생 조회 (onRentalStatusChange과 동일 방식)
    const usersSnap = await admin.firestore().collection("users")
      .where("studentId", "==", d.studentId)
      .where("status", "==", "approved")
      .limit(1).get();
    if (usersSnap.empty) return;
    const uid  = usersSnap.docs[0].id;
    const name = d.studentName || usersSnap.docs[0].data().name || "학생";
    await sendFCM(
      uid,
      "신청이 완료됐어요!",
      `${name}님의 소중한 신청 잘 받았어요! 열심히 검토할게요🔥`
    );
  });

// ── 새 공지사항 알림 ──────────────────────────────────────
exports.onNewNotice = functions.firestore
  .document("notices/{noticeId}")
  .onCreate(async (snap) => {
    const notice = snap.data();
    // sendAlert가 명시적으로 true일 때만 전송 (undefined, null, false 모두 전송 안 함)
    if (notice.sendAlert !== true) return;
    const usersSnap = await admin.firestore().collection("users")
      .where("status", "==", "approved").where("role", "==", "student").get();
    const sends = usersSnap.docs
      .filter(d => hasToken(d.data()))
      .map(d => sendFCM(d.id, "새 공지사항이 있어요", notice.title || ""));
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
    const commenterDisplay = isAnon ? "익명의 누군가가" : `${comment.authorName || "누군가"}님이`;

    await sendFCM(
      postAuthorId,
      "내 글에 새 댓글이 달렸어요",
      `"${postTitle.slice(0, 20)}${postTitle.length > 20 ? "..." : ""}"에 ${commenterDisplay} 댓글을 남겼어요!`
    );
  });

// ── 연체 자동 처리 (30분마다 실행) ──────────────────────────
exports.checkOverdue = functions.pubsub
  .schedule("*/30 * * * *")   // 30분마다
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const now = new Date();
    // KST 현재 날짜/시간
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = kst.toISOString().slice(0, 10);       // YYYY-MM-DD
    const timeStr  = kst.toISOString().slice(11, 16);      // HH:MM
    const alertTime = new Date(kst.getTime() - 30 * 60 * 1000); // 30분 전
    const alertTimeStr = alertTime.toISOString().slice(11, 16);

    const snap = await admin.firestore()
      .collection("rentalRequests")
      .where("status", "==", "대여중")
      .get();

    const statusBatch = admin.firestore().batch();
    const newOverdue = [];
    const alertTargets = [];
    const preAlertTargets = [];   // 반납 1시간 전 알림 대상

    snap.docs.forEach(doc => {
      const d = doc.data();
      if (!d.endDate || !d.endTime) return;

      const endDateTime = `${d.endDate}T${d.endTime}`;
      const endKst = `${d.endDate}T${timeStr}`;

      // 반납 시간이 지남 → 연체로 상태 변경
      if (d.endDate < todayStr || (d.endDate === todayStr && d.endTime <= timeStr)) {
        statusBatch.update(doc.ref, { status: "연체" });
        newOverdue.push({ id: doc.id, uid: d.studentId, name: d.studentName });
      } else if (!d.preReturnAlerted) {
        // 반납 1시간 전 알림 (아직 안 보낸 대여중 건만, 한 번만 발송)
        const endMs = new Date(`${d.endDate}T${d.endTime}:00+09:00`).getTime();
        const diff  = endMs - now.getTime();
        if (diff > 0 && diff <= 60 * 60 * 1000) {
          statusBatch.update(doc.ref, { preReturnAlerted: true });
          preAlertTargets.push({ uid: d.studentId, name: d.studentName });
        }
      }
    });

    // 연체 상태인 항목 조회 → 30분 초과 알림 (overdueAlerted 없는 것만)
    const overdueSnap = await admin.firestore()
      .collection("rentalRequests")
      .where("status", "==", "연체")
      .where("overdueAlerted", "==", false)
      .get();

    overdueSnap.docs.forEach(doc => {
      const d = doc.data();
      if (!d.endDate || !d.endTime) return;
      // 반납 시간 + 30분이 현재보다 이전이면 알림
      const endMs = new Date(`${d.endDate}T${d.endTime}:00+09:00`).getTime();
      const nowMs  = now.getTime();
      if (nowMs - endMs >= 30 * 60 * 1000) {
        statusBatch.update(doc.ref, { overdueAlerted: true });
        alertTargets.push({ uid: d.studentId, name: d.studentName });
      }
    });

    if (Object.keys(statusBatch._ops || {}).length > 0 ||
        newOverdue.length > 0 || alertTargets.length > 0 || preAlertTargets.length > 0) {
      await statusBatch.commit();
    }

    // 새로 연체된 학생 - overdueAlerted 초기화만 (연체 푸시는 onRentalStatusChange가 단독 발송 → 중복 방지)
    await Promise.allSettled(
      newOverdue.map(r =>
        admin.firestore().collection("rentalRequests").doc(r.id)
          .update({ overdueAlerted: false })
      )
    );

    // 30분 초과 연체 알림
    await Promise.allSettled(
      alertTargets.map(r =>
        sendFCM(r.uid, "아직 반납되지 않았어요 🚨", "연체 30분이 지났어요. 연체가 계속되면 다음 대여가 제한될 수 있어요!")
      )
    );

    // 반납 1시간 전 알림
    await Promise.allSettled(
      preAlertTargets.map(r =>
        sendFCM(r.uid, "장비 반납 1시간 전이에요!", "반납 전 예약내역에서 장비사용사진 업로드! 잊지말고 꼭 해주세요!")
      )
    );

    console.log(`연체 처리: ${newOverdue.length}건, 30분 알림: ${alertTargets.length}건, 반납1시간전: ${preAlertTargets.length}건`);
    return null;
  });

// ── 가입 승인 알림 ────────────────────────────────────────
exports.onUserApproved = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (before.status === after.status) return;
    if (before.status !== "pending" || after.status !== "approved") return;
    const name = after.name || "";
    await sendFCM(
      context.params.userId,
      "가입이 승인됐어요",
      `${name ? name + "님, " : ""}이제 로그인하고 장비를 대여할 수 있어요!`
    );
  });

// ── 프로젝트 스튜디오 팀원 초대 알림 ──────────────────────────
// crewMembers 문서에 가입 학생(userId)이 연동되면 그 학생에게 푸시.
// 앱 내 알림 벨은 클라이언트 buildAlerts가 별도로 처리 → 여기선 푸시만 담당.
function crewInviteMessage(d) {
  const projectTitle = d.projectTitle || "프로젝트";
  const role = d.role || "팀원";
  const inviter = d.inviterName ? `${d.inviterName}님이 ` : "";
  return {
    title: "프로젝트에 초대됐어요 🎬",
    body: `${inviter}'${projectTitle}' 프로젝트의 ${role} 팀원으로 추가했어요! 프로젝트 스튜디오에서 확인해보세요.`,
  };
}

exports.onCrewMemberInvite = functions.firestore
  .document("crewMembers/{crewId}")
  .onCreate(async (snap) => {
    const d = snap.data();
    // 가입 학생이 연동됐고, 소유자 본인을 자기 프로젝트에 넣은 게 아닐 때만
    if (!d.userId || d.userId === d.ownerId) return;
    const msg = crewInviteMessage(d);
    await sendFCM(d.userId, msg.title, msg.body);
  });

// 수정으로 연동 학생이 새로 바뀐 경우(수기 → 가입학생, 또는 다른 학생으로 교체)에도 발송
exports.onCrewMemberReassign = functions.firestore
  .document("crewMembers/{crewId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (!after.userId || after.userId === after.ownerId) return;
    if (before.userId === after.userId) return; // 사람이 안 바뀌면 스킵
    const msg = crewInviteMessage(after);
    await sendFCM(after.userId, msg.title, msg.body);
  });

// ── 관리자 수동 알림 (제목/내용 직접 입력해서 발송) ──────────
// 호출 예: sendCustomAlert({ title, body, target: "all" })            → 승인된 학생 전체
//          sendCustomAlert({ title, body, target: "25237001, 25237002" }) → 특정 학번 여러 명(쉼표 구분)
exports.sendCustomAlert = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  const callerDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin")
    throw new functions.https.HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");

  const { title, body, target } = data || {};
  if (!title || !target)
    throw new functions.https.HttpsError("invalid-argument", "제목과 대상(target)이 필요합니다.");

  if (target === "all") {
    const usersSnap = await admin.firestore().collection("users")
      .where("status", "==", "approved").where("role", "==", "student").get();
    const targets = usersSnap.docs.filter(d => hasToken(d.data()));
    await Promise.allSettled(targets.map(d => sendFCM(d.id, title, body || "")));
    return { success: true, sent: targets.length };
  }

  // 특정 학번 — 쉼표/공백으로 여러 명 입력 가능 (예: "25237001, 25237002")
  const ids = String(target).split(/[\s,]+/).filter(Boolean);
  if (ids.length === 0)
    throw new functions.https.HttpsError("invalid-argument", "학번을 입력해주세요.");

  let sent = 0;
  const notFound = [];
  for (const sid of ids) {
    const snap = await admin.firestore().collection("users")
      .where("studentId", "==", sid).limit(1).get();
    if (snap.empty) { notFound.push(sid); continue; }
    await sendFCM(snap.docs[0].id, title, body || "");
    sent++;
  }
  return { success: true, sent, notFound };
});

// ── 시간표 이미지 → AI 파싱 (Claude 비전) ──────────────────
// 학생이 시간표 스크린샷을 올리면 수업 목록(요일/수업명/강의실/교수/시간)으로 추출.
const TIMETABLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    classes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          day:       { type: "string", enum: ["월", "화", "수", "목", "금"] },
          name:      { type: "string" },
          location:  { type: "string" },
          professor: { type: "string" },
          startTime: { type: "string", description: "HH:MM 24시간 형식" },
          endTime:   { type: "string", description: "HH:MM 24시간 형식" },
        },
        required: ["day", "name", "location", "professor", "startTime", "endTime"],
      },
    },
  },
  required: ["classes"],
};

exports.parseTimetableImage = functions
  .runWith({ secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 120, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth)
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");

    const { imageBase64, mediaType } = data || {};
    if (!imageBase64)
      throw new functions.https.HttpsError("invalid-argument", "이미지가 없습니다.");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const media = allowed.includes(mediaType) ? mediaType : "image/jpeg";

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt =
      "이 이미지는 대학교 주간 시간표야. 표에 있는 모든 수업을 추출해줘.\n" +
      "- 요일은 월/화/수/목/금 중 하나로.\n" +
      "- 시간은 24시간 HH:MM 형식(예: 09:00, 13:30). 교시만 있으면 1교시=09:00 기준으로 합리적으로 환산.\n" +
      "- 강의실/교수명이 안 보이면 빈 문자열로.\n" +
      "- 표에 실제로 있는 수업만, 빈 칸은 무시.";

    let parsed;
    try {
      const resp = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 4000,
        output_config: { format: { type: "json_schema", schema: TIMETABLE_SCHEMA } },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media, data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      });
      const textBlock = (resp.content || []).find((b) => b.type === "text");
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      console.error("시간표 파싱 실패:", e);
      throw new functions.https.HttpsError("internal", "시간표 인식에 실패했어요. 더 선명한 사진으로 다시 시도해줘.");
    }

    const classes = Array.isArray(parsed.classes) ? parsed.classes : [];
    return { classes };
  });

// ── Project Studio AI 프로덕션 매니저 (Claude) ──────────────
// 클라이언트가 프로젝트 데이터 요약(context)과 질문(message)을 보내면
// Claude가 실용적 조언 + 추천 할 일을 구조화 출력으로 반환.
const PS_ASSISTANT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string", description: "한국어 반말로 3~5문장의 실용적 답변" },
    suggestedTasks: {
      type: "array",
      items: { type: "string" },
      description: "추가하면 좋을 할 일 목록 (없으면 빈 배열). 각 항목은 짧은 문장.",
    },
  },
  required: ["answer", "suggestedTasks"],
};

exports.projectStudioAssistant = functions
  .runWith({ secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth)
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");

    const projectContext = String(data?.context || "").slice(0, 8000);
    const message = String(data?.message || "").trim().slice(0, 1000);
    if (!message)
      throw new functions.https.HttpsError("invalid-argument", "질문이 없습니다.");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const system =
      "너는 학생 영상 제작을 돕는 '프로덕션 매니저 AI'야. 주어진 프로젝트 데이터만 근거로 " +
      "구체적이고 실용적인 조언을 한국어 반말로 짧게(3~5문장) 해줘. " +
      "데이터를 직접 수정하지 말고, 할 일을 추천할 땐 suggestedTasks 배열에 담아(추천할 게 없으면 빈 배열). " +
      "데이터에 없는 정보는 지어내지 말고 모른다고 해. 촬영 현장·일정·예산·장비·캐스팅 실무 관점으로 답해.";

    let parsed;
    try {
      const resp = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        system,
        output_config: { format: { type: "json_schema", schema: PS_ASSISTANT_SCHEMA } },
        messages: [{ role: "user", content: `[프로젝트 데이터]\n${projectContext}\n\n[질문]\n${message}` }],
      });
      const textBlock = (resp.content || []).find((b) => b.type === "text");
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      console.error("projectStudioAssistant 실패:", e);
      throw new functions.https.HttpsError("internal", "AI 응답 생성에 실패했어요. 잠시 후 다시 시도해줘.");
    }

    return {
      answer: parsed.answer || "",
      suggestedTasks: Array.isArray(parsed.suggestedTasks) ? parsed.suggestedTasks.slice(0, 8) : [],
    };
  });

// ── 매일 오전 9시(KST) 오늘의 퀴즈 자동 등록 ────────────────
// quizPool에서 아직 안 쓴 문제 하나를 꺼내 quizzes/{오늘날짜}에 등록하고 used 처리.
async function runDailyQuizPost() {
  const db = admin.firestore();
  // 클라이언트 todayStr()과 동일한 KST YYYY-MM-DD 포맷
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  const existing = await db.collection("quizzes").doc(today).get();
  if (existing.exists) {
    console.log(`[quiz] ${today} 이미 등록돼 있음 - 건너뜀`);
    return { status: "already-exists", date: today };
  }

  // where+orderBy 복합 인덱스가 필요 없도록 안 쓴 문제 전부 받아 메모리에서 오래된 순 정렬 (풀 최대 수백 개 수준)
  const snap = await db.collection("quizPool").where("used", "==", false).get();
  if (snap.empty) {
    console.log("[quiz] quizPool에 남은 문제 없음 - 오늘은 자동 출제 못 함");
    return { status: "empty-pool", date: today, remaining: 0 };
  }

  const picked = snap.docs.slice().sort((a, b) =>
    (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0)
  )[0];
  const q = picked.data();
  await db.collection("quizzes").doc(today).set({
    question: q.question,
    options: q.options,
    answer: q.answer,
    date: today,
  });
  await picked.ref.update({ used: true, usedDate: today });
  console.log(`[quiz] ${today} 자동 출제 완료: ${q.question}`);
  return { status: "posted", date: today, question: q.question, remaining: snap.size - 1 };
}

exports.postDailyQuiz = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    await runDailyQuizPost();
    return null;
  });
