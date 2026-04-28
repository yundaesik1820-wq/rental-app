import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { messaging, VAPID_KEY, db } from "../firebase";

export function useFCM(userId) {
  useEffect(() => {
    if (!userId || !messaging) return;

    const initFCM = async () => {
      try {
        // 알림 권한 요청
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // FCM 토큰 발급 및 저장
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          await updateDoc(doc(db, "users", userId), { fcmToken: token });
        }

        // 포그라운드 알림 처리
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {};
          if (Notification.permission === "granted") {
            new Notification(title || "KBAS 알림", {
              body:  body || "",
              icon:  "/icons/icon-192x192.png",
            });
          }
        });
      } catch (e) {
        console.log("FCM 초기화 실패:", e.message);
      }
    };

    initFCM();
  }, [userId]);
}
