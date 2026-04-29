importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyB_88xj-E67Z8fSvmZPh3F5bDnLF6wA0i4",
  authDomain:        "kbas-equipment-rental.firebaseapp.com",
  projectId:         "kbas-equipment-rental",
  storageBucket:     "kbas-equipment-rental.firebasestorage.app",
  messagingSenderId: "273923618577",
  appId:             "1:273923618577:web:1aee440b351a2feb68beb0",
});

const messaging = firebase.messaging();

// data payload를 받아 직접 알림 표시 (notification payload 없으므로 중복 없음)
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || "KBAS 알림";
  const body  = payload.data?.body  || "";

  self.registration.showNotification(title, {
    body,
    icon:  "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data:  { url: "https://rental-app-delta-kohl.vercel.app" },
  });
});

// 알림 클릭 시 앱 열기
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "https://rental-app-delta-kohl.vercel.app";
  event.waitUntil(clients.openWindow(url));
});
