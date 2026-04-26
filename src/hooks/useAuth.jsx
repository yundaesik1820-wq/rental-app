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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
            setLoading(false);
            return;
          }
          if (p.status === "rejected") {
            setPendingError("가입이 거절되었습니다. 관리자에게 문의하세요.");
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          if (p.status === "withdrawn") {
            setPendingError("탈퇴 처리된 계정입니다. 관리자에게 문의하세요.");
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setLoading(false);
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
      setLoading(false);
    });
    return unsub;
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
