import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const VAPID_KEY = "BLPGJBCYMn5hajgFcqpus-4noZQwFtpD4pZOV93yWk2cO1dCWEd_iS7m-9qMV2Dr_MtcAlMHjF7EPdY1z8BzNds";

// SW가 active 상태가 될 때까지 대기
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

export function useFCM(userId) {
  useEffect(() => {
    if (!userId) return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;

    const initFCM = async () => {
      try {
        // 1. 알림 권한 요청
        const permission = await Notification.requestPermission();
        console.log("알림 권한:", permission);
        if (permission !== "granted") return;

        // 2. SW 등록
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("SW 등록:", swReg.scope);

        // 3. SW active 대기 (핵심!)
        await waitForActiveServiceWorker(swReg);
        console.log("SW 활성화 완료");

        // 4. FCM 동적 import
        const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
        const { getApp } = await import("firebase/app");
        const msg = getMessaging(getApp());

        // 5. 토큰 발급
        const token = await getToken(msg, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        console.log("FCM 토큰:", token ? "발급 완료" : "발급 실패");

        if (token) {
          await updateDoc(doc(db, "users", userId), { fcmToken: token });
          console.log("Firestore 저장 완료");
        }

        // 6. 포그라운드 알림 - 서비스워커가 처리하므로 중복 방지
        onMessage(msg, (payload) => {
          // 서비스워커가 백그라운드 알림을 처리하므로
          // 포그라운드에서는 별도 알림 생성 안 함 (중복 방지)
          console.log("포그라운드 FCM 수신:", payload.notification?.title);
        });

      } catch (e) {
        console.error("FCM 오류:", e.message);
      }
    };

    const timer = setTimeout(initFCM, 2000);
    return () => clearTimeout(timer);
  }, [userId]);
}
