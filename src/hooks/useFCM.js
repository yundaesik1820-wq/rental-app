import { useEffect } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { Capacitor } from "@capacitor/core";

const VAPID_KEY = "BLPGJBCYMn5hajgFcqpus-4noZQwFtpD4pZOV93yWk2cO1dCWEd_iS7m-9qMV2Dr_MtcAlMHjF7EPdY1z8BzNds";

/* ───────── 토큰 저장 (웹·네이티브 공통) ───────── */
// 플랫폼별 배열에 arrayUnion으로 누적 → 웹(크롬)과 앱을 같은 계정으로 동시에 써도
// 토큰이 서로 덮어써지지 않고 둘 다 보관됨. 서버는 두 배열에 각각 발송한다.
async function saveToken(userId, token, native) {
  if (!token) return;
  const field = native ? "nativeTokens" : "webTokens";
  await updateDoc(doc(db, "users", userId), { [field]: arrayUnion(token) });
  console.log(`FCM 토큰 Firestore 저장 완료 (${field})`);
}

/* ───────── iOS / Android 네이티브 푸시 ───────── */
async function initNativeFCM(userId) {
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

  // 1. 권한 요청 (iOS는 시스템 팝업 뜸)
  const perm = await FirebaseMessaging.requestPermissions();
  console.log("네이티브 알림 권한:", perm.receive);

  // 1-1. 안드로이드: 카메라 권한도 함께 요청 (폴스컬러 등 카메라 기능용)
  //      iOS는 기존처럼 카메라 사용 시점에 자동으로 뜨므로 건드리지 않는다.
  //      @capacitor/camera 미설치 시 import가 실패해도 catch로 조용히 넘어감.
  if (Capacitor.getPlatform() === "android") {
    try {
      const { Camera } = await import("@capacitor/camera");
      const camPerm = await Camera.requestPermissions({ permissions: ["camera"] });
      console.log("네이티브 카메라 권한:", camPerm.camera);
    } catch (e) {
      console.log("카메라 권한 요청 건너뜀:", e.message);
    }
  }

  if (perm.receive !== "granted") return;

  // 2. FCM 토큰 발급 → 네이티브 토큰 배열에 저장
  const { token } = await FirebaseMessaging.getToken();
  console.log("네이티브 FCM 토큰:", token ? "발급 완료" : "발급 실패");
  await saveToken(userId, token, true);

  // 3. 토큰 갱신 대응
  await FirebaseMessaging.addListener("tokenReceived", async (e) => {
    await saveToken(userId, e.token, true);
  });

  // 4. 포그라운드 수신 로그 (표시는 presentationOptions가 처리)
  await FirebaseMessaging.addListener("notificationReceived", (e) => {
    console.log("푸시 수신(포그라운드):", e.notification?.title);
  });

  // 5. 알림 탭 시 동작 (필요하면 라우팅 추가)
  await FirebaseMessaging.addListener("notificationActionPerformed", (e) => {
    console.log("푸시 탭:", e.notification?.title);
  });
}

/* ───────── 웹(브라우저/PWA) 푸시 — 기존 로직 ───────── */
function waitForActiveServiceWorker(registration) {
  return new Promise((resolve) => {
    if (registration.active) { resolve(registration); return; }
    const sw = registration.installing || registration.waiting;
    if (!sw) { resolve(registration); return; }
    sw.addEventListener("statechange", function handler() {
      if (sw.state === "activated") {
        sw.removeEventListener("statechange", handler);
        resolve(registration);
      }
    });
  });
}

async function initWebFCM(userId) {
  if (!("Notification" in window)) return;
  if (!("serviceWorker" in navigator)) return;

  const permission = await Notification.requestPermission();
  console.log("웹 알림 권한:", permission);
  if (permission !== "granted") return;

  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  await waitForActiveServiceWorker(swReg);

  const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
  const { getApp } = await import("firebase/app");
  const msg = getMessaging(getApp());

  const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  await saveToken(userId, token, false);

  onMessage(msg, (payload) => {
    if (document.visibilityState === "visible") {
      // 서버는 data 페이로드로 전송(notification 필드 없음) → data를 우선 폴백으로 읽는다
      const { title, body } = payload.notification || payload.data || {};
      new Notification(title || "KBAS 알림", { body: body || "", icon: "/icons/icon-192x192.png" });
    }
  });
}

/* ───────── 1회용 토큰 발급 (회원가입 시 사전 등록용) ─────────
   권한 요청 + 토큰 발급만 수행하고 { token, native } 를 반환.
   저장은 호출하는 쪽(가입 문서 setDoc)에서 플랫폼별 배열로 처리한다. */
export async function getFcmTokenOnce() {
  try {
    if (Capacitor.isNativePlatform()) {
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== "granted") return null;
      const { token } = await FirebaseMessaging.getToken();
      return token ? { token, native: true } : null;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await waitForActiveServiceWorker(swReg);
    const { getMessaging, getToken } = await import("firebase/messaging");
    const { getApp } = await import("firebase/app");
    const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    return token ? { token, native: false } : null;
  } catch (e) {
    console.error("FCM 사전 토큰 발급 실패:", e.message);
    return null;
  }
}

/* ───────── 진입점: 환경 자동 분기 ───────── */
export function useFCM(userId) {
  useEffect(() => {
    if (!userId) return;

    const run = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await initNativeFCM(userId);   // iOS / Android 앱
        } else {
          await initWebFCM(userId);      // 브라우저 / PWA
        }
      } catch (e) {
        console.error("FCM 오류:", e.message);
      }
    };

    const timer = setTimeout(run, 2000);
    return () => clearTimeout(timer);
  }, [userId]);
}
