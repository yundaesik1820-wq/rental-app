import { useState, useEffect, createContext, useContext } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { APP_VERSION } from "../appVersion";

const AuthContext = createContext(null);

// 계정 전환 세션 어긋남 복구 — 네이티브 WebView는 Firebase IndexedDB 세션 쓰기를 늦게
// flush해서, 전환 후 앱을 죽이면 마지막으로 보던 계정 대신 이전 세션이 복원될 수 있음.
// localStorage(동기 저장)에 활성 계정을 기록해 두고, 앱 시작 첫 복원 세션이 다르면
// 저장된 전환 자격증명(linked_creds_*)으로 1회 자동 재로그인해서 맞춰준다.
const ACTIVE_EMAIL_KEY = "active_email";
let sessionRestoreChecked = false; // 앱 실행당 1회만 (무한루프 방지)

// 현재 플랫폼 ('ios' | 'android' | 'web')
function currentPlatform() {
  try {
    if (window.Capacitor && typeof window.Capacitor.getPlatform === "function") {
      return window.Capacitor.getPlatform();
    }
  } catch (e) {}
  return "web";
}

// 이용자별 업데이트 여부 확인용 — 앱 열 때 버전/플랫폼/접속시각 기록 (실패해도 무시)
function reportAppVersion(ref) {
  const platform = currentPlatform();
  updateDoc(ref, {
    appVersion: platform === "web" ? "web" : APP_VERSION,
    platform,
    lastSeenAt: serverTimestamp(),
  }).catch(() => {});
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingError, setPendingError] = useState("");

  useEffect(() => {
    // 안전장치: 어떤 이유로든 auth 초기화가 10초 안에 안 끝나면
    // 로딩을 해제하고 로그인 화면을 보여준다 (무한 스피너 방지)
    const failsafe = setTimeout(() => setLoading(false), 10000);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(failsafe);
      const firstAuthEvent = !sessionRestoreChecked;
      sessionRestoreChecked = true;
      let restoring = false;
      try {
        if (firebaseUser) {
          // 앱 시작 첫 복원 세션이 마지막 활성 계정과 다르면 → 저장된 전환 자격증명으로 복귀
          if (firstAuthEvent) {
            const activeEmail = localStorage.getItem(ACTIVE_EMAIL_KEY);
            if (activeEmail && firebaseUser.email !== activeEmail) {
              let creds = null;
              try { creds = JSON.parse(atob(localStorage.getItem(`linked_creds_${firebaseUser.uid}`) || "")); } catch {}
              if (creds?.email === activeEmail && creds?.pw) {
                try {
                  restoring = true;
                  await signInWithEmailAndPassword(auth, creds.email, creds.pw);
                  return; // 재로그인 성공 → 콜백이 올바른 계정으로 재발화
                } catch { restoring = false; } // 실패(비번 변경 등)면 복원된 세션 그대로 진행
              }
            }
          }
          localStorage.setItem(ACTIVE_EMAIL_KEY, firebaseUser.email || "");
          const ref  = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const p = snap.data();
            // 승인 대기 상태면 로그인 차단
            if (p.status === "pending") {
              setPendingError("관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다.");
              await signOut(auth);
              setUser(null);
              setProfile(null);
              return;
            }
            if (p.status === "rejected") {
              setPendingError("가입이 거절되었습니다. 관리자에게 문의하세요.");
              await signOut(auth);
              setUser(null);
              setProfile(null);
              return;
            }
            if (p.status === "withdrawn") {
              setPendingError("탈퇴 처리된 계정입니다. 관리자에게 문의하세요.");
              await signOut(auth);
              setUser(null);
              setProfile(null);
              return;
            }
            setPendingError("");
            setProfile({ uid: firebaseUser.uid, email: firebaseUser.email, ...p });
            reportAppVersion(ref); // 버전/접속 기록 (비차단)
          }
          setUser(firebaseUser);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (e) {
        // 프로필 조회 등에서 오류가 나도 앱이 멈추지 않도록 처리
        console.error("auth state error:", e);
        setUser(null);
        setProfile(null);
      } finally {
        if (!restoring) setLoading(false); // 복귀 재로그인 중엔 스피너 유지 (로그인 화면 깜빡임 방지)
      }
    });

    return () => { clearTimeout(failsafe); unsub(); };
  }, []);

  const login = async (email, password) => {
    setPendingError("");
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    localStorage.removeItem(ACTIVE_EMAIL_KEY); // 명시적 로그아웃 → 다음 로그인 계정 자유
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, login, logout, pendingError, setPendingError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
