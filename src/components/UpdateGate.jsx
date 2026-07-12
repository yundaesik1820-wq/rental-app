import React, { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { C } from "../theme";
import { APP_VERSION, compareVersions } from "../appVersion";

// 현재 플랫폼 ('ios' | 'android' | 'web')
function getPlatform() {
  try {
    if (window.Capacitor && typeof window.Capacitor.getPlatform === "function") {
      return window.Capacitor.getPlatform();
    }
  } catch (e) {}
  return "web";
}
function isNative() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (e) {
    return false;
  }
}

// 스토어 열기 (커스텀 스킴 → OS가 스토어 앱을 직접 열어줌, 별도 플러그인 불필요)
const STORE = {
  ios: "itms-apps://apps.apple.com/app/id6779502423",
  android: "market://details?id=com.kbas.rental",
};

export default function UpdateGate({ children }) {
  const [cfg, setCfg] = useState(null); // { minVersion, enabled, message, iosUrl, androidUrl }

  useEffect(() => {
    // 웹은 항상 Vercel 최신본이라 게이트 불필요 — 네이티브 앱에서만 검사
    if (!isNative()) return;
    const unsub = onSnapshot(
      doc(db, "config", "appVersion"),
      (snap) => setCfg(snap.exists() ? snap.data() : null),
      () => setCfg(null) // 규칙/네트워크 오류 시 앱은 정상 사용 (게이트 안 막음)
    );
    return () => unsub();
  }, []);

  const platform = getPlatform();
  const needUpdate =
    isNative() &&
    cfg &&
    cfg.enabled !== false &&
    cfg.minVersion &&
    compareVersions(APP_VERSION, cfg.minVersion) < 0;

  if (!needUpdate) return children;

  const storeUrl =
    (platform === "ios" && (cfg.iosUrl || STORE.ios)) ||
    (platform === "android" && (cfg.androidUrl || STORE.android)) ||
    cfg.iosUrl ||
    cfg.androidUrl ||
    STORE.ios;

  const openStore = () => {
    try {
      window.location.href = storeUrl;
    } catch (e) {}
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: C.bg,
        color: C.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 28px",
        textAlign: "center",
        paddingTop: "max(env(safe-area-inset-top), 24px)",
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 20 }}>🚀</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        업데이트가 필요해요
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: C.muted,
          maxWidth: 320,
          marginBottom: 28,
          whiteSpace: "pre-line",
        }}
      >
        {cfg.message ||
          "더 안정적인 이용을 위해\n최신 버전으로 업데이트해 주세요.\n\n계속하려면 업데이트가 필요합니다."}
      </div>
      <button
        onClick={openStore}
        style={{
          width: "100%",
          maxWidth: 320,
          padding: "15px 20px",
          borderRadius: 14,
          border: "none",
          background: C.teal,
          color: "#0B0B0E",
          fontSize: 16,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        지금 업데이트
      </button>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 18 }}>
        현재 버전 {APP_VERSION}
      </div>
    </div>
  );
}
