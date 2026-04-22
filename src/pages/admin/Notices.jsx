import { useState } from "react";
import { C, NOTICE_CAT } from "../../theme";
import { Card, Btn, Inp, Modal, Empty, PageTitle } from "../../components/UI";
import { useCollection, addItem, deleteItem } from "../../hooks/useFirestore";

export default function Notices({ isAdmin = true }) {
  const { data: notices } = useCollection("notices", "createdAt");
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail]   = useState(null);
  const [form, setForm] = useState({ title: "", content: "", category: "공지", pinned: true });

  const addNotice = async () => {
    if (!form.title || !form.content) return;
    await addItem("notices", { ...form, date: new Date().toISOString().slice(0, 10), author: "관리자" });
    setForm({ title: "", content: "", category: "공지", pinned: true });
    setShowAdd(false);
  };

  const pinned = notices.filter(n => n.pinned);
  const normal = notices.filter(n => !n.pinned);

  const NCard = ({ n }) => {
    const cat = NOTICE_CAT[n.category] || { bg: C.bg, col: C.muted };
    return (
      <Card onClick={() => setDetail(n)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{n.category}</span>
              {n.pinned && <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>📌 고정</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{n.title}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{n.date} · {n.author}</div>
          </div>
          {isAdmin && (
            <button onClick={e => { e.stopPropagation(); deleteItem("notices", n.id); }}
              style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: 4 }}>🗑️</button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle>📢 공지사항</PageTitle>
        {isAdmin && <Btn onClick={() => setShowAdd(true)}>+ 공지 작성</Btn>}
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} width={540}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 20 }}>공지 작성</div>
          <Inp label="제목" placeholder="공지 제목 입력" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>내용</div>
            <textarea placeholder="공지 내용을 입력하세요..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              style={{ display: "block", width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", minHeight: 120, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>카테고리</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["공지", "신규장비", "휴무"].map(c => {
                const ct = NOTICE_CAT[c] || { bg: C.bg, col: C.muted };
                return (
                  <button key={c} onClick={() => setForm(p => ({ ...p, category: c }))} style={{ flex: 1, background: form.category === c ? ct.col : C.bg, color: form.category === c ? "#fff" : C.muted, border: `1px solid ${form.category === c ? ct.col : C.border}`, borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{c}</button>
                );
              })}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, color: C.text }}>📌 상단에 고정</span>
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setShowAdd(false)} color={C.muted} outline full>취소</Btn>
            <Btn onClick={addNotice} full>게시</Btn>
          </div>
        </Modal>
      )}

      {pinned.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10 }}>📌 고정 공지</div>
          {pinned.map(n => <NCard key={n.id} n={n} />)}
        </div>
      )}
      {normal.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>전체 공지</div>
          {normal.map(n => <NCard key={n.id} n={n} />)}
        </div>
      )}
      {notices.length === 0 && <Empty icon="📢" text="공지사항이 없습니다" />}

      {detail && (() => {
        const cat = NOTICE_CAT[detail.category] || { bg: C.bg, col: C.muted };
        return (
          <Modal onClose={() => setDetail(null)} width={540}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ background: cat.bg, color: cat.col, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{detail.category}</span>
              {detail.pinned && <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>📌 고정</span>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, marginBottom: 8, lineHeight: 1.4 }}>{detail.title}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{detail.date} · {detail.author}</div>
            <div style={{ fontSize: 15, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 24 }}>{detail.content}</div>
            <Btn onClick={() => setDetail(null)} color={C.navy} full>닫기</Btn>
          </Modal>
        );
      })()}
    </div>
  );
}
