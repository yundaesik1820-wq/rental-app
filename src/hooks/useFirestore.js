import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

// 컬렉션 실시간 구독 훅
export function useCollection(collectionName, orderField = "createdAt") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy(orderField, "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [collectionName, orderField]);

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
