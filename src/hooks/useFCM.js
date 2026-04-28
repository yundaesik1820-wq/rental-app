import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { messaging, VAPID_KEY, db } from "../firebase";

export function useFCM(userId) {
  useEffect(() => {
    if (!userId) return;
    if (!messaging) { console.log("FCM 미지원 환경"); return; }
    if (!("Notification" in window)) return;

    const initFCM = async () => {
      try {
        // 이미 허용된 경우 바로 토큰 등록
        let permission = Notification.permission;

        // 아직 결정 안 된 경우만 팝업 띄움
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }

        if (permission !== "granted") return;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          await updateDoc(doc(db, "users", userId), { fcmToken: token });
          console.log("FCM 토큰 저장 완료");
        }

        // 앱 켜져있을 때 알림
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {};
          new Notification(title || "KBAS 알림", {
            body: body || "",
            icon: "/icons/icon-192x192.png",
          });
        });

      } catch (e) {
        console.log("FCM 초기화 실패:", e.message);
      }
    };

    // 약간의 딜레이 후 실행 (페이지 로드 직후보다 자연스럽게)
    const timer = setTimeout(initFCM, 2000);
    return () => clearTimeout(timer);
  }, [userId]);
}
