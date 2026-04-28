import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const VAPID_KEY = "BLPGJBCYMn5hajgFcqpus-4noZQwFtpD4pZOV93yWk2cO1dCWEd_iS7m-9qMV2Dr_MtcAlMHjF7EPdY1z8BzNds";

export function useFCM(userId) {
  useEffect(() => {
    if (!userId) return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;

    const initFCM = async () => {
      try {
        // 1. 권한 요청
        const permission = await Notification.requestPermission();
        console.log("알림 권한:", permission);
        if (permission !== "granted") return;

        // 2. firebase/messaging을 동적으로 import (빌드 에러 방지)
        const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
        const { getApp } = await import("firebase/app");
        const app = getApp();
        const msg = getMessaging(app);

        // 3. SW 등록 확인
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("SW 등록:", swReg);

        // 4. FCM 토큰 발급
        const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        console.log("FCM 토큰:", token ? "발급 완료" : "발급 실패");

        if (token) {
          await updateDoc(doc(db, "users", userId), { fcmToken: token });
        }

        // 5. 포그라운드 알림
        onMessage(msg, (payload) => {
          const { title, body } = payload.notification || {};
          new Notification(title || "KBAS 알림", {
            body: body || "",
            icon: "/icons/icon-192x192.png",
          });
        });

      } catch (e) {
        console.error("FCM 오류:", e);
      }
    };

    const timer = setTimeout(initFCM, 1500);
    return () => clearTimeout(timer);
  }, [userId]);
}
