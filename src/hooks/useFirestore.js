import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy, where, limit as fbLimit,
} from "firebase/firestore";
import { db } from "../firebase";

// 컬렉션 실시간 구독 훅
// opts(선택): { where: [[field, op, value], ...], limit: number, enabled: boolean }
//  - orderField 를 null/false 로 주면 orderBy 생략 → where 단독 쿼리(복합 인덱스 불필요)
//  - enabled:false 면 구독 안 하고 빈 배열 반환(예: 로그인 전 uid 없음)
export function useCollection(collectionName, orderField = "createdAt", opts = null) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify({ collectionName, orderField, opts });

  useEffect(() => {
    if (opts && opts.enabled === false) { setData([]); setLoading(false); return; }
    const parts = [];
    if (opts?.where) for (const [f, op, v] of opts.where) parts.push(where(f, op, v));
    if (orderField) parts.push(orderBy(orderField, "desc"));
    if (opts?.limit) parts.push(fbLimit(opts.limit));
    const q = query(collection(db, collectionName), ...parts);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.warn(`useCollection [${collectionName}] error:`, error.code);
        setLoading(false);
      }
    );
    return unsub;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading };
}

// 문서 추가
export async function addItem(collectionName, data) {
  return addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp() });
}

// 문서 수정
export async function updateItem(collectionName, id, data) {
  return updateDoc(doc(db, collectionName, id), { ...data, updatedAt: serverTimestamp() });
}

// 문서 삭제
export async function deleteItem(collectionName, id) {
  return deleteDoc(doc(db, collectionName, id));
}
