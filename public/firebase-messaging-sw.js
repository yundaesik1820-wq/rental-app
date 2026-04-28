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

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "KBAS 알림", {
    body:  body  || "",
    icon:  "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data:  payload.data || {},
  });
});
