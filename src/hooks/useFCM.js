import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Capacitor } from "@capacitor/core";

const VAPID_KEY = "BLPGJBCYMn5hajgFcqpus-4noZQwFtpD4pZOV93yWk2cO1dCWEd_iS7m-9qMV2Dr_MtcAlMHjF7EPdY1z8BzNds";

/* ───────── 토큰 저장 (웹·네이티브 공통) ───────── */
async function saveToken(userId, token) {
  if (!token) return;
  await updateDoc(doc(db, "users", userId), { fcmToken: token });
  console.log("FCM 토큰 Firestore 저장 완료");
}

/* ───────── iOS / Android 네이티브 푸시 ───────── */
async function initNativeFCM(userId) {
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

  // 1. 권한 요청 (iOS는 시스템 팝업 뜸)
  const perm = await FirebaseMessaging.requestPermissions();
  console.log("네이티브 알림 권한:", perm.receive);
  if (perm.receive !== "granted") return;

  // 2. FCM 토큰 발급 → 저장 (기존 백엔드와 동일한 fcmToken 필드)
  const { token } = await FirebaseMessaging.getToken();
  console.log("네이티브 FCM 토큰:", token ? "발급 완료" : "발급 실패");
  await saveToken(userId, token);

  // 3. 토큰 갱신 대응
  await FirebaseMessaging.addListener("tokenReceived", async (e) => {
    await saveToken(userId, e.token);
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
  await saveToken(userId, token);

  onMessage(msg, (payload) => {
    if (document.visibilityState === "visible") {
      const { title, body } = payload.notification || {};
      new Notification(title || "KBAS 알림", { body: body || "", icon: "/icons/icon-192x192.png" });
    }
  });
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
