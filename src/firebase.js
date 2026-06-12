import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase 웹 설정값(공개되어도 안전한 클라이언트 키). 환경변수 대신 직접 지정해
// 웹/앱(Capacitor) 어디서 빌드해도 항상 동일하게 연결되도록 함.
const firebaseConfig = {
  apiKey:            "AIzaSyB_88xj-E67Z8fSvmZPh3F5bDnLF6wA0i4",
  authDomain:        "kbas-equipment-rental.firebaseapp.com",
  projectId:         "kbas-equipment-rental",
  storageBucket:     "kbas-equipment-rental.firebasestorage.app",
  messagingSenderId: "273923618577",
  appId:             "1:273923618577:web:1aee440b351a2feb68beb0",
};

const app = initializeApp(firebaseConfig);
export const auth    = getAuth(app);

// 오프라인 캐시(앱 재진입 시 캐시 즉시 표시) +
// experimentalForceLongPolling: iOS WKWebView에서 Firestore가 멈추지 않도록 통신 방식 강제
export const db      = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);
