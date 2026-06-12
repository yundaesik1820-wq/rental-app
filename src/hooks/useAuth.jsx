import { useState, useEffect, createContext, useContext } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

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
      try {
        if (firebaseUser) {
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
        setLoading(false);
      }
    });

    return () => { clearTimeout(failsafe); unsub(); };
  }, []);

  const login = async (email, password) => {
    setPendingError("");
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, pendingError, setPendingError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
